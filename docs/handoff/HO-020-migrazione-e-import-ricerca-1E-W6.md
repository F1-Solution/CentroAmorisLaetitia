# HO-020 — Conferma di migrazione e import in locale (`1E-W6`, ricerca E3)

Fase 1E, wave `1E-W6`. Scritto il 2026-10-14.

Migrazione del database e import reale sono fra le azioni a **conferma
obbligatoria** (`CLAUDE.md`). Questo documento chiede una sola conferma, per una
sola esecuzione, **solo sul database di sviluppo locale** `amoris` in Docker.

---

## 1. Perché serve

La ricerca del sito (DR-144) elenca anche i 4 download pubblici, con la loro data,
come la sorgente. I documenti oggi non hanno una data: la migrazione `0004` aggiunge
la colonna `documents.published_at` (vuota), l'import la riempie dalla data del
post nella sorgente.

Finché la migrazione non è applicata, l'API con il codice nuovo **non va
riavviata**: leggerebbe una colonna che non esiste.

## 2. Che cosa farò, dopo la tua conferma

Tutto in locale: nessun dato fuori dalla tua macchina, nessuna email, nessun pagamento.

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-020-2026-10-14.dump"
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c TABLE.DATA'   # atteso 34
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. migrazione 0004: colonna documents.published_at
pnpm --filter @amoris/db migrate

# 3. import
pnpm --filter @amoris/importer start apply --confirm
```

Poi riavvio API e sito su `http://127.0.0.1:3002` e `http://127.0.0.1:3200`.

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| Migrazione | `0004_data_dei_documenti` applicata, nessun errore |
| `ESITO` dell'import | `success`, conteggi come HO-019, ripartizione 57/47/4 |
| `documents.published_at` | valorizzata per gli 8 documenti; i 4 pubblici al 5 aprile 2022, come la sorgente |
| `python tests/visual/stati-matrice.py` | 292 conformi, 0 difformi |
| Ricerca | stessi risultati della sorgente per una serie di frasi di prova (vedi §4) |

Dopo: verifica a vista della testata con la ricerca aperta, ricattura integrale
(588 catture: le 585 più `/?s=corso` a 3 viewport) e nuovo confronto della `1E-W6`.

## 4. Frasi di prova per la ricerca

`corso`, frase vuota, `famiglia`, `corso consulenti`, `Corso Per`, `perché`,
`-corso`, `consulente familiare`, `modulo`. Per ognuna confronto l'elenco degli
indirizzi della sorgente (`http://localhost:8088/?s=…`, tutte le pagine) con il
nostro. Differenze attese e già note: WordPress cerca anche nel contenuto grezzo
(attributi e shortcode), il sito nel testo visibile; con date uguali l'ordine
della sorgente non è stabile fra una pagina e l'altra.

## 5. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Migrazione fallita | mi fermo; la migrazione è in una transazione, nulla da riportare indietro |
| Import con esito diverso da `success` | mi fermo, riporto solo codici e conteggi, non riprovo senza nuova conferma |
| Dati da riportare indietro | `docker cp <copia>.dump amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'` |

## 6. Rischi

- **Privacy:** entra solo una data per documento; i 4 documenti riservati restano
  esclusi dalla ricerca e irraggiungibili (DR-033).
- **Dati reali:** le 425 compilazioni storiche non cambiano, l'import le salta.
- **Schema:** colonna nullable, senza valore predefinito; nessun effetto sul resto.

## 7. Come confermare

```
HO-020: confermo migrazione e import in locale.
```

Se preferisci rimandare: `HO-020: rimandata`. La ricerca resta provata solo sul
banco di prova, non sul sito locale.
