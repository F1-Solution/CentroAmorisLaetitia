# Contenuto scritto nel codice del sito pubblico (1G-26)

Caccia del 2026-10-26 su `apps/web/src/**` e sui componenti di `packages/blocks` resi sul sito. Ogni testo visibile o letto da un lettore di schermo che non viene dal contenuto è elencato con file e riga.

Aggiornato il 2026-10-27 con l'esito delle decisioni DR-269…DR-277 e DR-284, attuate nelle attività T2b e T2c della `1G-W7`: righe ricontrollate sul codice, colonna «Modificabile» e motivi riscritti, «Da decidere» sostituito da «Decisioni». Non è una nuova caccia: i testi aggiunti dopo il 2026-10-26 non sono elencati (vedi «Fuori elenco»).

## Riepilogo

Voci elencate: **78** in **16** file (mesi, lingua e fuso sono passati da `lib/format.ts` a `lib/wpDate.ts`).

| Origine | Voci |
|---|---|
| tema della sorgente (WordPress, Divi, plugin) | 33 |
| formattazione | 10 |
| accessibilità | 20 |
| dato dalle impostazioni o dai contenuti | 5 |
| scelta del progetto (testo nuovo, non della sorgente) | 10 |
| **Totale** | **78** |

Modificabili dalla redazione: **11** (erano 3): il testo viene da un dato o da un'impostazione. Non modificabili: **67** (erano 75), tutti con il motivo dichiarato; quelli che la sorgente lasciava cambiare sono decisi in DR-274…DR-277.

Fuori elenco, perché non sono testo di pagina: nomi di classi e identificativi, intestazioni HTTP, direttive di `robots`, regole di `proxy.ts`, struttura XML del feed RSS e messaggi di errore di configurazione di `lib/site.ts`, letti da chi avvia il sito. Il piè di pagina, i recapiti e il logo non sono scritti nel codice: vengono dalle impostazioni («Testo del piè di pagina», «Indirizzo del Centro», «Telefono del Centro», «Logo del sito»). Le etichette, i segnaposto e i testi dei moduli e delle slide sono dati, non codice. Fuori elenco anche il blocco «Documento» (DR-287, T2k): sul sito è un collegamento a `/download/<slug>/` il cui testo è l'etichetta del blocco o il titolo del documento, cioè un dato, e un documento non pubblico non rende nulla.

Legenda: «sì» = la redazione lo cambia dall'area; «no» = per cambiarlo serve il codice.

## Elenco per file

### `apps/web/src/app/layout.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 23 | `Centro Amoris Laetitia` | impostazioni | sì | Titolo di riserva della scheda: è «Titolo del sito»; il valore scritto in `lib/settingsOnce.ts:7` resta solo se l'impostazione manca o l'API non risponde (DR-273, DR-284). |
| 34 | `lang={lang}` | accessibilità | sì | Lingua dichiarata alle tecnologie assistive: la sola lingua di «Lingua del sito», per esempio `it` (DR-270). |

### `apps/web/src/app/not-found.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 14 | `404 Non trovato \| ${siteTitle}` | tema | no | Titolo della 404 del tema, fisso (DR-274); il nome del sito ora è l'impostazione, come in `page.tsx` (DR-273, DR-284). |

### `apps/web/src/app/[[...percorso]]/page.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 57 | `6 articoli per pagina` | formattazione | no | Articoli per pagina degli archivi di categoria: opzione del tema Divi (`divi_catnum_posts`), che l'area non espone; «Articoli per pagina» non la governa, come nella sorgente (DR-270). |
| 190 | `${title} - ${siteTitle}` | formattazione | no | Forma del titolo delle pagine senza SEO propria, come All in One SEO; il nome del sito è l'impostazione. |
| 200 | `404 Non trovato \| ${siteTitle}` | tema | no | Titolo della 404 del tema, fisso (DR-274); il nome del sito è l'impostazione. |
| 205 | ` - Pagina ${n}` | tema | no | Suffisso di paginazione del titolo della ricerca, in italiano (DR-040). |
| 214 | ` - Pagina ${n}` | tema | no | Suffisso di paginazione del titolo degli archivi (DR-040). |
| 250 | `og:locale` (`it_IT`) | accessibilità | sì | Lingua dei metadati di condivisione: «Lingua del sito» nella forma di WordPress (DR-270). |
| 267, 271 | ` - Pagina ${n}` | tema | no | Stesso suffisso nel nome della pagina nei dati strutturati. |

### `apps/web/src/components/HeaderSearch.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 48 | `Cerca` | accessibilità | no | Nome accessibile dell'icona di ricerca. |
| 90 | `Cerca …` | tema | no | Segnaposto del campo di ricerca del tema (DR-144), fisso come nella sorgente (DR-274). |
| 93 | `Cerca:` | tema | no | Attributo title del campo, come il tema; fisso (DR-274). |
| 95 | `Cerca` | accessibilità | no | Nome accessibile del campo (A5-1, DR-205). |
| 102 | `Chiudi la ricerca` | accessibilità | no | Nome accessibile della croce che chiude il campo. |

### `apps/web/src/components/SiteHeader.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 84 | `alt={siteTitle}` | impostazioni | sì | Testo alternativo del logo: «Titolo del sito». |
| 93 | `Menu principale` | accessibilità | no | Nome della regione di navigazione per i lettori di schermo. |
| 99 | `Seleziona una pagina` | tema | no | Etichetta della barra del menu per telefono, stringa del tema Divi; fissa (DR-274). |
| 102 | `Menu principale per telefono` | accessibilità | no | Nome della regione di navigazione del menu per telefono. |

### `apps/web/src/components/Views.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 182 | `alt=""` | accessibilità | no | Miniatura decorativa nell'elenco: il titolo che la accompagna basta. |
| 229 | `h1 nascosto con il nome della categoria` | impostazioni | sì | Titolo dell'archivio presente ma nascosto (A-7): il nome della categoria. |
| 250 | `« Post precedenti` | tema | no | Collegamento di paginazione del tema verso le pagine più vecchie; fisso (DR-274). |
| 255 | `Post successivi »` | tema | no | Collegamento di paginazione del tema verso le pagine più recenti; fisso (DR-274). |
| 312 | `Nessun risultato` | tema | no | Titolo del testo `no-results.php` del tema nella ricerca senza risultati; fisso (DR-274). |
| 314 | `La pagina richiesta non è stata trovata. Affina la tua ricerca, o utilizza la barra di navigazione qui sopra per trovare il post.` | tema | no | Corpo del testo `no-results.php` del tema nella ricerca senza risultati; fisso (DR-274). |
| 327 | `Risultati della ricerca per: ${query}` | accessibilità | no | Titolo `h1` presente ma nascosto nei risultati (A-7). |
| 359 | `Download` | tema | no | Etichetta del pulsante della scheda di un documento, come Download Manager (DR-161); fissa (DR-275). |
| 365 | `Dimensioni file` | tema | no | Etichetta della scheda del documento, modello di Download Manager; fissa (DR-275). |
| 368 | `Conteggio file / 1` | tema | no | Etichetta della scheda e valore fisso 1: ogni documento ha un solo file; fissa (DR-275). |
| 371 | `Data di creazione` | tema | no | Etichetta della scheda del documento; fissa (DR-275); la data segue «Formato data». |
| 375 | `Ultimo aggiornamento` | tema | no | Etichetta della scheda del documento; fissa (DR-275); la data è calcolata (DR-260) e segue «Formato data». |
| 453 | `Nessun risultato` | tema | no | Titolo del testo della 404, come il tema; fisso (DR-274). |
| 455 | `La pagina richiesta non è stata trovata. Affina la tua ricerca, o utilizza la barra di navigazione qui sopra per trovare il post.` | tema | no | Corpo del testo della 404, come il tema; fisso (DR-274). |

### `apps/web/src/lib/format.ts` e `apps/web/src/lib/wpDate.ts`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| `wpDate.ts:42` | `Gen, Feb, Mar, Apr, Mag, Giu, Lug, Ago, Set, Ott, Nov, Dic` | formattazione | sì | Mesi abbreviati della traduzione `it_IT` di WordPress; con un'altra «Lingua del sito» i nomi vengono da `Intl` (DR-270). Il formato della riga sotto i titoli resta `j M Y`, opzione di Divi non esposta (`format.ts:54`). |
| `wpDate.ts:29` | `Gennaio … Dicembre` | formattazione | sì | Mesi estesi della scheda del documento (D75): lingua da «Lingua del sito», forma da «Formato data» (DR-270). |
| `format.ts:50` | `...` | formattazione | no | Puntini del riassunto troncato, come il tema. |
| `wpDate.ts:20` | `it-IT / Europe/Rome` | formattazione | sì | Ora valori di riserva: lingua e fuso delle date vengono da «Lingua del sito» e «Fuso orario» (DR-270). |
| `format.ts:71` | `KB, MB, GB, B` | formattazione | no | Unità della dimensione del file, come Download Manager (D75). |

### `apps/web/src/lib/structuredData.ts`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 65 | `it-IT` | accessibilità | sì | Lingua dei dati strutturati: «Lingua del sito»; `it-IT` resta solo come riserva (DR-270). |
| 146 | `Home` | tema | no | Prima voce delle briciole nei dati strutturati, come All in One SEO; fissa (DR-276). |
| 248 | `Risultati della ricerca per «${query}»` | tema | no | Voce delle briciole nei dati strutturati della ricerca; fissa (DR-276). |
| 261 | `404 - Pagina non trovata` | tema | no | Voce delle briciole nei dati strutturati della 404; fissa (DR-276). |

### `packages/blocks/src/render/Form.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 87 | `Non è stato possibile inviare la richiesta.` | progetto | no | Messaggio di riserva se l'invio fallisce senza messaggio del servizio. |
| 92 | `Servizio non raggiungibile: riprova più tardi.` | progetto | no | Messaggio di errore di rete. |
| 103 | `Richiesta inviata.` | progetto | no | Conferma di riserva se né il modulo né la risposta ne hanno una; quella del modulo è un dato. |
| 108 | `Importo da versare: … €.` | progetto | no | Riga dell'importo, solo per i moduli con pagamento. |
| 111 | `Vai al pagamento` | progetto | no | Collegamento al pagamento. |
| 113 | `Sarai ricontattato per il pagamento.` | progetto | no | Testo se manca il collegamento al pagamento. |
| 123 | `Invio in corso…` | progetto | no | Testo di riserva del pulsante durante l'invio; quello del modulo è un dato (configurazione non modificabile in Fase 1, DR-218). |
| 124 | `Invia` | progetto | no | Testo di riserva del pulsante; quello del modulo è un dato (configurazione non modificabile in Fase 1, DR-218). |
| 130 | `Non compilare questo campo` | accessibilità | no | Etichetta del campo esca, nascosta a tutti. |

### `packages/blocks/src/render/FormField.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 29 | `Nome` | tema | no | Sotto-etichetta del campo nome, come WPForms; fissa (DR-277, DR-218). |
| 30 | `Cognome` | tema | no | Sotto-etichetta del campo nome; fissa (DR-277). |
| 31 | `Email` | tema | no | Sotto-etichetta del campo email; fissa (DR-277). |
| 32 | `Conferma email` | tema | no | Sotto-etichetta della conferma; fissa (DR-277). |
| 33 | `Indirizzo (linea 1)` | tema | no | Sotto-etichetta del campo indirizzo, misurata sulla pagina resa (U3, DR-157); fissa (DR-277). |
| 34 | `Indirizzo (riga 2)` | tema | no | Sotto-etichetta del campo indirizzo; fissa (DR-277). |
| 35 | `Località` | tema | no | Sotto-etichetta del campo indirizzo; fissa (DR-277). |
| 36 | `Stato / Provincia / Regione` | tema | no | Sotto-etichetta del campo indirizzo; fissa (DR-277). |
| 37 | `Codice postale` | tema | no | Sotto-etichetta del campo indirizzo; fissa (DR-277). |
| 38 | `Paese` | tema | no | Sotto-etichetta del campo indirizzo; fissa (DR-277). |
| 74 | `*` | tema | no | Marca dei campi obbligatori, come WPForms. |
| 245-254 | `intl-tel-input (nomi dei paesi e testi del selettore)` | accessibilità | no | Testi della libreria del telefono, ora in italiano con la traduzione inclusa nella libreria (DR-277); fissi, non seguono «Lingua del sito». |

### `packages/blocks/src/render/DiviContactField.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 60 | `aria-label={field.label}` | impostazioni | no | Nome accessibile dei campi del modulo di contatto: l'etichetta del modulo, un dato (configurazione non modificabile in Fase 1, DR-218). |

### `packages/blocks/src/render/Map.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 37 | `Mappa` | accessibilità | no | Titolo dell'incorporazione della mappa. |
| 44 | `Mostra la mappa: ${address}` | accessibilità | no | Nome accessibile della copertina della mappa (DR-107); l'indirizzo è un dato del blocco, ora modificabile (DR-279). |
| 49 | `Mostra la mappa` | progetto | no | Testo della copertina: la mappa non chiama terzi prima del clic (DR-107). |

### `packages/blocks/src/render/Video.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 55 | `Riproduci video` | accessibilità | no | Nome accessibile della copertina del video. |
| 74 | `Video` | accessibilità | no | Titolo dell'incorporazione YouTube. |
| 81 | `Video` | accessibilità | no | Titolo dell'incorporazione Vimeo. |
| 90 | `Apri il video` | progetto | no | Collegamento se il video non si incorpora. |

### `packages/blocks/src/render/Slider.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 58, 60 | `alt={slide.heading}` | impostazioni | sì | Testo alternativo dell'immagine della slide: il «Titolo» della slide. |
| 81 | `Slide precedente` | accessibilità | no | Nome accessibile della freccia. |
| 83 | `‹` | formattazione | no | Glifo della freccia indietro. |
| 89 | `Slide successiva` | accessibilità | no | Nome accessibile della freccia. |
| 91 | `›` | formattazione | no | Glifo della freccia avanti. |
| 100 | `Vai alla slide ${n}` | accessibilità | no | Nome accessibile dei puntini. |

### `packages/blocks/src/render/PostList.tsx`

| Riga | Testo | Origine | Modificabile | Motivo |
|---|---|---|---|---|
| 16 | `it-IT` | formattazione | sì | Sul sito la data dell'elenco articoli arriva già scritta in «Formato data» (`Views.tsx:38`, DR-270); `it-IT` resta solo come riserva nell'anteprima dell'area. |

## Decisioni

Le sette voci che la caccia aveva lasciato aperte sono decise voce per voce (DR-271, D167 = B). Nessuna resta da decidere.

| Id | Che cosa | Decisione | Esito nel codice |
|---|---|---|---|
| D1 | Nome del sito nel titolo di riserva e nella 404 | DR-273 (A, letto da «Titolo del sito»), attuato con DR-284 (interruttore `htmlLimitedBots` di Next) | Attuato (T2c): `layout.tsx:23` e `not-found.tsx:14` leggono l'impostazione; il `<title>` resta nell'`<head>`. Il markup ha perso un segnaposto vuoto di Next in fondo al `<body>`, e la 404 un preload del CSS in più: nessun effetto visibile. |
| D2 | Stringhe del tema: ricerca, «Seleziona una pagina», paginazione, nessun risultato, 404 | DR-274 (A, fisse in Fase 1, come nella sorgente) | Fisse e dichiarate. |
| D3 | Etichette della scheda di un documento | DR-275 (A, fisse in Fase 1) | Fisse e dichiarate; le date della scheda seguono «Formato data» (DR-270). |
| D4 | Lingua, fuso orario, formati di data e ora, primo giorno della settimana, articoli per pagina | DR-270 (C, il sito le legge e ne applica l'effetto), con DR-285 per le date nel fuso scelto | Attuato (T2b) solo dove la sorgente le usava: lingua in `lang`, `og:locale`, feed, dati strutturati e nomi di mesi e giorni; fuso in ogni data; «Formato data» nella scheda dei documenti e nell'elenco Category Posts; «Articoli per pagina» nell'elenco Category Posts senza numero proprio. Restano opzioni di Divi, non governate: riga sotto i titoli `j M Y`, 6 articoli negli archivi di categoria, 5 nella ricerca. «Formato ora» e «Primo giorno della settimana»: nessun punto del sito le usa, come nella sorgente. |
| D5 | Etichette delle briciole nel JSON-LD | DR-276 (A, fisse in Fase 1) | Fisse e dichiarate. |
| D6 | Sotto-etichette dei moduli | DR-277 (A, fisse, DR-218) | Fisse e dichiarate. |
| D7 | Testi del selettore del prefisso telefonico | DR-277 (A, verificato nel browser e tradotto ora, perché era in inglese) | Attuato (T2b): testi e nomi dei paesi in italiano; la resa chiusa del campo è identica. |

Nell'area amministrativa, fuori dal perimetro di questo elenco, i due testi che dicevano che la schermata dei media «non esiste ancora» sono riscritti (DR-269, T2b e T2d). I campi offerti dall'area ma fuori da DR-218 sono decisi in DR-278…DR-283, DR-286…DR-288 e registrati in `docs/qa/editability-matrix.csv`.
