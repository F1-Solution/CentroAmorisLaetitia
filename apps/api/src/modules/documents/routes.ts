import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses } from '../../lib/openapiErrors.js';
import { documentSchema, idParam, updateBody } from './schemas.js';
import { findById, list, update } from './service.js';

/** Modulo `documents`: elenco, dettaglio e modifica di titolo e descrizione dei documenti pubblici. */

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
}
