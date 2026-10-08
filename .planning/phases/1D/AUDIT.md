# AUDIT — Fase 1D

**Stato: in corso.** Avviato il 2026-10-07, **prima** di dichiarare la fase
completa, come impone `CLAUDE.md`. La fase **non** è dichiarata chiusa.

Verifica i 28 criteri di uscita di [`CONTEXT.md`](CONTEXT.md) §7, più il 24-bis.
Ogni esito qui sotto è **eseguito**; dove l'esecuzione non è ancora avvenuta, il
criterio è segnato ⏳ e il motivo è scritto.

---

## 1. Esito provvisorio

| | |
|---|---|
| Criteri verificati con esito positivo | **20 su 29** |
| Criteri in attesa di esecuzione | **9** |
| Criteri falliti | **0** |
| Difetti trovati e corretti durante l'audit | **2** (§3) |

Blocco principale: dal 2026-10-08 il motore di Docker Desktop risponde `500` a
ogni richiesta, quindi database, archiviazione e servizi non sono raggiungibili.
I criteri che ne hanno bisogno aspettano HO-011.

## 2. I criteri di uscita, uno per uno

### Importer — `importer-spec.md` §14

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1 | `plan` non scrive nulla | da eseguire: fotografia di tutte le tabelle prima e dopo un `plan` sul database importato | ⏳ Docker |
| 2 | Due `apply` di fila danno lo stesso stato | da eseguire: la copia presa fra la terza e la quarta esecuzione, ripristinata in un database temporaneo, contro lo stato attuale, escluse `created_at` e `updated_at`. Un primo tentativo il 2026-10-08 ha dato «identici» su due fotografie **vuote** per il guasto di Docker: scartato | ⏳ Docker |
| 3 | I conteggi di `database-schema.md` §6 coincidono | quarta esecuzione, 2026-10-07: tutti i volumi coincidono con gli attesi **aggiornati da decisioni**: `terms` 4 (DR-061), `media` 178 di tabella (DR-058, DR-060), `redirects` 181 (DR-065), `forms` 26 (DR-094), `form_notifications` 40 (DR-098). `media_variants` 1.287 contro circa 1.376: scostamento motivato in `import-completeness-report.md` §2.1 | ✅ |
| 4 | Zero riferimenti `wp-content/uploads` rimasti | verifica finale della quarta esecuzione: 0 | ✅ |
| 5 | Zero righe `error` in `import_issues` | interrogata la tabella per la quarta esecuzione: 0 `error`, 13 `warning` | ✅ |
| 6 | Riserva ≤ 10 % dei blocchi e ≤ 15 contenuti | quarta esecuzione: 7 blocchi su 305 (2,30 %), 4 contenuti su 108 | ✅ |
| 7 | Il rapporto non contiene dati personali | ispezionato il rapporto stampato dalla quarta esecuzione (58 righe) e `import-completeness-report.md`: nessun indirizzo, nome di file, IP o nome di persona | ✅ |
| 8 | `rollback` riporta il database allo stato precedente | prova su dati sintetici, come deciso da DR-096: `apps/importer/tests/unit/rollback.test.ts` verde in `pnpm test` del 2026-10-07 | ✅ |

### Modello a blocchi — ADR-005, ADR-006

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 9 | 108 documenti validi secondo lo schema | da eseguire: suite reale dell'importer | ⏳ Docker |
| 10 | Zero `[et_pb_` e `<!-- wp:` nel testo convertito | da eseguire: suite reale e ricerca sul database importato | ⏳ Docker |
| 11 | Andata e ritorno su 108 contenuti | da eseguire: suite reale (`roundTripReal.real.test.ts`) | ⏳ Docker |
| 12 | Sanificazione idempotente | `packages/blocks/tests/sanitize.test.ts`: 35 prove verdi il 2026-10-08 | ✅ |

### Media e URL — ADR-004 §7

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 13 | Oggetti in `media-public` = file sorgente meno le esclusioni | preflight della quarta esecuzione: 1.475 file dopo le esclusioni, come atteso; verifica «file nel bucket / file attesi» eseguita: 0 mancanti | ✅ |
| 14 | Checksum identici al 100 % | verifica «checksum non corrispondenti» della quarta esecuzione: 0 | ✅ |
| 15 | I 4 documenti riservati non sono raggiungibili da anonimo | da eseguire: prova negativa sull'archiviazione avviata | ⏳ Docker |
| 16 | URL storici rispondono 301 | da eseguire: campione di `/wp-content/uploads/...` e i 6 slug storici sul servizio avviato | ⏳ Docker |

### API e sessioni — ADR-007, ADR-001

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 17 | I 12 controlli di ADR-007 §3.1 hanno un test che passa | `apps/api/tests/adr007Controls.test.ts`, un blocco per controllo, 32 prove, verdi il 2026-10-07; il controllo 11 è dichiarato fuori perimetro nel test stesso | ✅ |
| 18 | Righe della logica di autenticazione | `apps/api/tools/countAuthLines.ts`, regola invariata, 2026-10-08: **nucleo 439** su 500, rispettata; **totale 861**, oltre 500, coperto dalla deroga di DR-066 confermata da DR-070 | ✅ |
| 19 | `openapi.json` generata e protetta da test | `apps/api/tests/openapi.test.ts` contro `openapi.snapshot.json`, verde il 2026-10-07 | ✅ |
| 20 | Una riga di audit log per ogni modifica | `apps/api/tests/auditHook.test.ts`, verde il 2026-10-07 | ✅ |

### CMS — `acceptance-criteria.md` §3.4

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 21 | 1D-28…1D-35 eseguiti nell'area amministrativa avviata | nel browser, con Playwright: 1D-28 completo; 1D-31 caricare e testo alternativo; 1D-32 aggiungere, visibilità, spostare e annidare; 1D-34 creare e spegnere; 1D-35. **Non eseguiti nel browser**: 1D-29, 1D-33, e per 1D-30, 1D-31, 1D-34 aggiungere ed eliminare un blocco, sostituire ed eliminare un media, modificare un redirect. Coperti solo da prove di API e componenti. Serve una decisione (§5, D30) | ⏳ |
| 22 | L'anteprima usa i componenti di `packages/blocks` | `apps/admin/tests/preview-import-graph.test.ts`, verde il 2026-10-07: l'anteprima usa `BlocksDocument` del pacchetto condiviso e l'area amministrativa non ha una resa propria. Limite dichiarato: il sito pubblico non rende ancora contenuti, il confronto con `apps/web` arriva in 1E | ✅ |
| 23 | Il blocco di riserva si modifica in un'area di testo evidenziata, con avviso | `HtmlFallbackEditor` di `packages/ui`: `textarea` con evidenziazione sovrapposta e avviso «Blocco non convertito»; `packages/ui/tests/html-fallback-editor.test.tsx` verde | ✅ |
| 24 | Commutatore di ruolo, ambiente in parole, permessi del ruolo attivo | `apps/api/tests/areaBinding.test.ts` verde il 2026-10-07; nel browser, `tests/e2e/cms/accesso.spec.ts` (scelta della veste, ambiente scritto in parole, lavoro nell'altra area) | ✅ |
| 24-bis | Salvataggio automatico sulla copia di lavoro, pubblicazione su comando | `apps/api/tests/drafts.test.ts` verde il 2026-10-07 | ✅ |

### Struttura e igiene

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 25 | `apps/web` non importa da `packages/ui` | file di prova in `apps/web/src` che importa da `@amoris/ui`: **il lint fallisce** con `no-restricted-imports`; file rimosso, lint di nuovo verde | ✅ |
| 26 | `lint`, `typecheck`, `build`, `test` passano, in locale e in CI | in locale il 2026-10-07: `typecheck`, `lint`, `format:check`, `test` verdi. Da eseguire: `pnpm build` e la CI, che non gira dal 2026-09-14 perché 47 commit non sono stati spinti | ⏳ push |
| 27 | Nessun dato reale né segreto fra i file tracciati | ricerca su 723 file tracciati: 0 IBAN, 0 codici fiscali, 0 chiavi private, 0 token noti, nessun file di `source-private/`, `.reference/` o `.env`. Trovati due indirizzi su domini reali in prove: corretti (§3). Resta l'indirizzo pubblico della segreteria in `docs/migration/seo-rendered-baseline.csv`, già dichiarato nell'audit della 1C | ✅ |
| 28 | `PROGRESS.md` ha una riga per wave | 36 righe `PHASE:1D` `complete`; W4, W5, W7 e W8 registrate per sotto-wave. Manca solo la `1D-W12`, che è questo audit | ✅ |

## 3. Difetti trovati e corretti durante l'audit

1. **Indirizzo sul dominio reale del Centro in una prova** di
   `packages/ui/tests/shell-identity.test.tsx`, con un nome e cognome. Sostituito
   con un nome e un indirizzo sintetici sul dominio `.invalid`. Prova verde.
2. **Indirizzo su un dominio reale** in `packages/blocks/tests/sanitize.test.ts`.
   Sostituito con uno sul dominio `.invalid`. Prova verde.

Prima dell'audit, nella stessa giornata: il conteggio dei volumi contava anche
l'account locale di HO-009 (DR-099, attuata e provata).

## 4. Dipendenze

Nessuna dipendenza aggiunta durante l'audit. Il confronto con il §4 di `PLAN.md`
è da completare con l'elenco di `pnpm list` prima della chiusura.

## 5. Decisioni richieste

| id | Contenuto | Termine |
|---|---|---|
| ~~**D30**~~ | **Chiusa il 2026-10-08 da DR-100**: prove Playwright nuove | — |
