"""Prova temporanea: Urban Sports dà i posti rimasti? E accetta richieste dal sito giusteat.github.io?"""
import json, sys
from datetime import date
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scraper"))
import requests
import scrape

slug = "lyra-prenzlauerberg"
s = requests.Session(); s.headers.update(scrape.HEADERS)
r, err = scrape.fetch_day(s, slug, date.today())
print("risposta:", err or r.status_code)
if r is not None:
    got = scrape.extract(r.text)
    if got:
        classes = got[0]
        print("lezioni:", len(classes))
        print("chiavi di una lezione:", sorted(classes[0].keys()))
        for c in classes[:5]:
            print(c.get("title"), "| spots:", json.dumps(c.get("spots")), "| altri:", {k: v for k, v in c.items() if any(w in k.lower() for w in ("spot", "avail", "book", "free", "capac", "full", "wait"))})
    else:
        print("niente lezioni estratte")

url = scrape.BASE_URL + slug
origin = "https://giusteat.github.io"
print("\n--- prova dal sito (CORS) ---")
o = requests.options(url, headers={"Origin": origin, "Access-Control-Request-Method": "GET",
                                    "Access-Control-Request-Headers": "rsc,next-router-state-tree,next-url"}, timeout=30)
print("OPTIONS", o.status_code, {k: v for k, v in o.headers.items() if k.lower().startswith("access-control")})
g = requests.get(url, params={"view": "new", "date": date.today().isoformat()}, headers={"Origin": origin, "User-Agent": scrape.HEADERS["User-Agent"]}, timeout=30)
print("GET semplice", g.status_code, {k: v for k, v in g.headers.items() if k.lower().startswith("access-control")})
