#!/usr/bin/env python3
"""
Prova il sito in un browser finto e salva gli screenshot.

    python3 tools/prova.py [--ora HH:MM] [--pc] [--azioni "js; js"] [--out cartella]

Default: telefono 400x860, ora reale. Stampa errori JS, numero di schede/eventi
e salva telefono.png (o pc.png) nella cartella --out (default: scratchpad o /tmp).
--azioni: JavaScript da eseguire dopo il caricamento (es. "document.querySelector('.dy:nth-child(2)').click()").
"""
import argparse
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("--ora", help="ora finta di oggi, es. 08:33")
ap.add_argument("--pc", action="store_true", help="schermo da computer invece del telefono")
ap.add_argument("--azioni", default="", help="JavaScript da eseguire dopo il caricamento")
ap.add_argument("--pagina", default="index.html")
ap.add_argument("--out", default=os.environ.get("PROVA_OUT", "/tmp"))
a = ap.parse_args()

with socket.socket() as s:
    s.bind(("", 0))
    port = s.getsockname()[1]
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port)], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
        if a.pc:
            ctx = b.new_context(viewport={"width": 1300, "height": 800}, timezone_id="Europe/Berlin")
        else:
            ctx = b.new_context(viewport={"width": 400, "height": 860}, device_scale_factor=2,
                                is_mobile=True, has_touch=True, timezone_id="Europe/Berlin")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        if a.ora:
            from datetime import datetime
            from zoneinfo import ZoneInfo
            h, m = map(int, a.ora.split(":"))
            pg.clock.set_fixed_time(datetime.now(ZoneInfo("Europe/Berlin")).replace(hour=h, minute=m, second=0))
        pg.goto(f"http://localhost:{port}/{a.pagina}")
        pg.wait_for_timeout(1500)
        for js in filter(None, (x.strip() for x in a.azioni.split(";"))):
            pg.evaluate(js)
            pg.wait_for_timeout(300)
        print("schede:", pg.locator(".card").count(), "| eventi griglia:", pg.locator(".ev").count(),
              "| scrollY:", pg.evaluate("scrollY"))
        out = Path(a.out) / ("pc.png" if a.pc else "telefono.png")
        pg.screenshot(path=str(out))
        print("screenshot:", out)
        print("errori JS:", errs or "nessuno")
        b.close()
finally:
    srv.terminate()
