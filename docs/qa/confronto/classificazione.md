# Classificazione delle differenze — `1E-W6`, confronto finale

Stato al 2026-10-13: **confronto completo, parità non raggiunta.** Sostituisce la
classificazione parziale del 2026-10-12 (475 catture interrotte); la versione
precedente resta nella storia di Git.

## 0. Ambiente e numeri

| Voce | Valore |
|---|---|
| Catture del sito nuovo | 2026-10-13, 12:21–12:36, Chromium 153.0.8010.12, `http://127.0.0.1:3200`, un solo processo (`docs/qa/screenshots/cattura-sito-finale.log`) |
| Catture di riferimento | `1E-W1`, invariate |
| Confronto | `npx tsx tests/visual/confronto-tutto.ts`, soglia 0 % (DR-113), esame fino a 0,5 % |
| Maschere applicate | 29 rettangoli in `maschere.json` (mappa, video, tabella dei cookie) |
| Esito | **585 confronti: 0 superati, 0 da esaminare, 585 falliti**; 539 con altezza di pagina diversa, 46 con altezza uguale ma dall'8,7 al 51,4 % di pixel diversi |
| Dettaglio | `docs/qa/confronto/esiti.csv` (una riga per URL e viewport, con impronte sha256) |

Prima del confronto, su conferma dell'utente: import rieseguito in locale per la
correzione delle classi del menu (copia `amoris-prima-classi-menu-2026-10-13.dump`,
esito `success`, 0 classi serializzate su 64 voci). Le catture sono anteriori
all'import: la correzione riguarda solo l'attributo `class`, senza effetto visivo.

## 1. Difetti da correggere (non da approvare)

Una famiglia per causa. Gravità secondo `visual-regression-plan.md`.

| # | Famiglia | Gravità | Dove | Che cosa si vede | Componente |
|---|---|---|---|---|---|
| A | **9 contenuti vuoti** | bloccante | `/corsi-2022-2023/`, `/offerta-formativa-2019-2020/`, `/corso-per-consulenti-familiari-vecchia-pagina/`, `/dove-hai-la-testa-2/`, `/prossimi-corsi/`, `/riparare-le-relazioni-2018/`, `/fatti-non-parole-2/`, `/bacheca/`, più una bozza | Solo titolo e data; nella sorgente la pagina è lunga fino a 13 150 px | importer: il contenuto Divi racchiuso in `<!-- wp:divi/placeholder -->` è classificato Gutenberg e il blocco sconosciuto viene scartato senza riserva né errore; `/bacheca/` contiene solo lo shortcode `[wpdm_user_dashboard]` |
| B | **Colonne Divi impilate** | bloccante | 40 contenuti Divi, es. `/chi-siamo/` | Testo e immagine affiancati nella sorgente, uno sotto l'altro nel sito: pagine fino a 2 200 px più alte a 1440, quasi uguali a 390 | resa delle righe e colonne Divi in `packages/blocks` |
| C | **Form resi diversi** | bloccante | 24 contenuti con form, es. `/registrazione-sguardi-damore/` | Campi in altro ordine, etichette a lato invece del testo segnaposto, nessuna disposizione a due colonne, markup HTML mostrato come testo (`<b>`, `<a href>`), testo condizionale del bonifico sempre visibile | resa del blocco form in `packages/blocks` |
| D | **Elenco degli articoli** | bloccante | `/` (fino a 7 913 px in più), `/category/news/` e pagine 2–3 | Immagini a piena larghezza invece delle miniature, estratti assenti, data in più | resa di `post_list` e degli archivi |
| E | **Testata** | maggiore | tutte le 585 | Icona della ricerca assente; frecce dei sottomenu staccate dalla voce; spaziatura del menu diversa | `apps/web/src/styles/layout.css` e testata |
| F | **Piè di pagina** | maggiore | tutte le 585 | Testo centrato su tutta la larghezza invece che nella colonna della sorgente; fascia inferiore più alta | piè di pagina in `apps/web` |
| G | **Barra laterale** | maggiore | 404 e articoli | La sorgente ha la colonna laterale con il filetto verticale; la 404 nuova no, e il testo occupa tutta la riga | template di articoli e 404 |
| H | **Dettagli tipografici** | minore | articoli e pagine Divi | Testo giustificato nella sorgente, allineato a sinistra nel sito; data «7 Ott 2022» contro «07 Ott 2022» | stili del testo e formato della data |
| I | **Pagine di download** | da esaminare | 4 URL `/download/…` | 43–51 % di pixel diversi a pari altezza; causa non ancora isolata | template del download |

Le famiglie E, F e G spiegano da sole l'8–12 % di pixel diversi delle pagine con
la stessa altezza (es. `/404-url-inesistente/`, 9,0 %). Le famiglie A–D
spiegano le differenze di altezza.

**Nota di privacy.** Nella resa nuova del form di `/registrazione-sguardi-damore/`
il testo del bonifico, IBAN del Centro compreso, è sempre visibile; nella
sorgente compare solo scegliendo «Bonifico». È un dato pubblico del Centro, non
personale, ma la resa cambia ciò che la pagina mostra: rientra nella famiglia C.
Le catture sono fuori da Git (`.gitignore`, riga 69).

## 2. Maschere e difformità proposte per l'approvazione (HO-015)

| # | Voce | Tipo | Dove | Riferimento |
|---|---|---|---|---|
| 1 | Banner dei cookie della sorgente assente nel sito nuovo | maschera | tutte le pagine; nessun rettangolo in `maschere.json`, il banner non compare nelle catture di riferimento | DR-107, MI-08 |
| 2 | Mappa: copertina al posto di Google Maps, caricamento al clic | maschera `.blk-map` | `/contatti/`, `/dove-siamo/`, 6 viewport ciascuna, 12 rettangoli | DR-107, DR-121 |
| 3 | Video: copertina al posto del riproduttore, caricamento al clic | maschera `.blk-video` | `/riparte-il-corso-per-consulenti-familiari/` (3 per viewport, 9) e `/dal-vizioso-al-virtuoso/` (6), 15 rettangoli | DR-107, DR-122 |
| 4 | Tabella dei cookie che scorre nel proprio riquadro | difformità mascherata | `/informazioni-sui-cookie/` a 390 e 360 px, 2 rettangoli | DR-120 |
| 5 | Suffisso di paginazione «- Pagina N» nel titolo del documento, non visibile nella pagina | difformità | archivi paginati | DR-040 |

Limiti dichiarati: le maschere 2 e 3 sono misurate sul sito nuovo; dove le
altezze di pagina differiscono, le coordinate non coincidono con la sorgente e
il confronto fallisce comunque. Vanno rimisurate dopo le correzioni A–D.

## 3. Che cosa resta per chiudere la wave

1. Correggere le famiglie A–H ed esaminare la I, a cicli, con 1E-19 dopo ogni giro.
2. La famiglia A tocca `apps/importer`, fuori dai file della `1E-W6` nel PLAN §2,
   e richiede una nuova riesecuzione dell'import: entrambe da confermare.
3. Ricatturare e riconfrontare, poi rimisurare le maschere.
4. Approvazione delle voci del §2 (HO-015).

## 4. Confronto dopo HO-018 (2026-10-13)

Import con le famiglie A–D e J (`success`), ricattura integrale 585/585, maschere
rimisurate, confronto: **0 superati, 585 falliti**, 46 coppie con la stessa altezza.

| Misura | Prima | Dopo |
|---|---|---|
| Differenza d'altezza mediana | 227 px | 110 px |
| Coppie con più di 500 px di differenza | 197 | 45 |
| Differenza mediana a pari altezza | 13,19 % | 11,76 % |
| Coppie migliorate / peggiorate di oltre 100 px | — | 260 / 40 |

Difetti nuovi o riletti, da approvare prima di correggere:

| # | Famiglia | Gravità | Dove | Causa |
|---|---|---|---|---|
| K | **Immagini ritagliate** | bloccante | pagine Divi a 390 e 768, es. `/i-prossimi-corsi-del-centro/` | `imageAttributes` (`packages/blocks/src/render/media.ts:30-42`) mette nel `srcset` anche i ritagli a proporzione diversa (150×150, 400×250, 1080×675); WordPress li esclude. Chiamanti: `Image.tsx:14`, `MediaText.tsx:22`, `PostList.tsx:38`, `Slider.tsx:58`, `Video.tsx:58` |
| L | **Colonne Gutenberg dentro il testo Divi** | maggiore | solo `/corsi-2022-2023/` | La sorgente non carica lo stile delle colonne (commenti `divi:columns`, non `wp:columns`) e le impila; `blocks.css:125-200` le affianca |
| G | **Barra laterale per articolo** (rilettura) | maggiore | 28 articoli | Nella sorgente dipende da `_et_pb_page_layout`: 12 a destra, 14 a tutta larghezza, 2 senza; il sito la mette sempre |
| C+ | **Residui del form** | maggiore | 24 form | Telefono senza stile di intl-tel-input (si vede «+39») e a tutta riga invece che medio; sotto-campi dell'indirizzo senza spaziatura |
| M | **Mappa schiacciata** | maggiore | `/contatti/`, `/dove-siamo/` | La copertina della mappa è alta pochi pixel invece di ~230 |

`/bacheca/`: nella ripartizione risulta HTML (56/47/5 invece di 57/47/4) perché il
messaggio di Members sostituisce il contenuto prima del riconoscimento; decisione D58.

## 5. Confronto dopo HO-019 (2026-10-14)

Migrazione 0003 e import (`success`, 57/47/4, `page_layout` come atteso), D62
attuata, ricattura integrale 585/585, confronto: **0 superati, 585 falliti**, 47
coppie con la stessa altezza.

Misure prese con lo stesso metodo sulle due catture (altezza dei PNG contro il
riferimento); il metodo del §4 dava 110 px sulla cattura «prima», questo 92 px.

| Misura | Prima di HO-019 | Dopo |
|---|---|---|
| Differenza d'altezza mediana | 92 px | 72 px |
| Coppie con altezza entro 20 px | 83 | 138 |
| Coppie con più di 500 px di differenza | 45 | 36 |
| Coppie con la stessa altezza | 46 | 47 |
| Differenza mediana a pari altezza | 11,76 % | 11,81 % |

Verifica a vista a 1440: filetto a 245,7 px dal bordo destro del contenitore su
`/bacheca-degli-eventi/` e su un articolo con barra; `/corsi-2022-2023/` senza
barra; `/convegno-17-febbraio-2018/` con le sezioni da bordo a bordo.

Regressione trovata e corretta nello stesso giro: negli articoli Divi a tutta
larghezza il titolo era a ridosso della testata; ora ha il `padding-top: 6%` di
`.et_post_meta_wrapper` della sorgente (titolo a 238 px contro 237). I 15
articoli sono stati ricatturati dopo la correzione.

Restano, già classificate: E (testata, su tutte le 585), F (piè di pagina), H, I.
Le 36 coppie oltre 500 px si concentrano su form (C+), pagine Divi lunghe e testi
legali (`/informazioni-sui-cookie/`, `/informativa-privacy/`).
