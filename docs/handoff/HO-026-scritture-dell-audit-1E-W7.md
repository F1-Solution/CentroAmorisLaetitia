# HO-026 — Scritture locali dell'audit della `1E-W7`

Fase 1E, wave `1E-W7`. Scritto il 2026-10-18.

L'audit di chiusura riesegue ogni criterio dopo l'ultima correzione (`W7-PLAN.md` T7).
Due verifiche **scrivono** nel database di sviluppo locale `amoris`, e una terza cancella
ciò che le prime hanno scritto: sono azioni a **conferma obbligatoria** (`CLAUDE.md`).
Questo documento chiede una sola conferma, per una sola esecuzione delle tre, **solo in
locale**. Nessuna email (DR-108), nessun pagamento, nessuna chiamata a terzi.

---

## 1. Perché serve

| Verifica | Che cosa scrive | Perché va rifatta |
|---|---|---|
| 1E-19 (`tests/visual/prova-1e-19.ts`) | un salvataggio dal CMS **senza modifiche** di 4 contenuti (stessi `title`, `excerpt`, `blocks`); cambia solo `updated_at` | dopo DR-186 la data di modifica entra nel JSON-LD: va provato che un salvataggio identico lasci la pagina pubblica identica |
| §8 voce 4 (`tests/visual/verifica-accessibilita.ts`) | una compilazione **sintetica** per ogni form che si invia («Prova Sintetica», `prova.sintetica@example.invalid`), al massimo 24 | dopo F1 i 22 form col telefono internazionale devono inviarsi |
| Cancellazione | toglie le compilazioni scritte dalla voce 4 | come HO-024 |

Il resto dell'audit (T1-T3, T5, T6, A-1…A-7 con `SENZA_FORM=1`, confronto visivo, e2e
sul database sintetico `amoris_e2e`) non scrive nel database `amoris`.

## 2. Che cosa farò, dopo la tua conferma

```powershell
# 1. copia di salvataggio, fuori dal repository
docker exec amoris-dev-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -Fc -f /tmp/copia.dump'
docker cp amoris-dev-db-1:/tmp/copia.dump "$HOME\amoris-backup\amoris-prima-HO-026-2026-10-18.dump"
docker exec amoris-dev-db-1 rm /tmp/copia.dump

# 2. 1E-19: 4 salvataggi senza modifiche, confronto della pagina pubblica prima e dopo
pnpm exec tsx tests/visual/prova-1e-19.ts

# 3. voce 4 dei form, con dati sintetici
$env:SITO='http://127.0.0.1:3200'; pnpm exec tsx tests/visual/verifica-accessibilita.ts

# 4. conteggio delle compilazioni sintetiche scritte al passo 3 (senza legacy_id, dall'ora del passo 3)
docker exec amoris-dev-db-1 sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB -Atc "select count(*) from form_submissions where legacy_id is null"'

# 5. cancellazione in una transazione che si annulla se il numero non è quello del passo 4
#    (stesso schema di HO-024, con il numero contato al passo 4)
```

## 3. Esito atteso

| Controllo | Atteso |
|---|---|
| Copia di salvataggio | file `.dump` in `$HOME\amoris-backup\` |
| 1E-19 | 4 contenuti su 4 con pagina pubblica identica; `modified_at` invariata |
| Voce 4 | invio vuoto con messaggi nei 24 form; conferma con dati sintetici in tutti quelli che si inviano; nessuna email |
| Passo 4 | il numero dei form inviati al passo 3 (al massimo 24) |
| Passo 5 | `COMMIT`; dopo, 0 compilazioni senza `legacy_id` |
| Compilazioni importate | 425 prima e dopo |

## 4. Se qualcosa va storto

| Problema | Che cosa faccio |
|---|---|
| 1E-19 con una pagina diversa | mi fermo, riporto la differenza; nessun nuovo tentativo senza analisi |
| Il passo 4 dà più compilazioni dei form inviati | non cancello, ti mostro il conteggio |
| Il passo 5 non dà `COMMIT` | la transazione si annulla, il database resta com'era |
| Serve tornare indietro | `pg_restore --clean` dalla copia del passo 1, su tua conferma |

## 5. Come confermare

```
HO-026: confermo le scritture locali dell'audit e la cancellazione delle compilazioni sintetiche.
```

Se preferisci rimandare: `HO-026: rimandata` (l'audit resta incompleto su 1E-19 e voce 4).
