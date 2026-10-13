# Classificazione delle differenze — `1E-W6` (parziale)

Stato: **interrotto da un vincolo di memoria della macchina**, non concluso. I
numeri di questo documento vengono da una cattura del sito nuovo parziale e in
parte viziata (v. §0): non sono i 585 confronti del criterio 1E-2 e non
sostituiscono una ricattura pulita.

## 0. Che cosa è successo alla cattura

`tests/visual/cattura-sito.ts` è stato avviato due volte per un errore di
sessione (un processo di un tentativo precedente non si era fermato); i due
processi hanno catturato in parallelo competendo per la stessa memoria. Il
governatore di sistema di Claude Code ha poi interrotto per basso livello di
memoria sia la cattura sia un controllo di attesa, con la nota esplicita di
**non riavviarli da soli**. Risultato: 475/585 pagine catturate, 69 errori di
rete per timeout, e un confronto (`confronto-tutto.ts`) esteso solo a queste
475 (481 confrontabili dopo le maschere, alcuni con viewport in più per via
delle righe aggiunte dalla matrice).

**Conseguenza pratica**: molte delle differenze di altezza misurate su queste
475 catture sono reali (viste a occhio sugli screenshot, sotto), ma il quadro
non è completo né definitivo. Serve una ricattura integrale quando la macchina
avrà di nuovo memoria libera, su richiesta esplicita.

## 1. Cause pervasive (riguardano la maggioranza delle pagine)

### Causa A — «a capo» singoli non trasformati in `<br>` (bloccante)

**Componente**: `apps/importer/src/convert/shared/rich-text.ts` (funzione
condivisa da tutti i convertitori: HTML libero/«freeform» fuori dai blocchi
Gutenberg, modulo testo di Divi, HTML nudo dei 4 casi, shortcode sconosciuti).

**Causa**: la sorgente applicava `wpautop()` (`wp-includes/formatting.php`
riga 446) a ogni resa (`the_content`): un rigo singolo diventa `<br>`, un rigo
vuoto separa i paragrafi. L'importer copiava l'HTML grezzo, «a capo» compresi,
ma non applicava questa trasformazione: il browser collassa gli «a capo» in
uno spazio, e il testo si legge come un unico paragrafo continuo, molto più
corto della sorgente (misurato su `/affettivita-e-sessualita-il-lungo-viaggio/`:
confrontare la cattura di riferimento e quella nuova).

**Correzione fatta**: porto fedele di `wpautop()` in
`apps/importer/src/convert/shared/wpautop.ts`, applicato una sola volta in
`buildRichTextOrFallback` prima della sanificazione — lo stesso punto usato da
Divi, dal convertitore «freeform» e dall'HTML nudo. Test
`apps/importer/tests/unit/convert/wpautop.test.ts` (8 prove): paragrafi,
`<br>`, contenuto già a blocchi non raddoppiato, `<pre>` intatto. **Tutta la
suite dell'importer e di `packages/blocks` resta verde** (30 file / 184 prove
l'importer, 25 file / 212 prove i blocchi).

**Non ancora efficace sul sito**: il database contiene l'HTML già scritto
dall'importazione precedente; la correzione vale solo alla **prossima
riesecuzione dell'import**, già in coda con D50/D51 (carosello, pagamento) e
con l'`offset` della home. Fino ad allora, ogni pagina con testo non a blocchi
Gutenberg resta più corta del dovuto: è la causa della quasi totalità delle
«altezze diverse» viste nel confronto parziale.

**Pagine coinvolte**: tutte quelle con contenuto «freeform» (fuori blocchi
Gutenberg) o con modulo testo Divi scritto con «a capo» invece di paragrafi
separati — nel campione catturato, la maggioranza dei 78 `page` e 28 `post`.
Classificata **in attesa della riesecuzione dell'import**.

**Rettifica del 2026-10-12 (coordinatore):** WordPress toglie `wpautop()` dalla resa dei contenuti con blocchi (`has_blocks`), quindi la correzione non si applica ai 64 contenuti Gutenberg (test `gutenbergNoAutop.test.ts`). Resta da confermare dopo la ricattura se il Divi Builder applica `wpautop()` ai propri moduli come nella resa misurata.

### Causa B — immagini `alignleft/alignright/aligncenter` non più affiancate al testo (maggiore)

**Componente**: `apps/web/src/styles/blocks.css` (nessuna regola per queste
classi, pur presenti nell'HTML sanificato).

**Causa**: la sorgente le stilizza con regole misurate su
`wp-content/themes/Divi/style-cpt.css`: `.alignright{float:right}`,
`img.alignright{display:inline;float:right;margin-left:15px}`,
`img.alignleft{display:inline;float:left;margin-right:15px}`,
`.aligncenter{display:block;margin-left:auto;margin-right:auto}`. Senza queste
regole un'immagine pensata per affiancare il testo (es. il poster di
`/affettivita-e-sessualita-il-lungo-viaggio/`) va a capo, spostando tutto il
testo sotto invece che a fianco.

**Correzione fatta e verificata**: le quattro regole aggiunte a `blocks.css`,
limitate a `.blk-text` (il testo ricco); ricostruito e riavviato `apps/web`;
verificato a vista sulla cattura rifatta di
`/affettivita-e-sessualita-il-lungo-viaggio/`: l'immagine torna a destra con
il testo a fianco, come nella sorgente. **Effetto immediato**, non legato
all'import.

**Pagine coinvolte**: ogni contenuto con un'immagine `alignleft`/`alignright`
nel testo libero — non contate singolarmente in questa sessione (serve la
ricattura completa per l'elenco esatto).

## 2. Cause già note, non di questa wave

- **Elenco articoli della home con un articolo in più**: `offset` della
  configurazione salvata non ancora nel blocco `post_list` reso (rilievo
  2026-10-12, in attesa della riesecuzione dell'import, D50).
- **Scorrimento orizzontale della tabella dei cookie a 390/360 px**
  (`/informazioni-sui-cookie/`): difformità **già approvata** (DR-120),
  mascherata.
- **Mappa e video al clic**: copertina propria al posto del riproduttore
  esterno (DR-107), **maschera dichiarata** (§3).

## 3. Il carosello della home — non è un difetto dell'importer

Controllo richiesto dal coordinatore: perché nessun contenuto ha un blocco
`slider`, pur esistendo 12 righe in `slider_slides`.

**Esito della verifica** (database dell'istanza di riferimento,
`wp_posts`/`wp_postmeta`/`wp_options`):

- Il contenuto **pubblicato** della home (`wp_posts.ID = 62`) **non contiene**
  `[rev_slider]`: solo intestazioni, un paragrafo e lo shortcode `[catposts]`.
- Lo shortcode `[rev_slider alias="home"][/rev_slider]` esiste **solo in sei
  revisioni** della pagina (`post_type = revision`, `post_parent = 62`),
  l'ultima datata 2026-04-28: è stato **tolto dal contenuto pubblicato prima
  del backup** del 2026-09-13.
- Il widget `rev-slider-widget` esiste ma è **vuoto** (nessuna istanza
  configurata) e **non è assegnato a nessuna barra laterale attiva**
  (`sidebars_widgets`: solo `sidebar-2` ha un widget, il testo del piè di
  pagina già importato con DR-117).
- La cattura di riferimento della home (`docs/qa/screenshots/riferimento/home/1440.png`)
  **non mostra alcun carosello**: conferma visiva che coincide con i dati.
  I file JS/CSS di Slider Revolution si caricano comunque su ogni pagina
  (comportamento del plugin, non legato all'uso), e questo spiega perché
  compaiono nell'HTML pur non essendoci alcun modulo visibile.

**Conclusione**: l'importer **non ha un difetto** da correggere qui — riflette
correttamente il contenuto pubblicato, che non ha più il carosello. Il
riferimento che non torna è `docs/qa/visual-regression-plan.md` §8 punto 10
(«Carosello della home: 12 slide, avanzamento, comandi»), scritto nella 1B su
base dell'inventario dei plugin, prima di questa verifica puntuale.

**Non è una mia decisione da prendere**: propongo all'utente, con
raccomandazione:

- **Opzione A (raccomandata)**: correggere `visual-regression-plan.md` §8,
  togliendo il punto 10 e annotando l'esito di questa verifica — nessuna resa
  da provare, perché la sorgente non la rende più.
- **Opzione B**: lasciare il punto 10 e dichiarare esplicitamente, nel
  rapporto finale, che il controllo non è applicabile.

Nessuna differenza «carosello della home» entra quindi nella classificazione
delle difformità: le due rese (sorgente e sito nuovo) **coincidono già**, nel
senso che **nessuna delle due mostra un carosello**.

## 4. Maschere — coordinate (`docs/qa/confronto/maschere.json`)

17 rettangoli, per URL e viewport, misurati sul sito nuovo in esecuzione
(elemento `.blk-map` o `.blk-video`) o sulla tabella dei cookie:

| URL | Viewport | Area | Coordinate (x,y w×h) | Motivo |
|---|---|---|---|---|
| `/contatti/` | tutte e 6 | `.blk-map` | v. file, allargata in altezza a 450px | mappa esterna |
| `/dove-siamo/` | tutte e 6 | `.blk-map` | v. file, allargata in altezza a 450px | mappa esterna |
| `/riparte-il-corso-per-consulenti-familiari/` | 1440, 768, 390 | `.blk-video` | v. file | video esterno |
| `/informazioni-sui-cookie/` | 390, 360 | tabella cookie | v. file | DR-120 |

**Incompleto**: `/dal-vizioso-al-virtuoso/` ha un blocco `video` in database
ma `maschere.ts` non l'ha raggiunto (nessun errore registrato: da verificare
nella prossima sessione, probabilmente un timeout di rete silenzioso).
L'altezza delle maschere `.blk-map` è stata **allargata a mano** (450px, non
misurata pixel per pixel sul riquadro di errore di Google nella sorgente)
perché quel riquadro è più alto della copertina del sito nuovo: va rimisurata
sulla cattura di riferimento nella prossima sessione.

## 5. Numeri (parziali, da non usare come esito ufficiale di 1E-2/1E-3/1E-4)

Su 481 confronti possibili (475 pagine catturate, alcune con più righe di
matrice): 0 superati, 0 da esaminare, 481 falliti, 17 con area oltre 32×32
(tutte sulle pagine con mappa/video, dove la maschera non compensa ancora la
differenza di altezza complessiva). 104 confronti senza immagine (le 110 pagine
non ancora catturate). La causa A (§1) spiega la quasi totalità dei falliti.
