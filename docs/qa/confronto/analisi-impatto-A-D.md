# Analisi d'impatto delle famiglie A–D — `1E-W6`

Scritta il 2026-10-13, prima di qualunque modifica al codice. Le famiglie sono
quelle di `classificazione.md` §1. Righe misurate sul codice di oggi; dove la
correzione cambia un dato importato serve una riesecuzione dell'import, a
conferma.

**Perimetro.** Il PLAN §2 assegna alla `1E-W6` solo `apps/web/**`,
`packages/blocks/**` e `docs/qa/`. Le correzioni A, C e D toccano anche
`apps/importer/**` e `apps/api/**`: serve la tua approvazione esplicita.

## A — 9 contenuti vuoti

**Causa.** ADR-005 §1 conta fra i Divi i contenuti racchiusi nel marcatore
`<!-- wp:divi/placeholder -->` (Divi 47, Gutenberg 57). Il convertitore li
classifica invece Gutenberg (64/40), e il ramo Gutenberg scarta il marcatore
**con tutto ciò che contiene**. Lo scostamento era stato visto in
`.planning/phases/1D/BLOCK-MODEL.md` §10.3, con un controllo affidato alla
`1D-W4` che non lo ha intercettato.

Contenuti: 7 pubblicati (ID 90, 373, 594, 612, 658, 882, 1138), più la bozza
1781, che contiene solo il marcatore ed è vuota anche nella sorgente.

**Prova a secco** (convertitore Divi sui 7, senza scrivere nulla): sezioni,
righe, colonne, testo, immagini e 3 video, **nessun blocco di riserva**. Unico
residuo: il commento del marcatore produce un paragrafo vuoto in testa.

| # | Punto | Modifica |
|---|---|---|
| A1 | `apps/importer/src/convert/family.ts:11-22` | Famiglia `divi` quando gli unici marcatori Gutenberg sono `divi/placeholder` e c'è almeno uno shortcode `et_pb_`; come ADR-005 §1 |
| A2 | `apps/importer/src/convert/divi/convert.ts:45-61` | Un tratto fra moduli fatto solo di commenti HTML e spazi non produce blocchi |
| A3 | `apps/importer/src/convert/gutenberg/convert.ts:4, 110-112` | Commento: il marcatore si scarta solo se vuoto (caso 1781); comportamento invariato |
| A4 | `apps/importer/tests/unit/convert/family.test.ts` | Prove: marcatore con Divi → `divi`; marcatore vuoto → `gutenberg`; Gutenberg vero con marcatore → `gutenberg` |
| A5 | `apps/importer/tests/unit/convert/divi.test.ts` | Prova: il marcatore non genera paragrafi vuoti |
| A6 | `apps/importer/tests/real/contentsRelations.real.test.ts:158-160` | Atteso 57/47/4 (ADR-005), non più 64/40/4 |
| A7 | `docs/migration/divi-shortcode-strategy.md:132` | La riga del marcatore dice che il contenuto racchiuso si converte come Divi |
| A8 | `.planning/phases/1D/BLOCK-MODEL.md` §10.3 | Una riga di chiusura: scostamento corretto nella `1E-W6` |
| A9 | Riesecuzione dell'import | Necessaria; si fa una sola volta, insieme a C e D |

**Residuo noto, ID 1138 (`/corsi-2022-2023/`).** Un modulo testo Divi contiene
colonne Gutenberg (`wp-block-columns`, `flex-basis`). Il sanificatore toglie lo
`style` dei `div`, quindi le colonne si impilerebbero. Proposta: regola CSS
`.blk-text .wp-block-columns` e `flex-basis` ammesso **solo** su
`div.wp-block-column` (`packages/blocks/src/sanitize/sanitize.ts`). Va deciso
insieme a D57.

**`/bacheca/` non è un caso A.** Il suo unico shortcode, `[wpdm_user_dashboard]`,
si elimina per decisione (`divi-shortcode-strategy.md:62`, «plugin
disattivato»). Nell'istanza di riferimento il plugin è invece attivo e mostra
«Sorry, but you do not have permission to view this content.» Decisione D54.

## B — colonne Divi impilate

**Causa.** Il dato arriva giusto (`columnStructure "2_3,1_3"`, `width "2_3"`), ma
né i componenti né il CSS lo usano: `.blk-column` resta un `div` a blocco. Sono
coinvolti 48 contenuti con righe a più colonne: 41 `2_3,1_3`, 4 `1_3,2_3`,
3 `1_2,1_2`, 2 `3_4,1_4` e 1 `3_5,2_5`. Tutte le righe usano il gutter
predefinito.

| # | Punto | Modifica |
|---|---|---|
| B1 | `packages/blocks/src/render/Column.tsx:19-20` | Esporre la larghezza (`data-width`), fuori dal vocabolario chiuso delle classi |
| B2 | `apps/web/src/styles/blocks.css:27-55` | Geometria Divi sopra 980 px: `float:left`, `margin-right:5.5%` (zero sull'ultima colonna), clearfix della riga, larghezze `2_3` 64,833 %, `1_3` 29,6667 %, `1_2` 47,25 %, `3_4` 73,625 %, `1_4` 20,875 %, `3_5` 57,8 %, `2_5` 36,7 %, `4_4` 100 %. Fino a 980 px: `width:100%`, `margin-bottom:30px` salvo l'ultima |
| B3 | `apps/web/src/styles/blocks.css` | `.blk-column > .blk { margin-bottom:30px }`, a zero sull'ultimo, come `.et_pb_column .et_pb_module` |
| B4 | `packages/blocks/tests/render/render.test.tsx:51-85` | Prova dell'attributo di larghezza |
| B5 | Serializzatore (`serialize.ts:62-79`) | **Invariato**: la larghezza è presentazione, esclusa da `content_html` (§6.1) |

Nessuna riesecuzione dell'import. Rischio: le righe che vengono da Gutenberg
usano gli stessi blocchi, ma nella sorgente le rende il flex di WordPress, con
il passaggio a una colonna a 781 px invece che a 980. Decisione D57.

## C — form

| # | Sintomo | Causa | Punto |
|---|---|---|---|
| C1 | Ordine dei campi sparso (25 form su 25) | `JSON.parse` mette in ordine crescente le chiavi numeriche; WordPress segue l'ordine del testo | `apps/importer/src/stages/forms/index.ts:183-189` (e il commento `:25-27`), lo stesso per le notifiche a `:212`. L'ordine va letto dal testo grezzo |
| C2 | Etichette a lato, nessun segnaposto, un solo campo per nome, email con conferma e indirizzo | Opzioni scartate all'import (`first/last_placeholder`, `confirmation_placeholder`, segnaposto dell'indirizzo, `date_placeholder`, `size`, `label_hide`, `sublabel_hide`); resa con un solo `<input>` | `forms/index.ts:79-91`; `packages/blocks/src/render/Form.tsx:69-74, 137-149` |
| C3 | Tag HTML visibili come testo (22 form) | Il campo `html` è reso come testo | `Form.tsx:62-66`: sanificare con `sanitize.ts:54` e rendere come HTML |
| C4 | Testo del bonifico, IBAN compreso, sempre visibile | Logica condizionale non importata né valutata (22 form, solo `show`, `==`, gruppi in OR e regole in AND, valore = chiave della scelta) | `forms/index.ts:23-24, 79-91`; `Form.tsx:42-50` (oggi si inviano le etichette, non le chiavi); `apps/api/src/modules/formSubmissions/service.ts:68-87` |
| C5 | **Difetto funzionale**: un campo obbligatorio condizionato (es. «Numero ed età dei bambini») è sempre obbligatorio, quindi chi non chiede il babysitteraggio non riesce a inviare | Come C4: il server deve saltare i campi nascosti | `formSubmissions/service.ts:75, 80-87` |
| C6 | Due colonne assenti | WPForms affianca da solo i sotto-campi (nome/cognome, email/conferma, città/provincia) | Deriva da C2, con le classi equivalenti |
| C7 | Stile di campi e pulsante | CSS assente; testo del pulsante fisso | `apps/web/src/styles/blocks.css:203-215`; `Form.tsx:291-293`; esporre `submitText` da `apps/api/src/modules/public/service.ts:457-470, 514-540` |
| C8 | **Importo del pagamento perso** (scoperto ora) | `price "100,00"` con la virgola non viene letto | `apps/api/src/modules/public/service.ts:472-481` |

Prove da aggiornare: `apps/importer/tests/unit/stages/formsStage.test.ts` (serve
una fixture scritta come testo grezzo, perché `JSON.stringify` non può
rappresentare l'ordine), `packages/blocks/tests/render/dynamic-blocks.test.tsx:231-380`,
`apps/api/tests/formSubmissions.test.ts`, `publicRead.test.ts`, `formPayment.test.ts`,
`openapi.snapshot.json`. **Riesecuzione dell'import necessaria** (fase `forms`).
Decisioni D55 (telefono con bandiera) e D56 (forma dei valori inviati).

Privacy: il testo del campo HTML con i dati bancari si rende com'è, come nella
sorgente, mai nei log né nei documenti.

## D — elenco degli articoli e archivio

**Correzione di un rilievo precedente.** Nel plugin sorgente `offset` significa
«inizia dall'articolo N», contato da 1 (`class-widget.php:275-276`: si salta
solo con offset maggiore di 1, e l'etichetta dice «Start with post»). La home
sorgente mostra per primo l'articolo più recente (ID 1783, «Vuoi diventare
consulente familiare?»), come conferma la cattura di riferimento. Il rilievo del
2026-10-12 («la home salta il più recente») e l'`offset` applicato con l'import
di HO-013 sono quindi sbagliati. Decisione D53.

| # | Sintomo | Causa | Punto |
|---|---|---|---|
| D1 | Immagini a piena larghezza (home +7 913 px) | Immagine originale con `sizes=100vw` e CSS `width:100%`; la sorgente ha miniature 100×100 | `packages/blocks/src/render/PostList.tsx:38`; `apps/web/src/styles/blocks.css:190-201` |
| D2 | Estratti assenti | L'API passa solo il riassunto scritto a mano (3 articoli su 10); il plugin prende 100 parole del testo e aggiunge «leggi tutto» | `apps/api/src/modules/public/service.ts:547-578`, `schemas.ts:95-102`; `packages/blocks/src/render/data-maps.ts:58-65` |
| D3 | Data presente | I booleani `b:1` della configurazione salvata si perdono; con miniatura in alto il plugin non mostra la data | `apps/importer/src/stages/contents/catposts.ts:11-19, 41-44`; `apps/importer/src/convert/shared/non-divi-shortcodes.ts:68-81, 99-117` |
| D4 | Primo articolo saltato | `offset` copiato tale e quale | `catposts.ts:18`; `non-divi-shortcodes.ts:105-106` (offset − 1, minimo 0) |
| D5 | Miniatura di riserva assente (3 articoli) | `default_thunmbnail` non importato | `catposts.ts`; `packages/blocks/src/schema/post-list.ts:9-21`; `apps/api/src/modules/public/service.ts:15` (`MEDIA_KEYS`) |
| D6 | Archivio: immagine originale invece del ritaglio 1080×675 | Variante non scelta | `apps/web/src/components/Views.tsx:84-100` |
| D7 | Archivio: immagine dopo il titolo | Ordine nel template | `Views.tsx:119-129` |
| D8 | Archivio: spaziature e larghezza della colonna | `.entry-featured-image-url` assente; `.post-meta` senza `padding-bottom:15px` / `margin-bottom:6px`; colonna 79,125 % con 5,5 % invece di 77,25 % con 3 % | `apps/web/src/styles/layout.css:253-257, 269-272` |
| D9 | Data «07 Ott» invece di «7 Ott» (famiglia H) | Formattazione del giorno | `apps/web/src/lib/format.ts:22-31` |
| D10 | **Data spostata di un giorno** per gli articoli pubblicati di sera | `post_date` (ora locale) letta come UTC; va usata `post_date_gmt` | `apps/importer/src/stages/contents/index.ts:218` |

Prove da aggiornare: `apps/importer/tests/unit/stages/catpostsConfig.test.ts`
(i casi usano `s:1:"1"`, i dati reali `b:1`), `gutenbergFreeform.test.ts:66-80`,
`divi.test.ts:161`, `packages/blocks/tests/render/dynamic-blocks.test.tsx:193-230`,
`render.test.tsx:226-246`, `apps/api/tests/publicRead.test.ts:221-223, 322-325`,
`openapi.snapshot.json`, il corpus dei blocchi (`tests/fixtures/build-block-corpus.ts:191`,
`block-corpus.json:462`) e `apps/admin/tests/roundtrip-corpus.test.ts`. Nuove
prove per le viste in `apps/web/tests`. **Riesecuzione dell'import necessaria.**

Rischio: la larghezza di `#left-area` vale anche per gli articoli con barra
laterale; prima di cambiarla verifico che lì la sorgente usi lo stesso gutter.

## Ordine di lavoro proposto

1. A (importer) e B (solo resa), con le prove.
2. D, poi C, il più esteso.
3. Una sola riesecuzione dell'import, a conferma, con copia di sicurezza.
4. Prova 1E-19, controllo degli stati della matrice, ricattura e nuovo confronto.

## Stato di attuazione (2026-10-13)

Approvata con DR-129; decisioni D53–D57 chiuse con DR-130…134. Codice scritto, con
le prove, per tutte e quattro le famiglie; lint, tipi e prove dei 9 pacchetti verdi.
Ciò che dipende dai dati diventa visibile solo dopo la riesecuzione dell'import
(HO-018).

| Famiglia | Fatto | Visibile ora | Dopo l'import |
|---|---|---|---|
| A | famiglia Divi per il marcatore (57/47/4), niente paragrafi vuoti, `/bacheca/` con il messaggio di Members | — | i 7 contenuti e `/bacheca/` |
| B | geometria Divi misurata (larghezze, gutter, 30 px fra moduli, padding fisso da 1350 px, colonne e testi senza padding ereditato), righe Gutenberg in flex, `flex-basis` come classe | `/chi-siamo/` coincide entro 1 px a 1440 | righe Gutenberg (`layout`) |
| C | ordine dal testo, opzioni di resa, sotto-campi, HTML sanificato, logica condizionale in pagina e sul server, pagamento solo se il campo è visibile, importo con la virgola, testo del pulsante, CSS di WPForms, telefono con intl-tel-input (ADR-011) | HTML dei campi | ordine, segnaposto, condizioni |
| D | `offset` contato da 1, booleani, miniatura 100×100 e di riserva, estratto e «leggi tutto», niente data; archivio con ritaglio 1080×675, ordine e spaziature della sorgente; giorno senza zero; `post_date_gmt` | archivio coincide nelle misure principali | home, date |

Residui già visti, da riclassificare dopo la ricattura: immagine della colonna
destra di `/chi-siamo/` spostata di 64 px nella sorgente; riga dei metadati alta
39 px contro 42; resa del modulo di contatto Divi di `/contatti/`; famiglie E–I.

## J — link interni rotti (approvata, DR-135)

**Causa.** `normalizeSameSiteUrls` (`apps/importer/src/convert/shared/url-normalize.ts:21-22`)
cerca `//www.centroamorislaetitia.it/…` per trasformare gli indirizzi relativi allo
schema, ma trova la stessa sequenza anche **dentro** gli indirizzi assoluti:
`https://www.centroamorislaetitia.it/x/` diventa `https:/x/`, nell'`href` e nel
testo visibile. Nel database: **97 occorrenze in 47 contenuti**, es.
`/circolo-della-sicurezza/`.

| # | Punto | Modifica |
|---|---|---|
| J1 | `apps/importer/src/convert/shared/url-normalize.ts:21-22` | la sequenza `//host` vale solo se non è preceduta da uno schema (`https:`) o da una lettera |
| J2 | nuova prova `apps/importer/tests/unit/convert/urlNormalize.test.ts` | assoluto invariato in `href` e testo; relativo allo schema normalizzato |
| J3 | riesecuzione dell'import | la stessa di HO-018 |

`normalizeSameSiteUrlValue` (usata per `src` di immagini e video) controlla già
che il valore inizi con `//` e non è coinvolta. Gli indirizzi assoluti restano
assoluti, verso `www.centroamorislaetitia.it`, come nella sorgente.

**Esito (2026-10-13).** J1 e J2 fatti, 8 prove nuove, importer 348/348 verde; dopo
l'import di HO-018 nel database `https:/` spezzati 0 (erano 97 in 47 contenuti),
47 contenuti con indirizzi assoluti intatti.
