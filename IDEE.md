# Dubbi e idee future

## Computer
- Sul computer resta per ora il calendario a griglia. Da decidere: usare anche lì le schede come sul telefono
  (con ricerca, barra degli orari e giorni in fila)?
- Con tante palestre la vista a 7 giorni è molto affollata e i corsi non si leggono più.

## Lezioni
- "Posti rimasti" / "Fully booked" come nell'app: non si può con gli orari scaricati ogni 5 giorni.
  Per ora si mostrano i posti totali; per sapere se è pieno si apre la lezione nell'app.
- Foto delle palestre: lo scraper prova a prenderle da Urban Sports. Se non le trova, resta il riquadro colorato con le iniziali.

## Zone
- Icone casa / lavoro decise dal quartiere della palestra su Urban Sports (regola `AREAS` in `app.js`):
  Pankow = casa, Friedrichshain-Kreuzberg = lavoro. Lyra Pankow e SOUL Pankow sono in Pankow ma non a Prenzlauer Berg:
  hanno comunque la casa. Rostudios ha il CAP di Mitte (10119) ma Urban Sports lo mette in Pankow.

## Dati
- `pilates-studio-berlin` non ha dati (nome e indirizzo vuoti): forse il link non è più valido.

- **Posti liberi in tempo reale** (scartata per ora): Urban Sports li dà senza login (`spots.free`), ma non accetta richieste dal sito (niente CORS) → servirebbe un "ponte" (no). Aggiornarli ogni 1–2 ore: dato vecchio e lavoro sprecato (no).

- **Preferiti/pianificate/💔 uguali su telefono e computer** (rimandata): oggi restano nel browser. Idea: sincronizzare con la chiave GitHub dei posti (workflow che salva un file, lettura via API); oppure copia/incolla che passa tutto. Per ora si usa solo il telefono.
