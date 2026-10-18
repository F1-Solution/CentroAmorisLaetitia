import type { MediaMap } from '@amoris/blocks';

/**
 * Dati strutturati Schema.org come li serve All in One SEO nella sorgente (DR-170):
 * un solo `@graph` per pagina, stessi `@id`, indirizzi assoluti da SITE_URL (DR-188).
 * Esclusi `Person` e autore (DR-182); campi dell'organizzazione da impostazioni (DR-185).
 */

const LINGUA = 'it-IT';

export interface GraphImage {
  /** Percorso pubblico (`/media/…`) o indirizzo assoluto. */
  readonly path: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly caption: string | null;
}

export interface GraphSite {
  /** SITE_URL, senza barra finale. */
  readonly url: string;
  readonly name: string;
  readonly logo: GraphImage | null;
  readonly address: string;
  readonly telephone: string;
  readonly sameAs: readonly string[];
}

export interface Crumb {
  readonly name: string;
  readonly path: string;
}

interface PageBase {
  readonly path: string;
  /** Nome nelle briciole: il titolo del contenuto. */
  readonly title: string;
  /** Nome della pagina: il title SEO. */
  readonly name: string;
}

interface Dated {
  readonly description: string | null;
  readonly datePublished: string | null;
  readonly dateModified: string | null;
  readonly image: GraphImage | null;
}

export type GraphPage =
  | (PageBase & Dated & { readonly kind: 'webpage'; readonly parent?: Crumb | null })
  | (PageBase & Dated & { readonly kind: 'post'; readonly category: Crumb | null })
  | (PageBase & { readonly kind: 'collection' })
  | { readonly kind: 'search'; readonly query: string; readonly name: string }
  | { readonly kind: 'notFound'; readonly path: string | null };

type Node = Record<string, unknown>;

export interface JsonLdGraph {
  readonly '@context': 'https://schema.org';
  readonly '@graph': readonly Node[];
}

/** Toglie le chiavi vuote: un campo senza valore non si dichiara. */
function compact(node: Node): Node {
  return Object.fromEntries(
    Object.entries(node).filter(
      ([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0),
    ),
  );
}

const absolute = (site: GraphSite, path: string): string =>
  /^https?:\/\//i.test(path) ? path : `${site.url}${path.startsWith('/') ? '' : '/'}${path}`;

function imageObject(site: GraphSite, image: GraphImage, id?: string): Node {
  return compact({
    '@type': 'ImageObject',
    url: absolute(site, image.path),
    '@id': id,
    width: image.width,
    height: image.height,
    caption: image.caption,
  });
}

function organization(site: GraphSite): Node {
  const logoId = `${site.url}/#organizationLogo`;
  return compact({
    '@type': 'Organization',
    '@id': `${site.url}/#organization`,
    name: site.name,
    url: `${site.url}/`,
    logo: site.logo ? imageObject(site, site.logo, logoId) : null,
    image: site.logo ? { '@id': logoId } : null,
    address: site.address,
    telephone: site.telephone,
    sameAs: [...site.sameAs],
  });
}

function webSite(site: GraphSite): Node {
  return {
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    url: `${site.url}/`,
    name: site.name,
    inLanguage: LINGUA,
    publisher: { '@id': `${site.url}/#organization` },
  };
}

interface Step {
  readonly id: string;
  readonly name: string;
  readonly item?: string;
}

/** Le briciole di All in One SEO: `item` su tutti tranne l'ultimo, con i vicini richiamati. */
function breadcrumbList(id: string, steps: readonly Step[]): Node {
  const ref = (s: Step) => ({ '@type': 'ListItem', '@id': s.id, name: s.name });
  return {
    '@type': 'BreadcrumbList',
    '@id': id,
    itemListElement: steps.map((step, i) => {
      const next = steps[i + 1];
      const previous = steps[i - 1];
      return compact({
        '@type': 'ListItem',
        '@id': step.id,
        position: i + 1,
        name: step.name,
        item: next ? step.item : undefined,
        nextItem: next ? ref(next) : undefined,
        previousItem: previous ? ref(previous) : undefined,
      });
    }),
  };
}

const home = (site: GraphSite): Step => ({
  id: `${site.url}#listItem`,
  name: 'Home',
  item: site.url,
});

function trail(site: GraphSite, page: PageBase, parent: Crumb | null): Step[] {
  if (page.path === '/') return [home(site)];
  const url = absolute(site, page.path);
  const middle: Step[] = parent
    ? [
        {
          id: `${absolute(site, parent.path)}#listItem`,
          name: parent.name,
          item: absolute(site, parent.path),
        },
      ]
    : [];
  return [home(site), ...middle, { id: `${url}#listItem`, name: page.title }];
}

function webPage(site: GraphSite, page: PageBase & Dated): Node {
  const url = absolute(site, page.path);
  const imageId = `${url}#mainImage`;
  return compact({
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: page.name,
    description: page.description,
    inLanguage: LINGUA,
    isPartOf: { '@id': `${site.url}/#website` },
    breadcrumb: { '@id': `${url}#breadcrumblist` },
    image: page.image ? imageObject(site, page.image, imageId) : null,
    primaryImageOfPage: page.image ? { '@id': imageId } : null,
    datePublished: page.datePublished,
    dateModified: page.dateModified,
  });
}

function blogPosting(site: GraphSite, page: PageBase & Dated & { category: Crumb | null }): Node {
  const url = absolute(site, page.path);
  return compact({
    '@type': 'BlogPosting',
    '@id': `${url}#blogposting`,
    name: page.name,
    headline: page.title,
    publisher: { '@id': `${site.url}/#organization` },
    image: page.image ? imageObject(site, page.image) : null,
    datePublished: page.datePublished,
    dateModified: page.dateModified,
    inLanguage: LINGUA,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    isPartOf: { '@id': `${url}#webpage` },
    articleSection: page.category?.name,
  });
}

function collectionLike(
  site: GraphSite,
  type: 'CollectionPage' | 'SearchResultsPage',
  base: string,
  name: string,
): Node {
  const fragment = type === 'CollectionPage' ? 'collectionpage' : 'searchresultspage';
  return {
    '@type': type,
    '@id': `${base}#${fragment}`,
    url: base,
    name,
    inLanguage: LINGUA,
    isPartOf: { '@id': `${site.url}/#website` },
    breadcrumb: { '@id': `${base}#breadcrumblist` },
  };
}

function pageNodes(site: GraphSite, page: GraphPage): Node[] {
  switch (page.kind) {
    case 'webpage': {
      const url = absolute(site, page.path);
      return [
        breadcrumbList(`${url}#breadcrumblist`, trail(site, page, page.parent ?? null)),
        webPage(site, page),
      ];
    }
    case 'post': {
      const url = absolute(site, page.path);
      return [
        blogPosting(site, page),
        breadcrumbList(`${url}#breadcrumblist`, trail(site, page, page.category)),
        webPage(site, page),
      ];
    }
    case 'collection': {
      const url = absolute(site, page.path);
      return [
        breadcrumbList(`${url}#breadcrumblist`, trail(site, page, null)),
        collectionLike(site, 'CollectionPage', url, page.name),
      ];
    }
    case 'search': {
      const base = `${site.url}/`;
      const results: Step = {
        id: `${site.url}/search/${encodeURIComponent(page.query)}/#listItem`,
        name: `Risultati della ricerca per «${page.query}»`,
      };
      return [
        breadcrumbList(`${base}#breadcrumblist`, [home(site), results]),
        collectionLike(site, 'SearchResultsPage', base, page.name),
      ];
    }
    case 'notFound': {
      // Senza percorso gli identificativi restano relativi: si risolvono sull'indirizzo della pagina.
      const url = page.path ? absolute(site, page.path) : '';
      return [
        breadcrumbList(`${url}#breadcrumblist`, [
          home(site),
          { id: `${url}#listItem`, name: '404 - Pagina non trovata' },
        ]),
        compact({
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url: url || undefined,
          inLanguage: LINGUA,
          isPartOf: { '@id': `${site.url}/#website` },
          breadcrumb: { '@id': `${url}#breadcrumblist` },
        }),
      ];
    }
  }
}

/** Il grafo di una pagina: i nodi propri, poi organizzazione e sito. */
export function buildGraph(site: GraphSite, page: GraphPage): JsonLdGraph {
  return {
    '@context': 'https://schema.org',
    '@graph': [...pageNodes(site, page), organization(site), webSite(site)],
  };
}

/** U+2028 e U+2029: validi in JSON, non dentro uno script di alcuni interpreti. */
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, 'g');

/** JSON da mettere dentro `<script>`: `<`, `>`, `&` e i separatori di riga diventano escape. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATORS, (c) => `${String.fromCharCode(92)}u${c.charCodeAt(0).toString(16)}`);
}

const text = (settings: Readonly<Record<string, unknown>>, key: string): string => {
  const value = settings[key];
  return typeof value === 'string' ? value.trim() : '';
};

/** I dati del sito dalle impostazioni pubbliche (`/public/settings`). */
export function siteFromSettings(
  settings: Readonly<Record<string, unknown>>,
  url: string,
): GraphSite {
  const logoPath = text(settings, 'site.logo_path');
  const profiles = settings['social.profiles'];
  return {
    url,
    name: text(settings, 'site.title'),
    logo: logoPath ? { path: logoPath, width: null, height: null, caption: null } : null,
    address: text(settings, 'contact.address'),
    telephone: text(settings, 'contact.phone'),
    sameAs: Array.isArray(profiles)
      ? profiles.filter((p): p is string => typeof p === 'string' && p.trim() !== '')
      : [],
  };
}

/** Un'immagine della mappa dei media; didascalia, altrimenti testo alternativo, come la sorgente. */
export function imageFromMedia(media: MediaMap, id: string | null): GraphImage | null {
  const item = id ? media[id] : undefined;
  if (!item) return null;
  const caption = (item as { caption?: string | null }).caption || item.altText || null;
  return { path: item.publicPath, width: item.width, height: item.height, caption };
}
