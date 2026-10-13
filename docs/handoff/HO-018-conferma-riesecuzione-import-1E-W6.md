# HO-018 — Conferma della riesecuzione dell'import in locale (`1E-W6`, famiglie A–D)

Fase 1E, wave `1E-W6`. Scritto il 2026-10-13.

L'import reale è fra le azioni a **conferma obbligatoria** (`CLAUDE.md`): questo
documento chiede una sola conferma, puntuale, per una sola esecuzione.

---

## 1. Perché serve

Le correzioni delle famiglie A, B, C e D cambiano ciò che l'importer scrive. Il
database locale le riceve solo rieseguendo l'import:

| Famiglia | Effetto sul sito dopo l'import | Fonte |
|---|---|---|
| A | I 7 contenuti oggi vuoti (es. `/corsi-2022-2023/`, `/prossimi-corsi/`) tornano con il loro testo, le immagini e i video; `/bacheca/` mostra il messaggio della sorgente | ADR-005 §1, DR-131 |
| B | Le colonne delle pagine nate da Gutenberg si affiancano come nella sorgente (le colonne Divi sono già affiancate) | DR-134 |
| C | I campi dei form tornano nell'ordine della sorgente, con segnaposto, nome e cognome affiancati, email con conferma, logica condizionale (es. testo del bonifico solo scegliendo «Bonifico», pagamento solo scegliendo «PayPal») | DR-132, DR-133 |
| D | L'elenco della home parte dall'articolo più recente, con miniature 100×100, estratto e «leggi tutto», senza data; le date degli articoli pubblicati di sera non slittano più al giorno dopo | DR-130 |
| — | Le classi delle voci di menu restano corrette (già importate oggi) | 1E-W6 |

## 2. Che cosa farò, dopo la tua conferma

Li eseguo **io**, tutto in locale sul database di sviluppo `amoris` in Docker:
nessun dato fuori dalla tua macchina, nessuna email, nessun pagamento.

```powershell
# 1. copia di salvataggio nel contenitore, poi fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-018-2026-10-13.dump"

# 2. verifica: atteso 34
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c TABLE.DATA'
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 3. import
pnpm --filter @amoris/importer start apply --confirm
```

Dopo l'import ricostruisco e riavvio il sito su `http://127.0.0.1:3200`.

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| `ESITO` dell'import | `success`, stessi conteggi dell'esecuzione delle 13:09 di oggi |
| Ripartizione dei contenuti | Gutenberg 57, Divi 47, HTML 4 (ADR-005 §1) |
| Contenuti pubblicati senza blocchi | 0 |
| Blocchi di riserva | entro le soglie (10 %, 15 contenuti) |
| `python tests/visual/stati-matrice.py` | 292 conformi, 0 difformi |
| Home, `/corsi-2022-2023/`, `/registrazione-sguardi-damore/` a vista | come la sorgente nelle parti corrette |

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Esito diverso da `success` | mi fermo, riporto le anomalie (solo codici e conteggi) e non riprovo senza nuova conferma |
| Dati da riportare indietro | ripristino la copia: `docker cp <copia>.dump amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'` |

## 5. Rischi

- **Privacy:** nessun dato nuovo entra nel database: cambia solo la forma di ciò che
  c'è già. Il testo del bonifico resta nella definizione del form, come nella
  sorgente, e si mostra solo con la scelta «Bonifico».
- **Dati reali:** le 425 compilazioni storiche non cambiano, l'import le salta.

## 6. Come confermare

Scrivi nel prompt successivo:

```
HO-018: confermo la riesecuzione dell'import in locale.
```

Se preferisci rimandare: `HO-018: rimandata`. Le correzioni A, C e D e le colonne
Gutenberg resteranno invisibili sul sito fino all'import.

---

## 7. Esito (2026-10-13)

Confermato dall'utente ed eseguito. Copia in `$HOME\amoris-backup\amoris-prima-HO-018-2026-10-13.dump` (34 tabelle). Import `success`, ripartizione 56/47/5 (`/bacheca/`, D58), blocchi di riserva 2,10 %, contenuti senza blocchi 0, stati-matrice 292/292. Verifica a vista e confronto in `docs/qa/confronto/classificazione.md` §4.
