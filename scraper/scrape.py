#!/usr/bin/env python3
"""
Scarica gli orari pubblici (senza login) delle palestre elencate in
scraper/venues.json dalle pagine di Urban Sports Club e li salva in
data/usc.json.

Regola: si salvano i dati di Urban Sports con i loro nomi di campo, senza
inventare categorie, emoji o etichette. Uso personale: poche richieste,
con pause tra l'una e l'altra.
"""

import json
import random
import re
import sys
import time
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parent.parent
VENUES_FILE = ROOT / "scraper" / "venues.json"
OUT_FILE = ROOT / "data" / "usc.json"

BASE_URL = "https://urbansportsclub.com/en/venues/"
DAYS_AHEAD = 14             # quanti giorni scaricare (oggi incluso)
PAUSE_SECONDS = (2.0, 4.0)  # pausa casuale tra una richiesta e l'altra

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "RSC": "1",
}

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


def normalize(text):
    """Se arriva una pagina HTML, estrae il testo dei dati dagli script del sito."""
    if '"activities":' in text:
        return text
    chunks = re.findall(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', text)
    joined = ""
    for c in chunks:
        try:
            joined += json.loads(c)
        except json.JSONDecodeError:
            pass
    return joined or text


def value_after(text, key):
    """Legge il valore JSON che segue una chiave, es. "activities":{...}"""
    i = text.find(key)
    if i == -1:
        return None
    j = i + len(key)
    while j < len(text) and text[j] in " \n":
        j += 1
    try:
        obj, _ = json.JSONDecoder().raw_decode(text[j:])
    except json.JSONDecodeError:
        return None
    return obj


def extract(text):
    """Ritorna (corsi, limiti_visite, sito_web) oppure None se mancano gli orari."""
    text = normalize(text)
    activities = value_after(text, '"activities":')
    if not isinstance(activities, dict) or not isinstance(activities.get("classes"), list):
        return None
    limits = value_after(text, '"venueLimits":')
    website = None
    k = text.find('"children":"Website"')
    if k != -1:
        m = re.search(r'"href":"(https?://[^"]+)"', text[k:k + 3000])
        if m:
            website = m.group(1)
    return activities["classes"], limits, website


def build_venue(slug, item, limits, website):
    """Dati della palestra, salvati una volta sola."""
    v = (item or {}).get("venue") or {}
    loc = v.get("location") or {}
    visit_limits = []
    for p in ((limits or {}).get("b2c") or []):
        entry = {k: p.get(k) for k in (
            "name", "planName", "isAvailableAtVenue", "isProvidedByVenue",
            "monthlyLimitVenue", "monthlyLimitVenueAddress")}
        entry["categoryLimits"] = [
            {"id": c.get("id"), "name": c.get("name"), "limit": c.get("limit")}
            for c in (p.get("categoryLimits") or [])]
        visit_limits.append(entry)
    return {
        "slug": slug,
        "id": v.get("id"),
        "name": v.get("name"),
        "address": loc.get("address"),
        "postalCode": loc.get("postalCode"),
        "district": loc.get("displayAddress"),
        "latitude": loc.get("latitude"),
        "longitude": loc.get("longitude"),
        "website": website,
        "visitLimits": visit_limits,
    }


def convert(item, slug):
    """Un corso, con i nomi di campo di Urban Sports."""
    cat = item.get("category") or {}
    flags = item.get("flags") or {}
    return {
        "id": item["id"],
        "title": item["title"],
        "teacherName": item.get("teacherName"),
        "startDateTimeUTC": item["startDateTimeUTC"],  # in realtà ora di Berlino (+02:00 / +01:00)
        "endDateTimeUTC": item["endDateTimeUTC"],
        "category": {"id": cat.get("id"), "name": cat.get("name")},
        "planTypesB2C": item.get("planTypesB2C") or [],
        "isOnline": flags.get("isOnline"),
        "bookingType": item.get("bookingType"),
        "venue": slug,
    }


def load_old():
    if not OUT_FILE.exists():
        return {}
    try:
        return json.loads(OUT_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def main():
    venues_cfg = json.loads(VENUES_FILE.read_text(encoding="utf-8"))
    old = load_old()
    old_classes = old.get("classes", [])
    old_venues = old.get("venues", {})
    today = datetime.now(ZoneInfo("Europe/Berlin")).date()
    days = [today + timedelta(days=i) for i in range(DAYS_AHEAD)]

    session = requests.Session()
    session.headers.update(HEADERS)
    session.cookies.set("usc_city_selected", "1", domain="urbansportsclub.com")

    classes = {}
    venues_out = {}
    venues_ok = 0
    diag_printed = False

    for cfg in venues_cfg:
        slug = cfg["slug"]
        ok_days = 0
        failed_days = []
        last_error = None
        consecutive_fail = 0
        extra = None   # (limiti, sito) dalla prima risposta valida
        first_item = None

        for day in days:
            r, error = fetch_day(session, slug, day)
            result = None
            if r is None:
                last_error = error
            else:
                text = r.content.decode("utf-8", errors="replace")
                result = extract(text)
                if result is None:
                    last_error = "dati degli orari non trovati nella risposta"
                    if not diag_printed:
                        print(f"DIAGNOSI: status={r.status_code} url={r.url} "
                              f"tipo={r.headers.get('content-type')} lunghezza={len(text)}")
                        print(f"    INIZIO RISPOSTA: {text[:600]!r}")
                        diag_printed = True

            if result is None:
                failed_days.append(day)
                consecutive_fail += 1
                if consecutive_fail >= 3:
                    print(f"[{slug}] 3 errori di fila, salto il resto dei giorni")
                    break
            else:
                consecutive_fail = 0
                ok_days += 1
                items, limits, website = result
                if extra is None:
                    extra = (limits, website)
                for item in items:
                    try:
                        c = convert(item, slug)
                    except KeyError:
                        continue
                    if c["startDateTimeUTC"][:10] == day.isoformat():
                        classes[c["id"]] = c
                        if first_item is None:
                            first_item = item
            time.sleep(random.uniform(*PAUSE_SECONDS))

        # Giorni non scaricati: tieni i dati vecchi, se ci sono
        if failed_days:
            failed_iso = {d.isoformat() for d in failed_days}
            for c in old_classes:
                if c.get("venue") == slug and c["startDateTimeUTC"][:10] in failed_iso:
                    classes[c["id"]] = c

        if extra is not None:
            venues_out[slug] = build_venue(slug, first_item, extra[0], extra[1])
        elif slug in old_venues:
            venues_out[slug] = old_venues[slug]

        status = f"{ok_days}/{len(days)} giorni ok"
        if failed_days:
            status += f" | problemi: {last_error}"
        print(f"[{slug}] {status}")
        if ok_days > 0:
            venues_ok += 1

    if venues_ok == 0:
        print("ERRORE: nessuna palestra scaricata. Il file esistente NON viene toccato.")
        sys.exit(1)

    result = sorted(classes.values(), key=lambda c: (c["startDateTimeUTC"], c["venue"]))
    result = [c for c in result if c["startDateTimeUTC"][:10] >= today.isoformat()]

    # Riepilogo da guardare insieme
    print("\nCATEGORIE DI URBAN SPORTS (palestra | id | nome: corsi)")
    for (v, cid, cname), n in sorted(Counter(
            (c["venue"], c["category"]["id"] or 0, c["category"]["name"] or "-") for c in result).items()):
        print(f"    {v} | {cid} | {cname}: {n}")
    print("PIANI (combinazione: corsi)")
    for k, n in sorted(Counter(",".join(c["planTypesB2C"]) or "nessuno" for c in result).items()):
        print(f"    {k}: {n}")
    print("isOnline:", dict(Counter(str(c["isOnline"]) for c in result)))
    print("bookingType:", dict(Counter(str(c["bookingType"]) for c in result)))

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(
        json.dumps({
            "updated": datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="minutes"),
            "venues": venues_out,
            "classes": result,
        }, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"\nSalvati {len(result)} corsi e {len(venues_out)} palestre in {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
