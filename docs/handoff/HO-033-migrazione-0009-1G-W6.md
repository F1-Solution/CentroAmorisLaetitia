# HO-033 — Migrazione `0009` sul database di sviluppo (`1G-W6`)

Fase 1G, wave `1G-W6`. Scritto il 2026-10-26.

La migrazione sul database di sviluppo è un'azione a **conferma obbligatoria** (`CLAUDE.md`,
`PLAN.md` §7 conferma 2). Questo documento chiede una conferma per una sola esecuzione,
**solo sul database di sviluppo locale** `amoris` in Docker. Nessun dato esce dalla
macchina e nessuna email parte.

---

## 1. Perché serve

Con D156 = A (DR-260), «Ultimo aggiornamento» di un documento scaricabile mostra la data
dell'ultima modifica fatta dal CMS. La data sta in una colonna nuova.

| Che cosa | Effetto |
|---|---|
| `ALTER TABLE "documents" ADD COLUMN "modified_at" timestamp with time zone;` | colonna nuova, **vuota** per tutti gli 8 documenti |

Nessun valore esistente cambia, e nessuna riga si aggiunge o si toglie. Le 4 pagine
`/download/…` restano identiche finché nessuno modifica un documento dall'area.

Senza la migrazione, il codice nuovo dell'API non parte sul database di sviluppo. Quindi
non si possono riavviare i server di sviluppo, né eseguire la verifica di 1E-16 e la
cattura di parità della T8.

## 2. Che cosa farò, dopo la tua conferma

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-033-2026-10-26.dump"
docker exec amoris-dev-db-1 sh -c 'pg_restore --list /tmp/copia.dump | grep -c "TABLE DATA"'
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. migrazione 0009
pnpm --filter @amoris/db migrate
```

Poi eseguo i controlli del §3. Non scrivo altro sul database.

## 3. Esito atteso

| Controllo | Prima (lettura del 2026-10-26) | Dopo |
|---|---|---|
| migrazioni applicate | 9 | 10, l'ultima `0009_documenti_data_di_modifica` |
| colonna `documents.modified_at` | assente | presente, vuota per 8 documenti su 8 |
| contenuti, media, documenti, compilazioni | 108, 178, 8, 425 | invariati |
| caroselli, slide | 1, 12 | invariati |

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| copia di salvataggio con errore | mi fermo prima della migrazione e riporto il solo messaggio |
| migrazione con errore | mi fermo, riporto il solo messaggio, non riprovo senza una nuova conferma |
| dati da riportare indietro | `docker cp "$HOME\amoris-backup\amoris-prima-HO-033-2026-10-26.dump" amoris-dev-db-1:/tmp/copia.dump`, poi `docker exec amoris-dev-db-1 sh -c 'pg_restore --clean --if-exists -U $POSTGRES_USER -d $POSTGRES_DB /tmp/copia.dump'` |

Anche senza ripristino si può tornare indietro, perché la colonna è vuota:
`ALTER TABLE documents DROP COLUMN modified_at;`. Ma il codice della wave la richiede.

## 5. Come confermare

```
HO-033: confermo la migrazione 0009 sul database di sviluppo.
```

Se preferisci rimandare: `HO-033: rimandata`. In quel caso la T8 resta ferma.

## 6. Esito (2026-10-26)

Confermata dall'utente con il testo del §5 ed eseguita lo stesso giorno.

| Controllo | Prima | Dopo |
|---|---|---|
| copia di salvataggio | — | `amoris-prima-HO-033-2026-10-26.dump`, 468.180 byte, 34 tabelle con dati |
| migrazioni applicate | 9 | 10 |
| colonna `documents.modified_at` | assente | `timestamp with time zone`, nullabile, vuota per 8 documenti su 8 |
| contenuti, media, documenti, compilazioni | 108, 178, 8, 425 | 108, 178, 8, 425 |
| caroselli, slide | 1, 12 | 1, 12 |
