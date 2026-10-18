#!/usr/bin/env python3
"""
Legge una richiesta arrivata dalla pagina "Gestisci palestre" (una issue di
GitHub) e aggiorna scraper/venues.json.

Il testo della issue è in ISSUE_BODY. Dentro c'è un blocco ```json``` con:
  {"azione": "aggiungi" | "modifica" | "rimuovi", "link": "...",
   "only_categories": [...], "or_title_contains": [...], "all_day": true/false}

Scrive in GITHUB_OUTPUT:
  slugs   = palestre da scaricare (vuoto se non serve scaricare nulla di nuovo)
  esito   = frase da mettere come commento nella issue
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENUES_FILE = ROOT / "scraper" / "venues.json"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,120}$")


def slug_from(link):
    """Accetta il link intero di Urban Sports oppure solo il nome finale."""
    link = (link or "").strip()
    m = re.search(r"urbansportsclub\.com/(?:[a-z]{2}/)?venues/([^/?#\s]+)", link)
    slug = (m.group(1) if m else link).strip("/").lower()
    return slug if SLUG_RE.match(slug) else None


def clean_list(values):
    out = []
    for v in values or []:
        v = str(v).strip()
        if v and len(v) <= 60 and v not in out:
            out.append(v)
    return out[:20]


def write_venues(venues):
    lines = ",\n".join("  " + json.dumps(v, ensure_ascii=False) for v in venues)
    VENUES_FILE.write_text("[\n" + lines + "\n]\n", encoding="utf-8")


def output(**kw):
    path = os.environ.get("GITHUB_OUTPUT")
    text = "".join(f"{k}<<FINE\n{v}\nFINE\n" for k, v in kw.items())
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(text)
    else:
        print(text)


def fail(msg):
    output(slugs="", esito="❌ " + msg)
    sys.exit(1)


def main():
    body = os.environ.get("ISSUE_BODY", "")
    m = re.search(r"```json\s*(\{.*?\})\s*```", body, re.S)
    if not m:
        fail("Non trovo i dati della richiesta. Usa la pagina \"Gestisci palestre\" del sito.")
    try:
        req = json.loads(m.group(1))
    except json.JSONDecodeError:
        fail("I dati della richiesta non sono leggibili.")

    action = req.get("azione")
    slug = slug_from(req.get("link"))
    if action not in ("aggiungi", "modifica", "rimuovi"):
        fail("Azione sconosciuta.")
    if not slug:
        fail("Il link non sembra un link di una palestra di Urban Sports "
             "(es. https://urbansportsclub.com/en/venues/nome-palestra).")

    venues = json.loads(VENUES_FILE.read_text(encoding="utf-8"))
    idx = next((i for i, v in enumerate(venues) if v["slug"] == slug), None)

    if action == "rimuovi":
        if idx is None:
            fail(f"`{slug}` non è nella lista, non c'è niente da togliere.")
        venues.pop(idx)
        write_venues(venues)
        output(slugs="", esito=f"✅ Tolta la palestra `{slug}`.")
        return

    entry = {"slug": slug}
    cats = clean_list(req.get("only_categories"))
    words = clean_list(req.get("or_title_contains"))
    if cats:
        entry["only_categories"] = cats
        if words:
            entry["or_title_contains"] = words
    elif words:
        # Solo parole nel titolo: nessuna categoria tenuta per intero
        entry["only_categories"] = ["__nessuna__"]
        entry["or_title_contains"] = words
    if req.get("all_day"):
        entry["all_day"] = True

    if idx is None:
        venues.append(entry)
        verb = "Aggiunta"
    else:
        venues[idx] = entry
        verb = "Aggiornata"
    write_venues(venues)
    output(slugs=slug, esito=f"✅ {verb} la palestra `{slug}`: {json.dumps(entry, ensure_ascii=False)}")


if __name__ == "__main__":
    main()
