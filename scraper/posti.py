#!/usr/bin/env python3
"""
Posti liberi a richiesta: per le lezioni scelte dal sito (env LEZIONI = id separati
da virgola, anche di più giorni) scarica la pagina di ogni loro palestra e giorno
e salva in data/posti.json solo i posti di quelle lezioni.
"""

import json
import os
import random
import time
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

import scrape

ROOT = Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "data" / "posti.json"
PAUSE_SECONDS = (1.0, 2.0)   # poche palestre, pausa breve


def main():
    ids = {int(x) for x in os.environ["LEZIONI"].split(",") if x.strip().isdigit()}
    classes = json.loads(scrape.OUT_FILE.read_text())["classes"]
    # una pagina per ogni coppia (palestra, giorno) che contiene lezioni richieste
    coppie = sorted({(c["venue"], c["startDateTimeUTC"][:10]) for c in classes if c["id"] in ids})
    giorni = sorted({g for _, g in coppie})
    print(f"{len(ids)} lezioni, {len(coppie)} pagine, giorni {giorni}")

    session = requests.Session()
    session.headers.update(scrape.HEADERS)
    posti = {}
    for i, (slug, g) in enumerate(coppie):
        if i:
            time.sleep(random.uniform(*PAUSE_SECONDS))
        r, err = scrape.fetch_day(session, slug, date.fromisoformat(g))
        got = scrape.extract(r.text) if r is not None else None
        if not got:
            print(f"  {slug} {g}: {err or 'niente dati'}")
            continue
        for item in got[0]:
            if item.get("id") in ids:
                s = item.get("spots") or {}
                posti[str(item["id"])] = {"free": s.get("free"), "max": s.get("max")}
        print(f"  {slug} {g}: ok")

    OUT_FILE.write_text(json.dumps({
        "richiesta": os.environ.get("RICHIESTA", ""),
        "aggiornato": datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="seconds"),
        "giorni": giorni,
        "posti": posti,
    }, ensure_ascii=False))
    print(f"salvati {len(posti)} posti")


if __name__ == "__main__":
    main()
