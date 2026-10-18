# HO-024 — Cancellazione delle compilazioni sintetiche delle prove (`1E-W7`, T4)

Fase 1E, wave `1E-W7`. Scritto il 2026-10-17.

Le cancellazioni sono fra le azioni a **conferma obbligatoria** (`CLAUDE.md`, `W7-PLAN.md`
R7-3). Questo documento chiede una sola conferma, per una sola esecuzione, **solo sul
database di sviluppo locale** `amoris` in Docker.

---

## 1. Perché serve

Nella T4, la voce 4 del §8 invia ogni form con **dati sintetici** («Prova Sintetica»,
`prova.sintetica@example.invalid`). Nessuna email è partita (DR-108). Due invii sono
andati a buon fine e hanno scritto **2 righe** in `form_submissions`:

| Form | Pagina |
|---|---|
| modulo di contatto | `/contatti/` |
| registrazione al corso Caritas | `/registrazione-corso-caritas-fare-bene-il-bene/` |

Conteggio in sola lettura del 2026-10-17: 2 righe senza `legacy_id` (cioè non
importate dalla sorgente), registrate fra le 14:14 e le 14:26 UTC. Le compilazioni
importate hanno tutte un `legacy_id` e non vengono toccate.

## 2. Che cosa farò, dopo la tua conferma

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-024-2026-10-17.dump"
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. controllo: atteso 2
docker exec amoris-dev-db-1 sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -Atc "select count(*) from form_submissions where legacy_id is null and submitted_at >= timestamptz ''2026-10-17 14:00:00+00''"'

# 3. cancellazione, in una transazione che si annulla se le righe non sono esattamente 2
docker exec amoris-dev-db-1 sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1 -c "begin; do \$\$ declare n int; begin delete from form_submissions where legacy_id is null and submitted_at >= timestamptz ''2026-10-17 14:00:00+00''; get diagnostics n = row_count; if n <> 2 then raise exception ''righe cancellate: %'', n; end if; end \$\$; commit;"'
```

Se una tabella collegata impedisce la cancellazione (vincolo `restrict`), non forzo
niente: mi fermo e ti scrivo che cosa la trattiene.

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| Copia di salvataggio | file `.dump` in `$HOME\amoris-backup\` |
| Passo 2 | `2` |
| Passo 3 | `COMMIT` |
| Stesso conteggio dopo | `0` |
| Compilazioni importate | numero invariato |

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| Il passo 2 non dà 2 | mi fermo senza cancellare e ti mostro il conteggio |
| Il passo 3 non dà `COMMIT` | la transazione si annulla e il database resta com'era; ti mostro l'errore |
| Serve tornare indietro | `pg_restore --clean` dalla copia del passo 1, su tua conferma |

## 5. Come confermare

Scrivi: **«HO-024: confermo la cancellazione delle 2 compilazioni sintetiche»**. La
conferma vale per questa sola esecuzione. Se preferisci tenerle per ora, scrivi
«HO-024: rinviata». Nelle prossime prove i form con dati sintetici scriveranno righe
nuove, e servirà un handoff come questo.

---

## 6. Esito (2026-10-18)

Confermato dall'utente («HO-024 confermo la cancellazione») ed eseguito sul database
locale `amoris`.

| Controllo | Esito |
|---|---|
| Copia di salvataggio | `$HOME\amoris-backup\amoris-prima-HO-024-2026-10-18.dump`, 464 612 byte |
| Passo 2 | `2` |
| Passo 3 | `COMMIT` |
| Stesso conteggio dopo | `0` |
| Compilazioni importate | 425 prima e dopo |
