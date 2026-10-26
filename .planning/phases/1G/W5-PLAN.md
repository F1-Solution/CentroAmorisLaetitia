# Piano della wave 1G-W5 — Media, tipi di file, anteprima della bozza

> **Per chi esegue:** sotto-skill richiesta `superpowers:subagent-driven-development` (o
> `superpowers:executing-plans`). Passi con caselle `- [ ]`. Prove **prima** del codice
> (`superpowers:test-driven-development`). Protocollo `PROGRESS.md`: un commento datato
> dopo ogni attività, una sola riga `STATUS:complete` a fine wave. Nessun commit senza
> conferma: il controller fotografa il lavoro fra un'attività e l'altra
> (`.superpowers/sdd/strumenti-1G/snap.sh`).

Scritto il 2026-10-23, dopo la chiusura della `1G-W4` (commit `b8b1bce`, CI `39846126570`
verde).

**Obiettivo:** un'immagine caricata o sostituita dall'area amministrativa ha le stesse
dimensioni derivate dell'import e il sito la mostra in ogni dimensione; un file non
ammesso o troppo grande è rifiutato con un messaggio in italiano; la bozza si vede sul
sito, solo da chi può vederla, identica alla pagina che sarà pubblicata (1G-5, 1G-10,
1G-14, 1G-19). La wave chiude anche DR-248 e il caso §6.4 della `1G-W4`.

**Architettura.**

- **Media.** Un modulo nuovo, `media/sizes.ts`, contiene la lista canonica delle misure
  (S8). `media/variants.ts` le calcola come WordPress e le genera con `sharp`.
  `media/fileType.ts` riconosce il tipo dalle prime firme del file. Caricamento e
  sostituzione calcolano tutto in memoria prima di scrivere. Poi scrivono gli oggetti,
  poi il database in una transazione, e solo dopo il commit tolgono gli oggetti vecchi.
- **Anteprima.** L'assemblaggio della pagina oggi sta dentro `GET /public/content`.
  Diventa una funzione, usata anche da `GET /contents/:id/preview` nell'area Redazione,
  che vi applica la copia di lavoro di chi chiede. Il sito risolve `/anteprima/<id>/`
  nella stessa rotta `[[...percorso]]` delle pagine e inoltra all'API il solo cookie di
  sessione. Poi rende la pagina con il percorso del contenuto, così l'HTML coincide con
  quello pubblicato. `noindex` e `no-store` viaggiano nelle intestazioni.
- **DR-248.** `GET /public/search` aggiunge `type` a ogni risultato. Il sito mostra
  l'estratto solo per le notizie.

**Stack:** Fastify, Zod, Drizzle, Next.js, `packages/ui`, Vitest, Playwright.

- **Dipendenza nuova:** `sharp` 0.35.4 in `apps/api` (DR-225). È la stessa versione già
  presente nel lockfile come dipendenza facoltativa di `next`.
- **Nessuna migrazione prevista:** le colonne e le tabelle esistenti bastano.

**Riferimenti:**

- `CONTEXT.md` §1, §3, §5 (RG-04, RG-06), §7 (1G-5, 1G-10, 1G-14, 1G-19, 1G-21, 1G-22);
  `PLAN.md` §1-§3, §5.
- DR-074, DR-189, DR-202, DR-216 B e C, DR-217 D, DR-225, DR-243, DR-248.
- ADR-003, ADR-004 §3.1, §3.2, §3.6; ADR-006 §3.3; ADR-007; ADR-008.
- `W4-PLAN.md` §6 caso 4 e S10; `visual-parity-report.md` §13.1.

---

## 1. Criteri di «fatto» della wave

| # | Criterio | Misura che lo chiude |
|---|---|---|
| W5-1 | DR-248: nella ricerca solo le notizie mostrano l'estratto. Pagine e documenti mostrano l'inizio del testo. Le 3 viste di `/?s=corso` restano identiche alla cattura accettata. §13.1 del rapporto di parità è aggiornato | prove dell'API e del sito, catture di T1 e T8 |
| W5-2 | 1G-14: ogni file viene rifiutato, con codice stabile e messaggio in italiano, se ha un tipo non ammesso, un contenuto diverso dal nome, un peso oltre il limite, troppi pixel o se è danneggiato. Nessun rifiuto scrive nell'archivio o nel database e non esce mai un `500`. Un nome già usato prende un suffisso e non sovrascrive mai | prove dell'API e dell'area, e2e |
| W5-3 | Caso §6.4 (secondo D145): un'immagine caricata ha larghezza, altezza e le derivate di S8. Usata come immagine in evidenza, in archivio e ricerca esce il ritaglio 1080×675 (o minore) e non l'originale | prove dell'API, e2e |
| W5-4 | 1G-5: sostituire un'immagine aggiorna larghezza e altezza e rigenera le derivate di S8. Le derivate che non esistono più spariscono (righe e oggetti), salvo D146. Il sito mostra la nuova immagine in ogni dimensione (D149) | prove dell'API, e2e |
| W5-5 | 1G-19: `/anteprima/<id>/` risponde `404` a un anonimo e a una sessione dell'area Impostazioni. Chi è entrato in Redazione la vede con la propria copia di lavoro. Le risposte portano `X-Robots-Tag: noindex` e `Cache-Control: private, no-store`. L'indirizzo non è nella sitemap | prove del sito e dell'API, e2e |
| W5-6 | 1G-10: dopo la pubblicazione, anteprima e pagina pubblica sono identiche con il metodo di DR-202 (HTML senza il payload RSC, `<head>` compreso). Vale nell'e2e e, sul database di sviluppo, per i 106 contenuti pubblicati | e2e, `prova-anteprima.ts` |
| W5-7 | Non regressione: 1E-19 4/4; redirect 181/181; stati 292/292 | `prova-1e-19.ts`, `verifica-redirect.ts`, `stati-matrice.py` |
| W5-8 | La verifica come la CI è verde | lint, Prettier, tipi, build, test, `db:verify`, copertura, e2e |

## 2. Fatti accertati il 2026-10-23

### 2.1 DR-248 (estratto delle pagine nella ricerca)

| Fatto | Fonte |
|---|---|
| S10 della `1G-W4` sta in `ListingText`, condiviso da archivio e ricerca tramite `PostListing`: nessun controllo sul tipo. La prova `searchView.test.tsx:89` chiede l'estratto di una pagina | `apps/web/src/components/Views.tsx:137-152, 159-207` |
| `GET /public/search` non dice il tipo. Lo schema `postsResponse` è condiviso con `/public/posts`. Il corpus legge pagine, notizie e documenti pubblici; i documenti hanno sempre l'estratto vuoto. `/public/posts` restituisce solo notizie | `public/schemas.ts:188-208`, `search.ts:126-153, 180`, `service.ts:849-850` |
| «Elenco articoli» e feed leggono solo notizie. La meta description di una pagina usa l'estratto solo se il testo è vuoto: DR-248 non la tocca | `PostList.tsx:63-65`, `proxy.ts:53-55`, `service.ts:291-301` |
| Nel database di sviluppo hanno un estratto 5 pagine pubblicate su 78 e 19 notizie su 28 | lettura del 2026-10-23 |
| L'unica ricerca della matrice visiva è `/?s=corso`: 63 risultati. La prima pagina (5 risultati) non ne ha nessuno con estratto. Le pagine con estratto sono nelle pagine 8 e 9 dei risultati, fuori matrice | `tests/visual/matrice.ts:87-93`, lettura e chiamata all'API del 2026-10-23 |
| Lo strumento di cattura della `1G-W4` è fuori Git e, rilanciato, sovrascrive `sito-1G-W4/` ed `esiti-1G-W4-DR-243.csv` | `.superpowers/sdd/strumenti-1G/dr243.ts:16-24, 74` |

### 2.2 Tipi di file e limiti

| Fatto | Fonte |
|---|---|
| `POST /media` usa il tipo dichiarato dal browser (`part.mimetype`). Non legge il contenuto e non controlla l'estensione. `PUT /media/:id/file` confronta solo i tipi dichiarati. Non esiste un elenco di tipi ammessi | `media/routes.ts:84`, `media/service.ts:138-146`, `public/routes.ts:379` |
| Limite di 64 MiB scritto nel codice. Oltre il limite `@fastify/multipart` risponde `413` con «request file too large», in inglese, e il gestore degli errori lo lascia passare. Un corpo non multipart dà `406`, anch'esso in inglese. L'area mostra il messaggio del server così com'è, e non ha `accept` né controlli prima dell'invio | `app.ts:139, 196-208`, `MediaLibrary.tsx:80-84`, `MediaUploader.tsx:63-75` |
| I due `409` (sostituzione con tipo diverso, eliminazione di un media citato) escono con `code: INTERNAL_ERROR` | `app.ts:203`, `media/service.ts:138-146, 229-237` |
| La chiave di un caricamento è `AAAA/MM/<nome del file così com'è>`, senza controllo di collisione. Lo stesso nome nello stesso mese sovrascrive l'oggetto nel bucket, poi il vincolo `unique` fallisce e la risposta è un `500`. L'oggetto si scrive prima della riga | `media/service.ts:63-67, 82-110` |
| Entrambe le rotte leggono il file intero in memoria (`toBuffer`) | `media/routes.ts:85, 125` |
| Media nel database di sviluppo: JPEG 81, PNG 43, PDF 52 (4 riservati), MP4 2. I file più grandi: video 70 MB (oltre il limite, quindi oggi non sostituibile), PNG 8,3 MB, PDF 8,3 MB, JPEG 1,2 MB | lettura del 2026-10-23 |

### 2.3 Dimensioni derivate

| Fatto | Fonte |
|---|---|
| `media.width` e `height` sono nullabili. `media_variants` ha percorso, chiave, larghezza, altezza, peso e impronta, ma **né nome della misura né ritaglio né tipo**. Il commento e ADR-004 §3.2 dicono «non si rigenerano» | `packages/db/src/schema/media.ts:19-78`, ADR-004 §3.2 |
| L'import leggeva `sizes[*].sizeName` ma non l'ha salvato. Ogni derivata sta nella cartella dell'originale, con nome `<base>-<L>x<A>.<est>` | `apps/importer/src/stages/media/index.ts:70-74, 290-335` |
| Misure della sorgente:<br>• `wp_options`: thumbnail 150×150 con ritaglio, medium 300×300, medium_large 768×0, large 1024×1024.<br>• Core: 1536×1536 e 2048×2048 proporzionali; originali oltre 2560 px ridotti in `-scaled`; qualità JPEG 82, WebP 86.<br>• Divi: 7 misure, tutte con ritaglio tranne 1080×9999.<br>• Misure responsive 480, 980, 1280 in sola larghezza, saltate se la soglia è ≥ alla larghezza dell'originale | dump `BackupDB-2026-09-13` (solo le chiavi delle misure), `wp-includes/media.php:5864, 5866`, `wp-admin/includes/image.php:285, 336`, `themes/Divi/post_thumbnails_divi.php:6-41`, `includes/builder/core.php:7073-7098` |
| 1287 derivate su 162 media: 778 JPEG, 353 PNG e 156 anteprime JPEG di 39 PDF. Da 0 a 16 per immagine. Tutti i media vengono dall'import: nessuno è stato caricato dal CMS. 9 originali superano i 2560 px, 1 è un `-scaled` | lettura del 2026-10-23 |
| La sostituzione riscrive l'originale sulla stessa chiave (DR-074) e aggiorna solo peso, impronta e data. Larghezza e altezza restano vecchie e le derivate non si toccano: in ogni dimensione derivata il sito continua a mostrare l'immagine vecchia | `media/service.ts:129-161` |
| Il sito:<br>• **immagine in evidenza:** servono larghezza e altezza; il ritaglio si trova come `min(L,1080)×min(A,675)`, altrimenti esce l'originale;<br>• **blocchi immagine:** scelgono la derivata per `"LxA"` e, se manca, passano all'originale; `srcset` usa le derivate più l'originale;<br>• **video:** il renderer non usa larghezza e altezza | `apps/web/src/lib/featured.ts:23-46`, `packages/blocks/src/render/media.ts:31-55` |
| Caso §6.4 della `1G-W4`: un'immagine caricata dal CMS non ha né misure né derivate. Usata come immagine in evidenza, un originale verticale non si ritaglia e si scarica intero | `W4-PLAN.md` §6 caso 4, `media/service.ts:93-106` |
| Derivate citate:<br>• 9 contenuti scelgono una derivata con `variant: "LxA"`;<br>• 4 contenuti citano 8 indirizzi di derivate nei blocchi;<br>• nessun contenuto cita le anteprime dei PDF;<br>• 2 contenuti citano i video | lettura del 2026-10-23 |
| I file dei media escono con `ETag` (l'impronta) e `Last-Modified`, senza `Cache-Control`. Il registro rinvia le intestazioni di cache alla 1F, con il proxy, come conseguenza di DR-074 | `public/routes.ts:380-440`, `decision-register.md:608, 627` |
| Nessuna elaborazione delle immagini nel progetto. `sharp@0.35.4` è nel lockfile solo come dipendenza facoltativa di `next@16.3.5`, con i binari per win32, linux-x64 e linuxmusl-x64. Non ha script d'installazione, quindi le regole di `pnpm-workspace.yaml` non lo bloccano. La CI gira su `ubuntu-latest` con Node 25 | `pnpm-lock.yaml:5788, 5808`, `.nvmrc`, `.github/workflows/ci.yml` |

### 2.4 Anteprima della bozza

| Fatto | Fonte |
|---|---|
| In produzione c'è un solo dominio: Caddy instrada per percorso `/admin*`, `/api/*`, `/media/*` e il resto al sito | `infra/compose/Caddyfile:13-48`, ADR-008 §3.2 |
| Il cookie `amoris_sessione` è HttpOnly, Secure, SameSite=Lax e non ha `Domain`. Il browser lo manda anche al sito, perché i cookie non dipendono dalla porta. Il sito però non inoltra nulla all'API | `auth/routes.ts:60-77`, `apps/web/src/lib/api.ts:21` |
| `/public` non ha area né permessi e ha una prova negativa per rotta. Il sito non legge il database | `public/routes.ts:51-57`, `publicRead.test.ts:10-13`, ADR-008 regola 4 |
| L'assemblaggio della pagina (blocchi, media, caroselli, form, documenti, SEO, termini) è scritto dentro la rotta. `publishedByPath` filtra i pubblicati | `public/routes.ts:91-145`, `service.ts:368-383` |
| Copia di lavoro:<br>• contiene titolo, estratto e blocchi, una per persona e contenuto;<br>• `GET /contents/:id/draft` chiede `content.write` e restituisce solo la propria.<br>Layout, immagine in evidenza, categorie, SEO e indirizzo si scrivono direttamente sul contenuto | `packages/db/src/schema/content.ts:119-147`, `content/routes.ts:394-418`, `ContentLayoutPanel.tsx:46-51` |
| L'anteprima dell'editor rende i blocchi senza media, intestazione, menu, piè di pagina e fogli di stile del sito: non può provare 1G-10 | `EditorPreview.tsx:29-39`, ADR-006 §3.3 |
| Il sito:<br>• `[[...percorso]]` risolve nell'ordine ricerca, archivi, download, contenuto;<br>• `robots` viene da `seo.robots`;<br>• JSON-LD e voce di menu attiva dipendono dal percorso della richiesta;<br>• nessuna `headers()` in `next.config.ts`;<br>• `robots.ts` vieta solo `/admin`, con una prova sull'elenco esatto;<br>• la sitemap contiene solo contenuti pubblicati e indicizzabili | `page.tsx:95-150, 198-213, 223-288`, `SiteHeader.tsx:23-59`, `robots.ts:15`, `robots.test.ts:18-22`, `service.ts:966-987` |
| Il metodo di 1E-19 è **DR-202** (non DR-201, come scrive `PLAN.md:26`): HTML senza payload RSC, `<head>` compreso. L'espressione regolare è locale allo script; lo script è manuale, legge il database e chiede `QA_PASSWORD` | `decision-register.md:1496`, `tests/visual/prova-1e-19.ts:20-21, 130` |
| `RESERVED_SLUGS` non contiene `anteprima` e una prova ne fissa l'elenco esatto. Nessun contenuto e nessuna regola stanno su `/anteprima…` | `content/address.ts:19-36`, `contentAddress.test.ts:355`, lettura del 2026-10-23 |
| Il log toglie solo le intestazioni `authorization` e `cookie`: un segreto nell'indirizzo finirebbe nel log | `app.ts:103` |
| e2e:<br>• tutto gira su `127.0.0.1`, porte 3100-3102;<br>• l'area conosce solo l'indirizzo dell'API;<br>• il menu del seme ha chiave `principale` mentre il sito legge `menu-principale`, quindi nell'e2e l'intestazione non ha menu | `tests/e2e/support/ambiente.ts:46-105`, `apps/admin/src/lib/api.ts:15`, `seedSintetico.ts:282`, `SiteShell.tsx:8` |
| Database di sviluppo: 106 contenuti pubblicati, 2 bozze, 0 copie di lavoro | lettura del 2026-10-23 |

## 3. Decisioni

### 3.1 Richieste prima di eseguire

| id | Decisione | Opzioni | Raccomandazione | Default vietato |
|---|---|---|---|---|
| **D145** | Quando nascono le dimensioni derivate e che cosa resta dell'originale | **A** — al caricamento e alla sostituzione, tutte le misure di S8 (quelle di WordPress e Divi, le stesse dell'import). Un originale oltre 2560 px si riduce a 2560 sul lato lungo, come WordPress. L'originale si riscrive senza i metadati della fotocamera (data, modello, posizione GPS), con l'orientamento applicato · **B** — come A, ma un originale fino a 2560 px si conserva byte per byte, metadati compresi, come faceva WordPress · **C** — solo alla sostituzione, alla lettera di DR-216 C: un'immagine caricata nuova resta senza derivate e il caso §6.4 della `1G-W4` resta un difetto, da portare al collaudo | **A**: chiude il caso §6.4, un'immagine nuova si comporta come una importata, e una foto del telefono non pubblica il luogo dello scatto. Va confermato da chi segue la privacy del Centro: non è una dichiarazione di conformità | generare derivate al caricamento o riscrivere originali senza decisione |
| **D146** | Derivate citate dai contenuti che la sostituzione farebbe sparire. Con proporzioni diverse le misure proporzionali cambiano nome (`-300x200` diventa `-300x225`). Oggi 9 contenuti scelgono una derivata e 4 ne citano 8 indirizzi | **A** — rifiuto spiegato: la sostituzione si ferma prima di scrivere, con `409 MEDIA_VARIANT_IN_USE` e i titoli dei contenuti. Si usa un'immagine con le stesse proporzioni, oppure si carica un media nuovo e lo si mette nel blocco; nessun contenuto cambia da solo · **B** — riscrittura: i blocchi passano alla derivata nuova della stessa misura, nella stessa operazione. Il registro ha una riga per contenuto, e la data di modifica di quei contenuti cambia · **C** — nessun controllo: dove un blocco sceglieva la derivata compare l'originale; dove il testo ne citava l'indirizzo, l'immagine non si vede più | **A**: nessuna pagina pubblica cambia senza che la persona lo veda; il caso riguarda pochi media, e il messaggio dice che cosa fare | modificare contenuti o lasciare immagini rotte senza decisione |
| **D147** | Tipi di file ammessi e limiti di peso (1G-14). SVG e HTML restano esclusi in ogni caso, perché possono contenere codice | **A** — JPEG, PNG e WebP fino a 20 MB e 50 milioni di pixel; PDF fino a 20 MB; MP4 fino a 100 MB · **B** — solo i tipi già presenti (JPEG, PNG, PDF, MP4), con il limite unico di oggi, 64 MB: il video da 70 MB resta non sostituibile dal CMS, e lo si dichiara · **C** — come A più GIF e documenti Office (DOCX, XLSX, ODT), con limite unico di 100 MB: le GIF animate perdono l'animazione nelle derivate, e i documenti Office non hanno anteprima | **A**: copre ogni file presente con margine. WebP lo accettava già WordPress 6.9. I limiti sono più del doppio del file più grande di ogni tipo | ammettere o rifiutare tipi, o cambiare limiti, senza decisione |
| **D148** | Come si raggiunge l'anteprima sul sito | **A** — con la sessione dell'area amministrativa: `/anteprima/<id>/` lo vede solo chi è entrato in Redazione con `content.read`; per chiunque altro risponde `404`. Funziona perché sito, area e API stanno sotto un solo dominio (ADR-008). Se la 1F spostasse l'area su un sottodominio, andrebbe rivisto · **B** — collegamento firmato con scadenza (30 minuti), creato dall'editor: chi lo riceve vede la bozza senza account finché non scade. Servono un segreto nuovo e la pulizia dei log, e il collegamento si può inoltrare · **C** — A e B insieme | **A**: nessun segreto nuovo e nessun collegamento che circola. 1G-19 si prova con le sessioni già controllate da ADR-007 | rendere visibile una bozza con un'autorizzazione non decisa |
| **D149** | Cache dei file dei media dopo una sostituzione. L'indirizzo resta (DR-074): senza `Cache-Control`, un browser che ha già il file vecchio può continuare a mostrarlo per un tempo che sceglie lui. Il registro ha rinviato queste intestazioni alla 1F | **A** — subito `Cache-Control: no-cache` sui file dei media: il browser chiede ogni volta se il file è cambiato e, se non lo è, riceve `304` senza byte. La politica definitiva resta alla 1F · **B** — come deciso finora, nessuna intestazione fino alla 1F: nel collaudo, 1G-5 si verifica dopo aver svuotato la cache del browser, e il handoff lo dichiara · **C** — `Cache-Control: max-age=300`: il file vecchio resta al massimo 5 minuti | **A**: 1G-5 chiede che il sito mostri la nuova immagine, e chi collauda non deve sapere che esiste una cache. Il costo è una richiesta di convalida per file | cambiare le intestazioni di cache senza decisione |

Se una risposta è diversa da A, aggiornare §3.2, §5 e le attività interessate prima di
eseguirle.

**Risposte del 2026-10-23 (DR-249…253):** D145-D149 = **A**; piano approvato. §3.2, §5 e le
attività restano come scritte.

**Decisioni emerse nella T8 (DR-254…256):** D150 = **B**, pulizia dei metadati di MP4 e PDF
con uno strumento nuovo, ADR e dipendenza da pianificare prima della `1G-W7`; D151 = **A**,
`next` aggiornato a ≥ 16.4.1 all'inizio della `1G-W7`; D152 = **A**, regressione N1 corretta
nella T8.

### 3.2 Scelte di dettaglio dichiarate (rivedibili)

**DR-248**

| # | Scelta | Motivo |
|---|---|---|
| S1 | `GET /public/search` aggiunge `type: 'page' \| 'post' \| 'document'` a ogni risultato, con uno schema proprio. `/public/posts` resta com'è. Il sito mostra l'estratto solo per `post`; pagine e documenti tornano ad `archiveSummary` dell'inizio del testo. L'API continua a restituire l'estratto di ogni contenuto | è l'unica informazione che manca al sito, e la resa resta al sito |
| S2 | Le catture usano una copia dello strumento della `1G-W4` con nomi nuovi: `sito-1G-W5/`, `diff-1G-W5/`, `esiti-1G-W5-DR-248.csv`.<br>• **Prima del codice** (T1): le pagine 8 e 9 dei risultati di `/?s=corso`.<br>• **Dopo** (T8): le stesse due pagine, più le 3 viste di `/?s=corso`, attese identiche alla cattura accettata.<br>§13.1 registra il ritorno delle pagine all'inizio del testo | la sola vista in matrice non contiene pagine con estratto: le pagine 8 e 9 sono l'unica prova visibile |

**Tipi e limiti (1G-14)**

| # | Scelta | Motivo |
|---|---|---|
| S3 | Il tipo si riconosce dal contenuto, con codice scritto nel progetto (l'alternativa senza dipendenza di `PLAN.md` §5): firme di JPEG, PNG, WebP, PDF e MP4. Per le immagini, `sharp` legge l'intestazione e rifiuta i file danneggiati. Il tipo dichiarato dal browser non conta, e l'estensione del nome deve corrispondere al tipo riconosciuto | oggi decide il browser |
| S4 | Tipi e limiti stanno in un solo elenco, `packages/contracts/src/mediaRules.ts`, usato da API e area. I limiti sono valori di configurazione con i default di D147, così le prove li abbassano | una sola fonte per i messaggi dell'API e dell'area |
| S5 | Codici stabili e messaggi in italiano:<br>• `415 MEDIA_TYPE_NOT_ALLOWED`, che elenca i tipi ammessi;<br>• `413 MEDIA_TOO_LARGE`, con il limite del tipo, anche quando il file supera il limite massimo e lo ferma `@fastify/multipart`;<br>• `413 MEDIA_TOO_MANY_PIXELS`, controllato sull'intestazione prima di decodificare;<br>• `400 MEDIA_FILE_INVALID`, file danneggiato;<br>• `400 MEDIA_NAME_MISMATCH`, per esempio un JPEG chiamato `.png`;<br>• `409 MEDIA_TYPE_CHANGED` e `409 MEDIA_IN_USE`, al posto di `INTERNAL_ERROR`;<br>• `406` in italiano.<br>Nessun rifiuto scrive | 1G-14; oggi `500` e messaggi in inglese |
| S6 | Il nome del file si ripulisce come fa `sanitize_file_name` di WordPress: niente cartelle né `..`, spazi in trattini, caratteri non ammessi tolti. Se il nome è già usato, come in WordPress, si aggiunge `-1`, `-2`, contando anche i nomi delle derivate. Non si sovrascrive mai. Se la riga non si scrive, gli oggetti appena caricati si tolgono | oggi la collisione sovrascrive il bucket e risponde `500`; il nome arriva dal browser |
| S7 | Nell'area:<br>• `accept` con i tipi ammessi;<br>• controllo di tipo e peso prima dell'invio, con lo stesso messaggio dell'API;<br>• riga «Tipi ammessi: …» accanto a «Carica» e «Sostituisci».<br>La sostituzione chiede conferma: «il file attuale e le sue N dimensioni derivate non si potranno recuperare». Dopo, l'avviso dice quante dimensioni sono state rigenerate | la persona sa prima che cosa può caricare; la sostituzione ora toglie anche file |

**Dimensioni derivate (DR-225, D145, D146)**

| # | Scelta | Motivo |
|---|---|---|
| S8 | **Misure** (lista unica in `media/sizes.ts`):<br>• **con ritaglio:** 150×150, 400×250, 1080×675, 400×284, 510×382, 400×516, 2880×1800;<br>• **proporzionali:** 300×300, 768×∞, 1024×1024, 1536×1536, 2048×2048, 1080×9999;<br>• **responsive:** 480, 980, 1280 in sola larghezza.<br>**Calcolo** come `image_resize_dimensions` di WordPress:<br>• niente ingrandimenti;<br>• ritaglio al centro, e con il ritaglio un lato più corto del riquadro resta com'è (`min`);<br>• le responsive si saltano se la soglia è ≥ alla larghezza dell'originale;<br>• misure ripetute e misure uguali all'originale si saltano.<br>**File:** nome `<base>-<L>x<A>.<est>`, con la base senza `-scaled`; qualità JPEG 82 e WebP 86; derivate senza metadati | DR-225: «stesse misure e stessi ritagli dell'import»; le misure si ricavano dall'originale, quindi non serve una migrazione |
| S9 | Sostituzione: l'indirizzo dell'originale resta (DR-074). La riga prende larghezza, altezza, peso e impronta nuovi. Le derivate si ricalcolano tutte:<br>• quelle con lo stesso nome si riscrivono sulla stessa chiave;<br>• quelle nuove si aggiungono;<br>• quelle che non esistono più si tolgono, righe e oggetti, dopo il commit (salvo il rifiuto di D146).<br>Tutto si calcola in memoria prima di scrivere, con un blocco consultivo per media. Una sostituzione interrotta a metà si ripete con lo stesso file e torna coerente; l'errore va nel log con l'id del media | oggi le derivate restano vecchie; l'archivio a oggetti non è transazionale |
| S10 | PDF e video non hanno derivate generate, perché la libreria non legge i PDF:<br>• le 156 anteprime JPEG importate dei PDF, che nessun contenuto cita, si tolgono quando si sostituisce il loro PDF (mostrerebbero il documento vecchio); se un contenuto le citasse, vale D146;<br>• per un video, sostituito il file, larghezza e altezza diventano nulle, perché il sito non le usa | nessuna anteprima con il contenuto vecchio |
| S11 | Nessuna rigenerazione in blocco (RG-04): i media importati restano byte per byte finché non si sostituiscono. Nel database di sviluppo nessun media è stato caricato dal CMS, quindi non c'è nulla da recuperare | parità approvata intatta |
| S12 | Revisione datata di ADR-004 §3.2, come DR-224 per ADR-007: le derivate si generano al caricamento (D145) e si rigenerano alla sostituzione, con la libreria di DR-225. Si allineano il commento in `media.ts:58` e quello di `schema.sql` | la ADR oggi dice «non si rigenerano» |

**Anteprima (DR-216 B, D148)**

| # | Scelta | Motivo |
|---|---|---|
| S13 | Indirizzo `/anteprima/<id>/`, con `anteprima` aggiunto a `RESERVED_SLUGS`. Si risolve dentro `[[...percorso]]`, come la ricerca e gli archivi | una rotta separata caricherebbe altri file JavaScript e l'HTML non coinciderebbe con la pagina pubblicata |
| S14 | API: `GET /contents/:id/preview`, nell'area Redazione con `content.read`, risponde con `Cache-Control: no-store`.<br>• Ha la forma di `GET /public/content`: l'assemblaggio diventa una funzione comune, e per un contenuto senza copia di lavoro i dati coincidono.<br>• Applica la copia di lavoro di chi chiede: titolo, estratto e blocchi validati, testo e `description_source` ricalcolati come al salvataggio.<br>• Vale per bozze e pubblicati, e non scrive nulla, nemmeno nel registro.<br>• I media riservati restano esclusi, come sul sito | un solo codice di assemblaggio, quindi nessuna divergenza |
| S15 | Sito: per `/anteprima/<id>/` il server legge `amoris_sessione` e lo inoltra **solo** a quella rotta dell'API.<br>• Senza cookie, o con una risposta diversa da `200`, risponde `404` come una pagina inesistente, senza dire se il contenuto esiste.<br>• Rende la pagina con il percorso del contenuto, usato come percorso corrente, nel JSON-LD e come canonical.<br>• Nessun banner e nessun markup in più | 1G-19 e identità con la pagina pubblicata (1G-10) |
| S16 | `proxy.ts` mette `X-Robots-Tag: noindex, nofollow`, `Cache-Control: private, no-store` e `Referrer-Policy: no-referrer` su `/anteprima/`, e lì non cerca redirect. Il `<meta name="robots">` resta quello del contenuto. Nessuna riga in `robots.txt` (un `Disallow` nasconderebbe l'intestazione ai motori) e nessuna nella sitemap | `noindex` garantito senza far divergere l'HTML |
| S17 | Editor: un pulsante «Anteprima sul sito» nell'intestazione apre una scheda nuova, salvando prima la copia di lavoro se ha modifiche in sospeso. L'area riceve l'indirizzo del sito da `NEXT_PUBLIC_SITE_URL` (in `.env.example` e nell'e2e); senza, il collegamento è relativo, perché in produzione il dominio è uno | oggi l'area non conosce l'indirizzo del sito |
| S18 | L'anteprima mostra solo la pagina del contenuto: archivi, ricerca, «Elenco articoli», feed e menu restano dei soli pubblicati. Per una bozza mai pubblicata la data di pubblicazione è il momento della richiesta, come in WordPress. L'identità di 1G-10 si prova quindi **dopo** la pubblicazione | DR-216 B riguarda la pagina; la data di una prima pubblicazione cambia per natura |
| S19 | La regola di DR-202 diventa una funzione condivisa, `tests/visual/confrontoHtml.ts`, usata da `prova-1e-19.ts`, dall'e2e e da un nuovo `tests/visual/prova-anteprima.ts`. Quest'ultimo, sul database di sviluppo, entra con un account di prova come fa 1E-19 e confronta anteprima e pagina pubblica dei 106 contenuti pubblicati | prova di 1G-10 sui contenuti veri, menu compresi (l'e2e non ha menu) |

**Cache (D149)**

| # | Scelta | Motivo |
|---|---|---|
| S20 | Con D149 = A: `Cache-Control: no-cache` su ogni risposta di `/media/*`, `200`, `206` e `304`. `ETag` e `Last-Modified` restano | il browser convalida e vede subito il file sostituito |

## 4. Struttura dei file

| Percorso | Che cosa |
|---|---|
| `apps/api/package.json`, `pnpm-lock.yaml` | `sharp` 0.35.4 |
| `apps/api/src/modules/media/sizes.ts`, `variants.ts`, `fileType.ts` (nuovi) | misure, calcolo e generazione delle derivate, riconoscimento del tipo |
| `apps/api/src/modules/media/routes.ts`, `service.ts`, `schemas.ts`; `apps/api/src/app.ts`, `config.ts` | caricamento e sostituzione, codici e messaggi, limiti in configurazione, `413` e `406` in italiano |
| `apps/api/src/modules/public/page.ts` (nuovo), `routes.ts`, `schemas.ts`, `search.ts` | assemblaggio comune della pagina; `type` nella ricerca; `Cache-Control` dei media |
| `apps/api/src/modules/content/preview.ts` (nuovo), `routes.ts`, `address.ts` | `GET /contents/:id/preview`; slug riservato `anteprima` |
| `packages/contracts/src/mediaRules.ts` (nuovo), `index.ts` | tipi ammessi, limiti, messaggi |
| `apps/web/src/app/[[...percorso]]/page.tsx`, `src/lib/api.ts`, `src/proxy.ts`, `src/components/Views.tsx` | anteprima, intestazioni, estratto solo per le notizie |
| `apps/admin/src/components/media/MediaLibrary.tsx`, `packages/ui/src/media/MediaUploader.tsx`, `apps/admin/src/lib/upload.ts` | tipi, controlli prima dell'invio, conferma della sostituzione |
| `apps/admin/src/components/editor/ContentEditor.tsx`, `apps/admin/src/lib/siteUrl.ts` (nuovo), `.env.example` | «Anteprima sul sito» |
| `apps/api/tests/mediaUpload.test.ts`, `mediaVariants.test.ts`, `contentPreview.test.ts` (nuovi); `publicSearch.test.ts`, `corredo.test.ts`, `contentAddress.test.ts`, `openapi.snapshot.json` | prove dell'API |
| `apps/web/tests/searchView.test.tsx`, `preview.test.tsx`, `proxy.test.ts`; `apps/admin/tests/media-library.test.tsx`, `content-preview.test.tsx` | prove del sito e dell'area |
| `tests/e2e/cms/media.spec.ts`, `anteprima.spec.ts` (nuovi); `tests/e2e/support/ambiente.ts` | e2e |
| `tests/visual/confrontoHtml.ts`, `prova-anteprima.ts` (nuovi), `prova-1e-19.ts` | regola di DR-202 condivisa; prova di 1G-10 sul database di sviluppo |
| `docs/decisions/adr/ADR-004-storage-media-e-url.md`, `packages/db/src/schema/media.ts`, `docs/architecture/schema.sql` | revisione datata e commenti (S12) |
| `docs/qa/visual-parity-report.md`, `docs/qa/confronto/esiti-1G-W5-DR-248.csv` | §13.1 aggiornato con DR-248 |

## 5. Interfacce

| Rotta | Permesso | Risposta |
|---|---|---|
| `GET /public/search` (esistente) | nessuno | ogni risultato aggiunge `type` (S1) |
| `POST /media` (esistente) | `media.write` | `201` con `width`, `height` e il numero di derivate; rifiuti di S5; nome ripulito e reso unico (S6) |
| `PUT /media/:id/file` (esistente) | `media.write` | `200` con `width`, `height` e derivate `{ written, removed }`; `409 MEDIA_TYPE_CHANGED`; D146-A: `409 MEDIA_VARIANT_IN_USE` con i contenuti; rifiuti di S5 |
| `DELETE /media/:id` (esistente) | `media.write` | `409 MEDIA_IN_USE` al posto di `INTERNAL_ERROR`, stesso messaggio |
| `GET /media/*` (esistente, pubblica) | nessuno | D149-A: `Cache-Control: no-cache` |
| `GET /contents/:id/preview` | `content.read`, area Redazione | la forma di `GET /public/content`, con la copia di lavoro di chi chiede (S14); `Cache-Control: no-store`; `401`, `403`, `404` |
| `/anteprima/<id>/` (sito) | sessione Redazione (D148-A) | la pagina come sarà pubblicata; `404` per chiunque altro; intestazioni di S16 |

```ts
// packages/contracts/src/mediaRules.ts — default di D147-A
interface MediaRule {
  mime: string;              // tipo riconosciuto dal contenuto (S3)
  extensions: string[];      // estensioni ammesse nel nome
  maxBytes: number;
  maxPixels?: number;        // solo immagini
  derivatives: boolean;      // true per JPEG, PNG, WebP
}
```

## 6. Revisione di attenzione

1. **Sostituzione con proporzioni diverse.** Un'immagine scelta da un blocco come
   derivata proporzionale, o citata per indirizzo, provoca il rifiuto di D146-A senza
   scritture. Una derivata con ritaglio citata, invece, conserva il nome e si riscrive.
2. **Sostituzione interrotta** (un oggetto scritto, il database no): il media resta
   leggibile, una seconda sostituzione con lo stesso file torna coerente, e il log ha
   l'id. Due sostituzioni simultanee dello stesso media si mettono in fila.
3. **File ostili:** un'immagine con 100 milioni di pixel dichiarati si rifiuta leggendo
   l'intestazione, prima di decodificarla. Un nome `../../x.jpg` diventa `x.jpg`. Un
   HTML chiamato `.jpg` è rifiutato.
4. **Caso §6.4:** un'immagine verticale caricata e messa come immagine in evidenza
   esce in archivio e ricerca come ritaglio 1080×675, con larghezza e altezza.
5. **Anteprima:** si prova da anonimo, da una sessione dell'area Impostazioni e sulla
   copia di lavoro di un'altra persona, che non si applica. Si prova anche su un
   contenuto con una regola di redirect sul suo indirizzo, sulla pagina iniziale (il
   percorso corrente è `/`) e su un contenuto con un media riservato nei blocchi.
6. **Un solo nome di host:** se l'area è aperta su `localhost` e il sito su `127.0.0.1`,
   il cookie non arriva e l'anteprima risponde `404`. L'ambiente di collaudo della
   `1G-W7` deve usare un solo host, e il suo handoff lo dice.
7. **HTML dell'anteprima e della pagina:** si confrontano dopo la pubblicazione, con la
   regola di DR-202. Una differenza che non si può togliere (per esempio un dettaglio di
   Next legato all'indirizzo) si porta all'utente prima di dichiarare 1G-10.

## 7. Attività

### T0 — Decisioni D145-D149
- [x] Portarle all'utente e registrare le risposte in `decision-register.md` (DR-249…253).
  Se sono diverse da A, aggiornare §3.2, §5 e le attività prima di eseguire.
- [x] Correggere in `PLAN.md:26` il riferimento al metodo di 1E-19 da DR-201 a DR-202.

### T1 — DR-248: estratto solo per le notizie nella ricerca
**File:** `public/search.ts`, `schemas.ts`, `routes.ts`, `apps/web/src/lib/api.ts`,
`Views.tsx`, prove, snapshot OpenAPI, copia dello strumento di cattura (S2).
- [ ] Cattura «prima» delle pagine 8 e 9 dei risultati di `/?s=corso`, con il sito di
  sviluppo `:3200` ancora sul codice della `1G-W4`.
- [ ] Prove (falliscono):
  - ogni risultato di `/public/search` ha `type`;
  - `/public/posts` è invariato nello snapshot;
  - nel sito, una pagina con estratto mostra l'inizio del testo (la prova di
    `searchView.test.tsx:89` si capovolge); una notizia con estratto mostra l'estratto;
    un documento resta com'è; l'archivio è invariato.
- [ ] Attuazione (S1); prove verdi; snapshot OpenAPI; commento in `PROGRESS.md`. La
  cattura «dopo» e §13.1 sono in T8.

### T2 — Tipi e limiti nell'API (1G-14)
**File:** `packages/contracts/src/mediaRules.ts`, `media/fileType.ts`, `routes.ts`,
`service.ts`, `schemas.ts`, `app.ts`, `config.ts`, `tests/mediaUpload.test.ts`,
`corredo.test.ts`.
- [ ] Prove (falliscono), con file sintetici creati nella prova:
  - ogni rifiuto di S5 ha codice, messaggio in italiano e **nessuna** scrittura, né
    `put` nell'archivio né righe;
  - il tipo dichiarato dal browser è ignorato: un PNG dichiarato JPEG si riconosce PNG,
    e con il nome `.jpg` è rifiutato (`MEDIA_NAME_MISMATCH`);
  - oltre il limite massimo, il `413` del plugin esce in italiano; lo stesso vale per il
    `406`;
  - il nome si ripulisce (`../`, spazi, accenti) e, se già usato, prende `-1` senza
    sovrascrivere l'oggetto esistente;
  - se la riga non si scrive, l'oggetto caricato si toglie;
  - i due `409` hanno i codici nuovi.
- [ ] Attuazione (S3-S6); prove verdi; snapshot OpenAPI; commento in `PROGRESS.md`.

### T3 — Dimensioni derivate e cache (DR-225, D145, D146, D149)
**File:** `apps/api/package.json`, `media/sizes.ts`, `variants.ts`, `service.ts`,
`public/routes.ts`, ADR-004, `media.ts`, `schema.sql`, `tests/mediaVariants.test.ts`.
- [ ] Aggiungere `sharp` 0.35.4 ad `apps/api` e dichiararlo in `PROGRESS.md` (DR-225,
  `PLAN.md` §5).
- [ ] Verifica in sola lettura sul database di sviluppo: per ogni immagine importata,
  le misure calcolate da S8 sull'originale coincidono con quelle delle sue derivate. Si
  elencano solo i numeri e le eccezioni attese (il `-scaled`, la derivata più grande
  dell'originale, le misure aggiunte da plugin). Nessun nome di file o titolo nel
  rapporto.
- [ ] Prove (falliscono), con immagini sintetiche generate nella prova:
  - **misure:** quelle attese da S8 per originali orizzontale, verticale, quadrato,
    piccolo e oltre 2560 px; per quest'ultimo, l'originale ridotto (D145-A);
  - **caricamento:** larghezza e altezza; righe e oggetti delle derivate con i nomi
    `<base>-LxA`; originale e derivate senza EXIF e GPS, con l'orientamento applicato
    (D145-A);
  - **sostituzione:**
    - stesso percorso dell'originale, con misure e impronta nuove;
    - derivate con lo stesso nome riscritte, quelle sparite tolte (righe e oggetti),
      quelle nuove aggiunte;
    - D146-A: `409 MEDIA_VARIANT_IN_USE` con i titoli, sia per `variant` nei blocchi sia
      per un indirizzo nel testo, senza scritture;
    - PDF: anteprime tolte; video: misure nulle;
    - due sostituzioni simultanee si mettono in fila;
  - **cache:** `Cache-Control: no-cache` su `200`, `206` e `304` dei media (D149-A).
- [ ] Attuazione (S8-S12, S20); prove verdi; revisione datata di ADR-004 §3.2; commento in
  `PROGRESS.md`.

### T4 — Area amministrativa: caricamento e sostituzione
**File:** `MediaLibrary.tsx`, `MediaUploader.tsx`, `lib/upload.ts`,
`apps/admin/tests/media-library.test.tsx`, `packages/ui/tests`.
- [ ] Prove (falliscono):
  - `accept` con i tipi ammessi;
  - un file di tipo o peso non ammesso è rifiutato prima dell'invio, con il messaggio in
    italiano e nessuna richiesta;
  - la riga «Tipi ammessi»;
  - la sostituzione chiede conferma, e «Annulla» non invia;
  - dopo, l'avviso dice quante dimensioni sono state rigenerate;
  - il rifiuto di D146-A elenca i contenuti; un `413` del server si legge in italiano.
- [ ] Attuazione (S7) con `packages/ui`; tastiera ed etichette; prove verdi; commento in
  `PROGRESS.md`.

### T5 — Anteprima nell'API
**File:** `public/page.ts`, `public/routes.ts`, `content/preview.ts`, `content/routes.ts`,
`content/address.ts`, `tests/contentPreview.test.ts`, `contentAddress.test.ts`,
`publicRead.test.ts`, snapshot OpenAPI.
- [ ] Prove (falliscono):
  - `GET /public/content` è invariato dopo l'estrazione (prove esistenti e snapshot);
  - per un pubblicato senza copia di lavoro, l'anteprima ha lo stesso corpo di
    `/public/content` al suo percorso;
  - con la propria copia di lavoro: titolo, estratto e blocchi della copia, e meta
    description ricalcolata;
  - la copia di lavoro di un'altra persona non si applica;
  - una bozza mai pubblicata ha come data il momento della richiesta (S18);
  - anonimo `401`, sessione Impostazioni `403`, id inesistente `404`;
  - `Cache-Control: no-store`; nessuna scrittura e nessuna riga nel registro;
  - i media riservati restano esclusi;
  - `anteprima` è riservato al primo livello (l'elenco esatto della prova aumenta di uno).
- [ ] Attuazione (S13, S14); prove verdi; snapshot OpenAPI; commento in `PROGRESS.md`.

### T6 — Anteprima sul sito e nell'editor
**File:** `page.tsx`, `apps/web/src/lib/api.ts`, `proxy.ts`, prove del sito;
`ContentEditor.tsx`, `lib/siteUrl.ts`, `.env.example`, `tests/e2e/support/ambiente.ts`,
prove dell'area.
- [ ] Prove (falliscono):
  - **sito:**
    - `/anteprima/<id>/` senza cookie dà `404` senza chiamare l'API;
    - con il cookie, l'API riceve **solo** `amoris_sessione`; `401`, `403` e `404`
      dell'API diventano `404`;
    - la pagina ha il percorso del contenuto come percorso corrente, nel JSON-LD e nel
      canonical;
    - le intestazioni di S16 ci sono, e su `/anteprima/` non si cercano redirect;
    - `robots.txt` e sitemap sono invariati;
  - **area:** «Anteprima sul sito» apre `<sito>/anteprima/<id>/` in una scheda nuova,
    dopo aver salvato la copia di lavoro in sospeso.
- [ ] Attuazione (S15-S17); prove verdi; commento in `PROGRESS.md`.

### T7 — Prove end-to-end
**File:** `tests/e2e/cms/media.spec.ts`, `anteprima.spec.ts`, `tests/visual/confrontoHtml.ts`.
- [ ] **Media**, come redazione:
  - carica un'immagine verticale sintetica e la mette come immagine in evidenza di una
    notizia sintetica: archivio e ricerca servono il ritaglio 1080×675 (caso §6.4);
  - la sostituisce con un'immagine orizzontale di altro colore: ogni derivata servita dal
    sito ha l'impronta nuova, le derivate sparite rispondono `404`, e la pagina mostra il
    colore nuovo senza svuotare la cache (D149-A);
  - un `.svg` e un testo rinominato `.jpg` sono rifiutati con il messaggio in italiano.
- [ ] **Anteprima:**
  - da anonimo `404`, con `X-Robots-Tag`;
  - la redazione cambia il titolo nella copia di lavoro: l'anteprima lo mostra, la pagina
    pubblica no;
  - pubblica: HTML dell'anteprima e della pagina identici con la regola di DR-202, per una
    pagina e per una notizia;
  - la sitemap non contiene `/anteprima/`;
  - una sessione dell'area Impostazioni riceve `404`.
- [ ] Verdi due volte di fila; commento in `PROGRESS.md`.

### T8 — Verifica e chiusura
- [ ] **Revisioni senza esiti critici o alti aperti:**
  - revisione del codice dell'intera wave (`code-reviewer`);
  - revisione di sicurezza (`security-reviewer`): lettura dei file caricati
    (riconoscimento del tipo, nomi e percorsi, file con troppi pixel, memoria), uso
    della libreria su input non fidato, autorizzazione dell'anteprima (copie di lavoro
    altrui, area), inoltro del cookie (solo quel cookie, solo all'API configurata),
    intestazioni, log.
- [ ] **Verifica come la CI:** `pnpm lint`, `npx prettier --check . --end-of-line auto`,
  `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm db:verify`, `pnpm test:coverage`,
  `pnpm test:e2e`. Poi ricompilare e riavviare sito, area e API di sviluppo
  (`riavvia-sviluppo.ps1`).
- [ ] **1G-10 sui contenuti veri:**
  `SITO=http://127.0.0.1:3200 API=http://127.0.0.1:3002 QA_PASSWORD=… npx tsx tests/visual/prova-anteprima.ts`
  deve dare 106/106 identici. Lo script legge soltanto, salvo la sessione e la riga
  d'accesso che scrive l'ingresso, come per 1E-19.
- [ ] **1E-19:** `prova-1e-19.ts` deve dare 4/4, perché `page.tsx` e `proxy.ts` cambiano.
- [ ] **DR-248:** cattura «dopo» (S2): 3 viste di `/?s=corso` identiche alla cattura
  accettata, pagine 8 e 9 confrontate con la cattura «prima». Aggiornare §13.1 di
  `visual-parity-report.md` ed `esiti-1G-W5-DR-248.csv`.
- [ ] **Non regressione**, con l'istanza di riferimento avviata in sola lettura:
  `SITO=http://127.0.0.1:3200 API=http://127.0.0.1:3002 WPREF_URL=http://localhost:8088 pnpm exec tsx tests/visual/verifica-redirect.ts`
  deve dare 181/181, e `python tests/visual/stati-matrice.py` 292 conformi. Poi si
  ferma l'istanza.
- [ ] Riga `PHASE:1G WAVE:1G-W5 STATUS:complete`; commit e push **su conferma**; controllo
  della CI.

## 8. Cosa la wave non fa

- Non rigenera in blocco i media esistenti (RG-04, S11). Non genera derivate né
  anteprime per PDF e video.
- Non aggiunge un editor d'immagine: niente ritaglio a mano, rotazione o scelta del
  punto di ritaglio.
- Non cambia le miniature del selettore dell'area, che scarica gli originali (fino a
  100 alla volta): resta da osservare nel collaudo.
- Non fissa la politica di cache dei media oltre D149: resta alla 1F con il proxy.
- Non mostra le bozze in archivi, ricerca, «Elenco articoli», feed o menu (S18). Con
  D148 = A, non crea collegamenti per chi non ha un account.
- Non cambia la resa delle notizie in archivio e ricerca: DR-243 resta.
- Non tocca documenti scaricabili e caroselli, che sono della `1G-W6`, anche se ne
  preparerà le regole sui tipi.
- Non modifica il database di sviluppo: le prove usano il proprio database e dati
  sintetici. Le sole scritture sono la sessione e la riga d'accesso di
  `prova-anteprima.ts` e di `prova-1e-19.ts`.
- Non corregge la chiave del menu del seme e2e (`principale`): la prova con i menu è
  `prova-anteprima.ts`.

## 9. Rischi

| Rischio | Mitigazione |
|---|---|
| La libreria non è quella di WordPress: una derivata rigenerata ha byte diversi e un aspetto appena diverso (la ragione di ADR-004 §3.2) | vale solo per i media sostituiti o caricati; nessun media importato cambia da solo (S11); revisione datata di ADR-004 |
| Le misure calcolate non tornano per qualche originale importato | verifica in sola lettura in T3 prima dell'attuazione; le eccezioni si elencano e, se toccano la regola, si portano all'utente |
| Memoria: file interi in memoria (fino a 100 MB per un video) e decodifica di immagini fino a 50 Mpx | limiti di S5 controllati sull'intestazione; un'elaborazione per media (blocco); e2e con i server di sviluppo spenti |
| Il cookie non arriva se area e sito usano host diversi, o se la 1F sposta l'area su un sottodominio | §6 caso 6; un solo host nell'ambiente di collaudo; segnalazione nella 1F (ADR-008) |
| L'HTML dell'anteprima differisce da quello della pagina per un dettaglio del framework | rotta unica (S13); prova in e2e e su 106 contenuti; §6 caso 7 |
| I binari della libreria per la piattaforma di produzione | il lockfile ha già linux-x64 e linuxmusl-x64; verifica nella 1F, con l'immagine scelta |
| Privacy: con D145 = B, le foto conservano data, modello e posizione dello scatto | D145-A li toglie; in ogni caso serve il parere di chi segue la privacy del Centro, non una dichiarazione di conformità |
| La sostituzione interrotta lascia oggetti e righe disallineati | S9: tutto in memoria prima di scrivere; vecchi oggetti tolti dopo il commit; ripetibile; log con l'id |
