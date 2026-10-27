import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { blockDocumentSchema, type BlockDocument } from '@amoris/blocks';
import type { PublicContent } from '../src/lib/api';
import {
  ArchiveView,
  ContentView,
  DocumentView,
  DownloadCategoryView,
} from '../src/components/Views';

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

describe('scheda del pacchetto nei download (D75)', () => {
  const html = renderToStaticMarkup(
    <DocumentView
      document={{
        id: 'doc-1',
        slug: 'modulo-sintetico',
        title: 'Modulo sintetico',
        description: null,
        mediaId: 'm-1',
        updatedAt: '2026-10-16T09:00:00Z',
        publishedAt: '2022-04-05T10:00:00Z',
        modifiedAt: null,
        byteSize: 103209,
      }}
      media={{
        'm-1': {
          id: 'm-1',
          publicPath: '/media/modulo-sintetico.pdf',
          mimeType: 'application/pdf',
          width: null,
          height: null,
          title: null,
          altText: null,
          caption: null,
          variants: [],
        },
      }}
    />,
  );

  it('mostra pulsante, dimensione, numero di file e date come Download Manager', () => {
    expect(html).toContain('href="/media/modulo-sintetico.pdf"');
    expect(html).toContain('100.79 KB');
    expect(html).toContain('5 Aprile 2022');
    expect(html).toContain('<span class="published">5 Apr 2022</span>');
  });

  it('prova negativa: nessun contatore dei download', () => {
    expect(html).not.toMatch(/>\s*Download\s*<span/);
    expect(html.match(/list-group-item/g)).toHaveLength(4);
  });
});

describe('categoria dei download (DR-181)', () => {
  const documento = (n: number, giorno: string) => ({
    id: `doc-${n}`,
    slug: `modulo-sintetico-${n}`,
    title: `Modulo sintetico ${n}`,
    description: null,
    mediaId: `m-${n}`,
    updatedAt: '2026-10-16T09:00:00Z',
    publishedAt: giorno,
    byteSize: 1000,
  });
  const html = renderToStaticMarkup(
    <DownloadCategoryView
      term={{
        id: 't-1',
        taxonomy: 'wpdmcategory',
        slug: 'moduli-sintetici',
        name: 'Moduli sintetici',
        path: '/download-category/moduli-sintetici/',
      }}
      documents={[documento(2, '2022-04-05T10:00:00Z'), documento(1, '2022-04-04T10:00:00Z')]}
    />,
  );

  it('un articolo del tema per documento, con titolo collegato e data, nell’ordine ricevuto', () => {
    expect(html.match(/<article /g)).toHaveLength(2);
    expect(html).toContain(
      '<h2 class="entry-title"><a href="/download/modulo-sintetico-2/">Modulo sintetico 2</a></h2>',
    );
    expect(html).toContain('<p class="post-meta"><span class="published">5 Apr 2022</span></p>');
    expect(html.indexOf('Modulo sintetico 2')).toBeLessThan(html.indexOf('Modulo sintetico 1'));
  });

  it('classi di Download Manager sugli articoli, come la sorgente', () => {
    expect(html).toContain(
      'class="et_pb_post wpdmpro type-wpdmpro status-publish hentry wpdmcategory-moduli-sintetici"',
    );
  });

  it('struttura dell’archivio del tema: colonna, titolo nascosto, paginazione vuota, filetto', () => {
    expect(html).toContain('id="left-area"');
    expect(html).toContain('<h1 class="screen-reader-text">Moduli sintetici</h1>');
    expect(html).toContain(
      '<div class="pagination clearfix"><div class="alignleft"></div><div class="alignright"></div></div>',
    );
    expect(html).toContain('id="sidebar"');
  });

  it('prova negativa: nessun estratto né immagine, come la sorgente', () => {
    expect(html).not.toContain('entry-featured-image-url');
    expect(html).not.toContain('<img');
  });

  it('categoria senza documenti: solo la struttura', () => {
    const vuota = renderToStaticMarkup(
      <DownloadCategoryView
        term={{
          id: 't-1',
          taxonomy: 'wpdmcategory',
          slug: 'vuota',
          name: 'Vuota',
          path: '/download-category/vuota/',
        }}
        documents={[]}
      />,
    );
    expect(vuota).not.toContain('<article');
    expect(vuota).toContain('id="left-area"');
  });
});

describe('archivio di categoria: estratto o inizio del testo (D139 = B, S10)', () => {
  const term = { id: 't', slug: 'cat', name: 'Categoria sintetica', path: '/category/cat/' };
  const post = (id: string, excerpt: string | null) => ({
    id,
    path: `/${id}/`,
    title: `Titolo ${id}`,
    excerpt,
    summary: null,
    textStart: `Inizio ${id}`,
    featuredMediaId: null,
    publishedAt: '2026-01-01T10:00:00Z',
  });
  const html = renderToStaticMarkup(
    <ArchiveView
      term={term}
      posts={{
        items: [post('con', 'Estratto <em>intero</em>\nsu due righe'), post('senza', null)],
        media: {},
        meta: { total: 2, page: 1, perPage: 6 },
      }}
      page={1}
    />,
  );

  it('chi ha l’estratto lo mostra intero in un paragrafo, a capo compreso', () => {
    expect(html).toContain('<p>Estratto intero<br/>su due righe</p>');
    expect(html).not.toContain('Inizio con');
  });

  it('chi non ce l’ha mostra l’inizio del testo, nudo come prima', () => {
    expect(html).toContain('</p>Inizio senza</article>');
  });
});

describe('pagina: titolo e immagine in evidenza scelti dall’area (DR-278)', () => {
  function pageWith(showTitle: boolean, featuredMediaId: string | null): string {
    const data = {
      content: {
        id: '55555555-5555-4555-8555-555555555555',
        type: 'page',
        path: '/pagina-sintetica/',
        slug: 'pagina-sintetica',
        title: 'Pagina sintetica',
        showTitle,
        pageLayout: 'right_sidebar',
        gutterWidth: null,
        excerpt: null,
        blocks: textOnly,
        featuredMediaId,
        publishedAt: '2026-01-02T10:00:00.000Z',
        updatedAt: '2026-01-02T10:00:00.000Z',
      },
      seo: {},
      terms: [],
      media: featuredMediaId
        ? {
            [featuredMediaId]: {
              id: featuredMediaId,
              publicPath: '/media/evidenza-sintetica.png',
              mimeType: 'image/png',
              width: 800,
              height: 600,
              title: null,
              altText: 'Evidenza sintetica',
              caption: null,
              variants: [],
            },
          }
        : {},
      sliders: {},
      forms: {},
      postLists: {},
      documents: {},
    } as unknown as PublicContent;
    return renderToStaticMarkup(<ContentView data={data} />);
  }

  it('titolo acceso: l’h1 visibile del tema', () => {
    expect(pageWith(true, null)).toContain(
      '<h1 class="entry-title main_title">Pagina sintetica</h1>',
    );
  });

  it('titolo spento: nessun h1 visibile, quello per i lettori di schermo', () => {
    const html = pageWith(false, null);
    expect(html).not.toContain('entry-title main_title');
    expect(html).toContain('<h1 class="screen-reader-text">Pagina sintetica</h1>');
  });

  it('immagine in evidenza: la pagina non la mostra nel testo (`divi_page_thumbnails` spento)', () => {
    const html = pageWith(true, '66666666-6666-4666-8666-666666666666');
    expect(html).not.toContain('evidenza-sintetica.png');
    expect(html).toBe(pageWith(true, null));
  });
});

describe('notizia: «Mostra il titolo» come Divi `single.php` (DR-286)', () => {
  function postWith(
    showTitle: boolean,
    blocks: BlockDocument,
    pageLayout = 'right_sidebar',
  ): string {
    const data = {
      content: {
        id: '77777777-7777-4777-8777-777777777777',
        type: 'post',
        path: '/notizia-sintetica/',
        slug: 'notizia-sintetica',
        title: 'Notizia sintetica',
        showTitle,
        pageLayout,
        gutterWidth: null,
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

  it('titolo acceso: titolo e data, a sezioni o no', () => {
    for (const html of [postWith(true, textOnly), postWith(true, diviSection)]) {
      expect(html).toContain('<h1 class="entry-title">Notizia sintetica</h1>');
      expect(html).toContain('class="post-meta"');
    }
  });

  /** Il titolo per i soli lettori di schermo (giro 2, nello spirito di DR-040). */
  const HIDDEN_H1 = '<h1 class="screen-reader-text">Notizia sintetica</h1>';
  const h1Count = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;

  it('notizia a sezioni con titolo spento: niente intestazione, un solo h1 per i lettori di schermo', () => {
    for (const layout of ['right_sidebar', 'full_width']) {
      const html = postWith(false, diviSection, layout);
      expect(html).not.toContain('et_post_meta_wrapper');
      expect(html).not.toContain('class="entry-title"');
      expect(h1Count(html)).toBe(1);
      expect(html).toContain(HIDDEN_H1);
    }
  });

  it('notizia senza sezioni con titolo spento: resta la data, il titolo solo per i lettori di schermo', () => {
    const html = postWith(false, textOnly);
    expect(html).toContain('class="post-meta"');
    expect(html).not.toContain('class="entry-title"');
    expect(h1Count(html)).toBe(1);
    expect(html).toContain(HIDDEN_H1);
  });

  it('il resto della notizia non cambia: l’intestazione diventa il solo h1 nascosto', () => {
    for (const layout of ['right_sidebar', 'full_width']) {
      const acceso = postWith(true, diviSection, layout);
      const spento = postWith(false, diviSection, layout);
      expect(spento).toBe(
        acceso.replace(
          /(<div class="container">)?<div class="et_post_meta_wrapper">.*?<\/p><\/div>(<\/div>)?/,
          HIDDEN_H1,
        ),
      );
    }
  });

  it('prova negativa: se il contenuto ha già un h1, nessun h1 in più', () => {
    const conH1 = blockDocumentSchema.parse({
      schema: 1,
      blocks: [
        {
          type: 'html',
          id: 'b_000000000009',
          props: { html: '<h1>Titolo nel testo</h1>', reason: 'manual' },
          children: [],
        },
      ],
    });
    const html = postWith(false, conH1);
    expect(h1Count(html)).toBe(1);
    expect(html).not.toContain('screen-reader-text');
  });

  it('titolo acceso: nessun h1 nascosto in più', () => {
    expect(postWith(true, diviSection)).not.toContain('screen-reader-text');
  });
});
