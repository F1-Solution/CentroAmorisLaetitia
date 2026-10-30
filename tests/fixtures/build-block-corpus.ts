/**
 * Genera `tests/fixtures/block-corpus.json`, il corpus **sintetico** su cui si
 * esegue l'andata e ritorno della wave `1D-W10`.
 *
 * Perché un file generato e non scritto a mano: la forma canonica di un
 * documento a blocchi è quella che `blockDocumentSchema` produce dopo aver
 * applicato i valori predefiniti, e quella di `rich_text` è quella che il
 * sanificatore restituisce. Scriverle a mano significherebbe indovinarle, e
 * una copia diverge al primo schema che cambia. Qui si dichiara il minimo e si
 * lascia a schema e sanificatore il compito di completarlo: il JSON che ne
 * esce è canonico per costruzione, e ogni test che lo carica lo riverifica.
 *
 * Il corpus copre **tutti e 14 i tipi** di ADR-005 §3.2, i contenitori
 * annidati, le classi del vocabolario chiuso, e i casi che rompono un'andata e
 * ritorno scritta male: entità HTML, accenti, emoji fuori dal piano base,
 * elementi vuoti, attributi da riordinare, e un blocco di riserva con markup
 * che non passa dal sanificatore.
 *
 * **Nessun dato reale**: testi inventati, dominio `esempio.invalid`.
 *
 * Si rigenera con:
 *
 *     pnpm --filter @amoris/importer exec tsx ../../tests/fixtures/build-block-corpus.ts
 */
import { writeFileSync } from 'node:fs';
import { blockDocumentSchema, sanitizeRichText } from '@amoris/blocks/model';

/** Identificativi stabili: il corpus deve essere riproducibile byte per byte. */
let counter = 0;
function nextId(): string {
  counter += 1;
  return `b_${counter.toString(16).padStart(12, '0')}`;
}

const MEDIA = '11111111-1111-4111-8111-111111111111';
const MEDIA_2 = '22222222-2222-4222-8222-222222222222';
const FORM = '33333333-3333-4333-8333-333333333333';
const DOCUMENT = '44444444-4444-4444-8444-444444444444';
const SLIDER = '55555555-5555-4555-8555-555555555555';
const TERM = '66666666-6666-4666-8666-666666666666';

type Raw = Record<string, unknown>;

const node = (type: string, props: Raw, children: Raw[] = []): Raw => ({
  type,
  id: nextId(),
  props,
  children,
});

/**
 * `rich_text` passa dal sanificatore prima di entrare nel corpus: lo schema
 * pretende che `html` sia un **punto fisso** della sanificazione (§3.4), e le
 * entità che un browser normalizza — `&quot;` diventa una virgoletta vera —
 * non si indovinano a mano.
 */
const richText = (html: string, props: Raw = {}): Raw => {
  const outcome = sanitizeRichText(html);
  if (!outcome.ok) throw new Error(`markup non ammesso nel corpus: ${outcome.element}`);
  return node('rich_text', { html: outcome.html, ...props });
};

const column = (width: string, children: Raw[]): Raw => node('column', { width }, children);
const row = (columns: Raw[]): Raw =>
  node(
    'row',
    { columnStructure: columns.map((c) => (c.props as { width: string }).width).join(',') },
    columns,
  );
const section = (rows: Raw[], props: Raw = {}): Raw => node('section', props, rows);

interface CorpusEntry {
  readonly name: string;
  readonly slug: string;
  readonly why: string;
  readonly document: unknown;
}

const entries: CorpusEntry[] = [];
function add(name: string, slug: string, why: string, blocks: Raw[]): void {
  entries.push({ name, slug, why, document: blockDocumentSchema.parse({ schema: 1, blocks }) });
}

add(
  'contenitori annidati',
  'corpus-contenitori',
  'sezione, riga, colonna, testo: la catena che ogni contenuto importato produce',
  [
    section([
      row([
        column('1_2', [richText('<p>Colonna di sinistra.</p>')]),
        column('1_2', [richText('<p>Colonna di destra.</p>')]),
      ]),
      row([column('4_4', [node('separator', { style: 'wide' })])]),
    ]),
  ],
);

add(
  'testo ricco con quello che rompe una serializzazione',
  'corpus-testo-ricco',
  'entità, accenti, emoji a quattro byte, elementi vuoti, attributi da ordinare',
  [
    richText(
      '<p>Virgolette &quot;dritte&quot;, &amp; commerciale, &lt;minore&gt;, accenti perché città, emoji \u{1F389}.</p>' +
        '<p>Un <strong>grassetto</strong> con <em>corsivo</em> e un <a href="https://esempio.invalid/pagina" rel="noopener" target="_blank">collegamento</a>.</p>' +
        '<ul><li>Primo</li><li>Secondo</li></ul>' +
        '<p>Interruzione<br>di riga.</p>',
      { textAlign: 'justify', classes: ['align-justify'] },
    ),
    richText('<h2>Titolo di sezione</h2><p>Un secondo paragrafo.</p>', {
      backgroundLayout: 'dark',
      classes: ['text-dark'],
    }),
  ],
);

add(
  'immagine',
  'corpus-immagine',
  'riferimento a un media, e classi dichiarate coerenti con le proprietà',
  [
    node('image', {
      mediaId: MEDIA,
      alt: 'Fotografia di prova',
      caption: 'Didascalia con & entità',
      variant: '800x600',
      align: 'center',
      lightbox: true,
      centerOnMobile: true,
      classes: ['center-on-mobile', 'in-lightbox'],
      useMediaCaption: false,
    }),
    node('image', { src: '/media/2026/01/senza-media-id.png', alt: '' }),
  ],
);

add('media e testo', 'corpus-media-testo', 'il contenitore che è anche blocco di contenuto', [
  node(
    'media_text',
    {
      mediaId: MEDIA_2,
      mediaAlt: 'Illustrazione',
      mediaPosition: 'right',
      mediaWidthPercent: 40,
      verticalAlignment: 'top',
    },
    [richText('<p>Testo accanto al media.</p>'), node('separator', {})],
  ),
]);

add('video', 'corpus-video', 'due fornitori e il poster, nelle due forme', [
  node('video', {
    src: 'https://www.youtube.com/watch?v=esempio',
    provider: 'youtube',
    posterMediaId: MEDIA,
  }),
  node('video', {
    src: '/media/2026/01/filmato.mp4',
    provider: 'file',
    posterSrc: '/media/2026/01/poster.jpg',
  }),
]);

add('mappa', 'corpus-mappa', 'coordinate come stringhe, segnaposto, classe in scala di grigi', [
  node('map', {
    address: 'Via di Prova 1, Città di Esempio',
    lat: '43.123456',
    lng: '-12.654321',
    zoom: 14,
    grayscale: true,
    grayscaleAmount: 80,
    classes: ['map-grayscale'],
    pins: [
      { title: 'Sede', lat: '43.123456', lng: '-12.654321', html: '<p>Ingresso principale</p>' },
    ],
  }),
]);

add('separatori', 'corpus-separatori', 'i tre stili', [
  node('separator', { style: 'default' }),
  node('separator', { style: 'wide' }),
  node('separator', { style: 'dots' }),
]);

add(
  'modulo, elenco, documento, carosello',
  'corpus-riferimenti',
  'i quattro blocchi che puntano a un altra entità',
  [
    node('form', { formId: FORM, origin: 'wpforms', showTitle: true }),
    node('post_list', { termIds: [TERM], limit: 5, order: 'title_asc' }),
    node('document', { documentId: DOCUMENT, label: 'Scarica il modulo', display: 'button' }),
    node('slider', { sliderId: SLIDER }),
  ],
);

add(
  'blocco di riserva',
  'corpus-riserva',
  'il markup che non passa dal sanificatore resta tale e quale',
  [
    node('html', {
      html: '<div class="legacy-widget" data-x="1"><span>Frammento conservato</span></div>',
      reason: 'divi_unmapped_module',
      detail: 'et_pb_sconosciuto',
    }),
  ],
);

add(
  'sezione a piena larghezza',
  'corpus-sezione-piena',
  'le proprietà booleane e le classi che devono concordare',
  [
    section([row([column('4_4', [richText('<p>Contenuto.</p>')])])], {
      fullWidth: true,
      parallax: true,
      innerShadow: true,
      transparentBackground: true,
      backgroundColor: 'rgba(12, 34, 56, 0.5)',
      customWidth: { mode: 'percent', value: 80 },
      padding: {
        base: { top: '10px', right: null, bottom: '2rem', left: null },
        tablet: null,
        phone: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      },
      classes: ['has-inner-shadow', 'has-parallax', 'has-transparent-bg', 'is-fullwidth'],
    }),
  ],
);

add(
  'documento vuoto',
  'corpus-vuoto',
  'il caso limite: nessun blocco, e deve restare nessun blocco',
  [],
);

writeFileSync(
  new URL('./block-corpus.json', import.meta.url),
  JSON.stringify({ generatedBy: 'tests/fixtures/build-block-corpus.ts', entries }, null, 2) + '\n',
  'utf8',
);
console.log(`corpus scritto: ${entries.length} documenti`);
