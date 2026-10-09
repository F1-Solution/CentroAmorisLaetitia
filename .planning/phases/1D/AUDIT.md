# AUDIT — Fase 1D

**Stato: audit completato il 2026-10-09, 28 criteri su 28 superati.** Avviato il 2026-10-07, **prima** di dichiarare la fase
completa, come impone `CLAUDE.md`. La fase **non** è dichiarata chiusa.

Verifica i 28 criteri di uscita di [`CONTEXT.md`](CONTEXT.md) §7, più il 24-bis.
Ogni esito qui sotto è **eseguito**; dove l'esecuzione non è ancora avvenuta, il
criterio è segnato ⏳ e il motivo è scritto.

---

## 1. Esito

| | |
|---|---|
| Criteri della Fase 1D | **28**: i 28 di `CONTEXT.md` più il 24-bis, meno il 16 spostato in 1E da DR-094 |
| Criteri verificati con esito positivo | **28 su 28** |
| Criteri in attesa | **0** |
| Criteri falliti | **0** |
| Difetti trovati e corretti durante l'audit | **6** (§3 e §3.1) |
| Difetti trovati e non corretti | **0** |

L'audit è completo. La chiusura della Fase 1D resta una decisione
dell'utente: questo documento non la dichiara.

## 2. I criteri di uscita, uno per uno

### Importer — `importer-spec.md` §14

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 1 | `plan` non scrive nulla | 2026-10-09: fotografia di **tutte** le 33 tabelle, comprese `import_runs`, `import_issues`, `import_id_map` e le marche temporali, prima e dopo un `plan` completo sul database importato: **identiche**. Il `plan` esce `partial` per la sola ragione dichiarata da DR-088 (non carica file, quindi non verifica il bucket) | ✅ |
| 2 | Due `apply` di fila danno lo stesso stato | 2026-10-09: la copia presa fra la terza e la quarta esecuzione, ripristinata in un database temporaneo poi eliminato, contro lo stato dopo la quarta: 30 tabelle di dominio, 27 non vuote, **identiche** riga per riga, identificativi compresi, escluse solo `created_at` e `updated_at`. La suite reale lo riprova anche da zero (`idempotency.real.test.ts`, verde). Il tentativo del 2026-10-08 su due fotografie vuote, per il guasto di Docker, era stato scartato | ✅ |
| 3 | I conteggi di `database-schema.md` §6 coincidono | quarta esecuzione, 2026-10-07: tutti i volumi coincidono con gli attesi **aggiornati da decisioni**: `terms` 4 (DR-061), `media` 178 di tabella (DR-058, DR-060), `redirects` 181 (DR-065), `forms` 26 (DR-094), `form_notifications` 40 (DR-098). `media_variants` 1.287 contro circa 1.376: scostamento motivato in `import-completeness-report.md` §2.1 | ✅ |
| 4 | Zero riferimenti `wp-content/uploads` rimasti | verifica finale della quarta esecuzione: 0 | ✅ |
| 5 | Zero righe `error` in `import_issues` | interrogata la tabella per la quarta esecuzione: 0 `error`, 13 `warning` | ✅ |
| 6 | Riserva ≤ 10 % dei blocchi e ≤ 15 contenuti | quarta esecuzione: 7 blocchi su 305 (2,30 %), 4 contenuti su 108 | ✅ |
| 7 | Il rapporto non contiene dati personali | ispezionato il rapporto stampato dalla quarta esecuzione (58 righe) e `import-completeness-report.md`: nessun indirizzo, nome di file, IP o nome di persona | ✅ |
| 8 | `rollback` riporta il database allo stato precedente | prova su dati sintetici, come deciso da DR-096: `apps/importer/tests/unit/rollback.test.ts` verde il 2026-10-07. In più, il 2026-10-09, la suite reale annulla un'esecuzione sulla sorgente vera e riporta il database a vuoto (`idempotency.real.test.ts`, verde) | ✅ |

### Modello a blocchi — ADR-005, ADR-006

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 9 | 108 documenti validi secondo lo schema | suite reale, 2026-10-09: 108 contenuti importati, **0** documenti rifiutati dallo schema (`roundTripReal.real.test.ts`); la suite reale intera: 8 file, 13 prove, verdi | ✅ |
| 10 | Zero `[et_pb_` e `<!-- wp:` nel testo convertito | ricerca sul database importato, 2026-10-09, in `blocks`, `content_html` e `content_text` dei 108 contenuti: **0** e **0** | ✅ |
| 11 | Andata e ritorno su 108 contenuti | `roundTripReal.real.test.ts`, 2026-10-09: 108 contenuti, **0** con HTML divergente, **0** con testo divergente, 0 su 193 blocchi `rich_text` non stabili | ✅ |
| 12 | Sanificazione idempotente | `packages/blocks/tests/sanitize.test.ts`: 35 prove verdi il 2026-10-08 | ✅ |

### Media e URL — ADR-004 §7

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 13 | Oggetti in `media-public` = file sorgente meno le esclusioni | preflight della quarta esecuzione: 1.475 file dopo le esclusioni, come atteso; verifica «file nel bucket / file attesi» eseguita: 0 mancanti | ✅ |
| 14 | Checksum identici al 100 % | verifica «checksum non corrispondenti» della quarta esecuzione: 0 | ✅ |
| 15 | I 4 documenti riservati non sono raggiungibili da anonimo | prova negativa del 2026-10-09 con le chiavi vere dei 4 file: archiviazione diretta **403** sul bucket riservato e su quello pubblico; attraverso l'API, la stessa che Caddy espone su `/media/*`, **404** per percorso e **401** su `/media/:id`. Controllo positivo: con le credenziali il bucket riservato elenca 4 oggetti | ✅ |
| 16 | URL storici rispondono 301 | **spostato nella Fase 1E da DR-094** (2026-10-04): oggi nessun componente serve i redirect al pubblico | ➡️ 1E |

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
| 21 | 1D-28…1D-35 eseguiti nell'area amministrativa avviata | Playwright sull'area amministrativa avviata, 2026-10-09: suite intera **30 su 30**. Le 7 prove nuove di DR-100 (`tests/e2e/cms/modifiche.spec.ts`) coprono il resto: testo e immagine dentro i blocchi (1D-29), aggiungere, spostare ed eliminare un blocco (1D-30), didascalia, sostituzione ed eliminazione di un media (1D-31), SEO di un contenuto e template globale (1D-33), modifica di un redirect (1D-34). Eseguite 3 volte di fila: 21 su 21. Hanno trovato il difetto del §3.1; dopo la correzione (DR-102), senza più le attese che lo aggiravano, di nuovo 30 su 30 e 21 su 21 | ✅ |
| 22 | L'anteprima usa i componenti di `packages/blocks` | `apps/admin/tests/preview-import-graph.test.ts`, verde il 2026-10-07: l'anteprima usa `BlocksDocument` del pacchetto condiviso e l'area amministrativa non ha una resa propria. Limite dichiarato: il sito pubblico non rende ancora contenuti, il confronto con `apps/web` arriva in 1E | ✅ |
| 23 | Il blocco di riserva si modifica in un'area di testo evidenziata, con avviso | `HtmlFallbackEditor` di `packages/ui`: `textarea` con evidenziazione sovrapposta e avviso «Blocco non convertito»; `packages/ui/tests/html-fallback-editor.test.tsx` verde | ✅ |
| 24 | Commutatore di ruolo, ambiente in parole, permessi del ruolo attivo | `apps/api/tests/areaBinding.test.ts` verde il 2026-10-07; nel browser, `tests/e2e/cms/accesso.spec.ts` (scelta della veste, ambiente scritto in parole, lavoro nell'altra area) | ✅ |
| 24-bis | Salvataggio automatico sulla copia di lavoro, pubblicazione su comando | `apps/api/tests/drafts.test.ts` verde il 2026-10-07 | ✅ |

### Struttura e igiene

| # | Criterio | Come è stato verificato | Esito |
|---|---|---|---|
| 25 | `apps/web` non importa da `packages/ui` | file di prova in `apps/web/src` che importa da `@amoris/ui`: **il lint fallisce** con `no-restricted-imports`; file rimosso, lint di nuovo verde | ✅ |
| 26 | `lint`, `typecheck`, `build`, `test` passano, in locale e in CI | in locale: `test` verde il 2026-10-07, `build` il 2026-10-08, `lint`, `format:check`, `typecheck` ed end-to-end il 2026-10-09. In CI, esecuzione `37786645548` del 2026-10-08: lint, formattazione, tipi e build verdi, **test falliti** per un difetto della CI (§3, punti 3 e 5). Esecuzione `37890020769` del 2026-10-09: lint, formattazione, tipi, build e archivio a oggetti verdi, test falliti per il §3, punto 6. Il 2026-10-09, dopo DR-101 e DR-102, in locale tutti verdi: `lint`, `format:check`, `typecheck`, `test` (8 pacchetti, 1090 prove) e end-to-end 30 su 30 Esecuzione `37919066237` del 2026-10-09, sul commit `68e3e88`: **tutti i passi verdi**, compresi test, copertura, schema ed end-to-end | ✅ |
| 27 | Nessun dato reale né segreto fra i file tracciati | ricerca su 723 file tracciati: 0 IBAN, 0 codici fiscali, 0 chiavi private, 0 token noti, nessun file di `source-private/`, `.reference/` o `.env`. Trovati due indirizzi su domini reali in prove: corretti (§3). Resta l'indirizzo pubblico della segreteria in `docs/migration/seo-rendered-baseline.csv`, già dichiarato nell'audit della 1C | ✅ |
| 28 | `PROGRESS.md` ha una riga per wave | 36 righe `PHASE:1D` `complete`; W4, W5, W7 e W8 registrate per sotto-wave. La `1D-W12`, questo audit, si registra alla sua conclusione, il 2026-10-09 | ✅ |

## 3. Difetti trovati e corretti durante l'audit

1. **Indirizzo sul dominio reale del Centro in una prova** di
   `packages/ui/tests/shell-identity.test.tsx`, con un nome e cognome. Sostituito
   con un nome e un indirizzo sintetici sul dominio `.invalid`. Prova verde.
2. **Indirizzo su un dominio reale** in `packages/blocks/tests/sanitize.test.ts`.
   Sostituito con uno sul dominio `.invalid`. Prova verde.

3. **La CI non poteva eseguire la prova dell'archiviazione dell'importer**
   (`apps/importer/tests/unit/storage/objectStore.test.ts`, aggiunta nella
   `1D-W11` quando la CI non girava più). Due cause: Turborepo non passava le
   variabili `S3_*` al compito `test`, e la CI avviava l'archivio a oggetti
   **dopo** le prove. Corretti `turbo.json` e `.github/workflows/ci.yml`; l'esito
   si vedrà alla prossima esecuzione della CI. Le altre prove che leggono la
   configurazione usano valori sintetici e non ne dipendono.
4. **Le immagini di MinIO non erano più scaricabili** da quay.io (`401`) né da
   Docker Hub (`404`). Sostituite con quelle Chainguard fissate per digest
   (DR-101). Il volume di sviluppo esistente è stato riassegnato con HO-012, il
   2026-10-09: server sano, 1477 oggetti pubblici e 4 riservati come prima,
   accesso anonimo 403 su entrambi i bucket.
5. **Il passo dell'archivio a oggetti della CI usava `docker compose wait`**, che
   fallisce se la creazione dei bucket è già finita. Ora la esegue in modo
   sincrono; provato due volte di fila in un progetto Compose isolato.
6. **La CI non dava all'importer il sale `IMPORTER_IP_HASH_SALT`**, che la sua
   configurazione pretende anche nella prova dell'archivio. Emerso dalla CI
   `37890020769` del 2026-10-09, la prima con l'archivio funzionante: tutto verde
   fino ai test, poi quell'unica variabile mancante. Aggiunto un valore sintetico
   alla CI e la variabile al compito `test` di Turborepo; la prova, eseguita in
   locale con i valori della CI, passa.

### 3.1 Difetto trovato e corretto con DR-102: una lettura cancellava ciò che si era appena scritto

Trovato dalle prove nuove del criterio 21. In tre punti dell'area
amministrativa una lettura dal servizio sovrascriveva, senza avvisare, le
modifiche fatte mentre era in corso:

| Punto | Che cosa si perde |
|---|---|
| `apps/admin/src/components/editor/ContentEditor.tsx`, `writeToContent` (righe 205–256): dopo «Salva» azzera le modifiche in sospeso e rilegge il contenuto, mentre albero, ispettore e titolo restano modificabili | una modifica fatta durante il salvataggio |
| `apps/admin/src/components/editor/ContentSeoPanel.tsx`, `load` (righe 90–117), con i campi disabilitati solo durante il salvataggio (righe 202–229) e non durante il caricamento | ciò che si scrive nel pannello SEO prima che i metadati siano arrivati |
| `apps/admin/src/components/menu/MenuItemPanel.tsx`, effetto alle righe 66–75, che riporta i campi ai valori salvati a ogni nuova lettura delle voci, per esempio dopo uno spostamento (`MenuManager.tsx` riga 190) | le modifiche non salvate della voce aperta |

Media, redirect, template globali e impostazioni non hanno il difetto: lì la
lettura non tocca la bozza aperta.

**Correzione, 2026-10-09 (DR-102).** I campi restano modificabili. L'editor,
dopo il salvataggio, rimette sullo schermo le modifiche fatte nel frattempo e
le segna da salvare; il salvataggio automatico aspetta la fine del salvataggio.
Il pannello SEO e la scheda della voce di menu, a ogni lettura, aggiornano solo
i campi non ancora modificati. Una prova di componente per punto, rossa prima
e verde dopo; anche il terzo punto, prima solo dedotto, è stato riprodotto. Le
prove end-to-end non aspettano più la fine del caricamento.

Prima dell'audit, nella stessa giornata: il conteggio dei volumi contava anche
l'account locale di HO-009 (DR-099, attuata e provata).

## 4. Dipendenze

Nessuna dipendenza aggiunta durante l'audit. Confronto fra i `package.json` alla
chiusura della 1C (`f3d35dc`) e oggi: le dipendenze nuove della 1D sono quelle
del §4 di `PLAN.md` (`zod`, `parse5`, `@aws-sdk/client-s3`, `@node-rs/argon2`,
`@fastify/cookie`, `@fastify/rate-limit`, `@fastify/multipart`, `@tiptap/*`) e
`@dnd-kit/core`, autorizzata da DR-069. Due, solo di sviluppo, **non erano
dichiarate** e lo sono qui:

| Pacchetto | Dove | Perché |
|---|---|---|
| `@testing-library/user-event` | `apps/admin`, dal 2026-09-22 | simula i gesti della persona nelle prove dei componenti dell'editor; stessa famiglia di `@testing-library/react`, presente dalla 1C |
| `@vitest/coverage-v8` | radice, dal 2026-09-24 | misura la copertura; senza, la soglia dell'80 % di DR-095 non si potrebbe verificare |

## 5. Decisioni richieste

| id | Contenuto | Termine |
|---|---|---|
| ~~**D30**~~ | **Chiusa il 2026-10-08 da DR-100**: prove Playwright nuove | — |
| ~~**D22**~~ | **Chiusa il 2026-10-09 da DR-101**: immagini Chainguard fissate per digest | — |
| ~~**D31**~~ | **Chiusa il 2026-10-09 da DR-102**: campi modificabili, modifiche conservate | — |
