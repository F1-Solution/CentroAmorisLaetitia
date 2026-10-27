import type { BlockDocument, FormsMap, MediaMap, PostListsMap, SlidersMap } from '@amoris/blocks';

/**
 * Lettura dei dati del sito pubblico, solo dal modulo `public` dell'API (DR-104):
 * il sito non parla al database (ADR-008 §3.3 regola 4). Ogni pagina si rende
 * sul server a ogni richiesta, senza cache intermedia (DR-105).
 */

const API_URL = (
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3002'
).replace(/\/$/, '');

export class ApiUnavailable extends Error {}

/** Il nome del cookie di sessione: la stessa variabile dell'API, con lo stesso valore predefinito. */
export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? 'amoris_sessione';

interface ReadOptions {
  readonly headers?: Record<string, string>;
  /** Gli esiti che valgono «non c'è», oltre a 404. */
  readonly absentStatuses?: readonly number[];
}

/** `null` se la risorsa non esiste (404); un errore per ogni altro esito. */
async function read<T>(path: string, options: ReadOptions = {}): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      cache: 'no-store',
      ...(options.headers ? { headers: options.headers } : {}),
    });
  } catch (caught) {
    // Solo l'errore di rete: gli errori interni di Next (resa dinamica) devono passare.
    if (caught instanceof TypeError) {
      throw new ApiUnavailable(`servizio non raggiungibile: ${caught.message}`);
    }
    throw caught;
  }
  if (response.status === 404 || options.absentStatuses?.includes(response.status)) return null;
  if (!response.ok) throw new ApiUnavailable(`servizio: ${response.status} su ${path}`);
  return (await response.json()) as T;
}

const q = (path: string) => encodeURIComponent(path);

export interface Seo {
  readonly title: string;
  readonly description: string | null;
  readonly canonicalPath: string;
  readonly robots: string;
  readonly ogTitle: string;
  readonly ogDescription: string | null;
  readonly ogType: string;
  readonly ogImagePath: string | null;
  /** Tipo dei dati strutturati scelto dall'area (DR-278); assente da un'API che non lo conosce. */
  readonly schemaType?: string;
}

export interface Term {
  readonly id: string;
  readonly taxonomy: string;
  readonly slug: string;
  readonly name: string;
  readonly path: string;
}

export interface PublicContent {
  readonly content: {
    readonly id: string;
    readonly type: 'page' | 'post';
    readonly path: string;
    readonly slug: string;
    readonly title: string;
    readonly showTitle: boolean;
    /** Ex `_et_pb_page_layout` (DR-139). */
    readonly pageLayout: 'right_sidebar' | 'full_width' | 'no_sidebar';
    /** Ex `_et_pb_gutter_width`; `null` = valore del tema (DR-149). */
    readonly gutterWidth: number | null;
    readonly excerpt: string | null;
    readonly blocks: BlockDocument;
    readonly featuredMediaId: string | null;
    readonly publishedAt: string | null;
    readonly updatedAt: string;
    /** Ultima modifica: `post_modified` della sorgente, poi le modifiche dal CMS (DR-186). */
    readonly modifiedAt: string;
  };
  readonly seo: Seo;
  readonly terms: readonly Term[];
  readonly media: MediaMap;
  readonly sliders: SlidersMap;
  readonly forms: FormsMap;
  readonly postLists: PostListsMap;
  readonly documents: Readonly<Record<string, PublicDocument>>;
}

/** L'anteprima: la pagina come `/public/content`, più l'indirizzo a cui il sito la serve («/» per la pagina iniziale). */
export interface PublicPreview extends PublicContent {
  readonly publicPath: string;
}

export interface PublicDocument {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly mediaId: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
  /** Ultima modifica fatta dal CMS; nulla per i documenti importati. */
  readonly modifiedAt: string | null;
  readonly byteSize: number;
}

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly target: string | null;
  readonly cssClasses: string | null;
  readonly children: readonly MenuItem[];
}

export interface PostSummary {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly summary: string | null;
  readonly textStart: string;
  readonly featuredMediaId: string | null;
  readonly publishedAt: string | null;
}

export interface PostPage {
  readonly items: readonly PostSummary[];
  readonly media: MediaMap;
  readonly meta: { readonly total: number; readonly page: number; readonly perPage: number };
}

/** Un risultato della ricerca: come un articolo, più il tipo di contenuto (DR-248). */
export interface SearchResult extends PostSummary {
  readonly type: 'page' | 'post' | 'document';
}

export type SearchPage = Omit<PostPage, 'items'> & { readonly items: readonly SearchResult[] };

export const getContent = (path: string) => read<PublicContent>(`/public/content?path=${q(path)}`);

/** La bozza di un contenuto come la servirebbe il sito (S15): solo qui si inoltra il cookie di sessione, e un rifiuto vale «non c'è». */
export const getPreview = (id: string, session: string) =>
  read<PublicPreview>(`/contents/${encodeURIComponent(id)}/preview`, {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(session)}` },
    absentStatuses: [400, 401, 403, 422],
  });

export const getMenu = (key: string) =>
  read<{ key: string; items: readonly MenuItem[] }>(`/public/menus/${encodeURIComponent(key)}`);

export const getSettings = async () =>
  (await read<Record<string, unknown>>('/public/settings')) ?? {};

export const getRedirect = (path: string) =>
  read<{ targetPath: string; statusCode: number }>(`/public/redirect?path=${q(path)}`);

export const getTerm = (path: string) =>
  read<{
    term: Term & { description: string | null };
    /** `description` manca da un'API precedente a DR-280. */
    seo: { title: string; description?: string | null; robots: string };
  }>(`/public/terms?path=${q(path)}`);

export const getPosts = (termIds: readonly string[], page: number, perPage: number) =>
  read<PostPage>(`/public/posts?termIds=${termIds.join(',')}&page=${page}&perPage=${perPage}`);

/** Un documento con le sue categorie `wpdmcategory` (`/download-category/<slug>/`). */
export const getDocument = (slug: string) =>
  read<{ document: PublicDocument; media: MediaMap; terms: readonly Term[] }>(
    `/public/documents/${encodeURIComponent(slug)}`,
  );

/** I documenti pubblici di una categoria dei download (DR-181). */
export const getDocuments = (termId: string) =>
  read<{ items: readonly PublicDocument[]; media: MediaMap }>(
    `/public/documents?termId=${encodeURIComponent(termId)}`,
  );

export const getSitemap = async () =>
  (await read<{ entries: { path: string; kind: string; updatedAt: string }[] }>(
    '/public/sitemap',
  )) ?? { entries: [] };

export function settingString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value : '';
}

/** Ricerca del sito pubblico (DR-144); 5 risultati per pagina come la sorgente. */
export const searchContents = (query: string, page: number) =>
  read<SearchPage>(`/public/search?s=${encodeURIComponent(query)}&page=${page}`);
