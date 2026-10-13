# Strategia di conversione dei contenuti — Fase 1B, wave `1B-W5`

Come si passa da Divi, da Gutenberg e dall'HTML nudo al modello a blocchi di
ADR-005, senza perdere fedeltà e senza rendere il contenuto immodificabile.

Affronta il rischio **R-06**, il principale della Fase 1.

| | |
|---|---|
| **Stato** | **proposta** |
| **Vincolo** | ogni shortcode Divi rilevato in Fase 1A ha una destinazione dichiarata |
| **Attuazione** | Fase 1D, con l'importer (`importer-spec.md` fase 5) |

---

## 1. Che cosa c'è davvero da convertire

Misurato su tutti i 108 contenuti pubblicati e in bozza.

| Famiglia | Pagine | Articoli | Totale |
|---|---|---|---|
| **Gutenberg** | 47 | 10 | **57** |
| **Divi** | 29 | 18 | **47** |
| **HTML nudo** | 2 | 2 | **4** |
| Misti | 0 | 0 | **0** |

**Nessun contenuto è misto.** Questo semplifica molto: la conversione si sceglie per
contenuto, senza dover riconoscere confini interni fra due sintassi.

Il quadro di Fase 1A parlava di «60 contenuti su 107 senza page builder». Era esatto
nella sostanza, ma quei 60 non sono HTML semplice: **57 sono già a blocchi**, in
formato Gutenberg. È una buona notizia: più della metà del sito ha già una
struttura, e va tradotta, non dedotta.

## 2. Divi: destinazione dichiarata di ogni shortcode

Dieci shortcode distinti, conteggiati sui tag di apertura.

| Shortcode | Aperture | Destinazione | Trattamento |
|---|---|---|---|
| `et_pb_section` | 48 | blocco **`section`** | contenitore. Si conservano larghezza piena, sfondo, spaziatura |
| `et_pb_row` | 88 | blocco **`row`** | contenitore. `column_structure` diventa la ripartizione delle colonne |
| `et_pb_column` | 137 | blocco **`column`** | contenitore. `type` (`4_4`, `1_2`, `1_3`…) diventa la larghezza relativa |
| `et_pb_text` | 89 | blocco **`rich_text`** | il contenuto interno passa dal filtro dell'elenco chiuso di ADR-005 §3.5 |
| `et_pb_image` | 59 | blocco **`image`** | `src` risolto in un riferimento al media; allineamento, collegamento, larghezza piena conservati |
| `et_pb_video` | 7 | blocco **`video`** | `src` e immagine di anteprima |
| `et_pb_map` | 2 | blocco **`map`** | indirizzo, coordinate, opzioni di interazione |
| `et_pb_map_pin` | 2 | dentro **`map`** | i segnaposto sono proprietà della mappa, non blocchi |
| `et_pb_contact_form` | 1 | blocco **`form`** | ADR-010. È un form di Divi, distinto dai 23 WPForms |
| `et_pb_contact_field` | 4 | dentro **`form`** | i campi diventano la definizione del form |

Nessuno shortcode Divi resta senza destinazione.

### 2.1 Shortcode non-Divi

| Shortcode | Occorrenze | Destinazione |
|---|---|---|
| `[catposts]` | 1 | blocco **`post_list`** |
| `[doc]` | 1 | blocco **`document`** |
| `[hash]` | 2 | **da esaminare in Fase 1D.** Non appartiene ad alcun plugin attivo: se non produce nulla nel reso, si elimina; se produce testo, diventa `rich_text` |
| `[UID]` | 4 | idem |
| `[wpdm_user_dashboard]` | 1 | **si elimina**; la pagina che lo contiene è riservata con Members e mostra il messaggio della sorgente (DR-131) |
| `[event_dashboard]` | 1 | **si elimina**: idem |

I due casi da esaminare producono, al più, un frammento di testo. Non si eliminano
alla cieca: si guarda l'HTML reso della pagina che li contiene e si decide con quel
dato.

## 3. Attributi di Divi: cosa si tiene e cosa si butta

Rilevati tutti gli attributi presenti. Il numero è alto, l'utile è poco: la maggior
parte descrive lo stato dell'editor, non la resa.

### 3.1 Attributi **conservati**, per blocco

| Blocco | Attributi che diventano proprietà |
|---|---|
| `section` | `transparent_background`, `background_color`, `make_fullwidth`, `use_custom_width`, `custom_width_px`, `custom_width_percent`, `custom_padding` e le varianti per tablet e telefono, `inner_shadow`, `parallax` |
| `row` | `column_structure`, `make_fullwidth`, `use_custom_width`, `custom_width_*`, `use_custom_gutter`, `gutter_width`, `background_*`, `custom_padding*` |
| `column` | **`type`** — è la larghezza relativa e non è negoziabile — più `custom_padding` |
| `rich_text` | `text_orientation`, `background_layout`, `custom_padding`, e il bordo **solo se** `use_border_color` è attivo con un colore diverso dal predefinito |
| `image` | `src`, `alt`, `title_text`, `align` e la variante per tablet, `force_fullwidth`, `url`, `url_new_window`, `show_in_lightbox`, `always_center_on_mobile` |
| `video` | `src`, `image_src` |
| `map` | `address`, `address_lat`, `address_lng`, `mouse_wheel`, `mobile_dragging`, `use_grayscale_filter`, `grayscale_filter_amount` |
| `form` | `email`, `title`, `success_message`, `custom_message`, e i campi da `et_pb_contact_field` |

### 3.2 Attributi **scartati**, con motivo

| Attributo | Presenze | Motivo |
|---|---|---|
| `admin_label` | 250 e oltre | etichetta visibile solo dentro l'editor di Divi |
| `_builder_version` | 240 e oltre | versione del page builder |
| `global_colors_info` | 110 e oltre | riferimento alla tavolozza globale di Divi, che non si porta |
| `_module_preset`, `theme_builder_area`, `_unique_id` | poche | stato interno del tema |
| `hover_enabled`, `sticky_enabled`, `*__hover_enabled`, `*__hover` | molte | stati di interazione dell'editor, non resa |
| `use_border_color` a `off`, `border_style` a `solid`, `border_color` predefinito | 76, 76, 61 | valori predefiniti che non producono alcun bordo visibile |
| `animation`, `animation_style`, `animation_direction` | 38, 18, 17 | **trattamento speciale**, §3.3 |
| `allow_player_pause`, `parallax_method` | poche | opzioni di moduli non usati nei contenuti misurati |
| `disabled` | 18 | il modulo è disattivato: **non si converte affatto**, si salta |

### 3.3 Le animazioni

Trentotto immagini hanno un'animazione in ingresso. Sono elementi **visibili**, ma
dipendono dal momento in cui si scatta lo screenshot: un confronto al pixel eseguito
durante l'animazione fallisce anche quando il risultato è identico.

Regola adottata:

1. Le animazioni si conservano come proprietà del blocco `image`.
2. In Fase 1E gli screenshot si scattano **ad animazioni concluse**, con attesa
   esplicita, e il piano di visual regression (`1B-W6`) lo impone.
3. Il rispetto della preferenza di sistema per la riduzione del movimento è una
   **miglioria dichiarata**, non parità: va approvata, non introdotta di nascosto.

## 4. Gutenberg: destinazione dichiarata di ogni blocco

Dodici tipi reali, più un marcatore.

| Blocco | Occorrenze | Contenuti | Destinazione |
|---|---|---|---|
| `wp:paragraph` | 274 | 40 | **`rich_text`** — paragrafi consecutivi si fondono in un solo blocco |
| `wp:list` e `wp:list-item` | 29 e 117 | 15 | **`rich_text`** con `ul` o `ol` |
| `wp:heading` | 5 | 4 | **`rich_text`** con `h2`…`h5` |
| `wp:image` | 19 | 18 | **`image`** |
| `wp:columns` | 16 | 16 | **`row`** |
| `wp:column` | 32 | 16 | **`column`** |
| `wp:media-text` | 1 | 1 | **`media_text`** |
| `wp:separator` | 5 | 5 | **`separator`** |
| `wp:wpforms/form-selector` | **23** | **23** | **`form`** — ADR-010 |
| `wp:html` | 6 | 3 | **`html`**, il blocco di riserva. Nasce già come tale |
| `wp:shortcode` | 1 | 1 | si risolve lo shortcode contenuto e si applica la §2.1 |
| `wp:divi/placeholder` | 8 | 8 | **marcatore**, non contenuto: si scarta; lo shortcode Divi che racchiude fa del contenuto un contenuto Divi (ADR-005 §1, corretto nella `1E-W6`) |

### 4.1 Fusione dei paragrafi

Duecentosettantaquattro `wp:paragraph` su 40 contenuti significa una media di sette
paragrafi consecutivi. Tradurli in 274 blocchi separati produrrebbe un editor con
un elenco lunghissimo di blocchi da una riga, scomodo da usare quanto l'HTML nudo.

Si fondono in un unico blocco `rich_text` per sequenza contigua. Il risultato reso è
identico; l'editor diventa un campo di testo con dentro i paragrafi, che è ciò con
cui un redattore sa lavorare.

## 5. Conversione progressiva: chi diventa cosa, e quando

R-06 chiede una scelta dichiarata **per tipo di contenuto**, non improvvisata per
pagina. Eccola.

| Famiglia | Quantità | Strategia | Editabilità attesa |
|---|---|---|---|
| **Gutenberg** | 57 | conversione completa in blocchi tipizzati. Nessun blocco di riserva, se non per `wp:html` | **piena** |
| **Divi** | 47 | conversione completa in blocchi tipizzati. Blocco di riserva solo dove la resa lo richiede | **piena**, con eccezioni contate |
| **HTML nudo** | 4 | un solo blocco `rich_text` | **piena**, ma senza struttura |

### 5.1 Ordine di lavorazione

1. **Gutenberg** per primi: sono più della metà, la traduzione è quasi meccanica, e
   producono subito un insieme di contenuti su cui provare l'editor.
2. **Divi strutturali** — sezione, riga, colonna, testo, immagine — che coprono il
   97% delle occorrenze.
3. **Coda di Divi** — video, mappa, form — dodici occorrenze in tutto.
4. **HTML nudo**, quattro contenuti.

### 5.2 Soglie, ereditate da ADR-005 §3.4

> I blocchi `html` non superano il **10% dei blocchi non contenitori** e non
> compaiono su più di **15 contenuti su 108**.

Il rapporto di import le misura e le stampa. Se vengono superate, la conversione non
ha funzionato e va rivista **prima** della Fase 1E.

## 6. Il problema del CSS, che è più grosso della conversione

Divi non genera solo HTML: genera **CSS per pagina**, in `wp-content/et-cache/`. Nel
backup ci sono 667 file CSS, e lo stesso contenuto su due installazioni può produrre
CSS diverso (R-01).

Ne segue una cosa importante: **convertire correttamente i blocchi non basta a
ottenere la parità.** Serve anche riprodurre lo stile.

Strategia:

1. **I design token si estraggono dal CSS reso**, non dal tema Divi: colori,
   dimensioni dei caratteri, interlinea, spaziature, punti di rottura, larghezze dei
   contenitori. È lavoro della Fase 1E.
2. Le regole comuni a tutte le pagine diventano il foglio di stile di base del sito.
3. Le regole specifiche di una pagina si esaminano una per una: quasi sempre sono
   varianti di spaziatura o colore riconducibili a proprietà dei blocchi del §3.1.
4. **L'istanza di riferimento resta congelata con la sua `et-cache` così com'è**, e
   non si rigenera mai. Rigenerarla cambierebbe il riferimento di confronto durante
   il confronto.

Il tema Divi come tale non si porta: nessuno dei suoi file CSS entra nel sistema
nuovo. Si riproducono i **valori**, non i fogli di stile.

## 7. Come si misura che la conversione ha funzionato

| # | Controllo | Quando | Soglia |
|---|---|---|---|
| 1 | Ogni contenuto produce un documento valido secondo lo schema Zod | 1D | 108 su 108 |
| 2 | Blocchi di riserva entro le soglie | 1D | 10% e 15 contenuti |
| 3 | Nessuno shortcode residuo nel testo convertito | 1D | zero occorrenze di `[et_pb_` e `<!-- wp:` |
| 4 | Nessun riferimento a `wp-content/uploads` | 1D | zero |
| 5 | Andata e ritorno nell'editor senza modifiche | 1D | nessuna differenza |
| 6 | Confronto visivo contro l'istanza di riferimento | 1E | soglie di `1B-W6` |
| 7 | Un redattore modifica testo e immagine su tre contenuti di famiglie diverse | 1G | riesce senza assistenza |

Il controllo 3 merita attenzione: uno shortcode non riconosciuto che sopravvive alla
conversione comparirebbe **come testo letterale** nella pagina pubblica. È un
difetto vistoso e facilissimo da non notare in un confronto automatico, perché
sposta pochi pixel.

## 8. Decisione che questa wave apre

### D13 — Difetti di qualità della sorgente

Misurato in `1B-W0` §1.2: sulle 29 pagine costruite con Divi, **28 non hanno meta
description** e **27 non emettono alcun `<h1>`**. Nessun URL del sito ha `og:image`.
Il suffisso di paginazione è in inglese.

Sono difetti di accessibilità e di SEO **già presenti** nel sito attuale. La
conversione a blocchi permette di correggerli senza toccare la resa visibile — il
`<h1>` verrebbe reso visivamente identico al testo che oggi lo sostituisce — ma è
una scelta dell'utente, non una decisione tecnica.

Tre strade, portate all'utente nel round di decisioni di fine Fase 1B:

| | Strada | Conseguenza |
|---|---|---|
| A | Riprodurre fedelmente, difetti compresi | parità assoluta, si portano avanti i difetti |
| B | Correggere i soli metadati non visibili (description, `og:image`, suffisso di paginazione), lasciando identica la resa | il confronto visivo resta pulito; migliora la SEO |
| C | Correggere anche la struttura dei titoli, restituendo un `<h1>` a ogni pagina, reso visivamente identico | migliora anche l'accessibilità; richiede una verifica visiva in più per pagina |

Fino alla risposta, i criteri di accettazione della Fase 1E trattano i metadati come
**insieme separato** dal confronto visivo, così che la decisione non blocchi la
parità.

## 9. Cosa questa strategia **non** promette

- Non promette che il 100% delle pagine Divi si converta senza blocco di riserva.
  Promette che ogni uso del blocco di riserva sia **contato, motivato e sotto
  soglia**.
- Non promette che la conversione da sola produca parità visiva: senza il lavoro sul
  CSS del §6, non la produce.
- Non promette che un redattore possa ricostruire da zero una pagina Divi complessa.
  Promette che possa **modificare** testo e immagini di tutte, che è ciò che DR-033
  chiede e che la Fase 1G collauderà.
