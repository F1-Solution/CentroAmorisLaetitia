# Analisi d'impatto — cause (a), (b), (c), campo di ricerca, pagina dei risultati, D66

Fase 1E, wave `1E-W6`. Scritto il 2026-10-14 dopo DR-146…150. Ordine di lavoro
approvato: (b), (a), campo, (c), risultati; D66 per ultima, perché chiede un import.

## (b) Spaziatura per pagina — D69 = A (DR-149)

Divi scrive sul `body` la classe `et_pb_gutters{N}`: N è `_et_pb_gutter_width` della
pagina, se c'è, altrimenti `gutter_width` del tema (2). Nella sorgente il meta vale 2 in
27 contenuti e 3 solo in `/chi-siamo/`. Sopra i 980 px il widget del piè ha
`margin-bottom` 0 / 3% / 5,5% / 8% per N = 1…4 (`css/dynamic-assets/gutters{N}_footer.css`
del tema). Le colonne delle righe Divi hanno una spaziatura propria, già conforme
(DR-134): non cambiano.

| Punto | Modifica |
|---|---|
| `packages/db/src/schema/content.ts` | colonna `gutterWidth` `smallint`, vuota = valore del tema, vincolo 1…4 |
| `packages/db/drizzle/0005_*.sql` e `meta/` | migrazione generata |
| `docs/architecture/schema.sql` | stessa colonna |
| `apps/importer/src/stages/contents/meta.ts` | `deriveGutterWidth()`: il meta se è 1…4, altrimenti vuoto |
| `apps/importer/src/stages/contents/index.ts` | scrittura in inserimento e aggiornamento |
| `apps/importer/src/preflight/constants.ts` | `_et_pb_gutter_width` da escluso a usato |
| `apps/importer/tests/unit/stages/contentsMeta.test.ts` | prove della funzione |
| `apps/api/src/modules/public/service.ts`, `routes.ts`, `schemas.ts` | `gutterWidth` nella lettura pubblica del contenuto |
| `apps/api/tests/openapi.snapshot.json`, `publicRead.test.ts` | contratto e prova |
| `apps/web/src/lib/api.ts` | tipo |
| `apps/web/src/components/SiteShell.tsx`, `apps/web/src/app/[[...percorso]]/page.tsx` | classe `et_pb_gutters{N}` su `#page-container`, 2 se il contenuto non la indica (archivio, ricerca, 404, download) |
| `apps/web/src/styles/layout.css:521-525` | margine del widget per N, solo sopra i 980 px |

Effetto atteso: −25 px sopra i 980 px su 114 indirizzi; `/chi-siamo/` invariata. Il
valore non si modifica dal CMS (come oggi la classe del tema); se serve, è una decisione
a parte. **Richiede migrazione e import** (HO-021).

## (a) Sottomenu chiusi — D68 = A (DR-148)

| Punto | Modifica |
|---|---|
| `apps/web/src/styles/layout.css:128-152` | sottomenu chiuso `display: none` invece di `visibility: hidden; opacity: 0`; aperto `display: block` |

Oggi l'apertura non ha transizione, quindi non serve `@starting-style`: la resa
all'apertura resta identica. Tastiera: un sottomenu chiuso non era raggiungibile prima
(`visibility: hidden`) e non lo è ora; `:focus-within` lo apre come prima. Menu del
telefono: regole separate (`.et_mobile_menu`), non toccate. Effetto atteso: le 23
coppie colpite tornano all'altezza della finestra.

## Campo di ricerca — approvato (DR-150), contorno D67 = A (DR-147)

| Punto | Modifica |
|---|---|
| `apps/web/src/styles/layout.css:233-245` | via `height`; `font-family: inherit`, `letter-spacing: 2px`; stessa spaziatura su `::placeholder`; contorno `2px solid #333` a fuoco come DR-141 |

Nessun effetto sulla ricattura: a ricerca chiusa il campo non si vede.

## (c) Spaziature dell'articolo di pagina

Nella sorgente `page.php` scrive l'articolo con `post_class()`, senza `et_pb_post`;
`single.php` e `index.php` lo aggiungono. Regole misurate:

| Regola della sorgente | Oggi nel sito |
|---|---|
| `#left-area { padding-bottom: 23px }` solo sopra i 980 px | sempre |
| `.et_full_width_page #left-area { padding-bottom: 0 }` | assente |
| `.main_title { margin-bottom: 20px }` | assente |
| articolo di pagina senza `.et_pb_post` (nessun margine) | `et_pb_post`, 60 px |
| `.et_pb_post { margin-bottom: 42px }` fra 981 e 1100 px e sotto i 981 | sempre 60 px |

| Punto | Modifica |
|---|---|
| `apps/web/src/components/Views.tsx:35` e `:77` | articolo di pagina senza `et_pb_post` (gli articoli `post`, l'archivio, i download e la 404 lo tengono, come la sorgente) |
| `apps/web/src/components/Views.tsx:73` | `#content-area` con l'indicazione `data-layout` del contenuto, per `et_full_width_page` |
| `apps/web/src/styles/layout.css:413-415` | `padding-bottom: 23px` solo sopra i 980 px, 0 con `full_width` |
| `apps/web/src/styles/layout.css:483-485` | 42 px fino a 1100 px |
| `apps/web/src/styles/layout.css` | `.main_title { margin-bottom: 20px }` |

Nessuna altra regola usa `et_pb_post` sull'articolo di pagina (ricerca in `apps/web`,
`packages/blocks`, `tests/visual`). Effetto atteso: −60 px su tutte le pagine costruite
con Divi; −63 px circa sulle pagine con titolo; −18 px per articolo sotto i 1101 px su
articoli, archivio e ricerca.

## Pagina dei risultati e archivio

Stesso modello (`index.php`), stesse regole: correggerle vale anche per
`/category/news/`.

| Regola della sorgente | Oggi | Punto |
|---|---|---|
| `h1 a … h6 a { color: inherit }` | colore dei link | `apps/web/src/styles/base.css` |
| `.et_pb_post > h2 { font-size: 18px }` sotto i 768 px | 26 px | `layout.css` |
| `.et_pb_post h2 { font-size: 16px; padding-bottom: 0 }` sotto i 480 px | 26 px | `layout.css` |
| immagine: `srcset` con la variante a 980 px e `sizes` con la fascia 481–980 | solo 1080 e 480 | `apps/web/src/lib/featured.ts`, sua prova |

La regola dei titoli vale per ogni `h1…h6` con un link: la cerco nei contenuti prima di
applicarla, perché può cambiare il colore di titoli linkati nei testi.

**Estratto e virgolette: fuori da questa correzione, D70.** WordPress passa testi e
titoli per `wptexturize` (virgolette e apostrofi tipografici) e salva le emoji come
entità (`&#x1f4cc;`). Il limite di 270 caratteri di Divi conta il testo così com'è
scritto, entità comprese: per questo l'estratto della sorgente è più corto di 10–24
caratteri. Riguarda tutti i titoli e i testi del sito, non solo la ricerca.

## D66 = A (DR-146) — testo visibile diviso per blocchi

| Punto | Modifica |
|---|---|
| `packages/blocks/src/serialize/text-extract.ts` | a capo ai confini dei blocchi (`p`, `div`, `h1…h6`, `li`, `tr`, `td`, `br`, …), spazio per i tag in linea; spazi ridotti, a capo conservati |
| `packages/blocks/tests/serialize.test.ts:342-352` | prova del caso «…corso» / «Per…» |
| `.planning/phases/1D/BLOCK-MODEL.md` §6.1 | regola aggiornata |

Chi legge `content_text` lo riduce già a una riga (`fallbackDescription`, riassunti,
`textStart`, `archiveSummary`, sommario dell'editor), quindi nessuna resa cambia;
`search_vector` non distingue spazi e a capo. Le prove di andata e ritorno confrontano
il testo con la stessa funzione: restano valide. **Richiede import** (HO-021).

## Decisione nuova

### D70 — Tipografia di WordPress (`wptexturize`) ed emoji nell'estratto
- **A (consigliata):** portare `wptexturize` nell'import (virgolette, apostrofi,
  trattini, puntini come la sorgente) e contare l'estratto sulla forma scritta da
  WordPress, entità comprese. Titoli, testi ed estratti tornano identici.
- B: solo le virgolette tipografiche, senza toccare la lunghezza dell'estratto.
- C: lasciare il testo com'è e registrarla come difformità.
- Impatto: titoli e testi di tutte le pagine; estratti di archivio e ricerca; import.
- Default vietato: cambiare i testi importati senza la tua risposta.

---

## D70 = A (DR-151) — tipografia di WordPress ed estratti

Scritto il 2026-10-16. **In attesa di approvazione dell'elenco**, nessuna modifica fatta.

### Che cosa fa la sorgente

- `wptexturize()` (`wp-includes/formatting.php:37`, WordPress della sorgente) trasforma
  alla resa `'` e `"` in ‘ ’ “ ”, `...` in …, ` - ` in –, `--` in —, `(tm)` in ™, 9' e 9"
  in primi; non tocca `pre`, `code`, `kbd`, `style`, `script`, `tt`, i commenti, i tag e
  il testo dentro le parentesi quadre degli shortcode.
- Traduzione `it_IT` della sorgente: stesse virgolette dell'inglese; elisioni proprie
  (`po'` → po’, `da'`, `di'`, `fa'`, `sta'`, `va'`, `be'`, `mo'`, `a'`, `de'`, `co'`).
- Si applica a: contenuto (`the_content`, tutte e tre le famiglie, prima degli
  shortcode), titoli (`the_title`: contenuti, voci di menu, download), riassunto scritto a
  mano (`the_excerpt`), titolo della finestra. **Non** agli attributi dei moduli Divi
  (titoli di pulsanti, intestazioni di slide), che Divi stampa senza filtro.
- Nessun tema o plugin della sorgente la disattiva (ricerca di `run_wptexturize` e
  `remove_filter` in `Divi` e `plugins`).
- Nel testo grezzo le emoji sono già entità (`&#x1f4cc;` 29 volte, `&#x1f557;`,
  `&#x1f4cd;`, `&#x1f4c5;` 9 volte ciascuna, …) e 91 apostrofi sono già `&#8217;`.
- L'estratto di archivio e ricerca è `truncate_post(270)` di Divi: conta 270 caratteri
  del testo **con le entità scritte per esteso** (`&#8217;` vale 7, `&#x1f4cc;` vale 9),
  poi toglie l'ultima parola. Per questo la sorgente taglia 10–24 caratteri prima.

### Punti da toccare

| Punto | Modifica |
|---|---|
| `apps/importer/src/convert/shared/wptexturize.ts` (nuovo) | porto di `wptexturize()` e `wptexturize_primes()` con le stringhe `it_IT`, come già `wpautop.ts`; il risultato in caratteri Unicode, non in entità |
| `apps/importer/tests/unit/convert/wptexturize.test.ts` (nuovo) | prove: virgolette, apostrofi, elisioni italiane, trattini, puntini, primi, tag e shortcode esclusi, `pre`/`code` intatti |
| `apps/importer/src/convert/shared/rich-text.ts:51` | `wptexturize` dopo `wpautop`, prima della sanificazione: vale per Gutenberg, Divi, HTML e per i blocchi di riserva che nascono dallo stesso frammento |
| `apps/importer/src/convert/divi/convert.ts` | nessuna modifica agli attributi dei moduli: la sorgente non li trasforma |
| `apps/importer/src/stages/contents/index.ts:106-107` | titolo e riassunto scritto a mano trasformati |
| `apps/importer/src/stages/menus/index.ts:202` | etichetta della voce di menu trasformata |
| `apps/importer/src/stages/documents/index.ts:200` | titolo del download trasformato |
| `apps/web/src/lib/format.ts:9-15` (`archiveSummary`) | conteggio dei 270 caratteri sulla forma scritta da WordPress: ‘ ’ “ ” – — … ™ ′ ″ valgono 7, un'emoji vale la lunghezza della sua entità esadecimale, `&` vale 5 |
| `apps/web/tests/format.test.ts` | prove del conteggio |
| `docs/migration/wp-to-postgres-mapping.md` | regola annotata |

Fuori: SEO (titoli e descrizioni di AIOSEO si verificano a parte sul reso, prima di
cambiarli), sanificazione e resa dei blocchi (nessuna modifica), API (nessuna modifica).

### Verifica

1. Testo visibile di `#main-content`, titolo e menu dei 115 indirizzi, sorgente contro
   sito, contando i caratteri ‘ ’ “ ” – — … ' ": numero di differenze prima e dopo.
2. Estratti dell'archivio (tutte le pagine) e della ricerca `corso`: identici alla
   sorgente, salvo gli scarti del testo già noti.
3. Lint, tipi, prove; import su conferma (**HO-022**); ricattura e confronto.

### Rischi

- La regola è complessa (contesti delle virgolette, numeri, primi): il porto segue il
  codice riga per riga e la verifica 1 misura il risultato su tutto il sito.
- Un apostrofo in un indirizzo o in un attributo non deve cambiare: tag e attributi
  restano esclusi come nella sorgente.

### Attuazione (2026-10-16, DR-152)

Scritto come da elenco, più due punti emersi lavorando:

| Punto | Perché |
|---|---|
| `apps/importer/src/convert/gutenberg/convert.ts`, blocchi `wp:html` e non mappati; `divi/convert.ts`, testo dei segnaposto della mappa | nella sorgente anche questi passavano da `the_content` |
| `apps/importer/src/convert/shared/non-divi-shortcodes.ts` | il testo letterale degli shortcode resta com'è: nella sorgente non passava dal filtro |
| `apps/api/src/modules/public/search.ts` e `tests/publicSearch.test.ts` | dopo il porto il testo ha «l’altro»; chi cerca scrive «l'altro», che la sorgente trovava nel grezzo: apici e virgolette tipografici si riducono a quelli dritti nel confronto |

L'etichetta di menu «Registrazione laboratorio &#8220;Litighiamo oggi?&#8221;», salvata
con le entità, ora si decodifica (prima React l'avrebbe mostrata alla lettera).

Prove: 17 per il porto (`tests/unit/convert/wptexturize.test.ts`), 4 per l'estratto
(`apps/web/tests/format.test.ts`), 1 per la ricerca. Lint, tipi 9/9, prove 8/8.

Linea di partenza della verifica 1 (`tipografia.py`, prima dell'import): 98 indirizzi su
115 con differenze, 1.258 scarti (contenuto 1.085, titoli 166, menu 7). Import: HO-022.
