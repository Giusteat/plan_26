#!/usr/bin/env python3
"""
Scarica gli orari pubblici (senza login) delle palestre elencate in
scraper/venues.json dalle pagine di Urban Sports Club e li salva in
data/corsi.json.

Uso personale: poche richieste, con pause tra l'una e l'altra.
"""

import json
import random
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parent.parent
VENUES_FILE = ROOT / "scraper" / "venues.json"
OUT_FILE = ROOT / "data" / "corsi.json"

BASE_URL = "https://urbansportsclub.com/en/venues/"
DAYS_AHEAD = 14          # quanti giorni scaricare (oggi incluso)
PAUSE_SECONDS = (2.0, 4.0)  # pausa casuale tra una richiesta e l'altra

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "RSC": "1",  # chiede al sito la versione "dati" della pagina
}

EMOJI = {
    "matbarre": "🧘‍♀️",
    "reformer": "➿",
    "pole": "💈",
    "yogasound": "🪷",
    "strength": "🏋️‍♂️",
    "dance": "🩰",
    "calisthenics": "🤸",
}

# Regole per assegnare la categoria dal titolo (si applica la prima che combacia).
CATEGORY_RULES = [
    ("reformer", r"reformer"),
    ("calisthenics", r"calisthenics|handstand|gymnastic|rings|acro"),
    ("matbarre", r"pilates|barre"),
    ("yogasound", r"yoga|yin|sound|gong|mobility|flexib|stretch|meditat|qi ?gong|nidra|fascia|breathe"),
    ("strength", r"strength|conditioning|circuit|cyclica|weight|glutes|sculpt|full body"),
    ("dance", r"ballet|dance|heels|contemporary"),
]
DEFAULT_CATEGORY = "matbarre"


def categorize(title, venue):
    if venue.get("force_category"):
        return venue["force_category"]
    t = title.lower()
    for category, pattern in CATEGORY_RULES:
        if re.search(pattern, t):
            return category
    return DEFAULT_CATEGORY


STATE_TREE = (
    "%5B%22%22%2C%7B%22children%22%3A%5B%5B%22locale%22%2C%22en%22%2C%22d%22%2Cnull%5D%2C"
    "%7B%22children%22%3A%5B%22venues%22%2C%7B%22children%22%3A%5B%5B%22slug%22%2C%22SLUG%22"
    "%2C%22d%22%2Cnull%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0"
    "%5D%7D%2Cnull%2Cnull%2C4%5D%7D%2Cnull%2Cnull%2C8%5D%7D%2Cnull%2Cnull%2C24%5D%7D%2Cnull"
    "%2Cnull%2C8%5D"
)


def fetch_day(session, slug, day):
    """Scarica la pagina-dati di una palestra per un giorno. Ritorna (risposta, errore)."""
    url = BASE_URL + slug
    params = {"view": "new", "date": day.isoformat(), "_rsc": "plan26"}
    extra = {
        "Referer": f"{url}?view=new",
        "Next-Url": f"/en/venues/{slug}",
        "Next-Router-State-Tree": STATE_TREE.replace("SLUG", slug),
    }
    error = "errore sconosciuto"
    for _ in range(2):
        try:
            r = session.get(url, params=params, headers=extra, timeout=30)
        except requests.RequestException as exc:
            error = str(exc)
        else:
            if r.status_code == 200:
                return r, None
            error = f"HTTP {r.status_code}"
            if r.status_code in (403, 429, 503):
                error += " (probabile blocco anti-bot)"
        time.sleep(5)
    return None, error


def _find_classes(text):
    key = '"activities":'
    i = text.find(key)
    if i == -1:
        return None
    j = text.find("{", i)
    if j == -1:
        return None
    try:
        obj, _ = json.JSONDecoder().raw_decode(text[j:])
    except json.JSONDecodeError:
        return None
    classes = obj.get("classes")
    return classes if isinstance(classes, list) else None


def extract_classes(text):
    """Trova nel testo il blocco "activities" e ne ritorna la lista "classes"."""
    result = _find_classes(text)
    if result is not None:
        return result
    # Piano B: se arriva una pagina HTML, i dati stanno dentro self.__next_f.push([1,"..."])
    chunks = re.findall(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', text)
    if chunks:
        joined = ""
        for c in chunks:
            try:
                joined += json.loads(c)
            except json.JSONDecodeError:
                pass
        return _find_classes(joined)
    return None


def describe(r, text):
    history = [h.status_code for h in r.history]
    return (
        f"status={r.status_code} url_finale={r.url} tipo={r.headers.get('content-type')} "
        f"lunghezza={len(text)} redirect={history}\n"
        f"    INIZIO RISPOSTA: {text[:600]!r}"
    )


def convert(item, venue):
    start_raw = item["startDateTimeUTC"]  # es. 2026-10-18T10:30:00+02:00 (ora di Berlino)
    end_raw = item["endDateTimeUTC"]
    class_date = datetime.strptime(start_raw[:10], "%Y-%m-%d").date()
    title = item["title"].strip()
    category = categorize(title, venue)
    spots = item.get("spots") or {}
    return {
        "id": item["id"],
        "title": f"{EMOJI[category]} {title}",
        "studio": venue["name"],
        "teacher": item.get("teacherName") or "N/D",
        "date": class_date.isoformat(),
        "day": class_date.weekday(),  # 0 = lunedì ... 6 = domenica
        "start": start_raw[11:16],
        "end": end_raw[11:16],
        "category": category,
        "spotsFree": spots.get("free"),
        "spotsMax": spots.get("max"),
    }


def load_old_events():
    if not OUT_FILE.exists():
        return []
    try:
        return json.loads(OUT_FILE.read_text(encoding="utf-8")).get("events", [])
    except (json.JSONDecodeError, OSError):
        return []


def main():
    venues = json.loads(VENUES_FILE.read_text(encoding="utf-8"))
    old_events = load_old_events()
    today = datetime.now(ZoneInfo("Europe/Berlin")).date()
    days = [today + timedelta(days=i) for i in range(DAYS_AHEAD)]

    session = requests.Session()
    session.headers.update(HEADERS)

    session.cookies.set("usc_city_selected", "1", domain="urbansportsclub.com")

    events = {}
    venues_ok = 0
    diag_printed = False

    for venue in venues:
        name = venue["name"]
        ok_days = 0
        failed_days = []
        last_error = None

        consecutive_fail = 0
        for day in days:
            r, error = fetch_day(session, venue["slug"], day)
            classes = None
            if r is None:
                last_error = error
            else:
                text = r.content.decode("utf-8", errors="replace")
                classes = extract_classes(text)
                if classes is None:
                    last_error = "dati degli orari non trovati nella risposta"
                    if not diag_printed:
                        print("DIAGNOSI (prima risposta senza orari):")
                        print("    " + describe(r, text))
                        diag_printed = True

            if classes is None:
                failed_days.append(day)
                consecutive_fail += 1
                if consecutive_fail >= 3:
                    print(f"[{name}] 3 errori di fila, salto il resto dei giorni")
                    break
            else:
                consecutive_fail = 0
                ok_days += 1
                for item in classes:
                    try:
                        ev = convert(item, venue)
                    except (KeyError, ValueError):
                        continue
                    if ev["date"] == day.isoformat():
                        events[ev["id"]] = ev
            time.sleep(random.uniform(*PAUSE_SECONDS))

        # Per i giorni non scaricati, tieni i dati vecchi (se ci sono)
        if failed_days:
            failed_iso = {d.isoformat() for d in failed_days}
            for ev in old_events:
                if ev.get("studio") == name and ev.get("date") in failed_iso:
                    events[ev["id"]] = ev

        status = f"{ok_days}/{len(days)} giorni ok"
        if failed_days:
            status += f" | problemi: {last_error}"
        print(f"[{name}] {status}")
        if ok_days > 0:
            venues_ok += 1

    if venues_ok == 0:
        print("ERRORE: nessuna palestra scaricata. Il file esistente NON viene toccato.")
        sys.exit(1)

    result = sorted(events.values(), key=lambda e: (e["date"], e["start"], e["studio"]))
    # niente corsi nel passato
    result = [e for e in result if e["date"] >= today.isoformat()]

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(
        json.dumps(
            {"updated": datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="minutes"),
             "events": result},
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"Salvati {len(result)} corsi in {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
