# HO-023 — Migrazione `0006` e import in locale (`1E-W6`, famiglie dopo DR-154)

Fase 1E, wave `1E-W6`. Scritto il 2026-10-16.

Migrazione e import reale sono fra le azioni a **conferma obbligatoria** (`CLAUDE.md`).
Questo documento chiede una sola conferma, per una sola esecuzione, **solo sul database
di sviluppo locale** `amoris` in Docker.

---

## 1. Perché serve

Il codice approvato con DR-157, DR-158 e DR-161 è scritto e provato; una parte si vede
solo con dati nuovi:

| Punto | Che cosa porta l'import |
|---|---|
| D71 (DR-155, DR-158) | colonna `contents.summary_source`: il testo da cui la sorgente contava l'estratto. Prova sul dump: **67 estratti su 68** identici alla sorgente in archivio e ricerca (l'unico diverso ha un byte non valido nel testo della sorgente) |
| R | margini personalizzati di Divi (`-23px`, `-27px`, `10px`, `30px`) e `padding: 0` di 5 righe |
| U1 | scelte in linea dei form (`input_columns`) |
| T | campi a tutta riga del modulo di contatto (`fullwidth_field`) |
| D75 (DR-161) | l'API espone data e dimensione dei download: va riavviata, e la nuova API legge la colonna di D71 |

Gli stili Q, N, P, S, V sono già attivi sul sito in locale.

## 2. Che cosa farò, dopo la tua conferma

Tutto in locale: nessun dato fuori dalla tua macchina, nessuna email, nessun pagamento.

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-023-2026-10-16.dump"
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c "TABLE DATA"'   # atteso 34
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. migrazione 0006 (una colonna nullable, nessun dato toccato)
pnpm --filter @amoris/db migrate

# 3. import
pnpm --filter @amoris/importer start apply --confirm
```

Poi riavvio l'API su `127.0.0.1:3002`, ricompilo e riavvio il sito su `127.0.0.1:3200`,
e passo a ricattura, confronto e report visivo.

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| Migrazione | `0006_estratto_della_sorgente` applicata |
| `ESITO` dell'import | `success`, ripartizione 57/47/4, verifiche a zero |
| `summary_source` | valorizzata in tutti i contenuti importati |
| Estratti di archivio e ricerca | uguali alla sorgente, salvo l'articolo con il byte non valido e la voce di DR-063 |
| `python tests/visual/stati-matrice.py` | 292 conformi, 0 difformi |
| `/contatti/`, `/diventa-socio/`, download | modulo Divi a due colonne, scelte in linea, scheda del pacchetto |

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Migrazione o import con esito diverso da `success` | mi fermo, riporto solo codici e conteggi, non riprovo senza nuova conferma |
| Dati da riportare indietro | `docker cp <copia>.dump amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'`; la colonna in più resta vuota e non dà fastidio |

## 5. Rischi

- **Privacy:** nessun dato nuovo; `summary_source` ripete l'inizio di testi già
  pubblici. La scheda dei download **non** mostra il contatore (DR-161).
- **Dati reali:** le 425 compilazioni storiche non cambiano, l'import le salta.
- **Editor:** i documenti salvati prima dell'import non hanno il campo `margin` e
  l'editor li segnala come «non in forma canonica» finché l'import non li riscrive.

## 6. Come confermare

```
HO-023: confermo migrazione e import in locale.
```

Se preferisci rimandare: `HO-023: rimandata`.
