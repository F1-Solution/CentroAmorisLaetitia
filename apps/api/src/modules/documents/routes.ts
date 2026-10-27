import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses, noContent } from '../../lib/openapiErrors.js';
import {
  createBody,
  deletionPreviewSchema,
  documentSchema,
  idParam,
  updateBody,
} from './schemas.js';
import {
  create,
  deletionBlockers,
  findById,
  list,
  removeDocument,
  removeFileIfUnused,
  update,
} from './service.js';

/** Modulo `documents`: elenco, dettaglio, creazione, modifica ed eliminazione dei documenti pubblici. */

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/documents',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['documenti'],
        summary: 'Elenca i documenti pubblici, per titolo',
        response: { 200: z.array(documentSchema), ...errorResponses(401, 403) },
      },
    },
    async (_request, reply) => reply.send(await list(app.db)),
  );

  typed.get(
    '/documents/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['documenti'],
        summary: 'Legge un documento pubblico',
        params: idParam,
        response: { 200: documentSchema, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await findById(app.db, request.params.id);
      if (!row) return reply.callNotFound();
      return reply.send(row);
    },
  );

  typed.patch(
    '/documents/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'document.update', entityType: 'document' } },
      schema: {
        tags: ['documenti'],
        summary: 'Modifica titolo e descrizione di un documento pubblico',
        params: idParam,
        body: updateBody,
        response: { 200: documentSchema, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await update(app.db, request.params.id, request.body);
      if (!row) return reply.callNotFound();
      return reply.send(row);
    },
  );

  // DR-281: creare ed eliminare toccano il file (`media.write`) e pubblicano o ritirano (`content.publish`, DR-242).
  const writeAndPublish = [
    app.requirePermission(PERMISSIONS.contentWrite),
    app.requirePermission(PERMISSIONS.mediaWrite),
    app.requirePermission(PERMISSIONS.contentPublish),
  ];

  typed.post(
    '/documents',
    {
      onRequest: writeAndPublish,
      config: { audit: { action: 'document.create', entityType: 'document' } },
      schema: {
        tags: ['documenti'],
        summary:
          'Crea un documento pubblico da un PDF della libreria, con titolo, descrizione e categoria dei download',
        body: createBody,
        response: { 201: documentSchema, ...errorResponses(400, 401, 403, 409) },
      },
    },
    async (request, reply) => {
      const row = await create(app.db, request.body);
      if (!row) throw new Error('documento creato ma non rileggibile');
      request.auditTarget = { entityId: row.id, detail: { title: row.title, slug: row.slug } };
      return reply.code(201).send(row);
    },
  );

  typed.get(
    '/documents/:id/deletion',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['documenti'],
        summary: 'Anteprima dell’eliminazione: che cosa la impedisce, senza scrivere nulla',
        params: idParam,
        response: { 200: deletionPreviewSchema, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      const preview = await deletionBlockers(app.db, request.params.id);
      if (!preview) return reply.callNotFound();
      return reply.send(preview);
    },
  );

  typed.delete(
    '/documents/:id',
    {
      onRequest: writeAndPublish,
      config: { audit: { action: 'document.delete', entityType: 'document' } },
      schema: {
        tags: ['documenti'],
        summary:
          'Elimina un documento pubblico: rifiutato se un blocco «Documento» o un menu lo cita; il file sparisce se nessun altro lo usa',
        params: idParam,
        response: { 204: noContent, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const removed = await removeDocument(app.db, id);
      if (!removed) return reply.callNotFound();
      // Titolo e slug restano nel registro: il documento non c'è più per ritrovarli.
      request.auditTarget = { entityId: id, detail: { title: removed.title, slug: removed.slug } };
      await removeFileIfUnused(app.db, app.objectStore, removed.mediaId, {
        runtime: app.mediaRuntime,
        log: request.log,
      });
      return reply.code(204).send(null);
    },
  );
}
