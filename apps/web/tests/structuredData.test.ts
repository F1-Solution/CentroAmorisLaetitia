import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  imageFromMedia,
  serializeJsonLd,
  siteFromSettings,
  type GraphSite,
} from '../src/lib/structuredData';

/*
 * M1 (1E-W7, DR-170, DR-182, DR-185, DR-187, DR-188): un `@graph` per pagina con
 * la forma che All in One SEO 5.0.1.1 serve nella sorgente (misurata su
 * localhost:8088 il 2026-10-18), indirizzi assoluti da SITE_URL, nessuna `Person`.
 * Dati sintetici: dominio `.invalid`, indirizzo e telefono inventati.
 */

const BASE = 'https://sito.example.invalid';

const SITO: GraphSite = {
  url: BASE,
  name: 'Centro di prova',
  logo: null,
  address: '',
  telephone: '',
  sameAs: [],
};

type Nodo = Record<string, unknown>;

function nodi(grafo: { '@graph': readonly Nodo[] }, tipo: string): Nodo[] {
  return grafo['@graph'].filter((n) => n['@type'] === tipo);
}

function nodo(grafo: { '@graph': readonly Nodo[] }, tipo: string): Nodo {
  const trovati = nodi(grafo, tipo);
  expect(trovati, `un solo nodo ${tipo}`).toHaveLength(1);
  return trovati[0]!;
}

function tipi(valore: unknown, raccolti = new Set<string>()): Set<string> {
  if (Array.isArray(valore)) valore.forEach((v) => tipi(v, raccolti));
  else if (valore && typeof valore === 'object') {
    for (const [k, v] of Object.entries(valore)) {
      if (k === '@type') raccolti.add(String(v));
      else tipi(v, raccolti);
    }
  }
  return raccolti;
}

const pagina = {
  kind: 'webpage' as const,
  path: '/chi-siamo/',
  title: 'Chi siamo',
  name: 'Chi siamo - Centro di prova',
  description: null,
  datePublished: '2017-09-18T20:57:15.000Z',
  dateModified: '2018-10-09T14:42:35.000Z',
  image: null,
};

describe('nodi comuni a ogni pagina', () => {
  const grafo = buildGraph(SITO, pagina);

  it('contesto schema.org e un solo @graph', () => {
    expect(grafo['@context']).toBe('https://schema.org');
    expect(Array.isArray(grafo['@graph'])).toBe(true);
  });

  it('WebSite con url, nome, lingua it-IT ed editore verso l’organizzazione', () => {
    expect(nodo(grafo, 'WebSite')).toEqual({
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      url: `${BASE}/`,
      name: 'Centro di prova',
      inLanguage: 'it-IT',
      publisher: { '@id': `${BASE}/#organization` },
    });
  });

  it('Organization con solo nome e url se le impostazioni sono vuote (DR-185)', () => {
    expect(nodo(grafo, 'Organization')).toEqual({
      '@type': 'Organization',
      '@id': `${BASE}/#organization`,
      name: 'Centro di prova',
      url: `${BASE}/`,
    });
  });

  it('nessuna Person, mai (DR-182)', () => {
    expect(tipi(grafo).has('Person')).toBe(false);
    expect(JSON.stringify(grafo)).not.toMatch(/author|creator|gravatar/i);
  });
});

describe('Organization con i campi delle impostazioni (DR-185)', () => {
  const completo: GraphSite = {
    ...SITO,
    logo: { path: '/media/logo-sintetico.png', width: 300, height: 120, caption: null },
    address: 'Via Inventata 1, 00000 Città di prova',
    telephone: '+39 000 0000000',
    sameAs: ['https://social.example.invalid/centro'],
  };
  const org = nodo(buildGraph(completo, pagina), 'Organization');

  it('logo come ImageObject assoluto, con image che lo richiama', () => {
    expect(org.logo).toEqual({
      '@type': 'ImageObject',
      '@id': `${BASE}/#organizationLogo`,
      url: `${BASE}/media/logo-sintetico.png`,
      width: 300,
      height: 120,
    });
    expect(org.image).toEqual({ '@id': `${BASE}/#organizationLogo` });
  });

  it('indirizzo, telefono e profili', () => {
    expect(org.address).toBe('Via Inventata 1, 00000 Città di prova');
    expect(org.telephone).toBe('+39 000 0000000');
    expect(org.sameAs).toEqual(['https://social.example.invalid/centro']);
  });

  it('logo senza misure: width e height omessi', () => {
    const senzaMisure = nodo(
      buildGraph(
        { ...SITO, logo: { path: '/media/l.png', width: null, height: null, caption: null } },
        pagina,
      ),
      'Organization',
    );
    expect(senzaMisure.logo).toEqual({
      '@type': 'ImageObject',
      '@id': `${BASE}/#organizationLogo`,
      url: `${BASE}/media/l.png`,
    });
  });
});

describe('home', () => {
  const grafo = buildGraph(SITO, {
    ...pagina,
    path: '/',
    title: 'Home',
    name: 'Home - Centro di prova',
    description: 'Testo sintetico della home.',
  });

  it('briciole con il solo «Home», senza item', () => {
    expect(nodo(grafo, 'BreadcrumbList')).toEqual({
      '@type': 'BreadcrumbList',
      '@id': `${BASE}/#breadcrumblist`,
      itemListElement: [
        { '@type': 'ListItem', '@id': `${BASE}#listItem`, position: 1, name: 'Home' },
      ],
    });
  });

  it('WebPage con nome SEO, descrizione, date e riferimenti', () => {
    expect(nodo(grafo, 'WebPage')).toEqual({
      '@type': 'WebPage',
      '@id': `${BASE}/#webpage`,
      url: `${BASE}/`,
      name: 'Home - Centro di prova',
      description: 'Testo sintetico della home.',
      inLanguage: 'it-IT',
      isPartOf: { '@id': `${BASE}/#website` },
      breadcrumb: { '@id': `${BASE}/#breadcrumblist` },
      datePublished: '2017-09-18T20:57:15.000Z',
      dateModified: '2018-10-09T14:42:35.000Z',
    });
  });
});

describe('pagina', () => {
  it('briciole Home → pagina, con item solo sulla prima', () => {
    const briciole = nodo(buildGraph(SITO, pagina), 'BreadcrumbList');
    expect(briciole.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        '@id': `${BASE}#listItem`,
        position: 1,
        name: 'Home',
        item: BASE,
        nextItem: { '@type': 'ListItem', '@id': `${BASE}/chi-siamo/#listItem`, name: 'Chi siamo' },
      },
      {
        '@type': 'ListItem',
        '@id': `${BASE}/chi-siamo/#listItem`,
        position: 2,
        name: 'Chi siamo',
        previousItem: { '@type': 'ListItem', '@id': `${BASE}#listItem`, name: 'Home' },
      },
    ]);
  });

  it('senza immagine in evidenza: nessun ImageObject, nessuna descrizione vuota', () => {
    const grafo = buildGraph(SITO, pagina);
    expect(tipi(grafo).has('ImageObject')).toBe(false);
    expect(nodo(grafo, 'WebPage')).not.toHaveProperty('description');
    expect(nodo(grafo, 'WebPage')).not.toHaveProperty('image');
  });

  it('con immagine in evidenza: image con url, misure e didascalia, e primaryImageOfPage', () => {
    const webPage = nodo(
      buildGraph(SITO, {
        ...pagina,
        image: { path: '/media/famiglia.jpg', width: 736, height: 490, caption: 'Didascalia' },
      }),
      'WebPage',
    );
    expect(webPage.image).toEqual({
      '@type': 'ImageObject',
      '@id': `${BASE}/chi-siamo/#mainImage`,
      url: `${BASE}/media/famiglia.jpg`,
      width: 736,
      height: 490,
      caption: 'Didascalia',
    });
    expect(webPage.primaryImageOfPage).toEqual({ '@id': `${BASE}/chi-siamo/#mainImage` });
  });

  it('date assenti: non dichiarate', () => {
    const webPage = nodo(
      buildGraph(SITO, { ...pagina, datePublished: null, dateModified: null }),
      'WebPage',
    );
    expect(webPage).not.toHaveProperty('datePublished');
    expect(webPage).not.toHaveProperty('dateModified');
  });
});

describe('articolo', () => {
  const articolo = {
    kind: 'post' as const,
    path: '/notizia-sintetica/',
    title: 'Notizia sintetica',
    name: 'Notizia sintetica - Centro di prova',
    description: 'Estratto sintetico.',
    datePublished: '2026-02-09T21:29:13.000Z',
    dateModified: '2026-02-09T21:30:01.000Z',
    image: { path: '/media/locandina.jpg', width: 1414, height: 2000, caption: null },
    category: { name: 'News', path: '/category/news/' },
  };
  const grafo = buildGraph(SITO, articolo);

  it('BlogPosting senza autore, con editore, immagine, date e sezione (DR-182)', () => {
    expect(nodo(grafo, 'BlogPosting')).toEqual({
      '@type': 'BlogPosting',
      '@id': `${BASE}/notizia-sintetica/#blogposting`,
      name: 'Notizia sintetica - Centro di prova',
      headline: 'Notizia sintetica',
      publisher: { '@id': `${BASE}/#organization` },
      image: {
        '@type': 'ImageObject',
        url: `${BASE}/media/locandina.jpg`,
        width: 1414,
        height: 2000,
      },
      datePublished: '2026-02-09T21:29:13.000Z',
      dateModified: '2026-02-09T21:30:01.000Z',
      inLanguage: 'it-IT',
      mainEntityOfPage: { '@id': `${BASE}/notizia-sintetica/#webpage` },
      isPartOf: { '@id': `${BASE}/notizia-sintetica/#webpage` },
      articleSection: 'News',
    });
  });

  it('briciole Home → categoria → articolo', () => {
    const elementi = nodo(grafo, 'BreadcrumbList').itemListElement as Nodo[];
    expect(elementi.map((e) => [e.position, e.name, e.item])).toEqual([
      [1, 'Home', BASE],
      [2, 'News', `${BASE}/category/news/`],
      [3, 'Notizia sintetica', undefined],
    ]);
    expect(elementi[1]).toMatchObject({
      nextItem: { '@id': `${BASE}/notizia-sintetica/#listItem`, name: 'Notizia sintetica' },
      previousItem: { '@id': `${BASE}#listItem`, name: 'Home' },
    });
  });

  it('WebPage anche per l’articolo, senza author né creator', () => {
    const webPage = nodo(grafo, 'WebPage');
    expect(webPage).not.toHaveProperty('author');
    expect(webPage).not.toHaveProperty('creator');
    expect(webPage.primaryImageOfPage).toEqual({ '@id': `${BASE}/notizia-sintetica/#mainImage` });
  });

  it('senza categoria e senza immagine: Home → articolo, niente sezione né ImageObject', () => {
    const nudo = buildGraph(SITO, { ...articolo, category: null, image: null });
    expect(nodo(nudo, 'BreadcrumbList').itemListElement).toHaveLength(2);
    expect(nodo(nudo, 'BlogPosting')).not.toHaveProperty('articleSection');
    expect(tipi(nudo).has('ImageObject')).toBe(false);
  });
});

describe('documento', () => {
  it('Home → categoria dei download → documento, con WebPage', () => {
    const grafo = buildGraph(SITO, {
      kind: 'webpage',
      path: '/download/modulo-sintetico/',
      title: 'Modulo sintetico',
      name: 'Modulo sintetico - Centro di prova',
      description: null,
      datePublished: '2022-04-05T04:54:07.000Z',
      dateModified: '2022-04-05T04:54:07.000Z',
      image: null,
      parent: { name: 'Moduli sintetici', path: '/download-category/moduli-sintetici/' },
    });
    const elementi = nodo(grafo, 'BreadcrumbList').itemListElement as Nodo[];
    expect(elementi.map((e) => e.name)).toEqual(['Home', 'Moduli sintetici', 'Modulo sintetico']);
    expect(elementi[1]!.item).toBe(`${BASE}/download-category/moduli-sintetici/`);
    expect(nodo(grafo, 'WebPage').url).toBe(`${BASE}/download/modulo-sintetico/`);
  });
});

describe('archivio di categoria e categoria dei download (DR-187)', () => {
  const grafo = buildGraph(SITO, {
    kind: 'collection',
    path: '/category/news/',
    title: 'News',
    name: 'News - Centro di prova',
  });

  it('CollectionPage al posto di WebPage', () => {
    expect(nodi(grafo, 'WebPage')).toHaveLength(0);
    expect(nodo(grafo, 'CollectionPage')).toEqual({
      '@type': 'CollectionPage',
      '@id': `${BASE}/category/news/#collectionpage`,
      url: `${BASE}/category/news/`,
      name: 'News - Centro di prova',
      inLanguage: 'it-IT',
      isPartOf: { '@id': `${BASE}/#website` },
      breadcrumb: { '@id': `${BASE}/category/news/#breadcrumblist` },
    });
  });

  it('archivio paginato: url e briciole della pagina servita', () => {
    const paginato = buildGraph(SITO, {
      kind: 'collection',
      path: '/category/news/page/2/',
      title: 'News',
      name: 'News - Centro di prova - Pagina 2',
    });
    expect(nodo(paginato, 'CollectionPage').url).toBe(`${BASE}/category/news/page/2/`);
    expect(nodo(paginato, 'BreadcrumbList')['@id']).toBe(
      `${BASE}/category/news/page/2/#breadcrumblist`,
    );
  });
});

describe('ricerca (DR-187)', () => {
  const grafo = buildGraph(SITO, {
    kind: 'search',
    query: 'corso',
    name: 'corso - Centro di prova',
  });

  it('SearchResultsPage sulla home, come la sorgente', () => {
    expect(nodo(grafo, 'SearchResultsPage')).toEqual({
      '@type': 'SearchResultsPage',
      '@id': `${BASE}/#searchresultspage`,
      url: `${BASE}/`,
      name: 'corso - Centro di prova',
      inLanguage: 'it-IT',
      isPartOf: { '@id': `${BASE}/#website` },
      breadcrumb: { '@id': `${BASE}/#breadcrumblist` },
    });
  });

  it('briciole Home → risultati, con la frase cercata', () => {
    const elementi = nodo(grafo, 'BreadcrumbList').itemListElement as Nodo[];
    expect(elementi).toHaveLength(2);
    expect(elementi[1]!['@id']).toBe(`${BASE}/search/corso/#listItem`);
    expect(String(elementi[1]!.name)).toContain('corso');
  });
});

describe('404 (DR-187)', () => {
  it('WebPage senza nome, con le briciole', () => {
    const grafo = buildGraph(SITO, { kind: 'notFound', path: '/inesistente/' });
    const webPage = nodo(grafo, 'WebPage');
    expect(webPage).not.toHaveProperty('name');
    expect(webPage.url).toBe(`${BASE}/inesistente/`);
    expect(webPage.breadcrumb).toEqual({ '@id': `${BASE}/inesistente/#breadcrumblist` });
    expect(nodo(grafo, 'WebSite')).toBeTruthy();
  });

  it('percorso sconosciuto: identificativi relativi alla pagina, nessun url', () => {
    const webPage = nodo(buildGraph(SITO, { kind: 'notFound', path: null }), 'WebPage');
    expect(webPage['@id']).toBe('#webpage');
    expect(webPage).not.toHaveProperty('url');
  });
});

describe('serializeJsonLd', () => {
  it('neutralizza la chiusura dello script e i separatori di riga', () => {
    const testo = serializeJsonLd({ name: '</script><script>alert(1)</script> & \u2028' });
    expect(testo).not.toContain('<');
    expect(testo).not.toContain('>');
    expect(testo).toContain('\\u003c/script\\u003e');
    expect(testo).not.toContain('\u2028');
    expect(JSON.parse(testo)).toEqual({ name: '</script><script>alert(1)</script> & \u2028' });
  });
});

describe('siteFromSettings', () => {
  it('legge nome, logo, indirizzo, telefono e profili dalle impostazioni pubbliche', () => {
    expect(
      siteFromSettings(
        {
          'site.title': 'Centro di prova',
          'site.logo_path': '/media/logo.png',
          'contact.address': ' Via Inventata 1 ',
          'contact.phone': '',
          'social.profiles': ['https://social.example.invalid/a', 3, ''],
        },
        BASE,
      ),
    ).toEqual({
      url: BASE,
      name: 'Centro di prova',
      logo: { path: '/media/logo.png', width: null, height: null, caption: null },
      address: 'Via Inventata 1',
      telephone: '',
      sameAs: ['https://social.example.invalid/a'],
    });
  });

  it('impostazioni assenti: campi vuoti, nessun logo', () => {
    expect(siteFromSettings({}, BASE)).toEqual({
      url: BASE,
      name: '',
      logo: null,
      address: '',
      telephone: '',
      sameAs: [],
    });
  });
});

describe('imageFromMedia', () => {
  const media = {
    m1: {
      publicPath: '/media/a.jpg',
      width: 10,
      height: 20,
      altText: 'Testo alternativo',
      caption: 'Didascalia',
      variants: [],
    },
    m2: { publicPath: '/media/b.jpg', width: null, height: null, altText: 'Alt', variants: [] },
  };

  it('didascalia, altrimenti testo alternativo, come All in One SEO', () => {
    expect(imageFromMedia(media, 'm1')).toEqual({
      path: '/media/a.jpg',
      width: 10,
      height: 20,
      caption: 'Didascalia',
    });
    expect(imageFromMedia(media, 'm2')?.caption).toBe('Alt');
  });

  it('identificativo assente o sconosciuto: nessuna immagine', () => {
    expect(imageFromMedia(media, null)).toBeNull();
    expect(imageFromMedia(media, 'm9')).toBeNull();
  });
});
