# plan_26 — calendario personale di lezioni fitness (Berlino)

## Come lavorare con l'utente
- Parla in **italiano semplice**, frasi brevi, niente gergo tecnico: l'utente non è una programmatrice.
- Risposte corte: cosa è cambiato e come provarlo. Niente elenchi di dettagli tecnici.
- Prima di modifiche grandi o ambigue, riassumi cosa hai capito e chiedi conferma. Per quelle piccole e chiare procedi.
- Lavora **direttamente su `main`**: commit + `git push origin main`. Il sito (GitHub Pages, giusteat.github.io/plan_26) si aggiorna in 1–2 minuti.
- Idee rimandate → `IDEE.md`.

## Risparmiare token
- **Non leggere mai `data/corsi.json` per intero** (≈1 MB, 2500 lezioni). Interrogalo con `python3 -c` (json.load + filtri) e stampa solo quello che serve.
- Leggi solo la parte di file che serve (`grep -n` per trovare la funzione, poi Read con offset/limit). La mappa sotto dice dove sta cosa.
- Per provare il sito usa `python3 tools/prova.py` (vedi sotto) invece di scrivere script nuovi. Guarda/manda screenshot solo quando serve davvero.
- Il proxy di questa sandbox blocca urbansportsclub.com: lo scraper non si può provare da qui, gira solo su GitHub Actions.

## File
| File | Cosa fa |
|---|---|
| `index.html` + `app.js` + `style.css` | Calendario. Telefono (≤760px): ricerca, filtri, barra orari, giorni, schede. Computer: griglia oraria 1/4/7 giorni a tutto schermo. |
| `gestisci.html` | Pagina "Gestisci palestre": apre una issue `[palestra] ...` su GitHub. |
| `confronto.html` + `confronto.json` | Confronto prezzi Urban Sports / Wellhub (prezzi scritti a mano nel json). |
| `scraper/scrape.py` | Scarica 14 giorni di orari da Urban Sports (endpoint RSC di Next.js, senza login) → `data/corsi.json`. Env: `FORCE=true`, `ONLY_SLUGS=a,b`. |
| `scraper/venues.json` | Palestre: `slug`, opzionali `only_categories`, `or_title_contains`, `all_day`. |
| `scraper/posti.py` + `.github/workflows/posti.yml` | Posti liberi a richiesta: il pulsante "Posti liberi" (telefono) lancia il workflow con la chiave GitHub salvata nel browser (`ghToken`), solo per le lezioni del giorno guardato che passano i filtri e non sono iniziate → `data/posti.json`. |
| `scraper/richiesta.py` | Legge la issue di gestisci.html e aggiorna venues.json. |
| `.github/workflows/aggiorna.yml` | Scraper ogni 5 giorni o a mano (`forza`). |
| `.github/workflows/palestre.yml` | Parte su issue `[palestra]` del proprietario: richiesta.py + scrape solo di quella palestra. |

## Mappa di `app.js`
- In cima: **REGOLE modificabili** — `CATEGORY_RULES`, `GROUPS`, `COLORS`, `KEEP_CAPS`, `AREAS` (quartiere → casa/lavoro), `LEVEL_ACTS`/`LEVEL_WORDS` (livelli letti dal titolo), `AREA_BTNS`.
- `prep(c)`: arricchisce ogni lezione (date, studio, cat, group, area, levels, key preferito, text per ricerca).
- Preferiti: `favs` (chiave studio|titolo|giorno|ora) + `favT` (insegnante ricordato → "Nuovo insegnante"). Salvati nel browser: copia/incolla per passarli fra dispositivi.
- Pianificate: `agenda` (stessa chiave dei preferiti, ricorrenti); pulsante calendario nei filtri = agenda (`S.agenda`: `matches` ignora tutti gli altri filtri, schede da oggi divise per giorno). Non piaciute: `bad` (chiave studio|titolo|insegnante, scheda grigia, icone solo cuore barrato e apri, non si pianifica più), si segnano tenendo premuta la scheda (`onLongPress` → `openBadMenu`). Icone sulla riga del titolo (♡, 📅, ↗; titolo accorciato con …): `cardIcons`.
- `matches(c, skip)`: tutti i filtri (orari continui, zona, livello, categoria, palestra, piano, preferiti; sul telefono anche ricerca e orari).
- `updateAvailability()`: voci dei filtri grigie e in fondo.
- Filtri: `multi`, `levelFilter`, `planFilter`; costruiti in `init()` in quest'ordine: ♥, Pianificate, Categorie, Palestre, Livello, Orari continui, Piano, zona.
- Telefono: `renderCards` (con la ricerca mostra tutti i giorni da oggi, con titolo del giorno), `renderDays`, `scrollToNow` (all'apertura va alla prima lezione non iniziata, o all'ultima se oggi sono finite). Computer: `layout`, `renderGrid`, `openSheet`.
- Posti liberi: pulsante `#pbtn` a sinistra degli orari, `requestSpots`, `spotsButton`, `spotsText` (oggetto `P`, salvato in `posti`, un risultato per giorno, dimenticato dopo 2 ore: `freshDay`).
- Lezione grigia (`isPast`) appena inizia. Telefono: toccare la scheda non fa niente; l'app Urban Sports si apre solo dall'icona (`CLASS_URL(id)`).

## Dati (`data/corsi.json`)
`{updated, venues: {slug: {name, address, postalCode, district, latitude, longitude, website, image, visitLimits, allDay?}}, classes: [{id, title, teacherName, startDateTimeUTC (in realtà ora di Berlino), endDateTimeUTC, category{id,name}, spots{max}, planTypesB2C, isPlusCheckin, venue}]}`.
Piani: M = Classic, L = Premium (Max ignorato).

## Prove
```
python3 tools/prova.py                 # telefono, ora reale
python3 tools/prova.py --ora 08:33     # finge che sia quell'ora
python3 tools/prova.py --pc            # computer
python3 tools/prova.py --azioni "document.querySelector('#q').value='pole'; document.querySelector('#q').dispatchEvent(new Event('input'))"
node -e "new Function(require('fs').readFileSync('app.js','utf8'))"   # controllo sintassi
```
Se manca playwright: `pip install playwright` (il browser è già in /opt/pw-browsers/chromium, non fare `playwright install`).
