# Analisi per famiglie delle coppie fallite dopo DR-154

Fase 1E, wave `1E-W6`. Scritta il 2026-10-16, sul confronto di 588 coppie dopo
HO-022 e DR-154 (`ricerca-E3.md` §8): 17 superate, 1 da esaminare, 570 fallite.
**Nessuna modifica al codice**: le cause sono provate iniettando le regole nella
pagina del sito nuovo; i punti da toccare sono elencati per l'approvazione.

Strumenti: altezze dei PNG di riferimento, della cattura prima di DR-154
(`sito-2026-10-16-prima-DR-154`) e di quella attuale (`sito`); misure del DOM con
Chromium di Playwright e le condizioni di `tests/visual/condizioni.ts` su
`127.0.0.1:8088` (sorgente) e `127.0.0.1:3200` (sito nuovo).

## 1. Altezze peggiorate e migliorate nell'ultimo giro

Su 588 coppie: 318 invariate, 150 peggiorate, 120 migliorate (differenza dalla
sorgente in valore assoluto).

| Cambio d'altezza nel giro | Migliorate | Peggiorate |
|---|---|---|
| 1–3 px | 79 | 124 |
| 4–10 px | 24 | 19 |
| 11–30 px | 13 | 4 |
| 31–100 px | 4 | 3 |

**I cambi di 1–3 px vanno tutti nello stesso verso: pagina più alta.** È
l'interlinea `1.7em` di DR-154, che si eredita come 27,2 px fissi. Peggiora dove
il sito era già più alto della sorgente per un'altra causa (pagine Divi, colonne
Gutenberg), migliora dove era più basso (form, articoli). Non è un difetto nuovo:
sposta di 1–3 px pagine che hanno scarti di decine o centinaia di pixel, spiegati
più sotto.

| Famiglia di pagine | 1–3 px meglio / peggio | oltre 3 px meglio / peggio |
|---|---|---|
| Archivi e ricerca | 1 / 1 | 10 / 3 |
| Form di iscrizione | 17 / 6 | 2 / 1 |
| Pagine Divi a sezioni | 34 / 59 | 19 / 19 |
| Colonne Gutenberg con titolo | 6 / 48 | 2 / 0 |
| Testo con titolo (pagine e articoli) | 21 / 10 | 8 / 3 |
| 404 e download | 0 / 0 | 0 / 0 |

Oltre 3 px:

- **Migliorate**: estratti di archivio e ricerca (D70: `/category/news/` e pagina 2
  ora alla stessa altezza a 1440, 768 e 390); 15 articoli Divi da −29 a −25 px;
  testi con estratto o virgolette più corti di una riga.
- **Peggiorate**: 17 articoli Divi lunghi di 4–5 px (interlinea su molte righe);
  `/category/news/page/3/` a 768 e 390 e `/?s=corso` a 768, dove gli estratti più
  corti scoprono la voce mancante di DR-063 (§3.10); 3 coppie dove il testo più
  corto di una riga scopre una causa già presente (`/riparte-il-corso-riparare-le-relazioni/`
  e `-2/` a 390: §3.2; `/registrazione-seminario-lequilibrio-che-regge-la-coppia/`
  a 390: §3.8).

## 2. Famiglie di pagine e scarto residuo

Mediana della differenza d'altezza sito − sorgente, in px.

| Famiglia | URL | Coppie | Fallite | Stessa altezza | Mediana \|d\| | 1440 | 1024 | 768 | 390 | 360 |
|---|---|---|---|---|---|---|---|---|---|---|
| Archivi e ricerca | 5 | 18 | 18 | 6 | 14,5 | 0 | +10 | 0 | 0 | +18 |
| Form di iscrizione | 23 | 138 | 138 | 10 | 2 | −1 | −1 | −2 | −4 | −1 |
| Pagine Divi a sezioni | 47 | 231 | 229 | 25 | 27 | 0 | +19 | +23,5 | +23 | +47 |
| Colonne Gutenberg con titolo | 16 | 96 | 96 | 0 | 28 | +28 | +23 | +28 | +31,5 | +33,5 |
| Testo con titolo | 19 | 87 | 75 | 40 | 7 | 0 | 0 | 0 | −7 | +66 |
| 404 e download | 5 | 18 | 14 | 13 | 0 | 0 | 0 | 0 | −318 | 0 |

Delle 77 coppie fallite **alla stessa altezza**, 7 sono i download (41–43 %), 16
articoli con barra laterale (12–15 %, la barra copre lo scarto del testo: §3.2),
il resto pagine Divi e form tra l'1 e il 7 %.

## 3. Cause, con prova

Ogni causa è provata iniettando la regola nella pagina del sito nuovo e misurando
l'altezza del documento; la tabella del §5 riporta la prova sulle 114 pagine.

### 3.1 Q — padding per dispositivo ereditato (bloccante)

Le spaziature di tablet e telefono arrivano come proprietà personalizzate in linea
(`--blk-pad-top-t: 50px` sulla sezione). Le proprietà personalizzate **si
ereditano**: righe, colonne e moduli di testo senza un valore proprio prendono
quello della sezione. Esempio `/conosco-il-mio-corpo/` a 768: righe con 50 px
invece di 30, colonne e moduli con 50 px sopra e sotto invece di 0, +603 px. Lo
stesso vale per il desktop quando la sezione ha un padding proprio
(`/sostegno-alla-genitorialita/` +293 px a 1440).

Prova: con le 12 proprietà azzerate su ogni blocco, `/conosco-il-mio-corpo/` da
+603 a +23 px (il residuo è il §3.4), `/servizi/` da +500 a +20,
`/corso-per-consulenti-familiari-vecchia-pagina/` da +1.428 a +38 a 390.

| # | Punto | Modifica |
|---|---|---|
| Q1 | `apps/web/src/styles/blocks.css:11-19` | sul selettore `.blk` le 12 proprietà `--blk-pad-*` tornano a `initial`, così ogni blocco usa solo i propri valori in linea (lo stile in linea vince sulla regola) |
| Q2 | `packages/blocks/src/render/spacing.ts:18` (`SPACING_VARIABLES`) | nessuna modifica: l'elenco chiuso resta la fonte dei nomi; una prova verifica che Q1 li copra tutti |
| Q3 | `packages/blocks/tests` o `apps/web/tests` | prova: sezione con padding del tablet, riga e colonna senza → la riga usa il predefinito |

### 3.2 P — spaziature dell'articolo singolo (maggiore)

La sorgente ha `.single .post { padding-bottom: 25px }` su ogni articolo e
`.et_pb_post .entry-content { padding-top: 30px }` sugli articoli non Divi e sui
download (per i Divi `.et_pb_pagebuilder_layout .entry-content` lo azzera). Il
sito non ha né l'una né l'altra: −25 px sugli articoli Divi, −55 px sugli articoli
di testo, a ogni viewport. Sopra i 980 px la barra laterale, più alta, copre lo
scarto d'altezza, ma il testo resta 30 px più in alto: sono le 16 coppie alla
stessa altezza con il 12–15 % di pixel diversi.

Prova: `/riparte-il-corso-relazion-arti/`, `/vuoi-diventare-consulente-familiare/` e
gli altri articoli di testo da −55 a 0; 15 articoli Divi da −25 a 0 a 768 e 390.

| # | Punto | Modifica |
|---|---|---|
| P1 | `apps/web/src/components/Views.tsx:53` e `:78` | segno dell'articolo singolo (classe `single` sul contenitore, come il `body` di WordPress), per distinguerlo dalle voci dell'archivio (`:158`), che hanno le stesse classi |
| P2 | `apps/web/src/styles/layout.css:511` (vicino a `.et_pb_post`) | `.single .post { padding-bottom: 25px }`; `.single .et_pb_post:not([data-builder='divi']) .entry-content { padding-top: 30px }` |
| P3 | `apps/web/src/components/Views.tsx:264` (download) | stesso segno: la sorgente dà `padding-top: 30px` anche al download |

### 3.3 N — colonne Gutenberg (maggiore)

Due differenze, provate su `/io-e-laltro-imparare-a-stare-insieme/` e
`/convegno-diventare-anziani-in-famiglia/`:

1. **Margine sotto le colonne.** Nella sorgente `:where(.wp-block-columns) { margin-bottom: 1.75em }`
   ha specificità zero e il reset di Divi `div { margin: 0 }` lo annulla: margine 0.
   Il sito lo applica (28 px): +28 px su 16 pagine, a ogni viewport.
2. **Ultimo paragrafo di un blocco di testo.** Nella sorgente i paragrafi sono
   fratelli diretti della colonna e `p:last-of-type` toglie lo spazio solo
   all'ultimo paragrafo della colonna. Nel sito i paragrafi consecutivi stanno in
   un blocco di testo, e l'ultimo di ogni blocco perde i 16 px anche quando dopo
   ci sono altri paragrafi (per esempio dopo un separatore): −16 px per blocco.
   Le due cause insieme danno il +12 px di sei pagine.

Prova: le 16 pagine della famiglia vanno a 0 a tutte le viewport (§5), tranne
quelle con la causa §3.5.

| # | Punto | Modifica |
|---|---|---|
| N1 | `apps/web/src/styles/blocks.css:123-135` (`.blk-row[data-layout='flex']`) | `margin: 0` invece di `0 0 1.75em`, con il commento sul reset di Divi |
| N2 | `apps/web/src/styles/base.css:48-50` o `blocks.css` | per il contenuto Gutenberg (testo in `.entry-content` e nelle colonne `flex`), un blocco di testo seguito da un altro blocco di testo con paragrafi conserva lo spazio del suo ultimo paragrafo; nei moduli Divi resta la regola attuale |
| N3 | prove in `apps/web/tests` | margine delle colonne e paragrafi fra blocchi |

### 3.4 R — margini e CSS personalizzati dei moduli Divi (minore)

L'importer non porta `custom_margin` né `custom_css_main_element`. Nei contenuti
pubblicati: margini su 3 contenuti (`-23px` in alto su una riga di
`/conosco-il-mio-corpo/`, `-27px` in basso, `10px` e `30px` in basso), CSS
`padding: 0` su 5 elementi (righe degli articoli Divi, per esempio
`/i-prossimi-corsi-del-centro/`: 60 px in più a 768 e 390). È il residuo di
+20…+60 px dopo Q e P su queste pagine.

| # | Punto | Modifica |
|---|---|---|
| R1 | `apps/importer/src/convert/divi/convert.ts` (lettura degli attributi di riga, colonna e modulo) | leggere `custom_margin` con le varianti `_tablet`/`_phone` come oggi il padding |
| R2 | `packages/blocks` (schema e `spacing.ts`) | margini per dispositivo come proprietà in linea, elenco chiuso come per il padding (ADR-005 §3.3) |
| R3 | `custom_css_main_element` | solo il caso misurato, `padding` (0 o `padding-bottom: 0`), tradotto nel padding del blocco; altro CSS libero non si importa (riserva come oggi) |
| R4 | prove dell'importer e nuovo import su conferma | — |

### 3.5 S — liste senza lo stile di Divi (maggiore)

Il sito non ha regole per le liste del contenuto: valgono i margini del browser
(16 px sopra e sotto) e l'interlinea del testo (27,2 px). Divi
(`style-cpt.css` del tema): `#left-area ul, .entry-content ul { padding: 0 0 23px 1em; line-height: 26px; list-style-type: disc }`,
`ol` con `list-style-position: inside`, liste annidate con 2 px e rientro di 20 o
35 px, e nei moduli di testo `.et_pb_text ul, .et_pb_text ol { padding-bottom: 1em }`.
Esempio `/spazio-alle-paure/`: +21 px a ogni viewport.

Le liste dei form restano fuori (WPForms le azzera): la prima prova senza
esclusione portava i form da −2 a +19 px.

| # | Punto | Modifica |
|---|---|---|
| S1 | `apps/web/src/styles/base.css` | regole di Divi per `ul` e `ol` del contenuto, escluse quelle dei form |
| S2 | `apps/web/src/styles/blocks.css` | `padding-bottom: 1em` per le liste dentro i moduli di testo Divi |

### 3.6 T — modulo di contatto Divi senza stile (maggiore, una pagina)

`/contatti/`: il modulo di Divi è reso con la struttura di WPForms senza lo stile
del modulo di contatto: campi alti 21 px invece di 51, messaggio su una riga
invece di un'area di 150 px, nome ed email non affiancati, pulsante senza stile.
−215 px a 768, −252 a 390, pochi pixel sopra i 980 px ma con molti pixel diversi.

| # | Punto | Modifica |
|---|---|---|
| T1 | `packages/blocks/src/render/Form.tsx`, `FormField.tsx` e `apps/web/src/styles/blocks.css` | resa dell'origine `divi-contact` con le classi e le misure di `et_pb_contact_form` (campi metà, area di testo, pulsante), da misurare sulla sorgente prima di scrivere |

### 3.7 U — scelte dei form (minore)

1. **Scelte in linea.** I campi con `wpforms-list-inline` (`Sì/No`, consensi di
   `/diventa-socio/`) nella sorgente stanno su una riga (76 px il campo); nel sito
   sono impilati (104 px): +27/28 px per campo. Colpisce `/diventa-socio/` (3 campi)
   e i seminari con il pranzo (`/registrazione-seminario-invidia-…`,
   `-io-e-laltro-…`, `-la-rabbia-…`, `/registrazione-laboratorio-litighiamo-oggi/`).
2. **Gruppo di scelte 2 px più alto** (104 contro 102 px): da misurare sulla voce.
3. **Sottoetichette nascoste dell'indirizzo**: la sorgente legge «Indirizzo (linea 1)»,
   «Località», «Stato / Provincia / Regione», «Codice postale», il sito ripete il
   segnaposto. Non si vedono (solo lettori di schermo).

| # | Punto | Modifica |
|---|---|---|
| U1 | `apps/importer/src/stages/forms/parse.ts:248-252` (`FIELD_OPTION_KEYS_BY_TYPE`) | l'opzione `input_columns` oggi non arriva (vuota in tutti i 35 campi a scelta del database): aggiungerla per `radio` e `checkbox`; serve un import su conferma |
| U2 | `packages/blocks/src/render/FormField.tsx:106` (`ChoicesField`) e `blocks.css` | classe `wpforms-list-inline` e voci affiancate come WPForms |
| U3 | `ChoicesField`, `CompositeField` | altezza delle voci e testi delle sottoetichette come WPForms |

### 3.8 W — grassetto non chiuso nel testo del bonifico (decisione D73)

Nel campo «Istruzioni per bonifico bancario» di molti form la sorgente ha
`<b>IBAN<b>` invece di `<b>IBAN</b>`. Il browser della sorgente estende il
grassetto a **tutto il resto della pagina**, piè di pagina compreso: il testo del
piè, più largo, va a capo una riga in più a 768 e 390 (−27/−29 px nel sito, che
chiude il tag). Pagine: le 10 iscrizioni con −27…−29 px a 768 e 390 (§2).

### 3.9 V — blocco «media e testo» senza stile (maggiore, una pagina)

`/10-anni-di-vita-del-centro-per-la-famiglia-amoris-laetitia/`: nella sorgente
immagine e testo affiancati (`wp-block-media-text`, impilati sotto i 600 px); nel
sito il blocco non ha stile, l'immagine prende tutta la riga (1.080 px di altezza):
+867 px a 1440.

| # | Punto | Modifica |
|---|---|---|
| V1 | `apps/web/src/styles/blocks.css` | griglia del blocco `media_text` come `wp-block-media-text` (colonne 50/50, `is-stacked-on-mobile`, allineamento in alto) |

### 3.10 Differenze già decise o da decidere

| Voce | Coppie | Causa |
|---|---|---|
| Archivio pagina 3 e ricerca | `/category/news/page/3/`, `/?s=corso` | la sorgente elenca l'articolo 332, che condivide l'indirizzo con la pagina 328; DR-063 lo ha importato come bozza, quindi la pagina 3 scorre di una voce. Decisione D74 |
| Download | 4 URL, 41–43 % e −318…−365 px a 390 | la sorgente mostra la scheda del pacchetto WPDM (pulsante, dimensione, numero di file, date, contatore dei download) e la data dell'articolo; il sito solo «Scarica». Decisione D75 |
| Testi legali | `/informativa-privacy/`, `/informazioni-sui-cookie/` | dopo Q e S la privacy scende da +1.507 a +110 px a 390; i cookie restano −303…−1.255 px: tabella e testo da esaminare (resta il residuo di 7 apostrofi del §8 di `ricerca-E3.md`) |
| 404 | 1440, 1280, 1024 | alla stessa altezza, 0,2–7,5 %: menu e testo, da esaminare |

## 4. D71 e D72

### D71 = A (DR-155) — punti da toccare

| # | Punto | Modifica |
|---|---|---|
| D71-1 | `packages/db/src/schema/content.ts:50` e migrazione `0006` | colonna `summary_source text` (nullable): inizio del testo nella forma che Divi conta, con le entità prodotte da `wptexturize` scritte come entità e i caratteri dell'autore come caratteri |
| D71-2 | `apps/importer/src/stages/contents/index.ts:218-276` | calcolo all'import come `truncate_post()` (`epanel/custom_functions.php:316`): rimozione di didascalie, audio, embed e tag, poi `wptexturize`; primi 600 caratteri |
| D71-3 | `apps/api/src/modules/public/routes.ts:200`, `:233`, `search.ts:144`, `:169`, `schemas.ts`, `tests/openapi.snapshot.json` | `textStart` da `summary_source` quando c'è, altrimenti dal testo come oggi |
| D71-4 | `apps/api/src/modules/content/service.ts:127` | un salvataggio dal CMS che cambia il testo azzera `summary_source`: i contenuti del CMS contano i caratteri come sono |
| D71-5 | `apps/web/src/lib/format.ts:5-55` (`archiveSummary`) | conta ogni entità per la sua lunghezza e ogni carattere come 1; decodifica per la pagina. Tolto il peso fisso 7 |
| D71-6 | prove: `apps/web/tests/format.test.ts`, `apps/importer/tests/unit/stages`, `apps/api/tests/publicRead.test.ts`, `publicSearch.test.ts` | — |
| D71-7 | `docs/architecture/schema.sql`, `docs/migration/wp-to-postgres-mapping.md` | colonna e regola |
| D71-8 | handoff per migrazione e import in locale | su conferma |

### D72 = A (DR-156) — già soddisfatta

Il testo del bonifico è un campo HTML condizionale: nella sorgente sta nella
pagina ma è nascosto finché non si sceglie «Bonifico»; nelle catture non si vede.
Nel sito compare alla stessa scelta, con la stessa altezza (102 px, misurato su
`/registrazione-corso-relazion-arti/`). Il residuo di `tipografia.py` veniva dal
testo nascosto, che lo strumento leggeva. Nessuna modifica al prodotto: lo
strumento conterà solo il testo visibile.

## 5. Prova sulle 114 pagine

Regole Q1, P2, N1, N2, S1, S2 iniettate nella pagina del sito nuovo, altezza del
documento contro il PNG di riferimento (minimo l'altezza della finestra, come la
cattura), 579 coppie (esclusa `/?s=corso`). Le liste di form ed elenco degli
articoli escluse: la prima prova senza esclusione peggiorava i form (+21 px) e la
home. È una stima d'altezza, non un confronto di pixel: quello si rifà con la
ricattura dopo l'attuazione.

| Misura | Oggi | Con le regole |
|---|---|---|
| Coppie alla stessa altezza | 90 | **279** |
| Coppie entro 2 px | 161 | 352 |
| Differenza d'altezza mediana | 25 px | **1 px** |
| Coppie oltre 500 px | 34 | 12 |
| Migliorate / peggiorate | — | 270 / 30 |

| Famiglia | Coppie | Stessa altezza | Mediana \|d\| |
|---|---|---|---|
| Colonne Gutenberg con titolo | 96 | 0 → 94 | 28 → 0 |
| Testo con titolo | 84 | 37 → 60 | 15 → 0 |
| Pagine Divi a sezioni | 228 | 25 → 97 | 27 → 8 |
| Form di iscrizione | 138 | invariate (cause U, W) | 2 → 2 |
| Archivi | 15 | invariate (DR-063, D71) | 14 → 14 |
| 404 e download | 18 | invariate (D75) | 0 → 0 |

**Le 30 peggiorate** sono quasi tutte articoli Divi (`/i-prossimi-corsi-del-centro/`,
`/le-date-dei-prossimi-corsi-del-centro/`, `/offerta-formativa-2019-2020/`,
`/riparte-il-circolo-della-sicurezza/`, `/riparte-il-corso-per-consulenti-familiari/`,
`/convegno-26-novembre/`, …): i 25 px di P sono quelli della sorgente, e scoprono
il `padding: 0` di riga non importato (R, +60 px a 768 e 390). Tre articoli Divi a
1440 passano da −11 a +14 px: residuo sopra i 980 px da esaminare. Restano poi
`/10-anni-…` a 390 e 360 (V), `/servizi/` a 1280 (+43) e `/il-litigio-di-coppia/`,
`/dal-vizioso-al-virtuoso/` sopra i 980 px (−4…−39 px), da rimisurare dopo Q.

## 6. Ordine proposto

1. **Stili, senza import**: Q, N, P, S, V; ricattura e confronto.
2. **Importer, un solo import su conferma**: D71, R, U1; migrazione `0006`.
3. **Resa**: T, U2–U3; poi i residui del §5 e del §3.10.

## Decisioni nuove

### D73 — Grassetto non chiuso nel testo del bonifico
- **A (consigliata):** correggere: il sito chiude il tag e il piè di pagina resta
  normale; si registra come difformità approvata (refuso dell'autore, effetto solo
  su 10 form a 768 e 390).
- B: riprodurre l'effetto della sorgente (grassetto esteso al resto della pagina).
- Impatto: 10 pagine di iscrizione, piè di pagina.
- Default vietato: riprodurre o correggere senza la tua risposta.

### D74 — Articolo 332 nell'archivio delle notizie
- **A (consigliata):** lasciare DR-063 com'è e registrare come difformità la voce in
  meno nell'archivio (pagina 3 e ricerca con una voce di differenza).
- B: elencare l'articolo nell'archivio con il collegamento alla pagina 328, come la
  sorgente, restando bozza come contenuto.
- Impatto: `/category/news/page/3/`, ricerca.
- Default vietato: cambiare DR-063 senza la tua risposta.

### D75 — Scheda del pacchetto nelle pagine di download
- **A (consigliata):** resa della scheda come la sorgente (pulsante, dimensione,
  numero di file, date, data dell'articolo), **senza contatore dei download**, da
  registrare come difformità: è un dato che cambia e richiederebbe di contare gli
  scaricamenti.
- B: scheda completa con contatore (nuovo dato da conservare).
- C: lasciare il collegamento «Scarica» e registrare la difformità.
- Impatto: 4 pagine di download, 7 coppie al 41–43 %.
- Default vietato: aggiungere un contatore di download senza la tua risposta.

### Approvazione
- elenco dei punti Q, P, N, S, V (stili) e dell'ordine del §6;
- elenco D71-1…D71-8;
- R, T, U come da tabelle, da attuare dopo le misure indicate.

## 7. Dopo DR-157…161 e HO-023 (2026-10-16)

Attuati Q, P, N, S, V (stili), D71, R, U1 (importer), T, U2–U3 e D75 (resa). HO-023:
copia di salvataggio (34 tabelle), migrazione `0006`, import `success` 57/47/4,
`summary_source` in 108 contenuti su 108. Estratti contro la sorgente sul dump: 67 su 68
identici. 292/292 stati conformi; un solo `h1` per pagina; scorrimento orizzontale solo su
3 pagine Gutenberg, come la sorgente. Correzioni nate dalla revisione del codice: entità
fuori da Unicode, tipi di campo non previsti nel modulo Divi, nome accessibile dei campi,
confronto del testo senza spazi, `overflow-wrap` nei moduli di testo Divi, titolo della
scheda dei download in `h2`.

| Misura | Prima di DR-157 | Dopo |
|---|---|---|
| Superate | 17 | **38** |
| Da esaminare | 1 | 3 |
| Coppie alla stessa altezza | 94 | **303** |
| Coppie entro 2 px | 165 | 318 |
| Differenza d'altezza mediana | 25 px | **0 px** |
| Coppie oltre 500 px | 34 | 9 |

Peggiorate oltre 10 px: articoli Divi (+25 px di P, sopra il `padding` di riga ancora
diverso a 1440), i form dei seminari con il pranzo (scelte ora in linea, si vede il
grassetto del refuso di DR-159), `/servizi/` a 1280 e `/dal-vizioso-al-virtuoso/` a 1024.

Report visivo per la decisione delle difformità: artifact «Bozze di parità visiva», una
scheda per indirizzo con sorgente e sito affiancati a 1440, 768 e 390 px; le scelte
dell'utente si salvano nell'artifact (raccolta `decisioni`) e si registrano poi nel
registro delle decisioni. Da decidere lì anche il captcha aritmetico di `/contatti/`.
