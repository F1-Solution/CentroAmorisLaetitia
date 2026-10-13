import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { blockDocumentSchema, type BlockDocument } from '@amoris/blocks';
import type { PublicContent } from '../src/lib/api';
import { ContentView } from '../src/components/Views';

/**
 * Layout della pagina come `_et_pb_page_layout` della sorgente (DR-139, famiglia
 * G della `1E-W6`): la barra laterale c'è solo con `right_sidebar`, per pagine e
 * articoli; gli articoli Divi a tutta larghezza hanno le sezioni da bordo a
 * bordo. Dati sintetici.
 */

const textOnly: BlockDocument = blockDocumentSchema.parse({
  schema: 1,
  blocks: [
    {
      type: 'rich_text',
      id: 'b_000000000001',
      props: { html: '<p>Testo sintetico.</p>' },
      children: [],
    },
  ],
});

const diviSection: BlockDocument = blockDocumentSchema.parse({
  schema: 1,
  blocks: [
    {
      type: 'section',
      id: 'b_000000000002',
      props: {},
      children: [],
    },
  ],
});

function view(
  type: 'page' | 'post',
  pageLayout: 'right_sidebar' | 'full_width' | 'no_sidebar',
  blocks: BlockDocument = textOnly,
): string {
  const data = {
    content: {
      id: '44444444-4444-4444-8444-444444444444',
      type,
      path: '/sintetico/',
      slug: 'sintetico',
      title: 'Titolo sintetico',
      showTitle: true,
      pageLayout,
      excerpt: null,
      blocks,
      featuredMediaId: null,
      publishedAt: '2026-01-02T10:00:00.000Z',
      updatedAt: '2026-01-02T10:00:00.000Z',
    },
    seo: {},
    terms: [],
    media: {},
    sliders: {},
    forms: {},
    postLists: {},
    documents: {},
  } as unknown as PublicContent;
  return renderToStaticMarkup(<ContentView data={data} />);
}

describe('barra laterale per contenuto (DR-139)', () => {
  it('articolo con barra a destra: la barra c’è', () => {
    expect(view('post', 'right_sidebar')).toContain('id="sidebar"');
  });

  it('articolo a tutta larghezza o senza barra: la barra non c’è', () => {
    expect(view('post', 'full_width')).not.toContain('id="sidebar"');
    expect(view('post', 'no_sidebar')).not.toContain('id="sidebar"');
  });

  it('pagina con barra a destra: la barra c’è, come nella sorgente', () => {
    expect(view('page', 'right_sidebar')).toContain('id="sidebar"');
    expect(view('page', 'full_width')).not.toContain('id="sidebar"');
  });
});

describe('articoli costruiti con Divi (DR-139)', () => {
  it('a tutta larghezza: sezioni fuori dal contenitore, titolo nel proprio riquadro', () => {
    const html = view('post', 'full_width', diviSection);
    expect(html).not.toContain('id="left-area"');
    expect(html).toContain('class="et_post_meta_wrapper"');
    expect(html).toContain('Titolo sintetico');
  });

  it('con barra o senza: dentro la colonna, con le righe a tutta colonna', () => {
    for (const layout of ['right_sidebar', 'no_sidebar'] as const) {
      const html = view('post', layout, diviSection);
      expect(html).toContain('id="left-area"');
      expect(html).toContain('data-builder="divi"');
    }
  });
});
