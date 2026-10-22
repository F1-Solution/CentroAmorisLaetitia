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

describe('estratto nei risultati (D139 = B, S10)', () => {
  const item = (over: Record<string, unknown>) => ({
    id: 'a',
    path: '/articolo-sintetico/',
    title: 'Articolo sintetico',
    excerpt: null as string | null,
    summary: null,
    textStart: 'Inizio automatico del testo',
    featuredMediaId: null,
    publishedAt: '2026-01-01T10:00:00Z',
    ...over,
  });
  const render = (items: ReturnType<typeof item>[]) =>
    renderToStaticMarkup(
      <SearchView
        query="x"
        posts={{ items, media: {}, meta: { total: items.length, page: 1, perPage: 5 } }}
        page={1}
      />,
    );

  it('con l’estratto lo mostra intero in un paragrafo al posto dell’inizio del testo', () => {
    const lungo = Array.from({ length: 120 }, (_, i) => `parola${i}`).join(' ');
    const html = render([item({ excerpt: lungo })]);
    expect(html).toContain(`<p>${lungo}</p>`);
    expect(html).not.toContain('Inizio automatico del testo');
    expect(html).not.toContain('...');
  });

  it('gli a capo diventano interruzioni, i tag si tolgono, le entità si decodificano', () => {
    const html = render([
      item({ excerpt: 'Prima riga &amp; più\nseconda <a href="/x/">riga</a>' }),
    ]);
    expect(html).toContain('<p>Prima riga &amp; più<br/>seconda riga</p>');
    expect(html).not.toContain('href="/x/"');
  });

  it('senza estratto, o con un estratto di soli spazi, resta l’inizio del testo nudo', () => {
    for (const excerpt of [null, '', ' \n ']) {
      const html = render([item({ excerpt })]);
      expect(html).toContain('</p>Inizio automatico del testo</article>');
      expect(html).not.toContain('<p>');
    }
  });

  it('vale per ogni risultato, comprese le pagine: ognuno col proprio estratto', () => {
    const html = render([
      item({ id: 'p', path: '/pagina-sintetica/', excerpt: 'Estratto della pagina' }),
      item({ id: 'n', excerpt: null }),
    ]);
    expect(html).toContain('<p>Estratto della pagina</p>');
    expect(html).toContain('Inizio automatico del testo');
  });
});
