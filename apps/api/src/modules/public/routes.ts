import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { errorResponses, noContent } from '../../lib/openapiErrors.js';
import {
  contentResponse,
  documentResponse,
  keyParam,
  menuResponse,
  pathQuery,
  postsQuery,
  postsResponse,
  redirectResponse,
  settingsResponse,
  sitemapResponse,
  slugParam,
  termResponse,
} from './schemas.js';
import {
  collectRefs,
  documentsBy,
  fallbackDescription,
  fileByPublicPath,
  fillTemplate,
  formsByIds,
  mediaByIds,
  postListsByRefs,
  publicMenu,
  publicSettings,
  publishedByPath,
  publishedPosts,
  resolveRedirect,
  robotsDirectives,
  seoForContent,
  sitemapEntries,
  slidersByIds,
  termByPath,
  termsOfContent,
} from './service.js';
import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';

/**
 * Modulo `public` (DR-104): la lettura che il sito pubblico fa senza accesso.
 *
 * Nessuna rotta di questo modulo ha un'area né un permesso, e nessuna scrive:
 * per questo stanno fuori da `registerArea` e sotto un prefisso proprio, dove
 * una rotta di scrittura si noterebbe subito.
 */

const iso = (value: Date | null) => (value ? value.toISOString() : null);

async function siteTitle(app: FastifyInstance): Promise<string> {
  const settings = await publicSettings(app.db);
  const value = settings['site.title'];
  return typeof value === 'string' ? value : '';
}

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/content',
    {
      schema: {
        tags: ['pubblico'],
        summary: 'Un contenuto pubblicato, per percorso, con ciò che serve a renderlo',
        querystring: pathQuery,
        response: { 200: contentResponse, ...errorResponses(400, 404) },
      },
    },
    async (request, reply) => {
      const content = await publishedByPath(app.db, request.query.path);
      if (!content) return reply.callNotFound();
      const refs = collectRefs(content.blocks);
      if (content.featuredMediaId) refs.mediaIds.add(content.featuredMediaId);
      const sliders = await slidersByIds(app.db, refs.sliderIds);
      for (const slider of Object.values(sliders)) {
        for (const slide of slider.slides) if (slide.mediaId) refs.mediaIds.add(slide.mediaId);
      }
      const documents = await documentsBy(app.db, { ids: refs.documentIds });
      for (const document of documents) refs.mediaIds.add(document.mediaId);
      const [media, terms, seo, forms, postLists] = await Promise.all([
        mediaByIds(app.db, refs.mediaIds),
        termsOfContent(app.db, content.id),
        seoForContent(app.db, content, await siteTitle(app)),
        formsByIds(app.db, refs.formIds),
        postListsByRefs(app.db, refs.postLists),
      ]);
      // Le miniature degli articoli dell'elenco: media noti a chi rende, come il resto.
      for (const items of Object.values(postLists)) {
        for (const item of items) if (item.featuredMediaId) refs.mediaIds.add(item.featuredMediaId);
      }
      const extraMedia = await mediaByIds(
        app.db,
        [...refs.mediaIds].filter((id) => !(id in media)),
      );
      return reply.send({
        content: {
          id: content.id,
          type: content.type,
          path: content.path,
          slug: content.slug,
          title: content.title,
          showTitle: content.showTitle,
          pageLayout: content.pageLayout,
          excerpt: content.excerpt,
          blocks: content.blocks,
          featuredMediaId: content.featuredMediaId,
          publishedAt: iso(content.publishedAt),
          updatedAt: content.updatedAt.toISOString(),
        },
        seo,
        terms,
        media: { ...media, ...extraMedia },
        sliders,
        forms,
        postLists,
        documents: Object.fromEntries(
          documents.map((document) => [
            document.id,
            { ...document, updatedAt: document.updatedAt.toISOString() },
          ]),
        ),
      });
    },
  );

  typed.get(
    '/menus/:key',
    {
      schema: {
        tags: ['pubblico'],
        summary: 'Un menu come lo vede chi non ha fatto accesso',
        params: keyParam,
        response: { 200: menuResponse, ...errorResponses(400, 404) },
      },
    },
    async (request, reply) => {
      const items = await publicMenu(app.db, request.params.key);
      if (!items) return reply.callNotFound();
      return reply.send({ key: request.params.key, items });
    },
  );

  typed.get(
    '/settings',
    {
      schema: {
        tags: ['pubblico'],
        summary: 'Le impostazioni che il sito pubblico legge, da un elenco chiuso',
        response: { 200: settingsResponse },
      },
    },
    async (_request, reply) => reply.send(await publicSettings(app.db)),
  );

  typed.get(
    '/redirect',
    {
      schema: {
        tags: ['pubblico'],
        summary: 'La regola di reindirizzamento che vale per un percorso',
        querystring: pathQuery,
        response: { 200: redirectResponse, ...errorResponses(400, 404) },
      },
    },
    async (request, reply) => {
      const rule = await resolveRedirect(app.db, request.query.path);
      if (!rule) return reply.callNotFound();
      return reply.send(rule);
    },
  );

  typed.get(
    '/posts',
    {
      schema: {
        tags: ['pubblico'],
        summary: 'Articoli pubblicati, per gli archivi e per l’elenco di articoli',
        querystring: postsQuery,
        response: { 200: postsResponse, ...errorResponses(400) },
      },
    },
    async (request, reply) => {
      const { rows, total } = await publishedPosts(app.db, request.query);
      const media = await mediaByIds(
        app.db,
        rows.flatMap((row) => (row.featuredMediaId ? [row.featuredMediaId] : [])),
      );
      return reply.send({
        items: rows.map((row) => ({
          id: row.id,
          path: row.path,
          title: row.title,
          excerpt: row.excerpt,
          summary: fallbackDescription(row.excerpt, row.contentText),
          textStart: row.contentText.replace(/\s+/g, ' ').trim().slice(0, 600),
          featuredMediaId: row.featuredMediaId,
          publishedAt: iso(row.publishedAt),
        })),
        media,
        meta: { total, page: request.query.page, perPage: request.query.perPage },
      });
    },
  );

  typed.get(
    '/terms',
    {
      schema: {
        tags: ['pubblico'],
        summary: 'Una tassonomia per percorso, per l’archivio',
        querystring: pathQuery,
        response: { 200: termResponse, ...errorResponses(400, 404) },
      },
    },
    async (request, reply) => {
      const term = await termByPath(app.db, request.query.path);
      if (!term) return reply.callNotFound();
      const [template] = await app.db
        .select()
        .from(schema.seoTemplates)
        .where(eq(schema.seoTemplates.scope, 'category'))
        .limit(1);
      return reply.send({
        term,
        seo: {
          title: fillTemplate(template?.titleTemplate ?? '{term_title} - {site_title}', {
            term_title: term.name,
            site_title: await siteTitle(app),
          }),
          robots: robotsDirectives(false, false, template?.robotsDirectives ?? []),
        },
      });
    },
  );

  typed.get(
    '/documents/:slug',
    {
      schema: {
        tags: ['pubblico'],
        summary: 'Un documento scaricabile, se è pubblico',
        params: slugParam,
        response: { 200: documentResponse, ...errorResponses(400, 404) },
      },
    },
    async (request, reply) => {
      const [document] = await documentsBy(app.db, { slug: request.params.slug });
      if (!document) return reply.callNotFound();
      return reply.send({
        document: { ...document, updatedAt: document.updatedAt.toISOString() },
        media: await mediaByIds(app.db, [document.mediaId]),
      });
    },
  );

  typed.get(
    '/sitemap',
    {
      schema: {
        tags: ['pubblico'],
        summary: 'Gli indirizzi da elencare nella mappa del sito',
        response: { 200: sitemapResponse },
      },
    },
    async (_request, reply) => {
      const { contents, terms } = await sitemapEntries(app.db);
      return reply.send({
        entries: [
          ...contents.map((row) => ({
            path: row.path,
            kind: row.type,
            updatedAt: row.updatedAt.toISOString(),
          })),
          ...terms.map((row) => ({
            path: row.path,
            kind: 'category',
            updatedAt: row.updatedAt.toISOString(),
          })),
        ],
      });
    },
  );
}

/** Tipi che il browser potrebbe eseguire come documento: si servono in un recinto. */
const ACTIVE_TYPES = new Set(['text/html', 'application/xhtml+xml', 'image/svg+xml', 'text/xml']);

/**
 * I file dei media a `/media/…` (ADR-004 §3.6, ADR-008): il servizio legge il
 * bucket pubblico e passa il contenuto alla risposta, senza URL firmati. Le
 * intestazioni di cache sono rimandate alla Fase 1F (registro, conseguenza di
 * DR-074): qui solo impronta e data, che bastano alla rivalidazione.
 */
export async function publicMediaRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/media/*',
    {
      schema: {
        tags: ['pubblico'],
        summary: 'Il file di un media pubblico o di una sua dimensione derivata',
        response: {
          304: noContent.describe('Non modificato: la copia del client è ancora valida'),
          ...errorResponses(404),
        },
      },
    },
    async (request, reply) => {
      const rest = (request.params as { '*': string })['*'];
      const file = await fileByPublicPath(app.db, `/media/${rest}`);
      if (!file) return reply.callNotFound();

      const etag = `"${file.checksum.toString('hex')}"`;
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).header('etag', etag).send(null);
      }
      const object = await app.objectStore.get(app.objectStore.publicBucket, file.storageKey);
      if (!object) {
        // Le intestazioni del file non si scrivono prima di averlo: un 404 in JSON
        // con il tipo di un'immagine non si potrebbe inviare.
        request.log.error(
          { storageKey: file.storageKey },
          'media a registro ma assente dal bucket',
        );
        return reply.callNotFound();
      }
      void reply
        .header('content-type', file.mimeType)
        .header('etag', etag)
        .header('last-modified', file.updatedAt.toUTCString())
        .header('x-content-type-options', 'nosniff');
      if (ACTIVE_TYPES.has(file.mimeType)) {
        void reply.header('content-security-policy', "default-src 'none'; sandbox");
      }
      if (object.contentLength !== undefined) {
        void reply.header('content-length', String(object.contentLength));
      }
      return reply.send(object.body);
    },
  );
}
