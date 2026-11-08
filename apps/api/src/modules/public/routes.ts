import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { errorResponses, noContent } from '../../lib/openapiErrors.js';
import {
  contentResponse,
  documentResponse,
  documentsQuery,
  documentsResponse,
  keyParam,
  menuResponse,
  pathQuery,
  postsQuery,
  postsResponse,
  redirectResponse,
  searchQuery,
  searchResponse,
  settingsResponse,
  sitemapResponse,
  slugParam,
  termResponse,
} from './schemas.js';
import {
  documentsBy,
  downloadCategoriesOf,
  downloadCategoryById,
  fallbackDescription,
  summaryTextStart,
  fileByPublicPath,
  mediaByIds,
  publicMenu,
  publicSettings,
  publishedByPath,
  publishedPosts,
  recordRedirectHit,
  resolveRedirect,
  sitemapEntries,
  seoForTerm,
  termByPath,
} from './service.js';
import { anonymousLimit } from '../../lib/anonymousLimit.js';
import { searchPublished } from './search.js';
import { assemblePage, publicDocument, siteTitle } from './page.js';
import { parseByteRange } from '../../lib/objectStore.js';

/**
 * Modulo `public` (DR-104): la lettura che il sito pubblico fa senza accesso.
 *
 * Nessuna rotta di questo modulo ha un'area né un permesso, e nessuna scrive:
 * per questo stanno fuori da `registerArea` e sotto un prefisso proprio, dove
 * una rotta di scrittura si noterebbe subito.
 */

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const readLimit = anonymousLimit(app.config.HTTP_PUBLIC_READ_PER_MINUTE, { allowDirect: true });

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
      return reply.send(await assemblePage(app.db, content, await siteTitle(app.db)));
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
      config: { rateLimit: readLimit },
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
      // La scrittura non fa attendere la risposta; un errore va nel log senza dati della richiesta.
      if ('id' in rule) {
        recordRedirectHit(app.db, rule.id).catch((error: unknown) =>
          app.log.error(
            { err: error instanceof Error ? error.message : 'errore sconosciuto' },
            'Contatore dei redirect non aggiornato.',
          ),
        );
      }
      return reply.send({ targetPath: rule.targetPath, statusCode: rule.statusCode });
    },
  );

  typed.get(
    '/search',
    {
      config: { rateLimit: readLimit },
      schema: {
        tags: ['pubblico'],
        summary: 'Ricerca fra pagine, articoli e download pubblicati, come la sorgente',
        querystring: searchQuery,
        response: { 200: searchResponse, ...errorResponses(400) },
      },
    },
    async (request, reply) => {
      const { rows, total } = await searchPublished(app.db, request.query);
      const media = await mediaByIds(
        app.db,
        rows.flatMap((row) => (row.featuredMediaId ? [row.featuredMediaId] : [])),
      );
      return reply.send({
        items: rows.map((row) => ({
          id: row.id,
          type: row.type,
          path: row.path,
          title: row.title,
          excerpt: row.excerpt,
          summary: fallbackDescription(row.excerpt, row.contentText),
          textStart: summaryTextStart(row.summarySource, row.contentText),
          featuredMediaId: row.featuredMediaId,
          publishedAt: iso(row.publishedAt),
        })),
        media,
        meta: { total, page: request.query.page, perPage: request.query.perPage },
      });
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
          textStart: summaryTextStart(row.summarySource, row.contentText),
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
      return reply.send({ term, seo: await seoForTerm(app.db, term, await siteTitle(app.db)) });
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
        document: publicDocument(document),
        media: await mediaByIds(app.db, [document.mediaId]),
        terms: await downloadCategoriesOf(app.db, document.id),
      });
    },
  );

  typed.get(
    '/documents',
    {
      schema: {
        tags: ['pubblico'],
        summary:
          'I documenti pubblici di una categoria dei download, come l’archivio della sorgente',
        querystring: documentsQuery,
        response: { 200: documentsResponse, ...errorResponses(400, 404) },
      },
    },
    async (request, reply) => {
      const term = await downloadCategoryById(app.db, request.query.termId);
      if (!term) return reply.callNotFound();
      const documents = await documentsBy(app.db, { termId: term.id });
      // Senza documenti pubblici la categoria non esiste per il sito, come nella sitemap.
      if (documents.length === 0) return reply.callNotFound();
      return reply.send({
        items: documents.map(publicDocument),
        media: await mediaByIds(
          app.db,
          documents.map((document) => document.mediaId),
        ),
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
      const { contents, terms, documents, downloadCategories } = await sitemapEntries(app.db);
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
          ...documents.map((row) => ({
            path: `/download/${row.slug}/`,
            kind: 'document',
            updatedAt: (row.publishedAt ?? row.updatedAt).toISOString(),
          })),
          ...downloadCategories.map((row) => ({
            path: row.path,
            kind: 'download_category',
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
 * bucket pubblico e passa il contenuto alla risposta, senza URL firmati. Il file
 * esce con `Cache-Control: no-cache` (D149-A): il browser convalida con impronta e
 * data e vede subito una sostituzione; la politica definitiva resta alla Fase 1F.
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
          206: z.unknown().describe('La parte del file chiesta con Range (DR-189)'),
          416: noContent.describe('Intervallo di byte fuori dal file (DR-189)'),
          ...errorResponses(404),
        },
      },
    },
    async (request, reply) => {
      const rest = (request.params as { '*': string })['*'];
      const file = await fileByPublicPath(app.db, `/media/${rest}`);
      if (!file) return reply.callNotFound();

      const etag = `"${file.checksum.toString('hex')}"`;
      const lastModified = file.updatedAt.toUTCString();
      // DR-189: le richieste a intervalli si dichiarano su ogni risposta.
      void reply.header('accept-ranges', 'bytes').header('cache-control', 'no-cache');
      if (request.headers['if-none-match'] === etag) {
        return reply.code(304).header('etag', etag).send(null);
      }
      const ifRange = request.headers['if-range'];
      const range =
        ifRange === undefined || ifRange === etag || ifRange === lastModified
          ? parseByteRange(request.headers.range, file.byteSize)
          : null;
      if (range === 'unsatisfiable') {
        return reply.code(416).header('content-range', `bytes */${file.byteSize}`).send(null);
      }
      const object = await app.objectStore.get(
        app.objectStore.publicBucket,
        file.storageKey,
        range ?? undefined,
      );
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
        .header('last-modified', lastModified)
        .header('x-content-type-options', 'nosniff');
      if (ACTIVE_TYPES.has(file.mimeType)) {
        void reply.header('content-security-policy', "default-src 'none'; sandbox");
      }
      if (range) {
        void reply
          .code(206)
          .header('content-range', `bytes ${range.start}-${range.end}/${file.byteSize}`);
      }
      if (object.contentLength !== undefined) {
        void reply.header('content-length', String(object.contentLength));
      }
      return reply.send(object.body);
    },
  );
}
