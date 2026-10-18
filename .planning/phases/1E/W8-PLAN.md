# Piano della wave 1E-W8 — Rapporto, audit, richiesta di UAT

> **Per chi esegue:** sotto-skill richiesta `superpowers:executing-plans` (o
> `superpowers:subagent-driven-development`). Passi con caselle `- [ ]`.
> Protocollo `PROGRESS.md`: un commento datato dopo ogni attività, una sola riga
> `STATUS:complete` a fine wave.

Scritto il 2026-10-18, dopo la chiusura della `1E-W7` (DR-206, commit `8be9e7b`, non
ancora pubblicato).

**Obiettivo:** raccogliere in `AUDIT.md` l'esito eseguito di ogni criterio di uscita
della Fase 1E, completare `docs/qa/visual-parity-report.md` e portare all'utente la UAT
di parità, senza dichiarare la parità al suo posto.

**Architettura:** nessun codice nuovo. Si rieseguono le verifiche brevi e si citano,
con data e commit, quelle lunghe già eseguite sul codice attuale (**D107**). L'unica
modifica ai sorgenti è la formattazione Prettier che oggi fa fallire la CI (1E-18).

**Stack:** gli script esistenti di `tests/visual/` e `tests/e2e/`, Prettier del
repository, `gh` per leggere la CI. **Nessuna dipendenza nuova.**

**Riferimenti:** `CONTEXT.md` §7, `PLAN.md` §1 e §7, `W7-PLAN.md`,
`docs/qa/verifiche/audit-1E-W7.md`, `docs/handoff/HO-016-uat-di-parita-1E-W8.md`,
skill `deployment-gate` (condizioni 10, 12 e 13).

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W8-1 | Ogni criterio di `CONTEXT.md` §7 (1E-1…1E-19, A-1…A-8) ha in `AUDIT.md` esito, prova, data e commit | tabella senza celle vuote; nessun esito «da eseguire» |
| W8-2 | 1E-18 verde **anche in CI** | `gh run list` sul commit pubblicato: `success` |
| W8-3 | Rapporto di parità completo | `visual-parity-report.md` con i numeri dell'ultimo confronto, le difformità accettate (DR-162, DR-203, DR-204 e le nominative), le maschere, l'ambiente; nessuna voce «da completare» |
| W8-4 | UAT richiesta | HO-016 aggiornato e attivo; risposta dell'utente registrata con le sue parole nel rapporto e nel registro |

La riga `STATUS:complete` si scrive dopo W8-4, con la UAT approvata. Se la UAT non è
approvata, le differenze segnalate si correggono col metodo della `1E-W6` (analisi
d'impatto, prove, ricattura delle viste toccate) e la UAT si ripete su quelle.

## 2. Fatti accertati il 2026-10-18

| Fatto | Fonte |
|---|---|
| La CI di `1a107c0` è fallita solo su `pnpm format:check`; quella di `3a9ea79` pure è rossa | `gh run list`, run 39005370966 |
| Su `8be9e7b` 10 file non rispettano Prettier (a capo esclusi): `apps/admin/src/lib/editor/tree.ts`, `apps/api/tests/publicSearch.test.ts`, `apps/importer/src/convert/shared/meta-description.ts`, `apps/importer/src/stages/seo/index.ts`, `apps/importer/src/stages/settings/definitions.ts`, `apps/importer/tests/unit/convert/metaDescription.test.ts`, `apps/importer/tests/unit/stages/contentsStage.test.ts`, `apps/importer/tests/unit/stages/seoStage.test.ts`, `tests/visual/misura-testata-piede.ts`, `tests/visual/ricerca-aperta.ts` | `prettier --check . --end-of-line auto` |
| Dopo l'audit della `1E-W7` il solo cambio al codice è l'etichetta del campo di ricerca (DR-205), con resa identica al byte su 7 catture | `audit-1E-W7.md` |
| Ultimo confronto visivo: 591 righe (585 viste distinte), 40 superate, 3 da esaminare, 548 fallite, tutte accettate | `audit-1E-W7.md` §2, DR-162, DR-203 |
| `.planning/phases/1E/AUDIT.md` non esiste; il modello è `.planning/phases/1D/AUDIT.md` | filesystem |
| HO-016 è scritto ma non attivo; HO-013, HO-014, HO-015 sono chiusi | `docs/handoff/README.md` |
| `8be9e7b` non è pubblicato: `origin/main` è a `1a107c0` | `git log origin/main` |

## 3. Struttura dei file

| Percorso | Che cosa |
|---|---|
| i 10 file del §2 | solo formattazione Prettier, nessun cambio di comportamento |
| `.planning/phases/1E/AUDIT.md` (nuovo) | un criterio per riga: esito, prova, data, commit |
| `docs/qa/visual-parity-report.md` | nuove sezioni §11 (esito della `1E-W7`) e §12 (UAT) |
| `docs/handoff/HO-016-uat-di-parita-1E-W8.md`, `docs/handoff/README.md` | prerequisiti, formula (D109), prova del form (D108) |
| `PROGRESS.md`, `docs/decisions/decision-register.md` | come da protocollo |

## 4. Attività

### T1 — Formattazione e CI (1E-18)

- [ ] `node_modules/.bin/prettier --write` sui 10 file del §2, e nient'altro.
- [ ] `git diff --stat`: solo quei 10 file; `git diff -w` senza cambi di logica (lettura riga per riga).
- [ ] Verifica completa come la CI: `pnpm lint`, `prettier --check . --end-of-line auto`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm db:verify`, `pnpm test:e2e`. Atteso: tutto verde.
- [ ] Ricompilare e riavviare il sito su `:3200` con `SITE_URL` (la compilazione degli e2e riscrive `apps/web/.next`).
- [ ] **Conferma dell'utente**, poi commit: `style(1E): formattazione allineata al controllo della CI.`
- [ ] **Conferma dell'utente**, poi push di `8be9e7b` e del commit di formattazione.
- [ ] `gh run watch` sul commit pubblicato. Atteso `success`; altrimenti ci si ferma con il log del passo fallito (`superpowers:systematic-debugging`).

### T2 — Audit della fase (`AUDIT.md`)

Riesecuzioni brevi, sul sito di `:3200` dopo T1:

- [ ] 1E-7 menu dell'anonimo (41 voci, gerarchia ed etichette), scorrimento orizzontale, A-6, 1E-12: `pnpm exec tsx tests/visual/verifica-sito.ts`.
- [ ] 1E-9 e 1E-13: `tests/visual/verifica-redirect.ts`, atteso 181/181 e 0 inversioni.
- [ ] Stati della matrice: `python -I tests/visual/stati-matrice.py`, atteso 292/292.
- [ ] 1E-8: `tests/visual/verifica-metadati.ts`, atteso 0 difformi.
- [ ] 1E-12, 1E-15, 1E-16: prove automatiche già in `pnpm test` e `pnpm test:e2e` di T1, citate per nome.

Citate con data e commit, se **D107 = A**: 1E-1 e 1E-10 (`1E-W1`), 1E-2…1E-5 e 1E-11
(`1E-W6`/`1E-W7`, DR-162, DR-203, DR-204), 1E-6, 1E-17, A-1…A-8 (`audit-1E-W7.md`,
A-5 da `accessibilita-DR-205.csv`), 1E-14, 1E-19 (`analisi-1E-19-HO-026.md` §7).

- [ ] Scrivere `AUDIT.md` sul modello della 1D: §1 esito, §2 criteri uno per uno, §3 difetti trovati, §4 dipendenze introdotte nella fase (confronto con `PLAN.md` §5), §5 decisioni.
- [ ] Ogni criterio con un esito diverso da quello atteso ferma la wave: analisi e proposta all'utente.

### T3 — Rapporto di parità

- [ ] §11 «Esito della `1E-W7`»: verifiche non visive, ricattura dopo la T7, DR-203…205, i difetti ereditati rinviati dopo la UAT (DR-115, DR-169), le versioni di browser e strumenti.
- [ ] Indice delle difformità accettate con il loro riferimento (CSV per indirizzo).
- [ ] §12 «UAT»: il modo della prova (HO-016) e lo spazio per la risposta dell'utente, da riempire solo con le sue parole.
- [ ] Rilettura: nessuna frase che dichiari la parità; il termine «pixel-perfect» compare solo nella formula di D109.

### T4 — Richiesta della UAT

- [ ] Aggiornare HO-016: prerequisiti (T1-T3 fatti, CI verde), formula di risposta (D109), passo del form (D108), indirizzi dei due siti.
- [ ] `docs/handoff/README.md`: HO-016 attivo.
- [ ] **Stop.** Nessun lavoro della fase finché l'utente non risponde.

### T5 — Dopo la risposta

- [ ] Registrare la risposta, con le sue parole, nel §12 del rapporto e nel registro.
- [ ] Se D108 = A e l'utente ha inviato un form: conteggio delle compilazioni senza `legacy_id` e cancellazione in transazione, **su conferma**, come HO-024.
- [ ] Se approvata: riga `PHASE:1E WAVE:1E-W8 STATUS:complete`, commit e push su conferma. La chiusura della fase e HO-017 (distruzione dell'istanza di riferimento) sono passi successivi, ciascuno con la sua conferma.
- [ ] Se non approvata: elenco delle differenze, analisi d'impatto, correzioni, UAT ripetuta su quelle.

## 5. Rischi

| id | Rischio | Mitigazione |
|---|---|---|
| R8-1 | La CI fallisce per un motivo diverso da Prettier (e2e in CI, servizi del runner) | `gh run watch` subito dopo il push; diagnosi dal log, non nuovi tentativi alla cieca |
| R8-2 | La formattazione cambia il comportamento | solo i 10 file; `git diff -w` letto; suite completa prima del commit |
| R8-3 | Le prove citate non valgono più per il codice attuale | D107: si cita solo ciò che il cambio dopo l'audit (DR-205) non può toccare, con il commit su cui fu eseguito |
| R8-4 | Il rapporto suggerisce una parità che solo l'utente può dichiarare | T3, rilettura dedicata; formula di D109 |
| R8-5 | La prova del form della UAT lascia una compilazione nel database locale | D108; dati inventati; cancellazione su conferma |
| R8-6 | Arresto per memoria durante gli e2e o le verifiche | un processo alla volta; sito fermato durante gli e2e |

## 6. Assunzioni dichiarate

- Il sito su `:3200` e l'istanza di riferimento su `:8088` restano avviati fino alla UAT.
- Nessun import e nessuna migrazione in questa wave.
- La UAT si svolge in locale; staging e produzione sono della Fase 1F.
- Il gate non è superato da questa wave: dopo la UAT resta la condizione del deploy
  verificato (`deployment-gate`).

## 7. Decisioni aperte

| id | Decisione | Opzioni | Raccomandazione |
|---|---|---|---|
| **D107** | Quali criteri si rieseguono nell'audit della fase | **A** si rieseguono le verifiche brevi (T2) e si citano con data e commit quelle lunghe già eseguite dopo l'ultima correzione che le tocca (confronto visivo, interazioni, accessibilità, console) · **B** si riesegue tutto, compresa la ricattura di 591 viste e le verifiche sugli 81 URL (diverse ore, rischio di arresto per memoria) | **A** |
| **D108** | La prova del form nella UAT (HO-016, passo 4) | **A** l'utente invia un form con dati inventati; la compilazione si cancella dopo, su conferma · **B** nessun invio nella UAT: vale la voce 4 (24 form su 24, `accessibilita-form-HO-026.csv`) · **C** l'invio si prova sul database sintetico degli e2e, con il sito avviato apposta | **A** |
| **D109** | Formula con cui l'utente approva la UAT | **A** «approvo la parità pixel-perfect del sito pubblico, con le difformità accettate elencate nel rapporto», che è la condizione del gate scritta per intero · **B** la formula attuale di HO-016 («approvo la parità visiva»), e una conferma separata che valga come condizione del gate | **A** |
