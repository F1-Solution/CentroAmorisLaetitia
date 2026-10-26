import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { SiteShell } from '../../components/SiteShell';
import { JsonLd } from '../../components/JsonLd';
import {
  ArchiveView,
  ContentView,
  DocumentView,
  DownloadCategoryView,
  SearchView,
} from '../../components/Views';
import {
  getContent,
  getDocument,
  getDocuments,
  getPosts,
  getPreview,
  getSettings,
  getTerm,
  SESSION_COOKIE_NAME,
  searchContents,
  settingString,
  type PostPage,
  type PublicContent,
  type PublicDocument,
  type SearchPage,
  type Term,
} from '../../lib/api';
import { isPreviewPath, previewIdOf } from '../../lib/previewPath';
import { siteUrl } from '../../lib/site';
import {
  buildGraph,
  imageFromMedia,
  siteFromSettings,
  type GraphPage,
} from '../../lib/structuredData';
import type { MediaMap } from '@amoris/blocks';

/**
 * Ogni percorso del sito pubblico passa di qui (`1E-W4`), resa sul server a ogni
 * richiesta (DR-105). L'ordine è quello della sorgente: archivio di categoria,
 * categoria dei download, pagina di un documento, contenuto; altrimenti 404. I redirect li ha già serviti
 * `src/proxy.ts`, prima di arrivare qui.
 */

export const dynamic = 'force-dynamic';

/**
 * Articoli per pagina negli archivi di categoria: è un'opzione del tema
 * (`et_divi.divi_catnum_posts = 6`), distinta da `content.posts_per_page` (10),
 * che vale per il blocco di riserva della home di WordPress.
 */
const CATEGORY_POSTS_PER_PAGE = 6;

type Resolved =
  | {
      kind: 'archive';
      term: Term & { description: string | null };
      seoTitle: string;
      robots: string;
      page: number;
      posts: PostPage;
    }
  | { kind: 'search'; query: string; page: number; posts: SearchPage }
  | {
      kind: 'downloadCategory';
      term: Term;
      seoTitle: string;
      robots: string;
      documents: readonly PublicDocument[];
    }
  | { kind: 'document'; document: PublicDocument; media: MediaMap; terms: readonly Term[] }
  | { kind: 'content'; data: PublicContent; path: string };

interface Params {
  readonly params: Promise<{ percorso?: string[] }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** La frase di `?s=`, come WordPress: il primo valore, senza a capo; `null` se manca. */
function searchQueryOf(params: Record<string, string | string[] | undefined>): string | null {
  const raw = params.s;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === undefined ? null : value.replace(/[\r\n]/g, '').slice(0, 200);
}

/** AIOSEO della sorgente sulla ricerca: mai indicizzata, e dalla pagina 2 nemmeno seguita. */
const SEARCH_ROBOTS = 'noindex, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
const SEARCH_ROBOTS_PAGED =
  'noindex, nofollow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';

/** L'indirizzo nella forma dei `params` di Next (segmenti già ricodificati): quella a cui il proxy riporta il percorso grezzo. */
function rawPathOf(segments: readonly string[] | undefined): string {
  if (!segments || segments.length === 0) return '/';
  return `/${segments.join('/')}/`;
}

function pathOf(segments: readonly string[] | undefined): string {
  if (!segments || segments.length === 0) return '/';
  return `/${segments.map((segment) => decodeURIComponent(segment)).join('/')}/`;
}

/** S15: la bozza si vede solo con la sessione di Redazione; per tutto il resto è un 404. */
async function resolvePreview(id: string): Promise<Resolved | null> {
  const session = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!session) return null;
  const data = await getPreview(id, session);
  // L'indirizzo pubblico del contenuto («/» per la pagina iniziale) è quello corrente: menu, JSON-LD e canonical coincidono con la pagina pubblicata.
  return data ? { kind: 'content', data, path: data.publicPath } : null;
}

/** Una sola risoluzione per richiesta, condivisa fra metadati e pagina. */
const resolve = cache(
  async (path: string, query: string | null, rawPath: string): Promise<Resolved | null> => {
    const previewId = previewIdOf(rawPath);
    if (previewId) return resolvePreview(previewId);
    if (isPreviewPath(rawPath)) return null;

    // Ricerca (DR-144): `?s=` sulla home e sulle sue pagine, come WordPress.
    const searchPage = /^\/(?:page\/(\d+)\/)?$/.exec(path);
    if (query !== null && searchPage) {
      const page = Number(searchPage[1] ?? '1');
      const posts = page >= 1 ? await searchContents(query, page) : null;
      if (!posts || (page > 1 && posts.items.length === 0)) return null;
      return { kind: 'search', query, page, posts };
    }

    const archive = /^(\/category\/[^/]+\/)(?:page\/(\d+)\/)?$/.exec(path);
    if (archive?.[1]) {
      const found = await getTerm(archive[1]);
      const page = Number(archive[2] ?? '1');
      if (found && page >= 1) {
        const posts = await getPosts([found.term.id], page, CATEGORY_POSTS_PER_PAGE);
        if (posts && (page === 1 || posts.items.length > 0)) {
          return {
            kind: 'archive',
            term: found.term,
            seoTitle: found.seo.title,
            robots: found.seo.robots,
            page,
            posts,
          };
        }
      }
      return null;
    }

    // DR-181: pagina dell'elenco dei moduli, solo per i termini di Download Manager.
    if (/^\/download-category\/(?:[^/]+\/)+$/.test(path)) {
      const found = await getTerm(path);
      if (found?.term.taxonomy !== 'wpdmcategory') return null;
      const documents = await getDocuments(found.term.id);
      if (!documents) return null;
      return {
        kind: 'downloadCategory',
        term: found.term,
        seoTitle: found.seo.title,
        robots: found.seo.robots,
        documents: documents.items,
      };
    }

    const download = /^\/download\/([^/]+)\/$/.exec(path);
    if (download?.[1]) {
      const found = await getDocument(download[1]);
      return found
        ? {
            kind: 'document',
            document: found.document,
            media: found.media,
            terms: found.terms ?? [],
          }
        : null;
    }

    const data = await getContent(path);
    return data ? { kind: 'content', data, path } : null;
  },
);

/** Le impostazioni pubbliche, lette una volta per richiesta fra metadati e pagina. */
const settingsOnce = cache(getSettings);

/** Title delle pagine senza SEO propria: titolo e sito, come All in One SEO. */
const plainTitle = (title: string, siteTitle: string) => `${title} - ${siteTitle}`;

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const path = pathOf((await params).percorso);
  const resolved = await resolve(
    path,
    searchQueryOf(await searchParams),
    rawPathOf((await params).percorso),
  );
  const siteTitle = settingString(await settingsOnce(), 'site.title');
  if (!resolved) return { title: `404 Non trovato | ${siteTitle}` };

  if (resolved.kind === 'search') {
    // Come la sorgente: la frase senza markup, poi il sito; suffisso di pagina di DR-040.
    const words = resolved.query.replace(/<[^>]*>/g, '').trim();
    const suffix = resolved.page > 1 ? ` - Pagina ${resolved.page}` : '';
    return {
      title: `${words} - ${siteTitle}${suffix}`,
      robots: resolved.page > 1 ? SEARCH_ROBOTS_PAGED : SEARCH_ROBOTS,
    };
  }

  if (resolved.kind === 'archive') {
    // Suffisso di paginazione in italiano (DR-040: la sorgente scrive « - Page 2»).
    const suffix = resolved.page > 1 ? ` - Pagina ${resolved.page}` : '';
    return {
      title: `${resolved.seoTitle}${suffix}`,
      robots: resolved.robots,
      alternates: { canonical: path },
    };
  }
  if (resolved.kind === 'downloadCategory') {
    // Come la sorgente: «Moduli consulenze - Centro Amoris Laetitia», max-image-preview:large.
    return {
      title: resolved.seoTitle || plainTitle(resolved.term.name, siteTitle),
      robots: resolved.robots || 'max-image-preview:large',
      alternates: { canonical: path },
    };
  }
  if (resolved.kind === 'document') {
    return {
      title: plainTitle(resolved.document.title, siteTitle),
      alternates: { canonical: path },
    };
  }

  const { seo } = resolved.data;
  return {
    title: seo.title,
    ...(seo.description ? { description: seo.description } : {}),
    robots: seo.robots,
    alternates: { canonical: seo.canonicalPath },
    openGraph: {
      title: seo.ogTitle,
      ...(seo.ogDescription ? { description: seo.ogDescription } : {}),
      type: seo.ogType === 'website' ? 'website' : 'article',
      url: seo.canonicalPath,
      siteName: siteTitle,
      locale: 'it_IT',
      ...(seo.ogImagePath ? { images: [seo.ogImagePath] } : {}),
    },
  };
}

/** Prima categoria della tassonomia indicata, come voce intermedia delle briciole. */
function crumbOf(terms: readonly Term[], taxonomy: string) {
  const term = terms.find((t) => t.taxonomy === taxonomy);
  return term ? { name: term.name, path: term.path } : null;
}

/** La pagina risolta nella forma dei dati strutturati (DR-170), con i nomi dei title SEO. */
function graphPageOf(resolved: Resolved, path: string, siteTitle: string): GraphPage {
  switch (resolved.kind) {
    case 'search': {
      const words = resolved.query.replace(/<[^>]*>/g, '').trim();
      const suffix = resolved.page > 1 ? ` - Pagina ${resolved.page}` : '';
      return { kind: 'search', query: words, name: `${words} - ${siteTitle}${suffix}` };
    }
    case 'archive': {
      const suffix = resolved.page > 1 ? ` - Pagina ${resolved.page}` : '';
      return {
        kind: 'collection',
        path,
        title: resolved.term.name,
        name: `${resolved.seoTitle}${suffix}`,
      };
    }
    case 'downloadCategory':
      return {
        kind: 'collection',
        path,
        title: resolved.term.name,
        name: resolved.seoTitle || plainTitle(resolved.term.name, siteTitle),
      };
    case 'document':
      return {
        kind: 'webpage',
        path,
        title: resolved.document.title,
        name: plainTitle(resolved.document.title, siteTitle),
        description: null,
        datePublished: resolved.document.publishedAt,
        dateModified: resolved.document.updatedAt,
        image: null,
        parent: crumbOf(resolved.terms, 'wpdmcategory'),
      };
    case 'content': {
      const { content, seo, terms, media } = resolved.data;
      const common = {
        path,
        title: content.title,
        name: seo.title,
        description: seo.description,
        datePublished: content.publishedAt,
        dateModified: content.modifiedAt ?? content.updatedAt,
        image: imageFromMedia(media, content.featuredMediaId),
      };
      return content.type === 'post'
        ? { kind: 'post', ...common, category: crumbOf(terms, 'category') }
        : { kind: 'webpage', ...common };
    }
  }
}

export default async function Page({ params, searchParams }: Params) {
  const path = pathOf((await params).percorso);
  const resolved = await resolve(
    path,
    searchQueryOf(await searchParams),
    rawPathOf((await params).percorso),
  );
  if (!resolved) notFound();
  const currentPath = resolved.kind === 'content' ? resolved.path : path;
  const settings = await settingsOnce();
  const graph = buildGraph(
    siteFromSettings(settings, siteUrl()),
    graphPageOf(resolved, currentPath, settingString(settings, 'site.title')),
  );

  return (
    <SiteShell
      currentPath={currentPath}
      gutterWidth={resolved.kind === 'content' ? resolved.data.content.gutterWidth : null}
    >
      <JsonLd graph={graph} />
      {resolved.kind === 'archive' ? (
        <ArchiveView term={resolved.term} posts={resolved.posts} page={resolved.page} />
      ) : resolved.kind === 'search' ? (
        <SearchView query={resolved.query} posts={resolved.posts} page={resolved.page} />
      ) : resolved.kind === 'downloadCategory' ? (
        <DownloadCategoryView term={resolved.term} documents={resolved.documents} />
      ) : resolved.kind === 'document' ? (
        <DocumentView document={resolved.document} media={resolved.media} />
      ) : (
        <ContentView data={resolved.data} />
      )}
    </SiteShell>
  );
}
