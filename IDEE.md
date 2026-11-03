# Dubbi e idee future

## Lezioni
- Foto delle palestre: lo scraper prova a prenderle da Urban Sports. Se non le trova, resta il riquadro colorato con le iniziali.

## Zone
- Icone casa / lavoro decise dal quartiere della palestra su Urban Sports (regola `AREAS` in `app.js`):
  Pankow = casa, Friedrichshain-Kreuzberg = lavoro. Lyra Pankow e SOUL Pankow sono in Pankow ma non a Prenzlauer Berg:
  hanno comunque la casa. Rostudios ha il CAP di Mitte (10119) ma Urban Sports lo mette in Pankow.

## Dati
- `pilates-studio-berlin` non ha dati (nome e indirizzo vuoti): forse il link non è più valido.

- **Posti liberi in tempo reale** (scartata per ora): Urban Sports li dà senza login (`spots.free`), ma non accetta richieste dal sito (niente CORS) → servirebbe un "ponte" (no). Aggiornarli ogni 1–2 ore: dato vecchio e lavoro sprecato (no).

- **Preferiti/pianificate/💔 uguali su telefono e computer** (rimandata): oggi restano nel browser. Idea: sincronizzare con la chiave GitHub dei posti (workflow che salva un file, lettura via API); oppure copia/incolla che passa tutto. Per ora si usa solo il telefono.
