#!/usr/bin/env python3
"""
Posti liberi a richiesta: per le lezioni scelte dal sito (env LEZIONI = id separati
da virgola, GIORNO = AAAA-MM-GG) scarica la pagina del giorno di ogni loro palestra
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
    day = date.fromisoformat(os.environ["GIORNO"])
    ids = {int(x) for x in os.environ["LEZIONI"].split(",") if x.strip().isdigit()}
    classes = json.loads(scrape.OUT_FILE.read_text())["classes"]
    slugs = sorted({c["venue"] for c in classes if c["id"] in ids})
    print(f"{len(ids)} lezioni, {len(slugs)} palestre, giorno {day}")

    session = requests.Session()
    session.headers.update(scrape.HEADERS)
    posti = {}
    for i, slug in enumerate(slugs):
        if i:
            time.sleep(random.uniform(*PAUSE_SECONDS))
        r, err = scrape.fetch_day(session, slug, day)
        got = scrape.extract(r.text) if r is not None else None
        if not got:
            print(f"  {slug}: {err or 'niente dati'}")
            continue
        for item in got[0]:
            if item.get("id") in ids:
                s = item.get("spots") or {}
                posti[str(item["id"])] = {"free": s.get("free"), "max": s.get("max")}
        print(f"  {slug}: ok")

    OUT_FILE.write_text(json.dumps({
        "richiesta": os.environ.get("RICHIESTA", ""),
        "aggiornato": datetime.now(ZoneInfo("Europe/Berlin")).isoformat(timespec="seconds"),
        "giorno": day.isoformat(),
        "posti": posti,
    }, ensure_ascii=False))
    print(f"salvati {len(posti)} posti")


if __name__ == "__main__":
    main()
