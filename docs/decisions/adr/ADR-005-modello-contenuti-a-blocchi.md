# ADR-005 — Rappresentazione dei contenuti

| | |
|---|---|
| **Stato** | **approvata** il 2026-09-14 con DR-038 (approvazione in blocco) |
| **Data** | 2026-09-14 |
| **Wave** | `1B-W1` |
| **Decide** | come è fatto, a database, il corpo di una pagina o di un articolo |
| **Origine** | rischio R-06, il principale della Fase 1; RC-03; DR-033 |

## Revisioni

| Data | Revisione |
|---|---|
| 2026-10-29 | **§5, rischio residuo annotato** nella `1G-W9` T9 (minore parcheggiato dalla `1G-W7` T9): la gara fra l'eliminazione di un documento e il salvataggio di un contenuto che lo cita nel blocco «Documento». Nessuna regola cambia |
| 2026-10-09 | **§3.3 regola 2 riformulata**, attuazione di **DR-071** nella `1E-W0`: le spaziature per modulo di Divi si conservano come **valori** in proprietà personalizzate CSS sul contenitore del blocco; le **regole** che li usano stanno nel foglio di stile. Il divieto di stile in linea resta per le regole |

---

## 1. Contesto

R-06 è la tensione centrale del progetto: **l'HTML fedele al sito attuale è
ingestibile da un redattore; i blocchi editabili possono divergere dal pixel.** Il
gate chiede entrambe le cose: parità provata e CMS realmente usabile.

La Fase 1A aveva letto la sorgente come «Divi oppure HTML semplice». La wave
`1B-W0` ha misurato meglio, e il quadro reale è più favorevole:

| Forma del contenuto | Pagine | Articoli | Totale |
|---|---|---|---|
| **Solo blocchi Gutenberg** | 47 | 10 | **57** |
| **Solo shortcode Divi** (compreso il marcatore `wp:divi/placeholder`) | 29 | 18 | **47** |
| Nessuna delle due, HTML nudo | 2 | 2 | **4** |
| Misto Divi + Gutenberg reale | 0 | 0 | **0** |

Tre fatti cambiano la natura del problema:

1. **Non esiste alcun contenuto misto.** Ogni contenuto appartiene a una sola
   famiglia. La conversione si può quindi decidere per contenuto, senza casi ibridi
   da gestire.
2. **Più della metà del sito è già a blocchi.** I 57 contenuti Gutenberg usano
   **12 tipi di blocco distinti**, non decine.
3. Le due famiglie **convergono**: sezione, riga, colonna, testo, immagine sono le
   stesse cose con nomi diversi.

### 1.1 Blocchi Gutenberg effettivamente usati

| Blocco | Occorrenze | Contenuti |
|---|---|---|
| `paragraph` | 274 | 40 |
| `list-item` | 117 | 14 |
| `column` | 32 | 16 |
| `list` | 29 | 15 |
| `wpforms/form-selector` | **23** | **23** |
| `image` | 19 | 18 |
| `columns` | 16 | 16 |
| `html` | 6 | 3 |
| `heading` | 5 | 4 |
| `separator` | 5 | 5 |
| `shortcode` | 1 | 1 |
| `media-text` | 1 | 1 |

Il dato su `wpforms/form-selector` è nuovo e rilevante: **i form sono inseriti come
blocco, non come shortcode.** La Fase 1A aveva contato un solo
`et_pb_contact_form`, e quel conteggio riguardava i form di Divi, non i 23 form
WPForms incorporati nelle pagine. Questo tocca direttamente DR-032 e l'ADR-010.

### 1.2 Shortcode Divi effettivamente usati

Sezione, riga, colonna, testo, immagine coprono il 97% delle occorrenze. La coda è:
`et_pb_video`, `et_pb_map` con `et_pb_map_pin`, `et_pb_contact_form` con
`et_pb_contact_field`. Fuori da Divi restano `catposts`, `doc`, `hash`, `UID`, più
`event_dashboard` e `wpdm_user_dashboard`, che appartengono a plugin **disattivati**
e oggi non producono nulla.

### 1.3 HTML effettivamente presente dentro i blocchi di testo

Rilevato su tutti i 108 contenuti. L'insieme è piccolo e questo è il fatto che rende
praticabile l'editabilità:

| | Elementi |
|---|---|
| Struttura | `p`, `br`, `hr`, `div`, `figure`, `span` |
| Titoli | `h1` (1 sola occorrenza), `h2`, `h3`, `h4`, `h5` |
| Liste | `ul`, `ol`, `li` |
| Enfasi | `strong`, `b`, `em`, `i` |
| Collegamenti e media | `a`, `img` |
| Tabelle | `table`, `thead`, `tbody`, `tr`, `th`, `td` — **una sola tabella in tutto il sito** |

Attributi presenti: `href`, `target`, `rel`, `title`, `id`, `class`, `style`, `src`,
`alt`, `width`, `height`, `align`, `dir`, `type`, più alcune coppie `data-start` e
`data-end` che sono residui di un incollaggio e non hanno effetto.

Nessun `<script>`, nessun `<iframe>`, nessun `<form>` dentro il contenuto.

## 2. Opzioni

### Opzione A — Una colonna di HTML

Il corpo è HTML, si modifica con un editor di testo ricco.

- **A favore:** import banale, parità facile, nessun modello da progettare.
- **Contro:** non risolve R-06, lo rimanda. Un redattore che apre una pagina Divi
  convertita in HTML si trova davanti un muro di `div` annidati. E ogni salvataggio
  dell'editor rischia di riscrivere il markup e rompere la parità **dopo**
  l'approvazione — il modo peggiore in cui un difetto possa presentarsi.

### Opzione B — Solo blocchi strutturati

Ogni contenuto è un albero di blocchi tipizzati; l'HTML non è mai persistito.

- **A favore:** massima editabilità, resa coerente, contenuto indipendente dalla
  presentazione, riusabile su altri canali.
- **Contro:** obbliga a convertire **tutto**, compresi i quattro contenuti HTML nudi
  e i frammenti che non hanno un blocco corrispondente. Una conversione incompleta
  si manifesta come testo perso, che in una migrazione è il danno peggiore.

### Opzione C — Blocchi tipizzati con blocco di riserva

Albero di blocchi tipizzati; esiste un blocco `html` che conserva il frammento
originale quando nessun blocco lo rappresenta fedelmente.

- **A favore:** nessun contenuto va perso; ciò che è convertibile diventa editabile;
  ciò che non lo è resta fedele e visibile come eccezione.
- **Contro:** se il blocco di riserva viene usato con generosità, l'opzione C
  degenera nell'opzione A senza che nessuno se ne accorga. Serve una soglia dichiarata
  e misurata.

## 3. Scelta proposta

**Opzione C**, con una soglia esplicita e verificata in Fase 1G.

### 3.1 Forma

Il corpo è un **documento JSON** in una colonna `jsonb`, con versione dello schema,
validato da Zod sia in scrittura sia in lettura:

```
{
  "schema": 1,
  "blocks": [ { "type": "...", "id": "...", "props": {...}, "children": [...] } ]
}
```

Ogni blocco ha un identificatore stabile, generato all'import e **mai riassegnato**:
serve per i confronti, per i collegamenti interni a un'ancora e per la cronologia
delle versioni.

### 3.2 Insieme dei blocchi — chiuso, 14 tipi

Deriva dall'unione misurata delle due famiglie, non da un catalogo immaginato.

| Blocco | Contenitore | Origine | Note |
|---|---|---|---|
| `section` | sì | `et_pb_section` | sfondo, spaziatura, larghezza piena |
| `row` | sì | `et_pb_row`, `wp:columns` | definisce la ripartizione delle colonne |
| `column` | sì | `et_pb_column`, `wp:column` | larghezza relativa |
| `rich_text` | no | `et_pb_text`, `wp:paragraph`, `wp:list`, `wp:heading` | **il blocco di lavoro**: HTML ripulito, modificabile |
| `image` | no | `et_pb_image`, `wp:image` | riferimento al media, testo alternativo, didascalia, collegamento |
| `media_text` | sì | `wp:media-text` | immagine affiancata a testo |
| `video` | no | `et_pb_video` | 7 occorrenze |
| `map` | no | `et_pb_map` più `et_pb_map_pin` | contiene i segnaposto |
| `separator` | no | `wp:separator`, `<hr>` | |
| `form` | no | `wp:wpforms/form-selector`, `et_pb_contact_form` | riferimento al form, vedi ADR-010 |
| `post_list` | no | `[catposts]` | elenco di articoli per categoria |
| `document` | no | `[doc]`, `wpdmpro` | documento scaricabile |
| `slider` | no | Slider Revolution | riferimento al carosello |
| `html` | no | `wp:html`, frammenti non convertibili | **blocco di riserva** |

Non ci sono altri tipi, e l'insieme **non si allarga** in Fase 1: aggiungere un tipo
richiede una nota in questa ADR.

### 3.3 Regole di conversione

1. Un contenuto **Gutenberg** si converte per intero in blocchi. Non è previsto
   l'uso del blocco `html` se non per `wp:html`, che nasce già come tale.
2. Un contenuto **Divi** si converte per intero in blocchi. Gli attributi di stile
   di Divi che non hanno corrispondente si registrano nel rapporto di import e
   diventano, se necessari alla resa, **classi dichiarate** — mai stile in linea
   generato automaticamente.

   > **Riformulata il 2026-10-09, decisione DR-071.** Fa eccezione un solo caso:
   > le spaziature per modulo di Divi (`padding`, `margin` e simili), che sono
   > valori numerici liberi e non si riducono a una scala di classi senza
   > arrotondare. Si scrivono sul contenitore del blocco come **proprietà
   > personalizzate CSS** (per esempio `style="--blk-pad-top:54px"`), e solo le
   > regole del foglio di stile del sito le leggono. L'attributo porta un
   > **valore**, non una **regola**: nessuna proprietà CSS ordinaria
   > (`padding`, `color`, `display`…) compare mai in linea, e nessun nome di
   > proprietà personalizzata fuori dall'elenco chiuso del foglio di stile.
   > Il controllo è un test della Fase 1E sull'HTML reso.
3. Un contenuto **HTML nudo** (4 casi) diventa un singolo `rich_text`.
4. Il blocco `html` si usa solo quando la conversione perderebbe qualcosa di
   visibile. Ogni uso è **contato e motivato** nel rapporto di import.

### 3.4 Soglia dichiarata sull'uso del blocco di riserva

> Al termine della Fase 1D, i blocchi `html` non devono superare il **10% dei
> blocchi non contenitori** e non devono comparire su più di **15 contenuti su 108**.

Se la soglia viene superata, la conversione non ha funzionato e va rivista **prima**
della Fase 1E, non dopo l'approvazione della parità. La soglia è arbitraria nel
valore preciso ma non nella sostanza: senza un numero, l'opzione C scivola
nell'opzione A senza che nessuno debba ammetterlo.

### 3.5 Elenco chiuso di elementi e attributi ammessi in `rich_text`

Derivato dal §1.3, non da una lista generica di sicurezza:

```
Elementi:  p br hr div figure figcaption span
           h2 h3 h4 h5 h6
           ul ol li
           strong b em i u s sub sup
           a img
           table thead tbody tr th td
Attributi: href target rel title id class
           src alt width height loading
           colspan rowspan
```

Escluso deliberatamente: `style` in linea, `script`, `iframe`, `form`, `object`,
`embed`, gestori `on*`, `data-*`.

`style` merita una parola: **è presente nella sorgente** (su `span`, `p`, `li`, `a`,
`div`, `img`). Se in Fase 1E risultasse che rimuoverlo cambia la resa, si rientra
convertendo quegli stili in classi dichiarate, non riaprendo `style` in scrittura.
La decisione va presa con i confronti visivi alla mano, non adesso.

`h1` compare una sola volta nel contenuto: il titolo `<h1>` della pagina appartiene
al template, non al corpo. Per questo `h1` non è ammesso in `rich_text`.

### 3.6 HTML reso, mantenuto in cache

Accanto ai blocchi, una colonna `content_html` contiene la resa dei blocchi in HTML,
**rigenerata a ogni salvataggio, mai modificata a mano**. Serve a tre cose concrete:
la ricerca full-text, la generazione della meta description dai template SEO
(`1B-W0` §2.1), e il confronto meccanico fra due versioni durante la Fase 1E.

È una **cache**: se diverge dai blocchi, hanno ragione i blocchi.

### 3.7 Versioni

Ogni salvataggio crea una riga di cronologia con il documento a blocchi completo.
La sorgente ha 837 revisioni; non si importano — sono cronologia di WordPress e non
servono a nulla nel sistema nuovo. La cronologia nuova parte vuota.

## 4. Alternativa scartata e motivo

**Opzione A** è scartata perché non risolve R-06 e perché introduce il rischio
peggiore: una parità approvata che si degrada in silenzio al primo salvataggio di
un redattore.

**Opzione B** è scartata perché la purezza costa la certezza di non perdere nulla.
In una migrazione, il testo perso è il danno irreversibile: il blocco di riserva è
la rete che lo impedisce. La disciplina sta nella soglia del §3.4, non nell'assenza
della rete.

## 5. Conseguenze

**Più facile:** un redattore modifica testo e immagini su **tutti** i contenuti, non
solo su quelli semplici; la ricerca funziona; la resa è coerente perché nasce da
componenti, non da HTML arbitrario.

**Più difficile:** il convertitore Divi è la componente più delicata della Fase 1D.
Va scritto con test su **casi reali**, cioè sui contenuti della sorgente, eseguiti in
locale e **mai** riportati nella documentazione né in Git.

**Nuovo obbligo:** ogni tipo di blocco esiste in due esemplari coerenti — un
componente di resa nel sito pubblico e un editor nell'area amministrativa. Se i due
divergono, l'anteprima mente, ed è il difetto più insidioso di un CMS.

**Rischio residuo noto (2026-10-29, `1G-W9` T9).** Il salvataggio di un contenuto
verifica che il documento citato da un blocco «Documento» sia pubblico, ma fuori dalla
transazione che scrive il contenuto e senza bloccarne la riga. Se nello stesso istante
qualcuno elimina quel documento, entrambe le operazioni possono riuscire: l'eliminazione
non vede ancora il blocco che lo cita, il salvataggio ha già visto il documento. Il danno
è nullo per DR-287: sul sito un blocco che cita un documento assente non lascia traccia,
mai un collegamento a una pagina inesistente; il blocco resta nel contenuto finché
qualcuno non lo toglie, e cambiarlo senza scegliere un altro documento è rifiutato con
«Il documento scelto non è fra i documenti pubblici.». La
correzione (verifica e scrittura nella stessa transazione, con la riga del documento
bloccata in condivisione) tocca creazione, salvataggio e copia di lavoro dei contenuti;
si rinvia a quando quel codice si riapre.

## 6. Reversibilità

**Bassa.** È la decisione che vincola di più: schema, importer, componenti di resa
ed editor ne discendono. Va presa ora, con attenzione, e non rimessa in discussione
senza un motivo forte. Il documento JSON resta comunque leggibile e convertibile:
non è un formato proprietario opaco.

## 7. Verifica

**Fase 1D:** ogni contenuto della sorgente produce un documento valido secondo lo
schema Zod; la soglia del §3.4 è rispettata; il rapporto di import elenca ogni uso
del blocco di riserva con il motivo.

**Fase 1G:** un redattore modifica testo e immagine su tre contenuti scelti a caso —
uno Gutenberg, uno Divi, uno con blocco di riserva — e il risultato è corretto. Se
non ci riesce, il gate non è superato, indipendentemente dalla parità visiva.

**Test di andata e ritorno, obbligatorio:** aprire un contenuto nell'editor e
salvarlo **senza modifiche** non deve cambiare né i blocchi né l'HTML reso. È il
controllo che protegge la parità dal degrado silenzioso.
