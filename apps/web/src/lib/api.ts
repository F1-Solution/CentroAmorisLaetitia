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

/** `null` se la risorsa non esiste (404); un errore per ogni altro esito. */
async function read<T>(path: string): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  } catch (caught) {
    // Solo l'errore di rete: gli errori interni di Next (resa dinamica) devono passare.
    if (caught instanceof TypeError) {
      throw new ApiUnavailable(`servizio non raggiungibile: ${caught.message}`);
    }
    throw caught;
  }
  if (response.status === 404) return null;
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
    readonly excerpt: string | null;
    readonly blocks: BlockDocument;
    readonly featuredMediaId: string | null;
    readonly publishedAt: string | null;
    readonly updatedAt: string;
  };
  readonly seo: Seo;
  readonly terms: readonly Term[];
  readonly media: MediaMap;
  readonly sliders: SlidersMap;
  readonly forms: FormsMap;
  readonly postLists: PostListsMap;
  readonly documents: Readonly<Record<string, PublicDocument>>;
}

export interface PublicDocument {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly mediaId: string;
  readonly updatedAt: string;
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

export const getContent = (path: string) => read<PublicContent>(`/public/content?path=${q(path)}`);

export const getMenu = (key: string) =>
  read<{ key: string; items: readonly MenuItem[] }>(`/public/menus/${encodeURIComponent(key)}`);

export const getSettings = async () =>
  (await read<Record<string, unknown>>('/public/settings')) ?? {};

export const getRedirect = (path: string) =>
  read<{ targetPath: string; statusCode: number }>(`/public/redirect?path=${q(path)}`);

export const getTerm = (path: string) =>
  read<{ term: Term & { description: string | null }; seo: { title: string; robots: string } }>(
    `/public/terms?path=${q(path)}`,
  );

export const getPosts = (termIds: readonly string[], page: number, perPage: number) =>
  read<PostPage>(`/public/posts?termIds=${termIds.join(',')}&page=${page}&perPage=${perPage}`);

export const getDocument = (slug: string) =>
  read<{ document: PublicDocument; media: MediaMap }>(
    `/public/documents/${encodeURIComponent(slug)}`,
  );

export const getSitemap = async () =>
  (await read<{ entries: { path: string; kind: string; updatedAt: string }[] }>(
    '/public/sitemap',
  )) ?? { entries: [] };

export function settingString(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value : '';
}
