# BLOCK-MODEL — Fase 1D · Il modello a blocchi, campo per campo

Le decisioni di dettaglio che ADR-005 lascia aperte. Serve a rendere eseguibili le
wave `1D-W1` e `1D-W3` senza che nessuno debba inventare.

| | |
|---|---|
| **Stato** | proposta di attuazione. Non modifica ADR-005: la **completa** dove tace |
| **Vincolo** | l'insieme dei blocchi è chiuso a 14 tipi e non si allarga in Fase 1 (ADR-005 §3.2) |
| **Attuazione** | `packages/blocks`, wave `1D-W1` |

Dove una scelta è **arbitraria** lo si dice. Arbitrario non significa indifferente:
significa che vale una scelta qualunque purché sia **una sola** e sia scritta.

---

## 1. Forma del documento

ADR-005 §3.1 fissa l'involucro. Qui si fissa il resto.

```ts
const BlockDocument = z.object({
  schema: z.literal(1),
  blocks: z.array(BlockNode),
});
```

Un blocco ha **esattamente quattro chiavi**, e nessuna altra:

```ts
{ type: BlockType, id: BlockId, props: <propri del tipo>, children: BlockNode[] }
```

Regole dell'involucro:

| # | Regola | Motivo |
|---|---|---|
| 1 | `children` è **sempre presente**, anche sui blocchi non contenitori, dove è un array vuoto | Un campo che a volte c'è e a volte no produce due forme dello stesso documento, e la serializzazione deterministica del §6 ne avrebbe due |
| 2 | Le chiavi di `props` sono **sempre tutte presenti**, con il valore predefinito dove il dato manca | Stesso motivo. Non esistono proprietà assenti: esistono proprietà a `null` |
| 3 | Gli oggetti sono `.strict()`: una chiave sconosciuta **fa fallire** la validazione | Una proprietà scritta male passerebbe in silenzio, e verrebbe scoperta come contenuto mancante |
| 4 | Ogni `props` include il frammento comune `classes` del §2.1 | Attua ADR-005 §3.3 regola 2 |
| 5 | La radice del documento accetta `section`, `row` e i blocchi di contenuto; **non** accetta `column` | I 57 contenuti Gutenberg non hanno alcuna sezione: inventargliene una aggiungerebbe markup che la sorgente non ha. Una colonna fuori da una riga non ha significato |

## 2. Tipi condivisi

### 2.1 Frammento comune delle proprietà

```ts
const CommonProps = {
  classes: z.array(ClassName).default([]),   // vocabolario chiuso, §7
};
```

`ClassName` è `^[a-z][a-z0-9-]{0,39}$`. Il vocabolario ammesso è chiuso ed è nel §7:
una classe fuori vocabolario **fa fallire** la validazione. Senza vocabolario chiuso,
«classi dichiarate» diventa «stringhe arbitrarie», che è la stessa cosa dello stile in
linea con un passaggio in più.

### 2.2 Identificatore

```ts
const BlockId = z.string().regex(/^b_[0-9a-f]{12}$/);
```

Come si genera: §4.

### 2.3 Riferimenti alle altre entità

```ts
const EntityRef = z.string().uuid();   // media, forms, documents, sliders, terms
```

Sono gli identificatori delle righe di PostgreSQL, non gli identificatori di
WordPress. La corrispondenza con la sorgente vive in `import_id_map`
(`importer-spec.md` §6.1), mai dentro i blocchi.

### 2.4 Lunghezze, colori, spaziature

```ts
const CssLength = z.string().regex(/^-?\d+(\.\d+)?(px|em|rem|%|vh|vw)$/);

const ColorValue = z.string().regex(
  /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/
);

const Box = z.object({
  top: CssLength.nullable(),  right:  CssLength.nullable(),
  bottom: CssLength.nullable(), left: CssLength.nullable(),
}).strict();

const Spacing = z.object({
  base: Box.nullable(), tablet: Box.nullable(), phone: Box.nullable(),
}).strict();
```

**Arbitrario, e dichiarato:** i colori si conservano **nella forma in cui stanno nella
sorgente**, senza normalizzare `#FFF` in `#ffffff` né `rgb()` in esadecimale.
Normalizzare renderebbe il confronto di andata e ritorno dipendente dalla funzione di
normalizzazione, che è esattamente la classe di errore che ADR-006 §1 indica come
discriminante. Un valore che non corrisponde alle due forme ammesse **non si importa**:
produce una riga `import_issues` di gravità `warning` con modulo e attributo, e la
proprietà resta `null`.

Stessa regola per `CssLength`: le unità ammesse sono cinque; qualunque altra cosa —
valori multipli in una stringa, funzioni `calc()`, unità esotiche — non si importa e
si conta.

### 2.5 Che cosa è contenitore

| Insieme | Tipi |
|---|---|
| **Contenitori** — ADR-005 §3.2 li marca «sì» | `section`, `row`, `column`, `media_text` |
| **Blocchi di contenuto** | `rich_text`, `image`, `media_text`, `video`, `map`, `separator`, `form`, `post_list`, `document`, `slider`, `html` |

`media_text` sta in entrambi gli insiemi: è un contenitore per la struttura e un
blocco di contenuto per la collocazione. Per il conteggio della soglia conta come
contenitore: §8.

## 3. I 14 tipi, campo per campo

Legenda della colonna «Obbl.»: **sì** = il documento non è valido senza;
**no** = ha un valore predefinito e la chiave è comunque sempre presente (regola 2 del §1).

### 3.1 `section` — contenitore

**Può contenere:** solo `row`. **Origine:** `et_pb_section` (48 aperture).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `fullWidth` | `boolean` | no | `false` | `make_fullwidth` |
| `transparentBackground` | `boolean` | no | `false` | `transparent_background` |
| `backgroundColor` | `ColorValue \| null` | no | `null` | `background_color` |
| `backgroundMediaId` | `EntityRef \| null` | no | `null` | immagine di sfondo risolta in media |
| `parallax` | `boolean` | no | `false` | `parallax` |
| `innerShadow` | `boolean` | no | `false` | `inner_shadow` |
| `customWidth` | `{ mode: 'default'\|'px'\|'percent', value: number \| null }` | no | `{mode:'default', value:null}` | `use_custom_width`, `custom_width_px`, `custom_width_percent` |
| `padding` | `Spacing` | no | tutti `null` | `custom_padding` e varianti tablet e telefono |
| `classes` | `ClassName[]` | no | `[]` | §7 |

Vincolo Zod: se `customWidth.mode === 'default'` allora `value` è `null`; altrimenti
`value` è un numero positivo. Un `use_custom_width` attivo senza valore è un'anomalia
della sorgente e produce un `warning`.

### 3.2 `row` — contenitore

**Può contenere:** solo `column`. **Origine:** `et_pb_row` (88), `wp:columns` (16).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `columnStructure` | `string` regex `^\d+_\d+(,\d+_\d+)*$` | **sì** | — | `column_structure`; per Gutenberg si deriva dalle larghezze delle colonne figlie |
| `fullWidth` | `boolean` | no | `false` | `make_fullwidth` |
| `customWidth` | come `section` | no | `{mode:'default', value:null}` | `use_custom_width`, `custom_width_*` |
| `gutter` | `{ custom: boolean, width: number \| null }` | no | `{custom:false, width:null}` | `use_custom_gutter`, `gutter_width` |
| `backgroundColor` | `ColorValue \| null` | no | `null` | `background_*` |
| `backgroundMediaId` | `EntityRef \| null` | no | `null` | `background_*` |
| `padding` | `Spacing` | no | tutti `null` | `custom_padding*` |
| `classes` | `ClassName[]` | no | `[]` | §7 |

**Invariante, verificata da Zod con `superRefine`:** `columnStructure` deve essere
esattamente l'unione, nell'ordine, dei valori `width` delle `column` figlie. Due
rappresentazioni della stessa cosa sono un doppione, e i doppioni divergono: la
verifica le tiene insieme e fa fallire il documento se divergono. Si tengono entrambe
perché `divi-shortcode-strategy.md` §3.1 dichiara `column.type` «non negoziabile» e
ADR-005 §3.2 attribuisce alla riga la ripartizione.

### 3.3 `column` — contenitore

**Può contenere:** i blocchi di contenuto del §2.5. **Non** può contenere `section`,
`row` o `column`. **Origine:** `et_pb_column` (137), `wp:column` (32).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `width` | `string` regex `^\d+_\d+$` | **sì** | — | `type` di Divi; per Gutenberg si deriva dalla larghezza percentuale dichiarata, o da `1_N` se assente |
| `padding` | `Spacing` | no | tutti `null` | `custom_padding` |
| `classes` | `ClassName[]` | no | `[]` | §7 |

**Non so** quale sia l'insieme esatto dei valori `type` presenti nella sorgente: i
documenti di Fase 1A e 1B non lo elencano. Finché non è misurato, `width` è una
espressione regolare e non una enumerazione. Nella wave `1D-W3` i valori distinti si
contano e l'enumerazione chiusa si scrive qui.

### 3.4 `rich_text` — il blocco di lavoro

**Non contiene blocchi.** **Origine:** `et_pb_text` (89), `wp:paragraph` (274),
`wp:list` (29), `wp:heading` (5), contenuti HTML nudo (4).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `html` | `string`, non vuota, **già sanificata** | **sì** | — | contenuto interno, passato dal §5 |
| `textAlign` | `'left'\|'center'\|'right'\|'justify' \| null` | no | `null` | `text_orientation` |
| `backgroundLayout` | `'light'\|'dark' \| null` | no | `null` | `background_layout` |
| `border` | `{ color: ColorValue, width: CssLength, style: 'solid' } \| null` | no | `null` | solo se `use_border_color` è attivo con colore diverso dal predefinito (`divi-shortcode-strategy.md` §3.2) |
| `padding` | `Spacing` | no | tutti `null` | `custom_padding` |
| `classes` | `ClassName[]` | no | `[]` | §7 |

Vincolo Zod: `html` deve essere un **punto fisso della sanificazione**, cioè
`sanifica(html) === html`. È la verifica che impedisce a un blocco non sanificato di
entrare nel database da una rotta dimenticata (ADR-005 §3.1: validato in scrittura e
in lettura).

### 3.5 `image`

**Non contiene blocchi.** **Origine:** `et_pb_image` (59), `wp:image` (19).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `mediaId` | `EntityRef \| null` | no | `null` | `src` risolto in `media` |
| `src` | `string \| null` | no | `null` | usato **solo** se `mediaId` è `null` |
| `variant` | `string` regex `^\d+x\d+$` `\| null` | no | `null` | suffisso di dimensione derivata usato nella sorgente; `null` = dimensione piena (ADR-004 §3.2) |
| `alt` | `string` | no | `""` | `alt` |
| `title` | `string \| null` | no | `null` | `title_text` |
| `caption` | `string \| null` | no | `null` | didascalia dell'allegato o `figcaption` |
| `linkUrl` | `string \| null` | no | `null` | `url` |
| `linkNewWindow` | `boolean` | no | `false` | `url_new_window` |
| `align` | `'left'\|'center'\|'right' \| null` | no | `null` | `align` |
| `alignTablet` | `'left'\|'center'\|'right' \| null` | no | `null` | variante tablet di `align` |
| `forceFullWidth` | `boolean` | no | `false` | `force_fullwidth` |
| `lightbox` | `boolean` | no | `false` | `show_in_lightbox` |
| `centerOnMobile` | `boolean` | no | `false` | `always_center_on_mobile` |
| `animation` | `{ style: string, direction: string \| null } \| null` | no | `null` | `animation`, `animation_style`, `animation_direction` — `divi-shortcode-strategy.md` §3.3 |
| `classes` | `ClassName[]` | no | `[]` | §7 |

Vincolo Zod: **almeno uno** fra `mediaId` e `src` è non nullo. Un `src` non risolto in
un media è un'anomalia e produce una riga `import_issues` di gravità `warning`: è un
riferimento che nessuno potrà più sostituire dall'editor.

`animation` si conserva come proprietà — `divi-shortcode-strategy.md` §3.3 lo impone —
ma nessuno lo anima in questa fase: la resa è 1E, con gli screenshot scattati ad
animazione conclusa.

### 3.6 `media_text` — contenitore

**Può contenere:** i blocchi di contenuto del §2.5, **escluso** `media_text` stesso.
**Origine:** `wp:media-text` (1 occorrenza).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `mediaId` | `EntityRef \| null` | no | `null` | immagine della metà media |
| `mediaAlt` | `string` | no | `""` | |
| `mediaVariant` | `string` regex `^\d+x\d+$` `\| null` | no | `null` | come `image.variant` |
| `mediaPosition` | `'left' \| 'right'` | no | `'left'` | classe `has-media-on-the-right` |
| `mediaWidthPercent` | `number` intero 1..99 `\| null` | no | `null` | `mediaWidth` |
| `verticalAlignment` | `'top'\|'center'\|'bottom'` | no | `'center'` | classe `is-vertically-aligned-*` |
| `linkUrl` | `string \| null` | no | `null` | |
| `classes` | `ClassName[]` | no | `[]` | §7 |

Il divieto di annidamento è arbitrario ma motivato: nella sorgente c'è **una sola**
occorrenza, quindi non esiste un caso reale di annidamento; ammetterlo aprirebbe una
ricorsione che nessun contenuto usa e che l'editor dovrebbe comunque gestire.

### 3.7 `video`

**Non contiene blocchi.** **Origine:** `et_pb_video` (7).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `src` | `string`, URL assoluto o percorso `/media/...` | **sì** | — | `src` |
| `provider` | `'youtube'\|'vimeo'\|'file'\|'other'` | no | `'other'` | **derivata**, §3.7.1 |
| `posterMediaId` | `EntityRef \| null` | no | `null` | `image_src` risolto in media |
| `posterSrc` | `string \| null` | no | `null` | `image_src` non risolto |
| `classes` | `ClassName[]` | no | `[]` | §7 |

#### 3.7.1 Come si deriva `provider`

Regola deterministica, applicata sul nome di dominio in minuscolo:
`youtube.com` o `youtu.be` → `youtube`; `vimeo.com` → `vimeo`; percorso che comincia
con `/media/` → `file`; tutto il resto → `other`. La derivazione avviene **una volta**,
all'import, e il valore è conservato: ricalcolarlo alla lettura lo renderebbe
dipendente dalla versione della regola, e l'andata e ritorno ne risentirebbe.

### 3.8 `map`

**Non contiene blocchi.** **Origine:** `et_pb_map` (2) con `et_pb_map_pin` (2). I
segnaposto sono **proprietà della mappa, non blocchi** (`divi-shortcode-strategy.md`
§2).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `address` | `string` | **sì** | — | `address` |
| `lat` | `string` regex `^-?\d+(\.\d+)?$` | **sì** | — | `address_lat` |
| `lng` | `string` stessa regex | **sì** | — | `address_lng` |
| `zoom` | `number` intero 1..21 `\| null` | no | `null` | `zoom_level` se presente |
| `mouseWheel` | `boolean` | no | `false` | `mouse_wheel` |
| `mobileDragging` | `boolean` | no | `false` | `mobile_dragging` |
| `grayscale` | `boolean` | no | `false` | `use_grayscale_filter` |
| `grayscaleAmount` | `number` 0..100 `\| null` | no | `null` | `grayscale_filter_amount` |
| `pins` | `Array<{ title: string \| null, lat, lng, html: string \| null }>` | no | `[]` | `et_pb_map_pin` |
| `classes` | `ClassName[]` | no | `[]` | §7 |

**Arbitrario, e dichiarato:** latitudine e longitudine restano **stringhe**, non
numeri. Un numero in virgola mobile letto e riscritto può cambiare di una cifra
decimale — `9.1900000000000004` — e questo farebbe fallire l'andata e ritorno su un
contenuto che nessuno ha toccato. Il valore non serve a fare aritmetica: serve a essere
riconsegnato identico.

`pins[].html` passa dalla sanificazione del §5, come `rich_text`.

### 3.9 `separator`

**Non contiene blocchi.** **Origine:** `wp:separator` (5), `<hr>` dentro l'HTML.

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `style` | `'default'\|'wide'\|'dots'` | no | `'default'` | classi `is-style-wide`, `is-style-dots` di Gutenberg |
| `classes` | `ClassName[]` | no | `[]` | §7 |

### 3.10 `form`

**Non contiene blocchi.** **Origine:** `wp:wpforms/form-selector` (23),
`et_pb_contact_form` (1).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `formId` | `EntityRef` | **sì** | — | riga di `forms` |
| `origin` | `'wpforms' \| 'divi'` | **sì** | — | quale delle due famiglie |
| `showTitle` | `boolean` | no | `false` | `displayTitle` |
| `showDescription` | `boolean` | no | `false` | `displayDesc` |
| `classes` | `ClassName[]` | no | `[]` | §7 |

Il blocco **non** contiene la definizione dei campi: i form sono dati e stanno in
`forms` (ADR-010 §4.1). Il blocco contiene un riferimento e due preferenze di resa.
Nulla del pagamento entra qui: DR-039 lo colloca dopo l'invio, nella resa pubblica, e
il rimando è configurabile **per form**, quindi appartiene a `forms`.

`origin` esiste perché il form Divi e i 23 WPForms hanno definizioni di forma diversa,
e la resa deve sapere quale sta leggendo senza interrogare il database.

### 3.11 `post_list`

**Non contiene blocchi.** **Origine:** `[catposts]` (1 occorrenza).

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `termIds` | `EntityRef[]` | no | `[]` | categoria indicata nello shortcode |
| `limit` | `number` intero 1..50 `\| null` | no | `null` | parametro di numero |
| `showThumbnail` | `boolean` | no | `true` | |
| `showDate` | `boolean` | no | `true` | |
| `showExcerpt` | `boolean` | no | `true` | |
| `order` | `'date_desc'\|'date_asc'\|'title_asc'` | no | `'date_desc'` | |
| `classes` | `ClassName[]` | no | `[]` | §7 |

**Non so** quali parametri porti davvero l'unica occorrenza: nessun documento di Fase
1A o 1B li trascrive. I valori predefiniti qui sopra sono quelli del comportamento
abituale del widget, e vanno **verificati sulla singola occorrenza** in `1D-W3`. Un
parametro presente e non riconosciuto produce una riga `import_issues` di gravità
`warning`, non un valore inventato.

### 3.12 `document`

**Non contiene blocchi.** **Origine:** `[doc]` (1), `wpdmpro`.

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `documentId` | `EntityRef` | **sì** | — | riga di `documents` |
| `label` | `string \| null` | no | `null` | `__wpdm_link_label` |
| `display` | `'link' \| 'button' \| 'card'` | no | `'link'` | forma di resa nella sorgente |
| `classes` | `ClassName[]` | no | `[]` | §7 |

I 4 documenti riservati (`cuar_private_file`) **non compaiono in alcun blocco**: non
sono referenziati da alcun contenuto pubblico, e un blocco che li referenziasse
renderebbe visibile la loro esistenza (ADR-004 §3.6).

### 3.13 `slider`

**Non contiene blocchi.** **Origine:** Slider Revolution, 1 carosello, 12 slide.

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `sliderId` | `EntityRef` | **sì** | — | riga di `sliders` |
| `classes` | `ClassName[]` | no | `[]` | §7 |

Le slide stanno in `slider_slides`, non nel blocco: sono modificabili come dati
(`wp-to-postgres-mapping.md` §8) e un carosello può comparire in più contenuti.

### 3.14 `html` — il blocco di riserva

**Non contiene blocchi.** **Origine:** `wp:html` (6), più i frammenti che la
conversione non rappresenta fedelmente.

| Proprietà | Tipo | Obbl. | Predefinito | Origine |
|---|---|---|---|---|
| `html` | `string` non vuota | **sì** | — | frammento originale, **non** sanificato dal §5 |
| `reason` | enum, §3.14.1 | **sì** | — | scritto dal convertitore |
| `detail` | `string \| null`, max 200 caratteri, **mai contenuto** | no | `null` | nome del modulo o dello shortcode non rappresentato |
| `classes` | `ClassName[]` | no | `[]` | §7 |

#### 3.14.1 I motivi ammessi

```
wp_html_block        il contenuto nasceva già come blocco HTML di Gutenberg
divi_unmapped_module un modulo Divi senza blocco corrispondente
divi_unmapped_markup markup dentro un et_pb_text che l'elenco chiuso non ammette
shortcode_unknown    uno shortcode non riconosciuto che produce testo visibile
manual               inserito da una persona nell'area amministrativa
```

ADR-005 §3.3 regola 4 chiede che ogni uso sia «contato e motivato»: `reason` è la
motivazione, e `detail` dice **quale** costrutto, senza riportarne il contenuto.

#### 3.14.2 Che cosa viene rimosso anche qui

Il blocco di riserva conserva la fedeltà, **non** il pericolo. Anche dentro `html` si
rimuovono sempre, con una riga `import_issues` di gravità `error`:

`script`, `iframe`, `object`, `embed`, `form`, `style` come elemento, e ogni attributo
`on*`.

ADR-005 §1.3 dichiara che nella sorgente non ce n'è nessuno. Se ne comparisse uno,
sarebbe un fatto nuovo e un `error` è la risposta giusta: l'import non si dichiara
riuscito e qualcuno deve guardarlo.

### 3.15 Riepilogo del contenimento

| Contenitore | Può contenere |
|---|---|
| radice del documento | `section`, `row`, e ogni blocco di contenuto |
| `section` | solo `row` |
| `row` | solo `column` |
| `column` | ogni blocco di contenuto |
| `media_text` | ogni blocco di contenuto **tranne** `media_text` |
| tutti gli altri | nulla: `children` è sempre `[]` |

La regola è espressa in Zod con un tipo ricorsivo e una verifica di ammissibilità
figlio per figlio. Un annidamento non ammesso **fa fallire** il documento: è il tipo di
errore che, senza vincolo, si accumula finché qualcuno apre una pagina e vede una
colonna dentro una colonna.

## 4. L'identificatore stabile

ADR-005 §3.1 chiede un identificatore «generato all'import e mai riassegnato», che
serva ai confronti, ai collegamenti a un'ancora e alla cronologia delle versioni.
`importer-spec.md` §2 principio 7 vieta «identificatori casuali non tracciati».

### 4.1 Come si genera all'import

Deterministico, derivato dalla **posizione nella sorgente** e non dalla posizione nel
risultato:

```
chiave = "<legacy_id del contenuto>#<offset iniziale>-<offset finale>#<tipo>"
id     = "b_" + primi 12 caratteri esadecimali di SHA-256(chiave)
```

Gli offset sono le posizioni, in byte, del costrutto dentro `post_content`.

| Caso | Che cosa si usa come intervallo |
|---|---|
| Un blocco che nasce da un costrutto solo | l'intervallo del costrutto |
| Paragrafi contigui fusi in un `rich_text` (`divi-shortcode-strategy.md` §4.1) | dall'inizio del primo alla fine dell'ultimo |
| Blocco sintetizzato, come un `rich_text` che raccoglie un contenuto HTML nudo | l'intero `post_content`, cioè `0-<lunghezza>` |

**Perché la posizione nella sorgente e non quella nel risultato.** Se l'identificatore
dipendesse dalla posizione nell'albero prodotto, una correzione al convertitore
cambierebbe tutti gli identificatori a valle, e la riesecuzione dell'import — che
`importer-spec.md` §6.2 prevede come normale — riassegnerebbe ciò che ADR-005 dice di
non riassegnare mai. Con la posizione nella sorgente, gli identificatori restano gli
stessi finché resta la stessa la sorgente.

### 4.2 Collisioni

Con 12 caratteri esadecimali lo spazio è 2^48. I blocchi previsti sono qualche
migliaio: la collisione è improbabile, non impossibile, e «improbabile» non è una
strategia. Si gestisce così, in modo deterministico: i blocchi si visitano in ordine di
documento; si tiene l'insieme degli identificatori già assegnati; alla prima collisione
si ricalcola su `chiave + "#2"`, poi `"#3"`, e così via. Stessa sorgente, stesso esito.

**Arbitrario, e dichiarato:** 12 caratteri. Più corti aumentano le collisioni, più
lunghi rendono illeggibile l'ancora `#b_...` nell'URL. Il prefisso `b_` serve a
garantire che l'identificatore cominci per lettera, come un identificatore HTML deve.

### 4.3 Blocchi creati nell'area amministrativa

Non hanno una sorgente, quindi non hanno una chiave deterministica: ricevono 6 byte da
un generatore crittografico, nello stesso formato. Non viola il principio 7 di
`importer-spec.md`, che riguarda l'importer: l'importer non genera mai un
identificatore casuale.

### 4.4 Che cosa succede alla riesecuzione

`importer-spec.md` §6.2 dice che i blocchi si rigenerano dalla sorgente. Con il §4.1,
rigenerarli produce gli stessi identificatori, quindi la rigenerazione è innocua sui
collegamenti a un'ancora. Resta vera la protezione del §6.3: un contenuto modificato
nel CMS non viene rigenerato affatto.

## 5. Sanificazione di `rich_text`

ADR-005 §3.5 dà l'elenco. Qui diventa una regola applicabile.

### 5.1 Elementi ammessi

```
p br hr div figure figcaption span
h2 h3 h4 h5 h6
ul ol li
strong b em i u s sub sup
a img
table thead tbody tr th td
```

Ventotto elementi. `h1` è escluso per ADR-005 §3.5: il titolo appartiene al template.

### 5.2 Attributi ammessi, **per elemento**

ADR-005 §3.5 dà un elenco unico di attributi. Applicarlo indistintamente a tutti gli
elementi ammetterebbe `href` su un `td` e `colspan` su un `a`. Qui l'elenco è
ristretto per elemento; è una restrizione, mai un ampliamento.

| Elemento | Attributi ammessi |
|---|---|
| tutti gli elementi ammessi | `id`, `class`, `title` |
| `a` | in più: `href`, `target`, `rel` |
| `img` | in più: `src`, `alt`, `width`, `height`, `loading` |
| `th`, `td` | in più: `colspan`, `rowspan` |
| tutti gli altri | nessuno in più |

`width` e `height` su `img` accettano solo cifre.

### 5.3 Valori ammessi negli URL

`href` e `src` accettano: `http:`, `https:`, `mailto:`, `tel:`, un percorso che
comincia con `/`, un'ancora che comincia con `#`. Tutto il resto — a cominciare da
`javascript:` e da `data:` — fa **rimuovere l'attributo** e produce una riga
`import_issues` di gravità `error`.

`target` accetta solo `_blank` e `_self`.

### 5.4 Che cosa succede a ciò che non è ammesso

| Caso | Che cosa accade | Riga in `import_issues` |
|---|---|---|
| **Attributo** non ammesso, incluso `style` | l'attributo si rimuove, l'elemento resta | `info`, con elemento e attributo. Per `style` il valore si registra a parte, perché ADR-005 §3.5 dice che se in 1E risultasse necessario si rientra convertendolo in classi |
| **Attributo** `data-start` e `data-end` | si rimuovono senza conteggio speciale | `info`. ADR-005 §1.3 li dichiara «residui di un incollaggio senza effetto» |
| **Elemento** non ammesso e **pericoloso** (`script`, `iframe`, `form`, `object`, `embed`, `style`, gestori `on*`) | si rimuove con tutto il suo contenuto | `error` |
| **Elemento** non ammesso e innocuo (per esempio `font`, `center`, `section` dentro un testo) | il frammento **non si sanifica**: l'intero blocco diventa un `html` con `reason = divi_unmapped_markup` | `warning`, con il nome dell'elemento |
| **Elemento** ammesso in posizione non valida (per esempio `li` fuori da una lista) | l'analizzatore conforme alla specifica lo ricolloca come farebbe un browser; l'esito è deterministico | nessuna |

La quarta riga è la scelta che conta, e va motivata. L'alternativa abituale — togliere
il tag e conservarne il contenuto — **cambia la resa in silenzio**: un `<center>`
rimosso sposta il testo a sinistra e nessuno se ne accorge finché non si guarda la
pagina. Preferire il blocco di riserva significa perdere l'editabilità di quel
frammento e guadagnare la certezza che la resa non cambi da sola; la soglia del §8
impedisce che questa preferenza diventi un'abitudine.

### 5.5 Quello che la sanificazione **non** fa

- Non aggiunge `rel="noopener"` ai collegamenti con `target="_blank"`. Sarebbe un
  miglioramento, non una parità, e i miglioramenti si dichiarano e si approvano (come
  WebP in ADR-004 §3.7). I browser attuali applicano comunque quel comportamento da sé.
- Non riscrive `b` in `strong`, né `i` in `em`: ADR-005 §3.5 li ammette **tutti e
  quattro**, e riscriverli farebbe fallire l'andata e ritorno su contenuti mai toccati.
- Non normalizza gli spazi bianchi, non riduce i ritorni a capo, non rientra il
  markup.
- Non riscrive i riferimenti ai media: è la fase 15 dell'import, un punto solo
  (ADR-004 §3.3).

### 5.6 Idempotenza

`sanifica(sanifica(x)) === sanifica(x)`, per ogni `x`. È una proprietà, non un
auspicio, e si prova come tale: la wave `1D-W1` genera casi che coprono tutto l'elenco
del §5.1, tutti gli attributi ammessi e non ammessi del §5.2, e i cinque casi del §5.4,
e verifica la proprietà su ciascuno. Senza idempotenza, il criterio 1D-36 non può
passare: il primo salvataggio cambierebbe il contenuto.

## 6. Serializzazione deterministica in `content_html`

ADR-005 §3.6 dice che `content_html` è una **cache** rigenerata a ogni salvataggio e
che, se diverge, hanno ragione i blocchi. ADR-005 §7 fa dipendere da essa il test di
andata e ritorno. Quindi la funzione deve essere totale, pura e deterministica.

### 6.1 Che cosa `content_html` è, e che cosa non è

**Non è il markup del sito pubblico.** Il sito rende i blocchi con i componenti React
di `packages/blocks` (ADR-006 §3.3). `content_html` serve alle tre cose che ADR-005
§3.6 elenca: ricerca full-text, generazione della meta description dai template SEO,
confronto meccanico fra due versioni.

Ne segue una regola: `content_html` porta il **testo** e l'**identità** dei blocchi,
non le loro proprietà di presentazione. Duplicare le proprietà dentro l'HTML
significherebbe tenerne due copie sincronizzate, e ADR-005 §3.6 avverte proprio di
questo. Le proprietà si confrontano su `blocks`, che è la verità.

`content_text` (`database-schema.md` §4.4) si ottiene da `content_html` togliendo i
tag e riducendo gli spazi: una funzione sola, applicata dopo.

### 6.2 Involucro di ogni tipo

Ogni blocco produce **esattamente un elemento**, con `class` e `id`.

| Tipo | Involucro | Contenuto |
|---|---|---|
| `section` | `<section class="blk blk-section" id="...">` | i figli |
| `row` | `<div class="blk blk-row" id="...">` | i figli |
| `column` | `<div class="blk blk-column" id="...">` | i figli |
| `media_text` | `<div class="blk blk-media-text" id="...">` | `<img>` se c'è `mediaId` o `src`, poi i figli |
| `rich_text` | `<div class="blk blk-text" id="...">` | `props.html` così com'è |
| `image` | `<figure class="blk blk-image" id="...">` | `<img alt="...">`, poi `<figcaption>` se c'è didascalia |
| `video` | `<div class="blk blk-video" id="..."></div>` | vuoto |
| `map` | `<div class="blk blk-map" id="...">` | l'indirizzo come testo, e i `title` dei segnaposto |
| `separator` | `<hr class="blk blk-separator" id="...">` | — |
| `form` | `<div class="blk blk-form" id="..."></div>` | vuoto |
| `post_list` | `<div class="blk blk-post-list" id="..."></div>` | vuoto |
| `document` | `<div class="blk blk-document" id="...">` | `label` se presente |
| `slider` | `<div class="blk blk-slider" id="..."></div>` | vuoto |
| `html` | `<div class="blk blk-raw" id="...">` | `props.html` così com'è |

Le classi del blocco (`props.classes`) si aggiungono all'attributo `class`, dopo le
due fisse, **nell'ordine in cui stanno nell'array**. L'ordine dell'array è quello
prodotto dal convertitore, quindi deterministico.

### 6.3 Le dodici regole di forma

Ognuna è arbitraria; ciò che non è arbitrario è che siano dodici e scritte.

1. Uscita in **UTF-8** senza marcatore di ordine dei byte; i ritorni a capo, dove ci
   sono, sono `\n`.
2. **Nessuno spazio bianco introdotto dal serializzatore**: nessun rientro, nessun
   ritorno a capo fra elementi. Uno spazio in più è un nodo di testo in più, e su
   elementi in linea si vede.
3. **Ordine degli attributi**: prima `class`, poi `id`, poi tutti gli altri in ordine
   crescente di nome secondo il valore dei caratteri. È un ordine **totale**: due
   serializzazioni dello stesso albero non possono differire.
4. I valori degli attributi sono **sempre fra doppi apici**, anche quando non
   servirebbero.
5. Dentro un valore di attributo si sostituiscono `&` con `&amp;`, `<` con `&lt;`, `"`
   con `&quot;`. Nient'altro.
6. Nel testo si sostituiscono `&` con `&amp;`, `<` con `&lt;`, `>` con `&gt;`.
   Nient'altro. `>` non sarebbe obbligatorio: lo si fa per simmetria e per non dover
   ricordare l'eccezione.
7. I caratteri non ASCII si scrivono **direttamente**, mai come entità numeriche: il
   documento è UTF-8.
8. Elementi vuoti — `br`, `hr`, `img` — si scrivono `<br>`, senza barra finale e senza
   tag di chiusura.
9. Ogni altro elemento ha **sempre** il tag di chiusura, anche quando è vuoto:
   `<div class="blk blk-form" id="b_..."></div>`.
10. Un attributo il cui valore è `null` **non si scrive**. Un array `classes` vuoto non
    produce classi aggiuntive, ma le due classi fisse ci sono sempre.
11. Il serializzatore **non sanifica**. `props.html` è già un punto fisso della
    sanificazione (vincolo del §3.4) e viene copiato così com'è. Sanificare due volte
    non guasterebbe, ma renderebbe la serializzazione dipendente dal sanificatore, e
    due funzioni accoppiate divergono.
12. Il serializzatore è **puro**: nessuna data, nessuna lingua, nessun valore casuale,
    nessuna lettura di configurazione. Stesso documento, stessa stringa, su qualunque
    macchina.

### 6.4 Come si prova

| Prova | Che cosa mostra |
|---|---|
| `serializza(d) === serializza(d)` su documenti generati a caso dagli schemi | determinismo |
| `serializza(analizza(serializza(d))) === serializza(d)` | stabilità rispetto a un giro di analisi |
| `serializza` eseguito con fuso orario e lingua di sistema diversi | purezza rispetto all'ambiente |
| Un documento con le stesse proprietà in ordine diverso nell'oggetto JavaScript | l'ordine delle chiavi dell'oggetto non influisce, perché l'ordine degli attributi è quello della regola 3 |

## 7. Gli attributi di stile di Divi senza corrispondente

ADR-005 §3.3 regola 2: gli attributi di stile Divi che non hanno corrispondente «si
registrano nel rapporto di import e diventano, se necessari alla resa, **classi
dichiarate** — mai stile in linea generato automaticamente».

### 7.1 I tre destini di un attributo Divi

| Destino | Criterio | Che cosa succede |
|---|---|---|
| **Proprietà tipizzata** | l'attributo è nell'elenco conservato di `divi-shortcode-strategy.md` §3.1 | diventa una delle proprietà del §3 di questo documento |
| **Scartato** | l'attributo è nell'elenco di `divi-shortcode-strategy.md` §3.2 | si ignora, senza riga di anomalia: è già stato deciso che non produce resa |
| **Sconosciuto** | non è in nessuno dei due elenchi | **non si importa**, e produce una riga `import_issues` di gravità `warning` con modulo e nome dell'attributo. Mai stile in linea, mai una proprietà inventata |

La terza riga è la regola che protegge: senza, un attributo nuovo entrerebbe come
stringa in un campo generico e nessuno saprebbe più da dove viene.

### 7.2 Il vocabolario chiuso delle classi

`props.classes` accetta **solo** questi nomi. È un vocabolario, non uno spazio libero;
allargarlo è una modifica a questo documento, quindi un fatto visibile.

| Classe | Significato | Da quale attributo Divi |
|---|---|---|
| `is-fullwidth` | occupa l'intera larghezza | `make_fullwidth`, `force_fullwidth` |
| `has-parallax` | sfondo con parallasse | `parallax` |
| `has-inner-shadow` | ombra interna | `inner_shadow` |
| `has-transparent-bg` | sfondo trasparente dichiarato | `transparent_background` |
| `text-light` / `text-dark` | testo chiaro o scuro su sfondo | `background_layout` |
| `align-left` / `align-center` / `align-right` / `align-justify` | allineamento del testo | `text_orientation` |
| `center-on-mobile` | centrato sotto la soglia mobile | `always_center_on_mobile` |
| `in-lightbox` | l'immagine apre l'ingranditore | `show_in_lightbox` |
| `map-grayscale` | mappa in scala di grigi | `use_grayscale_filter` |

Alcune di queste informazioni sono **anche** proprietà tipizzate: `is-fullwidth` e
`fullWidth`, per esempio. È voluto. La proprietà è il dato; la classe è il gancio per il
CSS che la Fase 1E scriverà. Chi produce l'albero scrive entrambe, e una verifica in
`1D-W1` controlla che non si contraddicano.

### 7.3 Il punto che **non** decido: le spaziature

`custom_padding` porta valori arbitrari per modulo. Un vocabolario chiuso di classi non
li esprime. Le strade sono tre e non sono equivalenti:

| | Strada | Che cosa si perde, che cosa si guadagna |
|---|---|---|
| A | Le spaziature diventano classi da una **scala di token** (`pad-sm`, `pad-md`…), arrotondando i valori della sorgente | Si rispetta ADR-005 alla lettera. Si perde fedeltà: un `54px` arrotondato a `48px` sposta il contenuto, e la parità si misura al pixel |
| B | Stile in linea vero e proprio, `style="padding-top:54px"` | Fedeltà piena. **Viola ADR-005 §3.3 regola 2** in modo esplicito |
| C | Solo **proprietà personalizzate CSS** sul contenitore, `style="--blk-pad-top:54px"`, con le regole che le usano nel foglio di stile | Fedeltà piena, e la presentazione resta dichiarata in un punto solo. Resta formalmente un attributo `style`, quindi la regola va riformulata invece che aggirata |

**Raccomandazione: C.** Una proprietà personalizzata è un valore, non una regola: la
decisione su *come* dipingere resta nel foglio di stile, che è ciò che ADR-005 vuole
proteggere. Ma è una riformulazione della regola, e riformulare una regola approvata
non è compito mio.

**Impatto sulla wave `1D-W1`: nessuno.** Il modello conserva comunque il valore in
`padding`; come venga dipinto è lavoro della Fase 1E, dove il CSS si estrae dal reso
(`divi-shortcode-strategy.md` §6). Impatto sulla formulazione del criterio di uscita:
finché non è deciso, il divieto si enuncia come «nessuna **dichiarazione** CSS in
linea in `content_html`», che con le regole del §6.2 è comunque vero, perché
`content_html` non porta proprietà di presentazione.

## 8. Come si contano i blocchi di riserva

ADR-005 §3.4: «i blocchi `html` non devono superare il **10% dei blocchi non
contenitori** e non devono comparire su più di **15 contenuti su 108**».

### 8.1 Il denominatore

Blocchi **non contenitori** = tutti i blocchi il cui tipo non è fra i quattro che
ADR-005 §3.2 marca «Contenitore: sì», cioè non è `section`, `row`, `column`,
`media_text`.

Si adotta la lettura **letterale della tabella di ADR-005**, che esclude anche
`media_text`. È la lettura più severa, perché riduce il denominatore e quindi alza la
percentuale: una scelta che non può nascondere un problema. Con **una sola** occorrenza
di `media_text` in tutto il sito, la differenza fra le due letture è irrilevante nei
fatti, e questo va detto per non far sembrare importante ciò che non lo è.

### 8.2 Il numeratore

Tutti i blocchi di tipo `html`, **compresi** quelli con `reason = wp_html_block`.

`divi-shortcode-strategy.md` §5 osserva che i contenuti Gutenberg non usano il blocco
di riserva «se non per `wp:html`, che nasce già come tale». Si potrebbe leggerlo come
un'esenzione. Non la si applica: ADR-005 §3.4 dice «i blocchi `html`», senza eccezioni,
e una soglia con un'esenzione è una soglia più debole. Il rapporto stampa comunque la
**scomposizione per motivo**, così chi legge distingue i 6 nativi dai frammenti non
convertiti.

### 8.3 Le due misure

```
percentuale       = blocchi_html / blocchi_non_contenitori * 100
contenuti_toccati = numero di contents con almeno un blocco html
```

| Misura | Soglia | Si supera se |
|---|---|---|
| percentuale | 10% | il valore **non arrotondato** supera 10 |
| contenuti toccati | 15 su 108 | il conteggio è 16 o più |

Il valore si stampa arrotondato a un decimale, ma il confronto usa il valore pieno:
un 10,04% arrotondato a 10,0 passerebbe una soglia che ha superato.

### 8.4 Dove e quando si misura

Si misura su **tutti** i contenuti importati, non su un campione, e in entrambi i modi
di esecuzione: anche `plan` la calcola, perché la conversione avviene comunque. Il
risultato finisce in tre posti: il rapporto a terminale, `import_runs.summary`, e
l'esito dell'esecuzione — se una delle due soglie è superata, l'esito **non** è
`success` (`importer-spec.md` §8.2).

I blocchi `html` annidati dentro un `media_text` si contano come tutti gli altri: il
conteggio visita l'albero per intero.

### 8.5 Che cosa fare se la soglia è superata

ADR-005 §3.4 dice che «la conversione non ha funzionato e va rivista **prima** della
Fase 1E». Non è un difetto da correggere in silenzio: cambiare la soglia sarebbe
cambiare la decisione. Si porta all'utente, con la scomposizione per motivo e per
contenuto, ed è la conferma numero 6 del §7 di [`PLAN.md`](PLAN.md).

## 9. Assunzioni vietate e decisioni richieste

1. **Le spaziature di Divi e il divieto di stile in linea** — §7.3. Raccomandazione C,
   non applicabile senza una riformulazione di ADR-005 §3.3 regola 2. **Non blocca la
   `1D-W1`**; va decisa entro l'inizio della Fase 1E. **Default vietato.**

2. **L'insieme chiuso dei valori di `column.width`** — §3.3. Oggi è un'espressione
   regolare perché nessun documento elenca i valori `type` presenti nella sorgente. Si
   misura in `1D-W3` e l'enumerazione si scrive qui: non è una decisione dell'utente,
   è un fatto da rilevare, ed è segnato perché non venga dimenticato.

3. **I parametri reali di `[catposts]`** — §3.11. I valori predefiniti proposti vanno
   verificati sull'unica occorrenza, in `1D-W3`. Anche questo è un fatto da rilevare,
   non una decisione; finché non è rilevato, i predefiniti qui sopra sono un'ipotesi
   dichiarata.

Nessun'altra scelta di questo documento richiede l'intervento dell'utente: tutto il
resto discende da ADR-005, ADR-006, ADR-004 e dalle misure di `1B-W0`.
