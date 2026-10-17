# HO-021 — Conferma di migrazione e import in locale (`1E-W6`, D66 e D69)

Fase 1E, wave `1E-W6`. Scritto il 2026-10-14.

Migrazione del database e import reale sono fra le azioni a **conferma
obbligatoria** (`CLAUDE.md`). Questo documento chiede una sola conferma, per una
sola esecuzione, **solo sul database di sviluppo locale** `amoris` in Docker.

---

## 1. Perché serve

- **D69 (DR-149).** La migrazione `0005` aggiunge la colonna `contents.gutter_width`
  (vuota, valori 1–4). L'import la riempie da `_et_pb_gutter_width`: nella sorgente
  vale 2 in 27 contenuti e 3 solo in `/chi-siamo/`, che così ritrova il margine del
  piè di pagina.
- **D66 (DR-146).** L'import riscrive `content_text` con i paragrafi separati da un a
  capo: la ricerca di «Corso Per» torna nell'ordine della sorgente.

Finché la migrazione non è applicata, l'API con il codice nuovo **non va
riavviata**: leggerebbe una colonna che non esiste. Il sito è già aggiornato e funziona
anche con l'API attuale.

## 2. Che cosa farò, dopo la tua conferma

Tutto in locale: nessun dato fuori dalla tua macchina, nessuna email, nessun pagamento.

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-021-2026-10-14.dump"
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c "TABLE DATA"'   # atteso 34
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. migrazione 0005: colonna contents.gutter_width
pnpm --filter @amoris/db migrate

# 3. import
pnpm --filter @amoris/importer start apply --confirm
```

Poi riavvio l'API su `http://127.0.0.1:3002` (il sito su `:3200` è già aggiornato).

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| Migrazione | `0005_spaziatura_della_pagina` applicata, nessun errore |
| `ESITO` dell'import | `success`, conteggi come HO-020, ripartizione 57/47/4, chiavi meta non classificate 0 |
| `contents.gutter_width` | 3 per `/chi-siamo/`; 2 per i contenuti che lo indicano; vuota per gli altri |
| `/chi-siamo/` sopra i 980 px | classe `et_pb_gutters3`, piè di pagina alto come la sorgente (226 px a 1440) |
| Ricerca «Corso Per» | ordine dei risultati comuni identico alla sorgente |
| `python tests/visual/stati-matrice.py` | 292 conformi, 0 difformi |

Dopo: misura di `/chi-siamo/` alle 5 viewport, confronto della ricerca e ricattura
delle sole coppie di `/chi-siamo/` nel confronto completo.

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Migrazione fallita | mi fermo; la migrazione è in una transazione, nulla da riportare indietro |
| Import con esito diverso da `success` | mi fermo, riporto solo codici e conteggi, non riprovo senza nuova conferma |
| Dati da riportare indietro | `docker cp <copia>.dump amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'` |

## 5. Rischi

- **Privacy:** entra solo un numero da 1 a 4 per contenuto; il testo di ricerca cambia
  solo negli a capo.
- **Dati reali:** le 425 compilazioni storiche non cambiano, l'import le salta.
- **Schema:** colonna nullable con vincolo 1–4, senza valore predefinito.

## 6. Come confermare

```
HO-021: confermo migrazione e import in locale.
```

Se preferisci rimandare: `HO-021: rimandata`. `/chi-siamo/` resta con il margine della
spaziatura 2 e la ricerca «Corso Per» con l'ordine attuale.
