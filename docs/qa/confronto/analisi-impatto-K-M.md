# Analisi d'impatto — famiglie K, L, G, C+, M della `1E-W6` e attuazione di D58

Fase 1E, wave `1E-W6`. Scritta il 2026-10-13, dopo il confronto di HO-018
(`classificazione.md` §4). **Nessuna modifica al codice**: questo documento
elenca ogni punto da toccare, con file e riga, per l'approvazione.

Misure prese sull'istanza di riferimento (`127.0.0.1:8088`) e sul sito nuovo
(`127.0.0.1:3200`) con Chromium di Playwright, stesse viewport del confronto.

---

## K — immagini ritagliate nel `srcset` (bloccante)

**Causa.** `imageAttributes` mette nel `srcset` **tutte** le dimensioni derivate,
anche i ritagli a proporzione diversa. WordPress (`wp_calculate_image_srcset`,
`wp_image_matches_ratio`) tiene solo quelle con la stessa proporzione della
dimensione mostrata, con 1 px di tolleranza dopo il ridimensionamento.

Esempio misurato, `/i-prossimi-corsi-del-centro/`, immagine 3744×5197:

| | `srcset` |
|---|---|
| Sorgente | 3744w, 216×300, 768×1066, 738×1024, 1080×1499 |
| Sito nuovo | le stesse **più** 150×150, 400×250, 400×284, 510×382, 1080×675 |

A 390 px il browser sceglie 400×250, un ritaglio orizzontale, e l'immagine
appare tagliata e bassa: è la causa principale delle 40 coppie peggiorate.

| # | Punto | Modifica |
|---|---|---|
| K1 | `packages/blocks/src/render/media.ts:30-42` `imageAttributes` | nel `srcset` solo le varianti con la proporzione della dimensione mostrata (regola di `wp_image_matches_ratio`), senza doppioni di larghezza |
| K2 | `packages/blocks/tests/render/media.test.tsx:53` | aggiornare l'atteso; nuove prove: ritagli esclusi, tolleranza di 1 px, immagine senza varianti |
| K3 | chiamanti, nessuna modifica di firma: `Image.tsx:14`, `MediaText.tsx:22`, `PostList.tsx:38`, `Slider.tsx:58`, `Video.tsx:58` | verificare a vista uno per tipo dopo K1 |
| K4 | `apps/web/src/lib/featured.ts` (archivio, ritaglio 1080×675) | **nessuna**: costruisce già il proprio `srcset` con ritaglio e variante da 480, come la sorgente |

**K-bis (decisione D59).** Nelle 9 pagine Gutenberg con `"sizeSlug":"large"` la
sorgente mostra la variante grande (es. 731×1024) con `width` e `sizes` di quella
variante; il sito nuovo mostra l'originale. Dove il contenitore è più largo
della variante, l'immagine nuova è più grande. Lo schema ha già il campo
`image.variant` (`packages/blocks/src/schema/image.ts:17-21`), ma l'importer lo
lascia `null` (`apps/importer/src/convert/gutenberg/convert.ts:152`,
`divi/convert.ts:408`) e la resa lo ignora. Le 41 immagini Divi puntano tutte
all'originale (0 con suffisso `-LxA`) e non cambiano.

| # | Punto | Modifica, solo se D59 = A |
|---|---|---|
| K5 | `apps/importer/src/convert/gutenberg/convert.ts:125-155` | `variant` = `LxA` dal suffisso del `src`, se la variante esiste |
| K6 | `media.ts` `imageAttributes` e `Image.tsx:14` | con `variant`: `src`, `width`, `height` e `sizes` della variante, `srcset` con la sua proporzione |
| K7 | prove in `apps/importer/tests/unit/convert/gutenberg.test.ts` e `media.test.tsx` | — |

## L — colonne Gutenberg dentro il testo Divi (maggiore)

**Causa.** `/corsi-2022-2023/` è Divi, ma il suo testo contiene
`div.wp-block-columns` con `flex-basis`, scritti dall'editor Divi con commenti
`divi:columns`. WordPress carica lo stile delle colonne solo per i blocchi
`wp:columns`: nella sorgente le «colonne» restano impilate, a una colonna, con le
immagini a dimensione naturale. Il nostro foglio di stile le affianca. Nel
database l'unico contenuto con `wp-block-columns` nel testo è questo.

| # | Punto | Modifica |
|---|---|---|
| L1 | `apps/web/src/styles/blocks.css:124-200` | togliere i selettori `.blk-text .wp-block-columns` e `.blk-text .wp-block-column…` da ogni regola; restano quelli di `.blk-row[data-layout='flex']` (DR-134) |
| L2 | verifica | `/corsi-2022-2023/` alle 6 viewport contro la sorgente; nessun altro contenuto toccato (query sul database) |

Il bordo della barra laterale sulla stessa pagina è la famiglia G.

## G — barra laterale per contenuto (maggiore)

**Misura.** La sorgente non stampa mai un elemento `#sidebar` (la barra è vuota):
cambia solo la classe del `body`, da `_et_pb_page_layout`, con predefinito del
tema `et_right_sidebar` (`et_divi.divi_sidebar`).

| Classe nella sorgente | Pagine | Articoli | Sorgente a 1440 | Sito nuovo |
|---|---|---|---|---|
| `et_right_sidebar` | 13 (non Divi) | 11 | colonna 834 px, filetto a 245,7 px da destra | pagine: colonna 1080 senza filetto; articoli: 834 px, filetto a 225,4 px |
| `et_full_width_page` | 36 | 15 | colonna piena, nessun filetto | pagine: uguale; articoli: barra |
| `et_no_sidebar` | 29 (Divi) | 2 | colonna piena, nessun filetto | pagine: uguale; articoli: barra |

Gli articoli Divi a piena larghezza (12) nella sorgente hanno le sezioni larghe
quanto la pagina (1440), come le pagine Divi. Archivio e 404 nella sorgente sono
`et_right_sidebar`, come oggi nel sito nuovo. Il filetto è 20 px fuori posto
anche dove la barra c'è già.

`wp-to-postgres-mapping.md:242` aveva previsto il caso: «se una di queste chiavi
cambia la resa, diventa una proprietà». Il confronto lo dimostra per
`_et_pb_page_layout`.

| # | Punto | Modifica |
|---|---|---|
| G1 | `apps/importer/src/preflight/constants.ts:138` | `_et_pb_page_layout` esce dalle chiavi escluse ed entra fra le importate |
| G2 | `apps/importer/src/stages/contents/meta.ts` (accanto a `deriveShowTitle`, righe 11-40) | `derivePageLayout(meta)`: `right_sidebar`, `full_width`, `no_sidebar`; assente → `right_sidebar` |
| G3 | `apps/importer/src/stages/contents/index.ts:225, 240-275` | scrivere il campo in inserimento e aggiornamento |
| G4 | `packages/db/src/schema/content.ts:37` e nuova migrazione `packages/db/drizzle/0003_…sql` | colonna `page_layout` (decisione D60) |
| G5 | `apps/api/src/modules/public/service.ts:302`, `schemas.ts:115`, `routes.ts:104`; `apps/api/tests/openapi.snapshot.json` | esporre il campo nella lettura pubblica |
| G6 | `apps/api/src/modules/content/schemas.ts:59, 87`, `service.ts:74, 98, 119`; `apps/admin/src/lib/editor/roundtrip.ts:36` | solo se D60 = A: leggibile e modificabile dal CMS |
| G7 | `apps/web/src/lib/api.ts:62` | tipo del contenuto pubblico |
| G8 | `apps/web/src/components/Views.tsx:29-48` (ramo Divi a piena larghezza), `:79` (`#sidebar` sempre per gli articoli) | classe di layout sul contenitore; barra solo con `right_sidebar`; articoli Divi `full_width` con le sezioni a tutta pagina |
| G9 | `apps/web/src/styles/layout.css:239-264, 309-318` | regole per classe come il tema; filetto alla posizione misurata (245,7 px a 1440) |
| G10 | `docs/migration/wp-to-postgres-mapping.md:242` | annotare l'esito |
| G11 | prove: `apps/importer/tests/unit/stages/contentsMeta.test.ts`, `apps/api/tests/publicRead.test.ts`, prova di resa di `Views` | — |

Serve la riesecuzione dell'import (nuovo HO).

## C+ — residui del form (maggiore)

**Telefono, causa misurata.** Il reset portato da WPForms,
`.blk-form[data-origin='wpforms'] *` (`apps/web/src/styles/blocks.css:495-512`),
ha specificità 0,2,0 e batte le regole di intl-tel-input (`.iti__flag`, 0,1,0):
larghezza, altezza e sfondo della bandiera si azzerano (0×0, nessuna immagine).
Il campo misura 1080 px; nella sorgente è il contenitore a 1080 px, il campo
resta «medio» a 648 px. La sorgente usa la versione vecchia della libreria
(senza prefisso visibile); la nostra 29.5.3 scrive `+39` in
`.iti__selected-dial-code`, assente nella sorgente.

**Indirizzo, causa misurata.** La sorgente divide i sotto-campi su più
`wpforms-field-row` (indirizzo; città e provincia; CAP), separate da 8 px;
`CompositeField` li mette tutti in una riga sola.

| # | Punto | Modifica |
|---|---|---|
| C+1 | `apps/web/src/styles/blocks.css:495` | il reset non tocca i discendenti di `.iti` (`:where(:not(.iti *))` o equivalente) |
| C+2 | `blocks.css:675-684` | contenitore `.iti` a tutta riga come oggi; campo con `max-width: 60 %` come gli altri medi; `padding-left` come la sorgente (52 px) |
| C+3 | `packages/blocks/src/render/FormField.tsx:209-245` (`PhoneField`) | `+39` nascosto come nella sorgente (opzione della libreria o regola CSS, da provare) |
| C+4 | `FormField.tsx:149-190` (`CompositeField`) | una `wpforms-field-row` per ogni parte intera e una per ogni coppia di metà, come la sorgente; vale per nome e indirizzo |
| C+5 | prove in `packages/blocks/tests/render/dynamic-blocks.test.tsx` e verifica a vista di `/registrazione-sguardi-damore/` | — |

Nessun import: è solo resa.

## M — mappa senza altezza (maggiore)

**Misura.** Il difetto c'è dalla `1E-W5` (`b58dcdc`), non è una regressione di oggi.

| Viewport | Sorgente `.et_pb_map` | Sito nuovo `.blk-map` |
|---|---|---|
| 1440 | 1080×440 | 1080×87 |
| 768 | 614×350 | 614×87 |
| 390 | 312×200 | 312×87 |

Nella sorgente indirizzo e segnaposti non si vedono (`.et_pb_map_pin` nascosto);
nel sito nuovo sì, sotto la copertina.

| # | Punto | Modifica |
|---|---|---|
| M1 | `apps/web/src/styles/blocks.css:394-406` | copertina e incorporazione alte 440 px, 350 px fino a 980 px, 200 px fino a 767 px, come Divi |
| M2 | `packages/blocks/src/render/Map.tsx:53-61` | indirizzo e segnaposti nascosti (decisione D61) |
| M3 | `tests/visual/maschere.ts` | rimisurare le maschere della mappa (DR-125): l'area cresce |

## D58 — attuazione (DR-136)

| # | Punto | Modifica |
|---|---|---|
| D58-1 | `apps/importer/src/stages/contents/index.ts:212-222, 254, 274` | famiglia d'origine con `detectContentFamily(row.content)` sul testo originale; la conversione continua a usare il testo dopo Members e `[catposts]` |
| D58-2 | prova unitaria in `apps/importer/tests/unit/stages/` | `/bacheca/` resta `gutenberg` |
| D58-3 | `apps/importer/tests/real/contentsRelations.real.test.ts:158-160` | nessuna: torna a 57/47/4 |

Serve la riesecuzione dell'import, insieme a G.

## Ordine proposto

K (bloccante, solo resa) → C+ e M (solo resa) → L → G con D58 e un solo import.
Dopo ogni gruppo: prove, lint, typecheck, matrice degli stati, verifica a vista;
alla fine ricattura e confronto.

---

## Esito dell'attuazione (2026-10-13, DR-137…140)

| Famiglia | Fatto | Prova |
|---|---|---|
| K | `srcset` con la sola proporzione mostrata, oltre 2048 px escluso; `variant` dal suffisso del file per le immagini Gutenberg, resa con `src`, misure e `sizes` della variante | 5 prove nuove in `media.test.tsx`, 2 in `gutenberg.test.ts`; a 390 px `/i-prossimi-corsi-del-centro/` sceglie 738×1024 come la sorgente |
| C+ | reset di WPForms senza il selettore del paese; campo medio con `min-width: 0` (intl-tel-input 29 impone `min-width: 100%`) e a tutta riga sotto 600 px; prefisso nascosto; una riga per parte intera o coppia di metà | bandiera 20×15 visibile, campo 648 px a 1440 e 312 a 390, righe dell'indirizzo ogni 46 px come la sorgente |
| M | 440/350/200 px; indirizzo e segnaposti nel markup con `hidden` | 1080×440 a 1440 e 312×200 a 390, come la sorgente |
| L | selettori `.blk-text .wp-block-column*` tolti; `figure` senza margini nel testo | `/corsi-2022-2023/` a una colonna |
| G | colonna `contents.page_layout` (migrazione `0003_layout_della_pagina.sql`), importer, API pubblica e del CMS, scheda «Pagina» nell'editor, template e CSS (filetto a 22,75 %, righe Divi a tutta colonna negli articoli) | prove in `contentsMeta`, `contentLayout`, `publicRead`, `content-editor`, `views` |
| D58 | famiglia sul testo originale | prova in `contentsMeta` |

**Regola di G, misurata.** Il valore registrato in `_et_pb_page_layout` non è
quello reso: Divi trasforma `et_no_sidebar` senza Builder in
`et_full_width_page`, e rende senza barra ogni pagina costruita col Builder.
Con queste due regole il valore calcolato coincide con la classe del body su
**106 contenuti su 106**.

**Residui annotati, non toccati.** Su `/i-prossimi-corsi-del-centro/` le
immagini Divi sono larghe 190 px contro 338 della sorgente: non dipende dal
`srcset`, va riclassificato dopo la ricattura. La bandiera è alta 15 px contro
10 (versione della libreria, ADR-011).

G, D58 e K-bis (D59) diventano visibili solo dopo migrazione e import: HO-019.
