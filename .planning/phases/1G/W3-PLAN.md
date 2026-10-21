# Piano della wave 1G-W3 — Indirizzi dei contenuti

> **Per chi esegue:** sotto-skill richiesta `superpowers:subagent-driven-development` (o
> `superpowers:executing-plans`). Passi con caselle `- [ ]`. Prove **prima** del codice
> (`superpowers:test-driven-development`). Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Nessun commit senza
> conferma: il controller fotografa il lavoro fra un'attività e l'altra.

Scritto il 2026-10-21, dopo la chiusura della `1G-W2` (commit `f6589e6`).

**Obiettivo:** rendere slug e genitore di un contenuto modificabili dall'editor, così che
il cambio d'indirizzo crei da sé i redirect dal vecchio indirizzo, ricalcoli i percorsi
delle pagine figlie e non lasci catene né cicli (1G-11); in più, togliere le copie di
lavoro dalla vista predefinita del registro (DR-233).

**Architettura:** una rotta dedicata `PUT /contents/:id/address` esegue, in **una**
transazione con un blocco consultivo, il piano calcolato da una sola funzione: nuovo
percorso del contenuto e delle discendenti (per prefisso del percorso materializzato),
redirect automatici per i contenuti pubblicati, riscrittura delle regole che puntavano ai
vecchi indirizzi, controllo finale di catene e cicli. La stessa funzione, in sola lettura,
serve l'anteprima (`GET …/address/preview`) mostrata nella conferma dell'editor. `PATCH
/contents/:id` smette di accettare `slug` e `parentId`. Nessuna modifica al sito pubblico:
legge già percorso e regole a ogni richiesta (DR-105).

**Stack:** Fastify, Zod, Drizzle, Next.js nell'area amministrativa, `packages/ui`, Vitest,
Playwright. **Nessuna dipendenza nuova, nessuna migrazione prevista** (vincoli e indici
esistenti bastano: `contents_path_unique`, `redirects_source_unique`,
`redirects_no_self_loop`).

**Riferimenti:** `CONTEXT.md` §5 RG-01, §7 (1G-11, 1G-22), `PLAN.md` §1, DR-216 D, DR-233,
`docs/architecture/database-schema.md` §4.2 (RC-07), `docs/migration/wp-to-postgres-mapping.md`
§3.2-§3.3 («il nuovo CMS deve creare automaticamente un redirect quando lo slug o il
genitore di un contenuto **pubblicato** cambia»), ADR-003 §3, ADR-007.

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W3-1 | Dall'editor si cambiano slug e genitore di una pagina, slug di una notizia; la conferma dice quali indirizzi cambiano e quali redirect nascono | prove dell'area amministrativa ed e2e |
| W3-2 | Per ogni contenuto **pubblicato** il cui indirizzo cambia nasce un redirect 301 dal vecchio al nuovo; le discendenti si spostano con il genitore, nella stessa transazione | prove dell'API su una gerarchia a tre livelli |
| W3-3 | Nessuna catena: ogni regola esatta che puntava a un vecchio indirizzo punta alla destinazione finale (secondo D130); nessun ciclo, anche riportando lo slug al valore originale | prove dell'API; controllo finale nella transazione |
| W3-4 | Collisione di percorso (anche su una figlia), genitore non valido (sé stesso, una discendente, una notizia), slug riservato (D133) → rifiuto con messaggio in italiano e **nessuna** scrittura | prove dell'API |
| W3-5 | `PATCH /contents/:id` rifiuta `slug` e `parentId`; `POST /contents` rifiuta il genitore di una notizia e la collisione con `409` invece di `500` | prove dell'API |
| W3-6 | Con il database di sviluppo invariato: redirect 181/181, stati 292/292 della matrice (293 indirizzi), 0 catene nuove | `verifica-redirect.ts`, `stati-matrice.py` |
| W3-7 | La vista predefinita «Modifiche al sito» non mostra salvataggi e scarti delle copie di lavoro, che restano in «Tutte le operazioni» e col filtro per operazione (DR-233) | prove dell'API |
| W3-8 | Il cambio d'indirizzo si legge nel registro («Ha cambiato l'indirizzo») e aggiorna «Ultima modifica di X il Y» | prove dell'API e dell'area |
| W3-9 | Verifica come la CI verde | lint, Prettier, tipi, build, test, `db:verify`, copertura, e2e |

## 2. Fatti accertati il 2026-10-21

| Fatto | Fonte |
|---|---|
| `contents.path` materializzato, unico in tutto il sito (pagine e notizie insieme); forma `^/(segmento/)*$`; `parent_id` con `ON DELETE RESTRICT`; le notizie non hanno genitore (CHECK) | `packages/db/src/schema/content.ts:28-79`, `docs/architecture/schema.sql:212-251, 709-711` |
| `pathFor(db, parentId, slug)` → `/<slug>/` o `<percorso del genitore><slug>/` | `apps/api/src/modules/content/service.ts:32-45` |
| `PATCH /contents/:id` **già** accetta `slug` e `parentId` e ricalcola il solo percorso del contenuto: niente transazione, niente redirect, figlie lasciate col vecchio percorso, nessun controllo di cicli né di notizie | `content/schemas.ts:101-107`, `content/service.ts:116-169` (riga 154-158) |
| `POST /contents` calcola il percorso dal genitore ma, per una notizia, salva `parent_id = null`: percorso e albero divergono | `content/service.ts:96-97` |
| Una collisione di percorso arriva al gestore generale come errore 23505 non tradotto → `500` | `apps/api/src/app.ts:181-209` |
| Nessuna rotta usa oggi `WITH RECURSIVE`; transazioni con `db.transaction` e blocco consultivo come in `accounts` | `accounts/service.ts:104, 189-213` |
| Redirect: `source_path` unico, `target_path` testo, `kind` `exact`/`prefix`, `origin` `migration`/`manual`/`automatic` (quest'ultima prevista per il CMS e mai usata), `is_active`; nessuna normalizzazione né controllo di catene nel servizio | `packages/db/src/schema/redirects.ts:25-49`, `modules/redirects/service.ts:64-98` |
| Risoluzione pubblica: un passo solo; il percorso della home → `/`; un contenuto **pubblicato** vince su una regola con la stessa origine; poi regola esatta attiva, poi prefisso più lungo | `apps/web/src/proxy.ts:69-88`, `modules/public/service.ts:901-959` |
| Menu (voci di tipo contenuto), sitemap, elenchi e ricerca leggono `contents.path` a ogni richiesta: seguono lo spostamento da soli | `public/service.ts:750-815, 964-1038` |
| Il canonical scritto a mano (`content_seo.canonical_url`), le voci di menu personalizzate e i collegamenti nel testo dei blocchi sono testo libero: non seguono lo spostamento | `packages/db/src/schema/seo.ts:33`, `menu.ts:44-63` |
| Il sito instrada per conto suo `/media/`, `/forms/`, `/feed/`, `/category/…`, `/download/…`, `/download-category/…`, `/wp-sitemap.xml`; nessun elenco di slug riservati nell'API | `apps/web/next.config.ts:34-36`, `proxy.ts:69-92`, `app/[[...percorso]]/page.tsx:95-150` |
| L'editor ha le schede «Contenuto», «Pagina», «SEO»; nessun campo per slug o genitore; `ContentLayoutPanel` è il modello di una scheda che salva da sola | `apps/admin/src/components/editor/ContentEditor.tsx:413-421`, `ContentLayoutPanel.tsx` |
| `packages/ui` non ha una casella con completamento: per il genitore basta `SelectField` | `packages/ui/src/index.ts` |
| Database di sviluppo (lettura del 2026-10-21): 78 pagine e 30 notizie; **nessuna pagina ha figlie** (profondità 1); 181 regole della migrazione (180 esatte, 1 prefisso), 6 delle quali puntano a un contenuto; 0 canonical scritti a mano; 0 voci di menu personalizzate interne; 0 contenuti su slug riservati | query in sola lettura |
| Una regola della migrazione è **nascosta** da un articolo con lo stesso percorso: `/pronti-a-ripartire/` → un'immagine; `/734-2/` → `/pronti-a-ripartire/` | query in sola lettura |
| Le verifiche 181/181 e 292/292 della 1E richiedono sito, API e istanza di riferimento su `:8088`; non sono nella CI | `tests/visual/verifica-redirect.ts:23`, `tests/visual/stati-matrice.py`, `.planning/phases/1E/AUDIT.md:48, 74` |
| La vista `changes` del registro è `CHANGE_ACTIONS` (29 azioni, comprese `content.draft.save` e `content.draft.discard`); una prova lega l'elenco alle 26 azioni dichiarate nelle rotte | `apps/api/src/modules/audit/actions.ts:8-38`, `service.ts:19`, `tests/audit.test.ts:80-98` |
| «Ultima modifica» conta `content.create`, `content.update`, `content.publish`, `content.unpublish` e il titolo SEO | `modules/audit/service.ts:177-189` |

## 3. Decisioni

### 3.1 Richieste prima di eseguire

| id | Decisione | Opzioni | Raccomandazione | Default vietato |
|---|---|---|---|---|
| **D130** | Regole che puntano al vecchio indirizzo di un contenuto spostato | A — tutte le regole esatte che vi puntano (anche le 181 della migrazione) si riscrivono verso il nuovo indirizzo; 1G-11 «181 invariati» si legge «le 181 regole restano e ognuna porta in un passo alla pagina giusta» · B — si riscrivono solo le regole manuali e automatiche; quelle della migrazione restano com'erano e diventano catene di due passi · C — si rifiuta lo spostamento di un contenuto a cui punta una regola della migrazione | **A**: è l'unica che rispetta «nessuna catena» senza vietare nulla; oggi riguarda 6 contenuti | riscrivere regole della migrazione senza decisione |
| **D131** | Regole già presenti sugli indirizzi coinvolti: in **partenza** (una regola nascosta dal contenuto, come `/pronti-a-ripartire/`) e in **arrivo** (lo slug riportato a un valore precedente, o un indirizzo che è origine di una regola) | A — in partenza la regola nascosta prende come destinazione il nuovo indirizzo (chi visitava quell'indirizzo trovava il contenuto, non la regola); in arrivo una regola automatica si toglie, una manuale o della migrazione fa rifiutare lo spostamento con un messaggio che la indica · B — in partenza la regola nascosta resta com'è e diventa efficace (l'indirizzo porta alla sua vecchia destinazione); in arrivo come A · C — ogni regola coinvolta, anche manuale, si modifica o si toglie da sé, e la conferma lo elenca | **A**: segue ciò che il visitatore vedeva e non cancella mai una scelta esplicita di una persona | modificare o togliere regole manuali senza decisione |
| **D132** | Riferimenti scritti a mano al vecchio indirizzo (canonical personalizzato, voci di menu personalizzate, collegamenti nel testo) | A — non si riscrive nulla: il redirect porta il visitatore in un passo; l'anteprima avvisa se un canonical o una voce di menu personalizzata indica un vecchio indirizzo · B — si riscrivono in automatico canonical e voci di menu personalizzate uguali a un vecchio indirizzo; i collegamenti nel testo no · C — come B, più i collegamenti nel testo dei blocchi | **A**: oggi non ce n'è nessuno (0 e 0); riscrivere il testo dei blocchi tocca la parità approvata (1E-19) | riscrivere contenuti scritti dalla redazione senza decisione |
| **D133** | Slug di primo livello che il sito usa per sé (`category`, `download`, `download-category`, `media`, `forms`, `feed`, `wp-content`, `page`, `fonts`, `admin`, `api`, `_next`, `wp-sitemap.xml`, `sitemap.xml`, `robots.txt`, `favicon.ico`) | A — rifiutati al primo livello, alla creazione e al cambio d'indirizzo, con messaggio in italiano; nessun contenuto esistente toccato (oggi 0) · B — nessun controllo, come oggi: la pagina nascerebbe irraggiungibile | **A**: un indirizzo che il sito non può servire è un errore da fermare prima | rifiutare slug senza decisione |

Se una risposta è diversa da A, aggiornare §5 e le attività T2-T3 prima di eseguirle.

### 3.2 Scelte di dettaglio dichiarate (rivedibili)

| # | Scelta | Motivo |
|---|---|---|
| S1 | Redirect solo per i contenuti **pubblicati** che cambiano indirizzo, figlie comprese, qualunque sia lo stato del genitore | `wp-to-postgres-mapping.md` §3.3; un indirizzo mai servito non ha visitatori |
| S2 | Il genitore di una pagina è una pagina; una notizia non ha genitore | vincolo `contents_posts_have_no_parent` e uso di WordPress |
| S3 | Per la home la destinazione finale è `/` (il suo percorso è già rediretto lì) | evita la catena vecchio percorso → nuovo percorso → `/` |
| S4 | Le regole a prefisso e quelle verso indirizzi esterni non si riscrivono; quelle esatte disattivate sì, così una riattivazione non crea catene | la regola `/wp-content/uploads/` punta a file, non a contenuti |
| S5 | Una sola azione nuova nel registro, `content.address.update` («Ha cambiato l'indirizzo»), con i conteggi nel dettaglio; conta per «Ultima modifica» | il cambio d'indirizzo cambia la pagina pubblica (stesso criterio di DR-231) |
| S6 | La conferma appare solo se almeno un contenuto pubblicato cambia indirizzo | un contenuto in bozza si rinomina senza conseguenze pubbliche |

## 4. Struttura dei file

| Percorso | Che cosa |
|---|---|
| `apps/api/src/modules/audit/actions.ts`, `service.ts` | vista predefinita senza copie di lavoro (DR-233); azione nuova; «Ultima modifica» |
| `apps/api/src/modules/content/address.ts` (nuovo) | `planAddressChange`, `applyAddressChange`, `parentOptions`, slug riservati |
| `apps/api/src/modules/content/routes.ts`, `schemas.ts`, `service.ts` | tre rotte nuove; `PATCH` senza `slug`/`parentId`; `POST` corretto |
| `packages/contracts/src/contentAddress.ts` (nuovo), `index.ts` | `addressPlanSchema`, `addressOptionSchema` e tipi; come `audit.ts` (i contratti dei contenuti oggi stanno in `content/schemas.ts`) |
| `apps/admin/src/components/editor/ContentAddressPanel.tsx` (nuovo), `ContentEditor.tsx` | scheda «Indirizzo» |
| `apps/admin/src/lib/auditLabels.ts` | etichetta dell'azione nuova |
| `apps/api/tests/contentAddress.test.ts`, `apps/admin/tests/content-address.test.tsx`, `tests/e2e/cms/indirizzi.spec.ts` (nuovi); `apps/api/tests/audit.test.ts` | prove |
| `apps/api/tests/openapi.snapshot.json` | rotte nuove, corpo di `PATCH` cambiato |

## 5. Interfacce

Tutte nell'area `redazione`.

| Rotta | Permesso | Risposta |
|---|---|---|
| `GET /contents/:id/address/options` | `content.read` | `{ items: [{ id, title, path }] }`: le pagine, escluse il contenuto e le sue discendenti, ordinate per percorso; `[]` per una notizia |
| `GET /contents/:id/address/preview?slug=&parentId=` | `content.read` | `AddressPlan` (sotto); nessuna scrittura, nessuna riga nel registro |
| `PUT /contents/:id/address` corpo `{ slug, parentId }` | `content.write` | `{ content: ContentDetail, plan: AddressPlan }`; azione `content.address.update` |

```ts
interface AddressPlan {
  path: string;                                   // nuovo percorso del contenuto
  moves: { id: string; title: string; from: string; to: string; published: boolean }[];
  redirectsCreated: { from: string; to: string }[];
  redirectsRetargeted: { source: string; from: string; to: string; origin: string }[];
  redirectsRemoved: { source: string; target: string }[];     // D131-A, regole automatiche in arrivo
  warnings: { kind: 'canonical' | 'menu'; id: string; value: string }[]; // D132-A
}
```

Errori (involucro esistente, codici stabili): `400 VALIDATION_FAILED` (slug malformato),
`400 CONTENT_PARENT_INVALID` (sé stesso, discendente, notizia, genitore inesistente o non
pagina), `400 CONTENT_SLUG_RESERVED` (D133), `409 CONTENT_PATH_TAKEN` (collisione, anche di
una figlia: il messaggio cita l'indirizzo), `409 REDIRECT_AT_DESTINATION` (D131-A: regola
manuale o della migrazione sull'indirizzo d'arrivo, il messaggio la cita), `409
REDIRECT_CYCLE` (rete di sicurezza). Ogni rifiuto lascia il database com'era.

`applyAddressChange` (in transazione, `pg_advisory_xact_lock(hashtext('contents.paths'))`,
righe del sottoalbero `FOR UPDATE`): ricalcola il piano dentro la transazione (mai quello
dell'anteprima), aggiorna `slug`, `parent_id`, `path` del contenuto e `path` delle
discendenti per prefisso, scrive le regole `origin = 'automatic'`, riscrive e toglie
secondo D130/D131, poi verifica che nessuna regola esatta attiva toccata porti a un'altra
regola esatta attiva (catena) né torni su sé stessa (ciclo); in caso contrario annulla.

## 6. Revisione di attenzione

1. **Slug riportato al valore originale** (A → B → A): alla fine resta una sola regola
   B → A, nessuna A → B, nessun ciclo; lo stesso per un genitore cambiato e poi ripristinato.
2. **Collisione su una figlia, non sul contenuto spostato**: nessuna riga cambia,
   nemmeno il contenuto stesso.
3. **Bozza con figlie pubblicate**: redirect solo per le figlie pubblicate; nessuno per il
   genitore in bozza.
4. **Modifiche non salvate nella scheda «Contenuto»**: salvare l'indirizzo non le perde né
   le salva di nascosto (si aggiornano solo percorso, slug e genitore mostrati).
5. **Regola nascosta in partenza** (`/pronti-a-ripartire/`): dopo lo spostamento
   l'indirizzo porta al contenuto spostato, non all'immagine; `/734-2/` porta in un passo
   al nuovo indirizzo.

## 7. Attività

### T0 — Decisioni D130-D133
- [ ] Portarle all'utente; registrare le risposte in `decision-register.md`. Se diverse da
  A, aggiornare §3.2, §5 e T2-T3 prima di eseguire.

### T1 — Vista predefinita del registro senza copie di lavoro (DR-233)
**File:** `modules/audit/actions.ts`, `service.ts`, `tests/audit.test.ts`.
- [ ] Prove (falliscono): con righe `content.draft.save`, `content.draft.discard` e
  `content.update`, la vista predefinita restituisce solo `content.update`; `view=all` le
  restituisce tutte; `action=content.draft.save` restituisce la riga di copia di lavoro
  anche senza `view`.
- [ ] `DEFAULT_VIEW_ACTIONS` in `actions.ts` = `CHANGE_ACTIONS` senza le due azioni delle
  copie di lavoro; `service.ts:19` la usa per `view=changes`; la prova di deriva
  (`audit.test.ts:80-98`) resta su `CHANGE_ACTIONS`.
- [ ] Prove verdi; commento in `PROGRESS.md`.

### T2 — Piano del cambio d'indirizzo, opzioni del genitore e anteprima (sola lettura)
**File:** `content/address.ts`, `routes.ts`, `schemas.ts`, contratti,
`tests/contentAddress.test.ts`.
- [ ] Prove (falliscono) su una gerarchia sintetica a tre livelli (A pubblicata > B
  pubblicata > C pubblicata, più D in bozza sotto B) e sulle regole del §6:
  cambiando lo slug di B, `planAddressChange` restituisce i percorsi nuovi di B, C, D e
  redirect solo per B e C; con B in bozza, redirect solo per C (§6 caso 3); regola
  manuale verso il vecchio percorso di C riscritta; regola nascosta in partenza riscritta
  (D131-A); regola automatica in arrivo tolta; regola manuale in arrivo →
  `REDIRECT_AT_DESTINATION`; collisione su C → `CONTENT_PATH_TAKEN`; genitore uguale a sé,
  a C, o a una notizia → `CONTENT_PARENT_INVALID`; slug `media` al primo livello →
  `CONTENT_SLUG_RESERVED`, ma `media` sotto A è ammesso; home: destinazione `/` (S3);
  canonical uguale a un vecchio percorso → `warnings`.
- [ ] `options`: esclude il contenuto e le discendenti; `[]` per una notizia.
- [ ] Rotte `GET …/address/options` e `GET …/address/preview` con
  `app.requirePermission(PERMISSIONS.contentRead)`; preview non scrive nel registro;
  redazione 200, sessione in area Impostazioni 403.
- [ ] Attuazione; prove verdi; commento in `PROGRESS.md`.

### T3 — Applicazione in transazione e correzioni delle rotte esistenti
**File:** `content/address.ts`, `routes.ts`, `schemas.ts`, `service.ts`,
`modules/audit/actions.ts`, `service.ts`, OpenAPI, `tests/contentAddress.test.ts`,
`tests/audit.test.ts`.
- [ ] Prove (falliscono): `PUT …/address` applica il piano di T2 e, dopo, `GET
  /public/redirect?path=<vecchio di B>` risponde 301 verso il nuovo, `GET
  /public/content?path=<nuovo di C>` 200; ogni rifiuto di T2 lascia **tutte** le righe di
  `contents` e `redirects` invariate; A → B → A (§6 caso 1); controllo finale: una regola
  preparata ad arte che creerebbe una catena → `REDIRECT_CYCLE` e nulla scritto; riga del
  registro `content.address.update` con `entityId` del contenuto e conteggi nel dettaglio;
  «Ultima modifica» cambia; `PATCH /contents/:id` con `slug` o `parentId` → `400`; `POST
  /contents` con notizia e `parentId` → `400`, con percorso occupato → `409
  CONTENT_PATH_TAKEN`, con slug riservato → `400`.
- [ ] Azione nuova in `CHANGE_ACTIONS` e in `PUBLIC_CHANGES` di «Ultima modifica»; numero
  delle azioni dichiarate 26 → 27 nella prova di deriva e nel commento di `actions.ts`.
- [ ] Attuazione; snapshot OpenAPI rigenerata; prove verdi; commento in `PROGRESS.md`.

### T4 — Scheda «Indirizzo» nell'editor
**File:** `ContentAddressPanel.tsx`, `ContentEditor.tsx`, `lib/auditLabels.ts`,
`tests/content-address.test.tsx`.
- [ ] Prove (falliscono): la scheda mostra slug e, per una pagina, «Pagina genitore»
  (`SelectField` con «Nessuna, primo livello» e le opzioni di T2); l'indirizzo risultante si
  aggiorna mentre si scrive; «Salva l'indirizzo» chiede l'anteprima e, se un contenuto
  pubblicato cambia indirizzo (S6), apre una conferma con l'elenco «da → a» e i redirect;
  annullare non scrive; confermare chiama `PUT` e aggiorna percorso e intestazione senza
  toccare le modifiche non salvate della scheda «Contenuto» (§6 caso 4); ogni errore del §5
  si legge in italiano accanto al campo; gli avvisi di D132-A sono elencati; l'azione nuova
  ha la sua etichetta nel registro.
- [ ] Attuazione con `packages/ui` (`TextField`, `SelectField`, `Dialog` o
  `ConfirmDestructive`, `Alert`); navigazione da tastiera ed etichette; prove verdi;
  commento in `PROGRESS.md`.

### T5 — Prove end-to-end
**File:** `tests/e2e/cms/indirizzi.spec.ts`.
- [ ] Come redazione: crea una pagina e una figlia, le pubblica, cambia lo slug della
  madre dalla scheda «Indirizzo», conferma; il vecchio indirizzo della madre e quello della
  figlia, aperti sul sito, arrivano ai nuovi in un passo (risposta 301, poi 200).
- [ ] Riporta lo slug al valore originale: i vecchi indirizzi rispondono di nuovo 200, i
  secondi indirizzi portano ai primi; nessun ciclo.
- [ ] Come amministrazione: il registro mostra «Ha cambiato l'indirizzo» per quel
  contenuto.
- [ ] Commento in `PROGRESS.md`.

### T6 — Verifica e chiusura
- [ ] Revisione del codice dell'intera wave (`code-reviewer`) e revisione di sicurezza
  mirata (redirect aperti, autorizzazione delle rotte nuove, transazione) senza critici o
  alti aperti.
- [ ] Verifica come la CI: `pnpm lint`, `npx prettier --check . --end-of-line auto`,
  `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm db:verify`, `pnpm test:coverage`,
  `pnpm test:e2e`; poi ricompilare e riavviare sito, area amministrativa e API di sviluppo.
- [ ] Non regressione sul database di sviluppo invariato (W3-6), con l'istanza di
  riferimento avviata (`docker start wpref-db-1 wpref-wp-1`, sola lettura):
  `SITO=http://127.0.0.1:3200 API=http://127.0.0.1:3002 WPREF_URL=http://localhost:8088 pnpm exec tsx tests/visual/verifica-redirect.ts`
  → 181/181; `python tests/visual/stati-matrice.py` → 292 conformi; poi istanza fermata.
- [ ] Riga `PHASE:1G WAVE:1G-W3 STATUS:complete`; commit e push **su conferma**; controllo
  della CI.

## 8. Cosa la wave non fa

- Non sposta né rinomina contenuti del database di sviluppo: le prove usano il proprio
  database.
- Non riscrive i collegamenti nel testo dei blocchi (D132) né corregge catene preesistenti
  della migrazione che non riguardano contenuti spostati.
- Non aggiunge il genitore alla finestra di creazione: si sceglie dopo, nell'editor.
- Non aggiorna i contatori di utilizzo dei redirect (`hit_count`), oggi mai scritti.
- Non tocca il sito pubblico né il proxy.
- Non cambia l'importer: una riesecuzione dell'import ricalcolerebbe le regole della
  migrazione dalla sorgente (rischio dichiarato, §9).

## 9. Rischi

| Rischio | Mitigazione |
|---|---|
| Uno spostamento lascia l'albero a metà (figlie col vecchio percorso) | una transazione, blocco consultivo, piano ricalcolato dentro la transazione, prove di annullamento |
| Catene o cicli nascosti | controllo finale nella transazione; prove A → B → A; 181/181 a fine wave |
| Con D130-A o D131-A una riesecuzione dell'importer riporterebbe le regole della migrazione ai valori della sorgente | l'import reale non si riesegue dopo modifiche della redazione senza decisione; da ricordare nella 1F |
| Memoria della macchina per e2e e verifica completa | un pacchetto di prove per volta; server di sviluppo spenti durante gli e2e |

## 10. Decisioni emerse dalle revisioni finali (T6, 2026-10-21)

Revisione finale del codice: 0 critici, 2 importanti (I-1, I-2). Revisione di sicurezza
mirata: 0 critici, 0 alti, 2 medi (M1, M2), 5 bassi (L1-L5). Rapporti nella cartella di
lavoro della wave. Esecuzione ferma fino alle risposte (skill `grill-me`).

| id | Decisione | Opzioni | Raccomandazione | Default vietato |
|---|---|---|---|---|
| **D134** | Ritorno all'indirizzo originale quando al primo spostamento è stata riusata una regola nascosta (I-1, caso `/pronti-a-ripartire/`) | A — la regola riusata come redirect automatico diventa `origin = 'automatic'`; al ritorno si toglie come ogni automatica · B — l'origine resta; in arrivo si toglie una regola esatta non automatica che punta al vecchio indirizzo dello stesso contenuto · C — come ora: ritorno rifiutato, la regola va tolta a mano dalla pagina dei redirect | **A** | cambiare l'origine o togliere regole della migrazione o manuali senza decisione |
| **D135** | Regola automatica sull'indirizzo d'arrivo di una **bozza** (I-2) | A — si toglie solo se il contenuto che arriva è pubblicato; la conferma si apre anche quando il piano riscrive o toglie una regola attiva (S6 esteso) · B — si toglie comunque (D131-A letterale), con la conferma estesa che lo dice · C — come ora | **A** | togliere regole attive di una bozza senza decisione |
| **D136** | Slug con segmenti di punto e codifiche percentuali (M1) | A — rifiutati: codifiche `%xx` incomplete, slug che decodificato è `.`/`..` o contiene `/`, `\`, caratteri di controllo; slug riservati sulla forma decodificata; controlli di catena e anello su percorsi normalizzati · B — slug ristretto a `[a-z0-9-]` · C — nessun cambio | **A** | rifiutare slug senza decisione (D133) |
| **D137** | Redirect aperto preesistente nelle regole manuali, `//host` e `/\host` (M2) | A — rifiutati nello schema dell'API; proxy invariato (§8) · B — come A, più il proxy del sito che non redirige fuori dall'origine · C — rinvio alla 1F | **A** | toccare moduli fuori dalla wave senza decisione |
| **D138** | Permessi di `PUT /contents/:id/address` (L1) | A — anche `settings.write` quando il piano tocca regole esistenti e `content.publish` quando sposta un contenuto pubblicato · B — solo `content.write`, come il §5; confine registrato e rivisto quando i ruoli si dividono | **B** | cambiare permessi senza decisione |

Correzioni senza decisione nell'unica ondata finale: aiuto delle prove in corsa con
`try/finally`; `contentAddress.test.ts` diviso (1199 righe); token `--amoris-space-5`
inesistente; scheda «Indirizzo» disattivata mentre l'editor salva; testo «L'indirizzo
pubblico ora è …» corretto per bozze e home (e2e allineato); violazione 23503 del genitore →
`400 CONTENT_PARENT_INVALID`.
