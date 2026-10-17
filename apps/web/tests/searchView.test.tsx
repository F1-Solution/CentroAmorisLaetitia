import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SearchView, searchHref } from '../src/components/Views';

/** Ricerca del sito pubblico (DR-144): indirizzi e resa come la sorgente. Dati sintetici. */

const empty = { items: [], media: {}, meta: { total: 0, page: 1, perPage: 5 } };

describe('ricerca del sito pubblico (DR-144)', () => {
  it('le pagine dei risultati hanno gli indirizzi di WordPress', () => {
    expect(searchHref('corso', 1)).toBe('/?s=corso');
    expect(searchHref('corso consulenti', 3)).toBe('/page/3/?s=corso+consulenti');
  });

  it('senza risultati mostra il testo del tema, con la barra laterale', () => {
    const html = renderToStaticMarkup(<SearchView query="zzz" posts={empty} page={1} />);
    expect(html).toContain('<h1 class="not-found-title">Nessun risultato</h1>');
    expect(html).toContain('id="sidebar"');
  });

  it('con più pagine rimanda alla successiva con «Post precedenti»', () => {
    const posts = {
      items: [
        {
          id: 'a',
          path: '/articolo-sintetico/',
          title: 'Articolo sintetico',
          excerpt: null,
          summary: null,
          textStart: 'Testo sintetico',
          featuredMediaId: null,
          publishedAt: '2026-01-01T10:00:00Z',
        },
      ],
      media: {},
      meta: { total: 6, page: 1, perPage: 5 },
    };
    const html = renderToStaticMarkup(<SearchView query="sintetico" posts={posts} page={1} />);
    expect(html).toContain('href="/page/2/?s=sintetico"');
    expect(html).not.toContain('Post successivi');
  });
});
