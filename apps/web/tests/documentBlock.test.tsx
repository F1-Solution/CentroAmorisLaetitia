import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { blockDocumentSchema, type BlockDocument } from '@amoris/blocks';
import type { PublicContent, PublicDocument } from '../src/lib/api';
import { ContentView } from '../src/components/Views';

/**
 * Wave 1G-W7, T2k (DR-287): il sito passa al blocco «Documento» i documenti pubblici della
 * lettura pubblica, in tutti i modelli di pagina; il blocco diventa un collegamento a
 * `/download/<slug>/`, e un documento che la lettura non restituisce (riservato o eliminato)
 * non lascia traccia nell'HTML. Dati sintetici.
 */

const PUBLIC_ID = '11111111-1111-4111-8111-111111111111';
const HIDDEN_ID = '22222222-2222-4222-8222-222222222222';

const publicDocument: PublicDocument = {
  id: PUBLIC_ID,
  slug: 'modulo-sintetico',
  title: 'Modulo sintetico di prova',
  description: null,
  mediaId: '33333333-3333-4333-8333-333333333333',
  updatedAt: '2026-01-02T10:00:00.000Z',
  publishedAt: '2026-01-02T10:00:00.000Z',
  modifiedAt: null,
  byteSize: 10,
};

const docBlocks = [
  {
    type: 'document',
    id: 'b_00000000d001',
    props: { documentId: PUBLIC_ID, label: null },
    children: [],
  },
  {
    type: 'document',
    id: 'b_00000000d002',
    props: { documentId: HIDDEN_ID, label: 'Etichetta riservata sintetica' },
    children: [],
  },
];

/** Gutenberg: i blocchi alla radice. */
const flat: BlockDocument = blockDocumentSchema.parse({ schema: 1, blocks: docBlocks });

/** Divi: gli stessi blocchi dentro sezione, riga e colonna. */
const divi: BlockDocument = blockDocumentSchema.parse({
  schema: 1,
  blocks: [
    {
      type: 'section',
      id: 'b_00000000d010',
      props: {},
      children: [
        {
          type: 'row',
          id: 'b_00000000d011',
          props: { columnStructure: '1_1' },
          children: [
            {
              type: 'column',
              id: 'b_00000000d012',
              props: { width: '1_1' },
              children: docBlocks,
            },
          ],
        },
      ],
    },
  ],
});

/** Gutenberg: gli stessi blocchi dentro «media e testo» (giro 1 della T2k). */
const mediaText: BlockDocument = blockDocumentSchema.parse({
  schema: 1,
  blocks: [{ type: 'media_text', id: 'b_00000000d020', props: {}, children: docBlocks }],
});

function view(
  type: 'page' | 'post',
  pageLayout: 'full_width' | 'no_sidebar',
  blocks: BlockDocument,
) {
  const data = {
    content: {
      id: '44444444-4444-4444-8444-444444444444',
      type,
      path: '/sintetico/',
      slug: 'sintetico',
      title: 'Titolo sintetico',
      showTitle: true,
      pageLayout,
      gutterWidth: null,
      excerpt: null,
      blocks,
      featuredMediaId: null,
      publishedAt: '2026-01-02T10:00:00.000Z',
      updatedAt: '2026-01-02T10:00:00.000Z',
      modifiedAt: '2026-01-02T10:00:00.000Z',
    },
    seo: {},
    terms: [],
    media: {},
    sliders: {},
    forms: {},
    postLists: {},
    documents: { [PUBLIC_ID]: publicDocument },
  } as unknown as PublicContent;
  return renderToStaticMarkup(<ContentView data={data} />);
}

describe('blocco «Documento» sul sito (DR-287)', () => {
  const cases = [
    ['pagina Gutenberg', view('page', 'no_sidebar', flat)],
    ['pagina Divi', view('page', 'no_sidebar', divi)],
    ['articolo Divi a tutta larghezza', view('post', 'full_width', divi)],
    ['articolo Gutenberg', view('post', 'no_sidebar', flat)],
    ['pagina con «media e testo»', view('page', 'no_sidebar', mediaText)],
    ['articolo con «media e testo»', view('post', 'no_sidebar', mediaText)],
  ] as const;

  for (const [name, html] of cases) {
    it(`${name}: il collegamento apre la scheda, il riservato non lascia traccia`, () => {
      expect(html).toContain('<a href="/download/modulo-sintetico/">Modulo sintetico di prova</a>');
      expect(html).not.toContain(HIDDEN_ID);
      expect(html).not.toContain('Etichetta riservata sintetica');
      expect(html).not.toContain('b_00000000d002');
    });
  }
});
