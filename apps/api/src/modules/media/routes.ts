import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses, noContent } from '../../lib/openapiErrors.js';
import { sessionOf } from '../../plugins/auth.js';
import { idParam, listQuery, listResponse, mediaSchema, updateBody } from './schemas.js';
import { findById, list, remove, replaceFile, update, upload } from './service.js';

/** Modulo `media`. */

const ENTITY = 'media';

type Row = NonNullable<Awaited<ReturnType<typeof findById>>>;

const serialise = (row: Row) => ({ ...row, uploadedAt: row.uploadedAt.toISOString() });

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/media',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['media'],
        summary: 'Elenca i media',
        querystring: listQuery,
        response: { 200: listResponse, ...errorResponses(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const { items, total } = await list(app.db, request.query);
      return reply.send({
        items: items.map(serialise),
        meta: { total, page: request.query.page, perPage: request.query.perPage },
      });
    },
  );

  typed.get(
    '/media/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['media'],
        summary: 'Un media',
        params: idParam,
        response: { 200: mediaSchema, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await findById(app.db, request.params.id);
      if (!row) return reply.callNotFound();
      return reply.send(serialise(row));
    },
  );

  app.post(
    '/media',
    {
      onRequest: app.requirePermission(PERMISSIONS.mediaWrite),
      config: { audit: { action: 'media.upload', entityType: ENTITY } },
      schema: {
        tags: ['media'],
        summary: 'Carica un file nell’archivio a oggetti',
        consumes: ['multipart/form-data'],
        response: { 201: mediaSchema, ...errorResponses(400, 401, 403, 409) },
      },
    },
    async (request, reply) => {
      const part = await request.file();
      if (!part) {
        return reply.code(400).send({
          error: {
            code: 'FILE_MISSING',
            message: 'La richiesta non porta alcun file.',
            requestId: request.id,
          },
        });
      }

      const id = await upload(app.db, app.objectStore, {
        fileName: part.filename,
        mimeType: part.mimetype,
        body: await part.toBuffer(),
        // Il bucket riservato è dei documenti della futura area riservata
        // (ADR-004 §3.6): da qui si carica soltanto nel bucket pubblico.
        isPrivate: false,
        uploadedBy: sessionOf(request).user.userId,
      });

      const row = await findById(app.db, id);
      if (!row) throw new Error('media caricato ma non rileggibile');
      return reply.code(201).send(serialise(row));
    },
  );

  typed.put(
    '/media/:id/file',
    {
      onRequest: app.requirePermission(PERMISSIONS.mediaWrite),
      config: { audit: { action: 'media.replace', entityType: ENTITY } },
      schema: {
        tags: ['media'],
        summary: 'Sostituisce il file di un media conservandone l’indirizzo',
        consumes: ['multipart/form-data'],
        params: idParam,
        response: { 200: mediaSchema, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const part = await request.file();
      if (!part) {
        return reply.code(400).send({
          error: {
            code: 'FILE_MISSING',
            message: 'La richiesta non porta alcun file.',
            requestId: request.id,
          },
        });
      }

      const row = await replaceFile(app.db, app.objectStore, request.params.id, {
        mimeType: part.mimetype,
        body: await part.toBuffer(),
      });
      if (!row) return reply.callNotFound();
      return reply.send(serialise(row));
    },
  );

  typed.patch(
    '/media/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.mediaWrite),
      config: { audit: { action: 'media.update', entityType: ENTITY } },
      schema: {
        tags: ['media'],
        summary: 'Modifica titolo, testo alternativo e didascalia',
        params: idParam,
        body: updateBody,
        response: { 200: mediaSchema, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await update(app.db, request.params.id, request.body);
      if (!row) return reply.callNotFound();
      return reply.send(serialise(row));
    },
  );

  typed.delete(
    '/media/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.mediaWrite),
      config: { audit: { action: 'media.delete', entityType: ENTITY } },
      schema: {
        tags: ['media'],
        summary: 'Elimina un media e le sue varianti',
        params: idParam,
        response: { 204: noContent, ...errorResponses(401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const removed = await remove(app.db, app.objectStore, request.params.id);
      if (!removed) return reply.callNotFound();
      return reply.code(204).send(null);
    },
  );
}
