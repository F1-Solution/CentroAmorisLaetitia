# Piano della wave 1G-W4 — Estratto, immagine in evidenza, categorie, eliminazione

> **Per chi esegue:** sotto-skill richiesta `superpowers:subagent-driven-development` (o
> `superpowers:executing-plans`). Passi con caselle `- [ ]`. Prove **prima** del codice
> (`superpowers:test-driven-development`). Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Nessun commit senza
> conferma: il controller fotografa il lavoro fra un'attività e l'altra.

Scritto il 2026-10-21, dopo la chiusura della `1G-W3` (commit `10428f4`).

**Obiettivo:** dall'area amministrativa si cambiano estratto, immagine in evidenza e
categorie di una notizia, si creano e rinominano le categorie, e si elimina un contenuto
con conferma, con un rifiuto spiegato quando l'eliminazione romperebbe qualcosa (1G-12,
1G-13).

**Architettura:** l'estratto entra nella scheda «Contenuto» e segue la copia di lavoro come
il titolo. Immagine in evidenza e categorie stanno in una scheda nuova, «Elenchi e
archivi», che salva da sola come «Pagina» e «Indirizzo». Le categorie di una notizia hanno
una rotta propria, `PUT /contents/:id/terms`. L'eliminazione aggiunge un'anteprima in sola
lettura, `GET /contents/:id/deletion`, che dice che cosa la impedisce. `DELETE
/contents/:id` esiste già: si porta in una transazione con il blocco dei percorsi e con
codici d'errore stabili. Il sito legge già tutto a ogni richiesta (DR-105): se D139 = A,
`apps/web` non si tocca.

**Stack:** Fastify, Zod, Drizzle, Next.js nell'area amministrativa, `packages/ui`, Vitest,
Playwright. **Nessuna dipendenza nuova, nessuna migrazione prevista**: colonne, tabelle e
vincoli esistenti bastano.

**Riferimenti:** `CONTEXT.md` §1, §7 (1G-12, 1G-13, 1G-20, 1G-22), `PLAN.md` §1-§3,
DR-217 A, B, C, DR-218 (D115), DR-240, DR-242, `DECISIONI-1G.md` §5, ADR-005 §7, ADR-007.

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W4-1 | L'estratto di una notizia si cambia nella scheda «Contenuto». Il sito lo mostra dove dice D139. Svuotarlo riporta l'inizio automatico del testo | prove dell'API e dell'area, e2e |
| W4-2 | L'immagine in evidenza di una notizia si sceglie, si cambia e si toglie. Il sito la mostra in archivio, ricerca ed «Elenco articoli». Un media inesistente, privato o non immagine è rifiutato con `400` | prove dell'API e dell'area, e2e |
| W4-3 | Le categorie di una notizia si assegnano e si tolgono. L'archivio di categoria la mostra, o smette di mostrarla, alla richiesta successiva. Vale la regola di D141 | prove dell'API e dell'area, e2e |
| W4-4 | La schermata «Categorie» crea e rinomina. Il nome nuovo si legge sull'archivio. Lo slug segue D140. Un duplicato è rifiutato con `409` e non con `500` | prove dell'API e dell'area, e2e |
| W4-5 | «Elimina» nell'editor apre una conferma. Figlie, voci di menu e pagina iniziale fanno rifiutare secondo D143, con un messaggio che le nomina e **nessuna** scrittura. Non esce mai un `500` | prove dell'API su ogni dipendenza, e2e |
| W4-6 | Il registro mostra «Ha cambiato le categorie» e «Ha eliminato», con il titolo leggibile anche dopo l'eliminazione. «Ultima modifica» si aggiorna per estratto, immagine e categorie | prove dell'API e dell'area |
| W4-7 | Con il database di sviluppo invariato: redirect 181/181, stati 292/292. `apps/web` cambia (D139 = B): il confronto visivo degli archivi e della ricerca è registrato nel rapporto di parità come difformità DR-243, da accettare nella `1G-W7` | `verifica-redirect.ts`, `stati-matrice.py` |
| W4-8 | La verifica come la CI è verde | lint, Prettier, tipi, build, test, `db:verify`, copertura, e2e |

## 2. Fatti accertati il 2026-10-21

| Fatto | Fonte |
|---|---|
| `contents.excerpt` è testo nullabile. `PATCH /contents/:id` lo accetta già (max 5000) e la copia di lavoro lo contiene. Cambiarlo azzera `description_source` (DR-180). `''` resta `''`, mentre l'import scrive `NULL` | `packages/db/src/schema/content.ts:44, 54, 130`, `content/schemas.ts:133`, `content/service.ts:111-133`, `tests/descriptionSource.test.ts:112-126` |
| Archivio di categoria e ricerca mostrano l'**inizio del testo** e non l'estratto, come Divi con `divi_use_excerpt=false`. L'estratto si vede in «Elenco articoli» (`showExcerpt`), nel feed e nella meta description delle notizie | `apps/web/src/components/Views.tsx:167`, `lib/format.ts:42-58`, `public/service.ts:273-301, 612-626`, `lib/feed.ts:36` |
| Quando l'estratto è vuoto, quello automatico si calcola a ogni richiesta e non si salva | `public/service.ts:273, 616` |
| `contents.featured_media_id` ha FK `ON DELETE SET NULL` e `PATCH` lo accetta già. Un id inesistente dà 23503 e quindi `500`. Non si controlla che il media sia pubblico né che sia un'immagine. Un media privato scelto sparisce in silenzio dal sito | `content.ts:55`, `content/schemas.ts:149`, `app.ts:181-208`, `public/service.ts:128` |
| L'immagine in evidenza si vede in archivio e ricerca (`Thumbnail`, variante 1080×675, altrimenti l'originale senza misure), in «Elenco articoli» e nei dati strutturati. La pagina singola e `og:image` non la usano | `Views.tsx:117-133`, `web/src/lib/featured.ts:23-46`, `PostList.tsx:33-39`, `structuredData.ts:317`, `public/service.ts:419-432` |
| Un media caricato dal CMS non ha varianti né misure: come immagine in evidenza esce l'originale | `media/service.ts:93-106`, `DECISIONI-1G.md:162` |
| Eliminare un media usato come immagine in evidenza è già rifiutato con `409` (`citedBy`), senza una prova dedicata | `media/service.ts:197-237` |
| `MediaPicker` esiste ed è usato solo per l'immagine OG. Chiede un testo alternativo obbligatorio. Elenca da `GET /media?mimePrefix=image/` | `packages/ui/src/media/MediaPicker.tsx:45-49`, `ContentSeoPanel.tsx:151-157, 284-298` |
| Termini: `terms(taxonomy, slug, name, parent_id, path, …)` con `unique(taxonomy, slug)` e `unique(path)`; legame `content_terms` in `CASCADE`. Nel database ci sono 2 categorie (`news` 21 notizie, `senza-categoria` 9), 0 termini con genitore, nessun `post_tag`; ogni notizia ha esattamente una categoria | `packages/db/src/schema/taxonomy.ts`, lettura del 2026-10-21 |
| La categoria predefinita della sorgente è `default_category = 1`, cioè `senza-categoria`. Nel database di sviluppo non esiste una chiave d'impostazione equivalente | dump `BackupDB-2026-09-13`, `terms.legacy_id`, lettura di `settings` |
| `GET/POST/PATCH/DELETE /terms` esistono già (area `redazione`, `content.write`, azioni `term.*`). Restituiscono tutte le tassonomie. Uno slug duplicato dà 23505 e quindi `500`. Lo slug non nasce dal nome e la sua regola è più lasca di `slugSchema`. `PATCH` con uno slug nuovo cambia l'indirizzo dell'archivio senza redirect | `terms/routes.ts`, `terms/schemas.ts:16-27`, `terms/service.ts:86-100` |
| Nessuna rotta assegna categorie a un contenuto. `termsOf` non è usata e `GET /contents/:id` non restituisce i termini. L'area amministrativa non ha una schermata dei termini | `content/service.ts:215`, `MenuManager.tsx:127` |
| Archivio: un solo segmento (`/category/<slug>/`, `page/N/`, 6 per pagina). Il feed della categoria ha 10 voci. La sitemap contiene le categorie con almeno una notizia pubblicata. Le voci di menu di una categoria seguono `terms.path`; i blocchi «Elenco articoli» filtrano per id del termine | `app/[[...percorso]]/page.tsx:50, 105-123`, `proxy.ts:76-80`, `public/service.ts:72, 790, 849-892, 989-1005` |
| `DELETE /contents/:id` esiste (`content.write`, azione `content.delete`). Rifiuta con `409` se ci sono figlie, ma con codice `INTERNAL_ERROR` e senza nominarle. Non usa transazione né blocco | `content/routes.ts:272-289`, `content/service.ts:199-212` |
| Eliminare un contenuto che è in un menu dà `500`: `menu_items.content_id` è `ON DELETE SET NULL` e il vincolo `menu_items_target_matches_kind` vieta `content_id` nullo per le voci di tipo contenuto. **57 pagine su 106 contenuti** sono in un menu | `packages/db/src/schema/menu.ts:46, 61-64`, lettura del 2026-10-21 |
| Eliminare la pagina iniziale lascia `site.home_content_id` senza destinazione, e `/` risponderebbe 404. Le regole di redirect verso l'indirizzo eliminato restano: 6 contenuti oggi sono destinazione di una regola | `public/service.ts:353`, lettura del 2026-10-21 |
| Con il contenuto spariscono in cascata copia di lavoro, revisioni, SEO e legami alle categorie. Le righe del registro restano (`entity_id` testo), ma l'etichetta del contenuto non si risolve più | `audit/service.ts:101`, vincoli `pg_constraint` |
| Stati: `draft`, `published`, `archived` (nessuna rotta produce `archived`); non esiste un cestino | `packages/db/src/schema/enums.ts:6`, `content/service.ts:193` |
| Schede dell'editor: «Contenuto» (copia di lavoro e Salva con `PATCH`), «Pagina», «SEO», «Indirizzo» (salvano da sole). `ContentDetail` dell'area non ha `featuredMediaId`. `ConfirmDestructive` chiede di scrivere il nome ed è già usato per media e voci di menu | `ContentEditor.tsx:205-271, 374-386, 419-424, 479-484`, `lib/editor/roundtrip.ts:37-63`, `MediaLibrary.tsx:448-458` |
| «Ultima modifica» conta `content.create`, `.update`, `.publish`, `.unpublish`, `.address.update` e il titolo SEO. `content.delete` e `term.*` hanno già un'etichetta nel registro | `audit/service.ts:178-197`, `lib/auditLabels.ts:5-34` |
| Non sono provati: `DELETE /contents/:id`, le rotte `/terms` (salvo la creazione), `featuredMediaId` via `PATCH`, l'eliminazione di un contenuto in un menu. L'e2e dell'eliminazione manca (`DECISIONI-1G.md:171`) | `apps/api/tests/`, `tests/e2e/cms/` |

## 3. Decisioni

### 3.1 Richieste prima di eseguire

| id | Decisione | Opzioni | Raccomandazione | Default vietato |
|---|---|---|---|---|
| **D139** | Dove il sito mostra l'estratto di una notizia | A — dove lo mostrava la sorgente: «Elenco articoli», feed, meta description. Archivio e ricerca continuano a mostrare l'inizio del testo (Divi), e l'editor dice dove compare. 1G-12 si legge «negli elenchi che lo prevedono» · B — anche archivio e ricerca mostrano l'estratto quando c'è: **20 notizie su 30** cambiano subito aspetto in archivio e ricerca, una difformità di parità da approvare nella 1G-W7 | **A**: lascia intatta la parità approvata (DR-210) e l'estratto resta visibile dove il sito lo usava | cambiare la resa di archivio e ricerca senza decisione |
| **D140** | Slug di una categoria | A — rinominare cambia solo il nome. Lo slug si sceglie alla creazione, proposto dal nome, e poi non cambia: l'indirizzo dell'archivio resta · B — nome e slug modificabili; cambiando lo slug nasce un redirect 301 automatico a prefisso da `/category/<vecchio>/` (pagine e feed compresi), con le regole anti-catena della 1G-W3 · C — nome e slug modificabili senza redirect: il vecchio archivio risponde 404 | **A**: DR-217 B chiede «rinominare», e l'indirizzo indicizzato non si rompe | cambiare l'indirizzo di un archivio senza decisione |
| **D141** | Una notizia senza categoria | A — per pubblicare una notizia serve almeno una categoria; l'ultima categoria di una notizia pubblicata non si toglie; nessuna categoria predefinita · B — come WordPress: una notizia senza categoria va in «Senza categoria», la categoria predefinita della sorgente. Serve dire quale sia (chiave d'impostazione nuova o regola fissa sul termine importato) · C — nessun obbligo: una notizia può non avere categorie e allora non compare in nessun archivio | **A**: conserva la regola della sorgente (0 notizie su 30 senza categoria) senza aggiungere chiavi d'impostazione, che D115 esclude | rifiutare pubblicazioni o assegnare categorie in automatico senza decisione |
| **D142** | Come si elimina un contenuto | A — eliminazione definitiva, come fa già l'API. Con il contenuto spariscono copia di lavoro, SEO e legami alle categorie; il registro conserva titolo e indirizzo. Si conferma scrivendo il titolo. Per un contenuto pubblicato serve anche `content.publish` (stesso principio di DR-242) · B — definitiva, con il solo `content.write` · C — cestino recuperabile: stato nuovo, schermata del cestino, svuotamento. È fuori dal perimetro di D115 (revisioni e ripristino) e richiede una migrazione | **A**: è ciò che DR-217 C chiede, e con lo stesso confine di permessi appena scelto per gli indirizzi | cancellare dati o cambiare permessi senza decisione |
| **D143** | Che cosa succede a ciò che punta al contenuto eliminato | A — rifiuto spiegato se ha figlie, se è in un menu (le voci si elencano e vanno tolte prima dal menu) o se è la pagina iniziale. Le regole di redirect verso il suo indirizzo restano, e la conferma le elenca: porteranno a «pagina non trovata» e si sistemano dalla pagina dei redirect. Il suo indirizzo risponde 404 · B — come A, ma le voci di menu si tolgono insieme al contenuto e la conferma le elenca · C — come A, ma le regole verso il suo indirizzo si disattivano | **A**: niente sparisce dal menu pubblico senza una scelta esplicita, e nessuna regola scritta da una persona cambia | togliere voci di menu o cambiare regole senza decisione |

Se una risposta è diversa da A, aggiornare §3.2, §5 e le attività interessate prima di
eseguirle.

**Risposte del 2026-10-21 (DR-243…247):** D139 = **B**, D140-D143 = A. Per D139 = B sono
stati aggiornati W4-7, S1, S10 (nuova), §4, §5, T3, T4, T6, T7, §8 e §9. Nel database di
sviluppo hanno un estratto 19 notizie pubblicate su 28 (più 1 bozza) e 5 pagine
pubblicate su 78; un estratto contiene 2 collegamenti HTML, due contengono un a capo.

### 3.2 Scelte di dettaglio dichiarate (rivedibili)

| # | Scelta | Motivo |
|---|---|---|
| S1 | Campo «Estratto» (area di testo) nella scheda «Contenuto», **solo per le notizie**, sotto il titolo, salvato con il contenuto (copia di lavoro e «Salva»). Svuotato diventa `NULL`. Un testo d'aiuto dice dove compare (D139 = B): archivio della categoria, ricerca, «Elenco articoli», feed e descrizione per i motori di ricerca; vuoto, si usa l'inizio del testo | l'estratto è già nella copia di lavoro e nel `PATCH`; oggi il sito lo usa solo per le notizie |
| S2 | Scheda nuova «Elenchi e archivi», **solo per le notizie**: immagine in evidenza e categorie. Salva da sola, sul modello di `ContentLayoutPanel` | effetto immediato come «Pagina» e «Indirizzo»; l'immagine in evidenza di una pagina non compare sul sito |
| S3 | Immagine in evidenza con `MediaPicker`: solo immagini **pubbliche**, senza testo alternativo da scrivere (l'alt appartiene al media), con anteprima e «Togli». Nell'API, `featuredMediaId` inesistente, privato o non immagine → `400 CONTENT_MEDIA_INVALID` | oggi `500` o sparizione silenziosa |
| S4 | Categorie di una notizia: `PUT /contents/:id/terms`, solo tassonomia `category`, solo notizie. Azione `content.terms.update` («Ha cambiato le categorie»), che conta per «Ultima modifica». Non passa dalla copia di lavoro | l'archivio cambia subito, come per l'indirizzo |
| S5 | Schermata «Categorie» in Redazione: elenco (nome, indirizzo dell'archivio, numero di notizie), «Nuova categoria» (nome; slug proposto dal nome con la regola di `slugSchema`, DR-240), «Rinomina». Solo `category`; le altre tassonomie non compaiono. Un duplicato dà `409 TERM_SLUG_TAKEN` | DR-217 B; nessuna voce che risponda 404 (1G-20) |
| S6 | Le categorie **non si eliminano** dall'interfaccia: `DELETE /terms/:id` resta solo API, com'è | DR-217 B dice «creare e rinominare» |
| S7 | «Elimina» nell'intestazione dell'editor, accanto a «Ritira». Prima chiede l'anteprima dell'eliminazione: se qualcosa la impedisce, lo elenca e non offre la conferma; altrimenti `ConfirmDestructive` chiede di scrivere il titolo. Dopo l'eliminazione si torna all'elenco, con un avviso | un solo punto, dove la persona già vede il contenuto |
| S8 | `DELETE` in una transazione con il blocco dei percorsi della 1G-W3, perché nessuna figlia nasca a metà. Codici stabili: `409 CONTENT_HAS_CHILDREN`, `409 CONTENT_IN_MENU`, `409 CONTENT_IS_HOME`, con messaggi in italiano che nominano figlie, voci e menu. Il dettaglio della riga `content.delete` conserva titolo e percorso | oggi `INTERNAL_ERROR` o `500`; il registro deve restare leggibile (1G-9) |
| S9 | Nessuna gerarchia delle categorie (genitore), nessun tag, nessun `og:image` preso dall'immagine in evidenza | 0 termini con genitore; l'archivio ha un solo segmento; fuori da DR-217 |
| S10 | Archivio e ricerca (D139 = B): un risultato con un estratto non vuoto mostra l'estratto al posto dell'inizio del testo, **intero e senza taglio**, in un paragrafo `<p>`; gli a capo diventano interruzioni di riga, i tag HTML si tolgono lasciandone il testo, le entità si decodificano. Vale per ogni risultato con un estratto, comprese le pagine nella ricerca (DR-248: dalla `1G-W5` solo le notizie). Senza estratto resta `archiveSummary` dell'inizio del testo. Nessuna rotta dell'API cambia: `GET /public/posts` e `/public/search` restituiscono già `excerpt` | è la resa di `truncate_post` di Divi con `divi_use_excerpt = on`, che stampa `the_excerpt` (con `wpautop`); testo e non HTML perché l'estratto del CMS è testo semplice |

## 4. Struttura dei file

| Percorso | Che cosa |
|---|---|
| `apps/api/src/modules/content/deletion.ts` (nuovo) | `deletionBlockers(exec, id)` e `removeContent(db, id, permissions)` in transazione |
| `apps/api/src/modules/content/routes.ts`, `schemas.ts`, `service.ts` | `GET …/deletion`, `DELETE` corretto, `PUT …/terms`, validazione di `featuredMediaId`, estratto vuoto → `NULL`, `termIds` e `featuredMedia` nel dettaglio, regola D141 nella pubblicazione |
| `apps/api/src/modules/terms/routes.ts`, `schemas.ts`, `service.ts` | conteggio delle notizie, slug con la regola dei contenuti, `409` per il duplicato, regola D140 |
| `apps/api/src/modules/audit/actions.ts`, `service.ts` | azione nuova; «Ultima modifica»; titolo dei contenuti eliminati |
| `packages/contracts/src/contentDeletion.ts`, `terms.ts` (nuovi), `index.ts` | `deletionPreviewSchema`, `categorySchema` e tipi |
| `apps/admin/src/components/editor/ContentListingPanel.tsx` (nuovo), `ContentDeleteAction.tsx` (nuovo), `ContentEditor.tsx` | scheda «Elenchi e archivi», campo «Estratto», azione «Elimina» |
| `apps/admin/src/app/redazione/categorie/` (nuova), `components/terms/CategoryManager.tsx` (nuovo), `lib/areas.ts` | schermata «Categorie» e voce di navigazione |
| `apps/admin/src/lib/auditLabels.ts`, `lib/editor/roundtrip.ts` | etichetta nuova; `featuredMediaId` e `termIds` nel dettaglio |
| `apps/api/tests/contentDeletion.test.ts`, `contentListing.test.ts`, `terms.test.ts` (nuovi); `audit.test.ts`, `openapi.snapshot.json` | prove dell'API |
| `apps/admin/tests/content-listing.test.tsx`, `content-delete.test.tsx`, `categories.test.tsx` (nuovi) | prove dell'area |
| `tests/e2e/cms/notizie.spec.ts` (nuovo); seme sintetico se mancano categorie | e2e |
| `apps/web/src/components/Views.tsx`, `apps/web/src/lib/format.ts`, `apps/web/tests/views.test.tsx`, `searchView.test.tsx`, `format.test.ts` | D139 = B: estratto in archivio e ricerca (S10) |
| `docs/qa/visual-parity-report.md` | §13 nuovo: difformità DR-243 con le viste cambiate, da accettare nella `1G-W7` |

## 5. Interfacce

Tutte nell'area `redazione`. D139 = B non cambia rotte: l'archivio e la ricerca pubblici
restituiscono già `excerpt`.

| Rotta | Permesso | Risposta |
|---|---|---|
| `GET /contents/:id` (esistente) | `content.read` | aggiunge `termIds: string[]` e `featuredMedia: { id, title, thumbnailUrl } \| null` |
| `PATCH /contents/:id` (esistente) | `content.write` | `featuredMediaId` validato (S3); `excerpt: ''` salvato come `null` |
| `PUT /contents/:id/terms` corpo `{ termIds: string[] }` | `content.write` | `{ termIds, lastChange }`; `400 CONTENT_TERMS_INVALID` (termine inesistente o non `category`, contenuto non notizia); `400 CONTENT_CATEGORY_REQUIRED` (D141-A, lista vuota per una notizia pubblicata); azione `content.terms.update` |
| `POST /contents/:id/publish` (esistente) | `content.publish` | D141-A: notizia senza categoria → `400 CONTENT_CATEGORY_REQUIRED` |
| `GET /contents/:id/deletion` | `content.read` | `DeletionPreview` (sotto); nessuna scrittura, nessuna riga nel registro |
| `DELETE /contents/:id` (esistente) | `content.write`, più `content.publish` se pubblicato (D142-A) | `204`; `409` con i codici di S8; `403 NOT_AUTHORIZED` con il messaggio generico di `requirePermission` (nessun indizio del permesso mancante); ogni rifiuto non scrive nulla |
| `GET /terms?taxonomy=category` (esistente) | `content.read` | aggiunge `contentCount` a ogni voce |
| `POST /terms` (esistente) | `content.write` | per `category`: slug con `slugSchema`; `409 TERM_SLUG_TAKEN` |
| `PATCH /terms/:id` (esistente) | `content.write` | D140-A: per `category` solo `name` (e `description`); `slug` → `400` |

```ts
interface DeletionPreview {
  blocked: boolean;
  children: { id: string; title: string; path: string }[];
  menuItems: { id: string; label: string; menu: string }[];
  isHome: boolean;
  redirectsToPath: { source: string }[]; // D143-A: restano, la conferma li elenca
}
```

## 6. Revisione di attenzione

1. **Contenuto in un menu:** l'eliminazione è rifiutata con l'elenco delle voci. Nessuna
   riga cambia e non esce mai un `500`, nemmeno se una voce viene aggiunta fra anteprima
   ed eliminazione (il controllo si ripete nella transazione).
2. **Modifiche non salvate nella scheda «Contenuto»:** salvare «Elenchi e archivi» non le
   perde e non le salva di nascosto. Salvare l'estratto invariato non cambia la data di
   modifica né `description_source` (ADR-005 §7).
3. **Categoria rinominata:** indirizzo dell'archivio, voci di menu e blocchi «Elenco
   articoli» funzionano ancora. L'etichetta di una voce di menu personalizzata non cambia:
   è un testo suo, come in WordPress.
4. **Immagine appena caricata come immagine in evidenza:** non ha varianti, quindi in
   archivio esce l'originale. Va provato che la vista resti nella sua cornice; se non ci
   resta, il difetto passa alla 1G-W5 (dimensioni derivate) e si dichiara qui.
   **Esito (2026-10-22):** il foglio di stile contiene la larghezza, ma un originale verticale
   non si ritaglia e si scarica intero. Il difetto passa alla 1G-W5 (dimensioni derivate).
5. **Ultima categoria di una notizia pubblicata** (D141-A): toglierla è rifiutato con un
   messaggio; per una bozza è ammesso, ma la pubblicazione poi lo chiede.

## 7. Attività

### T0 — Decisioni D139-D143
- [x] Portarle all'utente; registrare le risposte in `decision-register.md` (DR-243…247). Se sono diverse
  da A, aggiornare §3.2, §5 e le attività prima di eseguire.

### T1 — Eliminazione nell'API
**File:** `content/deletion.ts`, `routes.ts`, `schemas.ts`, `service.ts`, contratti,
`modules/audit/*`, `tests/contentDeletion.test.ts`.
- [ ] Prove (falliscono), su dati sintetici:
  - contenuto senza dipendenze: `204`, e spariscono anche copia di lavoro, SEO e legami alle categorie;
  - figlia → `409 CONTENT_HAS_CHILDREN` con il titolo della figlia;
  - voce di menu → `409 CONTENT_IN_MENU` con etichetta e menu (oggi `500`);
  - pagina iniziale → `409 CONTENT_IS_HOME`;
  - pubblicato senza `content.publish` → `403 NOT_AUTHORIZED`, bozza con `content.write` → `204` (D142-A);
  - ogni rifiuto lascia invariate le tabelle `contents`, `menu_items`, `redirects`, `content_terms`;
  - anteprima: elenca figlie, voci, home e regole verso l'indirizzo, e non scrive nulla, nemmeno nel registro;
  - riga `content.delete` con titolo e percorso nel dettaglio, etichetta leggibile nel registro dopo l'eliminazione;
  - sessione dell'area Impostazioni → `403`.
- [ ] Attuazione (S8); prove verdi; snapshot OpenAPI; commento in `PROGRESS.md`.

### T2 — Categorie nell'API
**File:** `modules/terms/*`, `content/routes.ts`, `schemas.ts`, `service.ts`,
`modules/audit/*`, contratti, `tests/terms.test.ts`, `tests/audit.test.ts`.
- [ ] Prove (falliscono):
  - `GET /terms?taxonomy=category` con `contentCount`;
  - `POST` con slug duplicato → `409 TERM_SLUG_TAKEN` (oggi `500`), con slug malformato secondo DR-240 → `400`;
  - `PATCH` del nome → l'archivio pubblico mostra il nome nuovo all'indirizzo di prima, e lo `slug` è rifiutato (D140-A);
  - `PUT /contents/:id/terms` assegna e toglie, e `GET /public/posts` per quel termine segue alla richiesta successiva;
  - termine di un'altra tassonomia, o contenuto pagina → `400 CONTENT_TERMS_INVALID`;
  - lista vuota per una notizia pubblicata → `400 CONTENT_CATEGORY_REQUIRED`, per una bozza ammessa (D141-A);
  - pubblicare una notizia senza categoria → `400 CONTENT_CATEGORY_REQUIRED`;
  - riga `content.terms.update` e «Ultima modifica» aggiornata.
- [ ] Azione nuova in `CHANGE_ACTIONS` e nell'insieme di «Ultima modifica»; il conteggio della prova di deriva aumenta di uno.
- [ ] Attuazione; prove verdi; snapshot OpenAPI; commento in `PROGRESS.md`.

### T3 — Estratto e immagine in evidenza nell'API
**File:** `content/schemas.ts`, `service.ts`, `routes.ts`, `tests/contentListing.test.ts`.
- [ ] Prove (falliscono):
  - `featuredMediaId` inesistente, privato o non immagine → `400 CONTENT_MEDIA_INVALID` senza scritture (oggi `500`);
  - un'immagine pubblica è accettata e `GET /public/posts` e la ricerca la restituiscono;
  - `null` la toglie;
  - `excerpt: ''` diventa `NULL`, e il blocco «Elenco articoli» e il feed tornano all'inizio automatico;
  - estratto invariato: nessun cambio di `modified_at` né di `description_source`;
  - `GET /contents/:id` restituisce `termIds` e `featuredMedia`;
  - eliminare un media usato come immagine in evidenza → `409` (prova mancante finora).
- [ ] D139 = B (S10): prove del sito (`apps/web/tests`) per archivio e ricerca: con l'estratto (intero, in `<p>`, a capo come interruzione di riga, tag tolti, entità decodificate), senza estratto l'inizio del testo di prima; attuazione in `Views.tsx` e `format.ts`. La difformità si registra nel rapporto di parità in T7.
- [ ] Attuazione; prove verdi; commento in `PROGRESS.md`.

### T4 — Editor: estratto, «Elenchi e archivi», «Elimina»
**File:** `ContentEditor.tsx`, `ContentListingPanel.tsx`, `ContentDeleteAction.tsx`,
`lib/editor/roundtrip.ts`, `lib/auditLabels.ts`, prove dell'area.
- [ ] Prove (falliscono):
  - «Estratto» solo per le notizie, salvato con il contenuto, con il testo d'aiuto di D139 = B (S1);
  - la scheda «Elenchi e archivi» sceglie, cambia e toglie l'immagine (solo immagini pubbliche, nessun alt richiesto) e assegna e toglie categorie;
  - salvarla non tocca le modifiche non salvate di «Contenuto» (§6 caso 2);
  - D141-A spiegato in italiano accanto alle categorie;
  - «Elimina»: un'anteprima bloccata elenca i motivi e non offre la conferma; altrimenti la conferma chiede il titolo, «Annulla» non scrive, e dopo l'eliminazione si torna all'elenco con un avviso;
  - una persona senza `content.publish` vede che non può eliminare un pubblicato;
  - etichetta «Ha cambiato le categorie» nel registro.
- [ ] Attuazione con `packages/ui` (`TextArea`, `MediaPicker`, `CheckboxField`, `ConfirmDestructive`, `Alert`); tastiera ed etichette; prove verdi; commento in `PROGRESS.md`.

### T5 — Schermata «Categorie»
**File:** `apps/admin/src/app/redazione/categorie/`, `components/terms/CategoryManager.tsx`,
`lib/areas.ts`, `tests/categories.test.tsx`.
- [ ] Prove (falliscono):
  - elenco con nome, indirizzo e numero di notizie, solo `category`;
  - «Nuova categoria» con lo slug proposto dal nome e modificabile prima di creare; duplicato e slug non valido spiegati in italiano;
  - «Rinomina» cambia il nome e non mostra lo slug come modificabile (D140-A);
  - voce di navigazione in Redazione, senza 404 (1G-20).
- [ ] Attuazione; prove verdi; commento in `PROGRESS.md`.

### T6 — Prove end-to-end
**File:** `tests/e2e/cms/notizie.spec.ts`.
- [ ] Come redazione:
  - cambia estratto, immagine in evidenza e categoria di una notizia sintetica;
  - sul sito, l'archivio della categoria nuova la mostra con l'immagine e con l'estratto al posto dell'inizio del testo (D139 = B), quello vecchio non più; la ricerca mostra lo stesso estratto.
- [ ] Crea una categoria, la rinomina, e l'archivio mostra il nome nuovo all'indirizzo di prima.
- [ ] Elimina: una pagina in un menu è rifiutata con le voci elencate; una bozza senza dipendenze si elimina dopo la conferma, e il suo indirizzo risponde 404.
- [ ] Come amministrazione: il registro mostra «Ha eliminato» con il titolo e «Ha cambiato le categorie».
- [ ] Commento in `PROGRESS.md`.

### T7 — Verifica e chiusura
- [ ] Revisione del codice dell'intera wave (`code-reviewer`) e revisione di sicurezza mirata: autorizzazione di eliminazione e categorie, accesso a contenuti di altri (IDOR), transazione. Nessun esito critico o alto aperto.
- [ ] Verifica come la CI: `pnpm lint`, `npx prettier --check . --end-of-line auto`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm db:verify`, `pnpm test:coverage`, `pnpm test:e2e`; poi ricompilare e riavviare sito, area amministrativa e API di sviluppo.
- [ ] Difformità DR-243 (W4-7): cattura del sito nuovo per gli indirizzi di archivio e ricerca della matrice, in una cartella separata che non sovrascrive le catture accettate, confronto con il riferimento e con gli esiti accettati (DR-162, DR-203); le viste cambiate dall'estratto si elencano nel §13 nuovo di `visual-parity-report.md`, da accettare nella `1G-W7`.
- [ ] Non regressione (W4-7) con l'istanza di riferimento avviata in sola lettura: `SITO=http://127.0.0.1:3200 API=http://127.0.0.1:3002 WPREF_URL=http://localhost:8088 pnpm exec tsx tests/visual/verifica-redirect.ts` deve dare 181/181, e `python tests/visual/stati-matrice.py` 292 conformi. Poi si ferma l'istanza.
- [ ] Riga `PHASE:1G WAVE:1G-W4 STATUS:complete`; commit e push **su conferma**; controllo della CI.

## 8. Cosa la wave non fa

- Non modifica né elimina contenuti del database di sviluppo: le prove usano il proprio
  database e dati sintetici.
- Non elimina categorie dall'interfaccia (S6), non gestisce la loro gerarchia né i tag (S9).
- Non crea varianti delle immagini caricate dal CMS: è della 1G-W5.
- Non crea redirect per i contenuti eliminati e non tocca le regole esistenti (D143-A).
- Non aggiunge un cestino né il ripristino (D115).
- Non aggiunge l'immagine in evidenza delle pagine né `og:image` dall'immagine in evidenza.
- Tocca `apps/web` solo per l'estratto in archivio e ricerca (D139 = B, S10); il proxy no.

## 9. Rischi

| Rischio | Mitigazione |
|---|---|
| L'eliminazione è definitiva (D142-A) e un errore costa la perdita del contenuto | conferma che chiede il titolo; anteprima dei blocchi; registro con titolo e percorso; il collaudo della 1G-W8 usa un database separato |
| 57 pagine su 106 contenuti sono in un menu: con D143-A, eliminarle richiede prima di togliere le voci | messaggio che nomina menu e voce; e2e del caso; da osservare nel collaudo |
| Con D139 = B la parità di archivio e ricerca cambia per 19 notizie pubblicate, e per 5 pagine nella ricerca | confronto visivo e registrazione della difformità in T7; accettazione nella `1G-W7` |
| Un'immagine appena caricata, senza varianti, esce troppo grande negli archivi | §6 caso 4; se capita, il difetto passa alla 1G-W5 |
| Memoria della macchina per e2e e verifica completa | un pacchetto di prove per volta; server di sviluppo spenti durante gli e2e |
