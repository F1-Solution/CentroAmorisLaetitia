# HO-019 — Conferma di migrazione e import in locale (`1E-W6`, famiglie G, D58, D59)

Fase 1E, wave `1E-W6`. Scritto il 2026-10-13.

Migrazione del database e import reale sono fra le azioni a **conferma
obbligatoria** (`CLAUDE.md`). Questo documento chiede una sola conferma, per una
sola esecuzione, **solo sul database di sviluppo locale** `amoris` in Docker.

---

## 1. Perché serve

| Correzione | Che cosa cambia sul sito | Fonte |
|---|---|---|
| G | Barra laterale e filetto solo dove la sorgente li mostra: 13 pagine e 11 articoli con la barra, gli altri senza; articoli Divi a tutta larghezza con le sezioni da bordo a bordo | DR-139 |
| D58 | `/bacheca/` torna Gutenberg nella ripartizione: 57/47/4 | DR-136 |
| D59 | Le immagini Gutenberg «grandi» di 9 contenuti mostrano la dimensione scelta nella sorgente | DR-138 |

Le altre correzioni (K, C+, M, L) sono già attive: non dipendono dai dati.

## 2. Che cosa farò, dopo la tua conferma

Tutto in locale: nessun dato fuori dalla tua macchina, nessuna email, nessun pagamento.

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-019-2026-10-13.dump"
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c TABLE.DATA'   # atteso 34
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. migrazione 0003: tipo page_layout e colonna contents.page_layout
pnpm --filter @amoris/db migrate

# 3. import
pnpm --filter @amoris/importer start apply --confirm
```

Poi riavvio API e sito su `http://127.0.0.1:3002` e `http://127.0.0.1:3200`.

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| Migrazione | `0003_layout_della_pagina` applicata, nessun errore |
| `ESITO` dell'import | `success`, conteggi come HO-018 |
| Ripartizione | Gutenberg 57, Divi 47, HTML 4 |
| `page_layout` dei contenuti pubblicati | pagine: 13 `right_sidebar`, 36 `full_width`, 29 `no_sidebar`; articoli: 11, 15, 2 |
| `python tests/visual/stati-matrice.py` | 292 conformi, 0 difformi |
| A vista | `/bacheca-degli-eventi/` e un articolo con barra: filetto a 245,7 px da destra a 1440; `/convegno-17-febbraio-2018/` a tutta larghezza; `/corsi-2022-2023/` senza barra |

Dopo: ricattura integrale 585/585 e nuovo confronto della `1E-W6`.

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Migrazione fallita | mi fermo; nulla da riportare indietro, la migrazione è in una transazione |
| Import con esito diverso da `success` | mi fermo, riporto solo codici e conteggi, non riprovo senza nuova conferma |
| Dati da riportare indietro | `docker cp <copia>.dump amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'` |

## 5. Rischi

- **Privacy:** nessun dato nuovo entra nel database; cambia la forma di ciò che c'è.
- **Dati reali:** le 425 compilazioni storiche non cambiano, l'import le salta.
- **Schema:** la colonna nuova ha un valore predefinito (`right_sidebar`): fra
  migrazione e import, per pochi secondi, ogni contenuto avrebbe la barra.

## 6. Come confermare

```
HO-019: confermo migrazione e import in locale.
```

Se preferisci rimandare: `HO-019: rimandata`. G, D58 e D59 restano invisibili fino ad allora.
