# Piano della wave 1G-W2 — Registro delle operazioni

> **Per chi esegue:** sotto-skill richiesta `superpowers:subagent-driven-development` (o
> `superpowers:executing-plans`). Passi con caselle `- [ ]`. Prove **prima** del codice
> (`superpowers:test-driven-development`). Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Nessun commit senza
> conferma: il controller fotografa il lavoro fra un'attività e l'altra.

Scritto il 2026-10-20, dopo la chiusura della `1G-W1` (commit `2bf91c4`, CI
`39447465854` verde, HO-030 eseguito e primo account di amministrazione creato).

**Obiettivo:** rendere leggibile il registro delle operazioni che l'API già scrive, con una
schermata filtrabile per l'amministrazione e l'indicazione «ultima modifica di X il Y»
nell'editor per la redazione, così che il compito 1G-9 sia eseguibile dall'interfaccia.

**Architettura:** sola lettura di `audit_log`, che resta append-only. Una rotta nell'area
`impostazioni` con il permesso `audit.read` (DR-227) serve la schermata; la lettura di un
contenuto nell'area `redazione` aggiunge l'ultima modifica di **quel** contenuto, senza dare
alla redazione accesso al registro intero. Le etichette in italiano delle azioni stanno in
un solo elenco condiviso. Una correzione alla scrittura: la creazione di un contenuto oggi
non registra l'id del contenuto creato.

**Stack:** Fastify, Zod, Drizzle, Next.js nell'area amministrativa, `packages/ui`, Vitest,
Playwright. **Nessuna dipendenza nuova, nessuna migrazione prevista** (gli indici
`audit_log_entity_idx`, `audit_log_occurred_at_idx`, `audit_log_actor_idx` esistono già).

**Riferimenti:** `CONTEXT.md` §7 (1G-9, 1G-17, 1G-20), `PLAN.md` §1, DR-216 A, DR-227,
ADR-007 §3.1 controllo 10, `ux-proposals.md` §4.3 («registrato da …, area …»).

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W2-1 | L'amministrazione vede le operazioni dalla più recente, con data e ora, chi, in quale veste e area, che cosa, su che cosa, esito | prove dell'API ed e2e |
| W2-2 | Filtri per contenuto, persona, tipo di operazione, periodo ed esito; paginazione che regge decine di migliaia di righe | prove dell'API (paginazione per cursore, ordine stabile) |
| W2-3 | Nell'editor di un contenuto si legge «Ultima modifica di X il Y»; per i contenuti mai modificati dopo l'import, la data della sorgente | prove dell'area amministrativa ed e2e |
| W2-4 | La redazione non raggiunge il registro: né dal menu, né dall'indirizzo, né dall'API (1G-17) | prove negative dell'API ed e2e |
| W2-5 | Nessuna voce 404 nell'area amministrativa (1G-20) | e2e su tutte le voci di navigazione |
| W2-6 | La creazione di un contenuto registra l'id del contenuto creato | prova dell'API |
| W2-7 | Il registro non mostra impronte degli indirizzi IP, identificativi di sessione, né il contenuto di `detail` oltre ai campi in elenco chiuso | prova sulla risposta dell'API |
| W2-8 | Verifica come la CI verde | lint, Prettier, tipi, build, test, `db:verify`, copertura, e2e |

## 2. Fatti accertati il 2026-10-20

| Fatto | Fonte |
|---|---|
| Ogni richiesta che modifica dati scrive una riga, anche quando fallisce (`outcome`), salvo le rotte `/auth/*` che scrivono la propria | `apps/api/src/plugins/audit.ts` |
| 26 azioni dichiarate: `content.*` (7, comprese `draft.save` e `draft.discard`), `media.*` (4), `menu.item.*` (3), `redirect.*` (3), `seo.template.update`, `seo.content.update`, `setting.update`, `term.*` (3), `account.*` (3) | `grep "audit: {" apps/api/src/modules` |
| `entityId` viene da `auditTarget`, oppure dai parametri `id`, `key`, `scope`: `POST /contents` non ha `id`, quindi la creazione **non** registra quale contenuto è nato | `plugins/audit.ts`, `modules/content/routes.ts:92` |
| Il titolo SEO di un contenuto si registra con `entityType = content_seo` e l'id del contenuto | `modules/seo/routes.ts:90-93` |
| Gli invii dei form del sito pubblico finiscono nel registro senza persona né `entityId` (`POST /forms/:slug/submissions`) | `plugins/audit.ts`, conteggio sul database di sviluppo |
| Righe oggi nel database di sviluppo: 108 invii di form (78 falliti), 88 `menu.item.update`, 21 `content.update`, 14 `auth.login`, 9 `auth.context_changed` | query del 2026-10-20 |
| La riga conserva `actorLabel`, `actorRoleLabel`, `actorArea` anche se persona o ruolo vengono rimossi | `packages/db/src/schema/auth.ts` (`auditLog`) |
| `detail` contiene `status`, `method` e quanto la rotta mette in `auditTarget` (per gli account solo l'id e i ruoli); per l'accesso fallito, `entityType = auth.identifier` con un'impronta dell'identificativo | `plugins/audit.ts`, `modules/auth/routes.ts` |
| L'elenco dei contenuti mostra solo la data «Modificata», senza persona; l'editor mostra solo l'ora della copia di lavoro | `apps/admin/src/components/ContentList.tsx:242`, `editor/ContentEditor.tsx:286` |
| `contents` ha `modified_at` dalla sorgente (DR-186) e `updated_at` | `packages/db/src/schema/content.ts` |
| La voce «Registro delle operazioni» punta a `/impostazioni/registro`, oggi 404 | `apps/admin/src/lib/areas.ts` |

## 3. Decisioni richieste prima di eseguire

| id | Decisione | Opzioni | Raccomandazione | Default vietato |
|---|---|---|---|---|
| **D126** | Che cosa mostra il registro | A — tutto ciò che è scritto: modifiche, accessi e cambi d'area, invii dei form del sito, operazioni rifiutate; con filtri, e per difetto la vista «Modifiche al sito» · B — solo le modifiche fatte dall'area amministrativa (contenuti, media, menu, SEO, redirect, impostazioni, account) · C — come A, ma gli invii dei form del sito esclusi | **A**: il registro è lo strumento di controllo (controllo 10 di ADR-007) e nascondere accessi e rifiuti toglie proprio ciò che serve a capire un problema; la vista per difetto lo tiene leggibile. Gli invii dei form non contengono dati personali nel registro | nascondere righe senza decisione |
| **D127** | Da dove viene «ultima modifica di X il Y» | A — dal registro: l'ultima operazione riuscita su quel contenuto fra creazione, modifica, pubblicazione, ritiro e titolo SEO; le copie di lavoro **non** contano (non cambiano la pagina pubblica); senza righe, «Importato dalla sorgente, ultima modifica il …» da `modified_at` · B — colonna nuova `updated_by` su `contents`, scritta dal servizio | **A**: nessuna migrazione, una sola fonte di verità, e la persona resta nominata anche se l'account viene eliminato; il costo è una query in più quando si apre un contenuto, coperta dall'indice esistente | introdurre colonne senza decisione |
| **D128** | Conservazione delle righe del registro (oggi nessuna scadenza) | A — non si decide in questa wave: il registro resta append-only senza cancellazione, e la durata si porta alla 1F con il parere di chi segue la privacy del Centro · B — decidere ora una durata | **A**: la wave legge soltanto; una durata di conservazione è una decisione legale e di privacy, che `CLAUDE.md` chiede di non dichiarare senza validazione umana | cancellare o far scadere righe |

## 4. Struttura dei file

| Percorso | Che cosa |
|---|---|
| `apps/api/src/modules/audit/` (nuovo: `routes.ts`, `schemas.ts`, `service.ts`) | `GET /audit`, area `impostazioni`, permesso `audit.read` |
| `apps/api/src/app.ts` | registrazione di `audit` nell'area `impostazioni` |
| `apps/api/src/modules/content/routes.ts`, `service.ts` | `auditTarget` sulla creazione (W2-6); `lastChange` nella lettura di un contenuto (D127) |
| `packages/contracts/src/audit.ts` (nuovo) | tipi della risposta |
| `apps/admin/src/lib/auditLabels.ts` (nuovo) | etichette in italiano delle azioni e dei tipi di oggetto, elenco chiuso |
| `apps/admin/src/app/impostazioni/registro/page.tsx` (nuova), `components/audit/` (nuova) | schermata del registro |
| `apps/admin/src/components/editor/ContentEditor.tsx` | riga «Ultima modifica di X il Y» |
| `apps/api/tests/audit.test.ts`, `apps/admin/tests/audit.test.tsx`, `tests/e2e/cms/registro.spec.ts` (nuovi) | prove |
| `apps/api/tests/openapi.snapshot.json` | rotta nuova |

## 5. Interfacce

`GET /audit` — area `impostazioni`, permesso `audit.read`.

| Parametro | Tipo | Note |
|---|---|---|
| `view` | `changes` (predefinito) \| `all` | `changes`: azioni dell'area amministrativa dichiarate in `config.audit`; `all`: anche accessi, cambi d'area, invii dei form, azioni non dichiarate |
| `entityType`, `entityId` | stringhe | `entityType=content` include anche `content_seo` con lo stesso id |
| `actorUserId` | uuid | |
| `action` | stringa dell'elenco chiuso | |
| `outcome` | `success` \| `failure` | |
| `from`, `to` | data ISO | intervallo chiuso a sinistra, aperto a destra |
| `cursor`, `limit` | id della riga, 1…100 (predefinito 50) | ordine `occurred_at` decrescente poi `id` decrescente |

Risposta: `{ items: [{ id, occurredAt, actorLabel, actorRoleLabel, actorArea, action, entityType, entityId, entityLabel, outcome }], nextCursor }`. `entityLabel` è il titolo attuale del contenuto, del media o della voce di menu se esiste ancora, altrimenti `null`. **Mai** `ipHash`, `sessionId`, `detail`.

`GET /contents/:id` (esistente, area `redazione`) aggiunge
`lastChange: { actorLabel, occurredAt } | { importedAt } | null`.

## 6. Revisione di attenzione

1. **Paginazione con righe nello stesso istante**: due operazioni con lo stesso
   `occurred_at` non si perdono né si ripetono fra due pagine (cursore su `(occurred_at, id)`;
   prova con righe inserite allo stesso istante).
2. **Contenuto eliminato**: il registro mostra le sue righe con `entityLabel = null` e
   «contenuto non più presente», non va in errore.
3. **Persona eliminata o rinominata**: si mostra `actorLabel` registrato allora.
4. **Righe senza persona** (invii dal sito, accessi falliti): «Dal sito pubblico» o
   «Accesso non riuscito», mai un nome vuoto; l'impronta dell'identificativo non si mostra.
5. **Filtri incoerenti** (`from` dopo `to`, `limit` 0 o 1000, `action` sconosciuta): `400`
   con messaggio in italiano.

---

## 7. Attività

### T0 — Decisioni D126, D127, D128
- [ ] Portare le tre decisioni all'utente; registrare le risposte in
  `decision-register.md`. Se diverse da A, aggiornare §4 e §5 prima di T1.

### T1 — Lettura del registro nell'API
**File:** `modules/audit/*`, `app.ts`, `packages/contracts/src/audit.ts`, OpenAPI.
- [ ] Prove (falliscono): ordine e paginazione (caso 1 del §6); ogni filtro del §5; `view`
  predefinito; `entityType=content` include `content_seo`; `entityLabel` per contenuto,
  media e voce di menu esistenti e `null` per eliminati (caso 2); campi vietati assenti
  (W2-7); `400` per i filtri del caso 5; redazione → `403` (W2-4); sessione in area
  Redazione → `403`; nessun gestore eseguito quando la richiesta è rifiutata.
- [ ] Attuazione; prove verdi; commento in `PROGRESS.md`.

### T2 — Correzione della scrittura e ultima modifica
**File:** `modules/content/routes.ts`, `service.ts`, `packages/contracts`.
- [ ] Prova (fallisce): `POST /contents` scrive una riga con `entityId` del contenuto creato
  (W2-6).
- [ ] Prove (falliscono) per `lastChange` (D127): dopo una modifica riuscita, persona e ora
  di quella modifica; una copia di lavoro salvata non la cambia; un tentativo fallito non la
  cambia; il titolo SEO la cambia; contenuto senza righe → `importedAt` da `modified_at`.
- [ ] Attuazione; prove verdi; commento in `PROGRESS.md`.

### T3 — Schermata «Registro delle operazioni» e riga nell'editor
**File:** `app/impostazioni/registro/page.tsx`, `components/audit/*`, `lib/auditLabels.ts`,
`editor/ContentEditor.tsx`.
- [ ] Prove dell'area amministrativa (falliscono): tabella con data e ora in italiano, chi
  («Dal sito pubblico» quando manca, caso 4), veste e area, operazione in italiano, oggetto
  con collegamento al contenuto quando esiste, esito; filtri con etichette; «Carica altre»
  con il cursore; stato vuoto e stato d'errore; un'azione senza etichetta mostra il codice
  grezzo invece di sparire.
- [ ] Prova: l'editor mostra «Ultima modifica di X il Y» o «Importato dalla sorgente, ultima
  modifica il …».
- [ ] Attuazione con i componenti di `packages/ui` e i token del sistema di design;
  navigazione da tastiera ed etichette; prove verdi; commento in `PROGRESS.md`.

### T4 — Prove end-to-end
**File:** `tests/e2e/cms/registro.spec.ts`.
- [ ] Come redazione: modifica il titolo di una pagina e salva; l'editor mostra «Ultima
  modifica di <nome del seme>».
- [ ] Come amministrazione: apre il registro, filtra per quel contenuto, trova la modifica
  con persona, veste e ora (compito 1G-9 percorso da una prova).
- [ ] Caso negativo: la redazione non raggiunge `/impostazioni/registro` e `GET /audit`
  risponde `403`.
- [ ] Ogni voce di navigazione delle due aree risponde senza 404 (W2-5).
- [ ] Commento in `PROGRESS.md`.

### T5 — Verifica e chiusura
- [ ] Revisione del codice dell'intera wave (`code-reviewer`) senza critici o alti aperti;
  revisione di sicurezza mirata sulla rotta nuova (autorizzazione, campi esposti).
- [ ] Verifica come la CI: `pnpm lint`, `npx prettier --check . --end-of-line auto`,
  `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm db:verify`, `pnpm test:coverage`,
  `pnpm test:e2e`; poi ricompilare e riavviare sito, area amministrativa e API di sviluppo.
- [ ] Riga `PHASE:1G WAVE:1G-W2 STATUS:complete`; commit e push **su conferma**; controllo
  della CI.

## 8. Cosa la wave non fa

- Non cancella né fa scadere righe del registro (D128).
- Non esporta il registro (CSV o simili): non richiesto da alcun criterio.
- Non cambia che cosa si scrive nel registro, salvo l'id del contenuto creato (W2-6).
- Non mostra la cronologia completa alla redazione: solo l'ultima modifica del contenuto
  aperto.
- Non introduce revisioni né ripristino (DR-218).
