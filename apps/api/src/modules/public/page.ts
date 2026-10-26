import type { Database } from '@amoris/db';
import {
  collectRefs,
  documentsBy,
  formsByIds,
  mediaByIds,
  postListsByRefs,
  publicSettings,
  seoForContent,
  slidersByIds,
  termsOfContent,
} from './service.js';

/** L'assemblaggio di una pagina, condiviso da `GET /public/content` e dall'anteprima della bozza perché non divergano. */

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export async function siteTitle(db: Database): Promise<string> {
  const settings = await publicSettings(db);
  const value = settings['site.title'];
  return typeof value === 'string' ? value : '';
}

/** Un documento pubblico con le date in ISO, come lo legge il sito. */
export function publicDocument<
  T extends {
    readonly updatedAt: Date;
    readonly publishedAt: Date | null;
    readonly modifiedAt: Date | null;
  },
>(document: T) {
  return {
    ...document,
    updatedAt: document.updatedAt.toISOString(),
    publishedAt: iso(document.publishedAt),
    modifiedAt: iso(document.modifiedAt),
  };
}

/** Il contenuto già risolto, con ciò che serve a SEO e blocchi. */
export interface PageContent {
  readonly id: string;
  readonly type: 'page' | 'post';
  readonly path: string;
  readonly slug: string;
  readonly title: string;
  readonly showTitle: boolean;
  readonly pageLayout: 'right_sidebar' | 'full_width' | 'no_sidebar';
  readonly gutterWidth: number | null;
  readonly excerpt: string | null;
  readonly blocks: unknown;
  readonly contentText: string;
  readonly descriptionSource: string | null;
  readonly featuredMediaId: string | null;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  readonly modifiedAt: Date | null;
  readonly isHome: boolean;
}

/** La risposta intera di `GET /public/content` per un contenuto già risolto. */
export async function assemblePage(db: Database, content: PageContent, title: string) {
  const refs = collectRefs(content.blocks);
  if (content.featuredMediaId) refs.mediaIds.add(content.featuredMediaId);
  const sliders = await slidersByIds(db, refs.sliderIds);
  for (const slider of Object.values(sliders)) {
    for (const slide of slider.slides) if (slide.mediaId) refs.mediaIds.add(slide.mediaId);
  }
  const documents = await documentsBy(db, { ids: refs.documentIds });
  for (const document of documents) refs.mediaIds.add(document.mediaId);
  const [media, terms, seo, forms, postLists] = await Promise.all([
    mediaByIds(db, refs.mediaIds),
    termsOfContent(db, content.id),
    seoForContent(db, content, title),
    formsByIds(db, refs.formIds),
    postListsByRefs(db, refs.postLists),
  ]);
  // Le miniature degli articoli dell'elenco: media noti a chi rende, come il resto.
  for (const items of Object.values(postLists)) {
    for (const item of items) if (item.featuredMediaId) refs.mediaIds.add(item.featuredMediaId);
  }
  const extraMedia = await mediaByIds(
    db,
    [...refs.mediaIds].filter((id) => !(id in media)),
  );
  return {
    content: {
      id: content.id,
      type: content.type,
      path: content.path,
      slug: content.slug,
      title: content.title,
      showTitle: content.showTitle,
      pageLayout: content.pageLayout,
      gutterWidth: content.gutterWidth,
      excerpt: content.excerpt,
      blocks: content.blocks,
      featuredMediaId: content.featuredMediaId,
      publishedAt: iso(content.publishedAt),
      updatedAt: content.updatedAt.toISOString(),
      // DR-186: la modifica della sorgente o del CMS; prima dell'import, l'aggiornamento.
      modifiedAt: (content.modifiedAt ?? content.updatedAt).toISOString(),
    },
    seo,
    terms,
    media: { ...media, ...extraMedia },
    sliders,
    forms,
    postLists,
    documents: Object.fromEntries(
      documents.map((document) => [document.id, publicDocument(document)]),
    ),
  };
}
