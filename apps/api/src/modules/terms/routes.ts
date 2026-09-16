import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses, noContent } from '../../lib/openapiErrors.js';
import { createBody, idParam, listQuery, termSchema, updateBody } from './schemas.js';
import { create, findById, list, remove, update } from './service.js';

/** Modulo `terms`. */

const ENTITY = 'term';

export async function termRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/terms',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['tassonomie'],
        summary: 'Elenca i termini, per tassonomia',
        querystring: listQuery,
        response: { 200: z.array(termSchema), ...errorResponses(401, 403) },
      },
    },
    async (request, reply) => reply.send(await list(app.db, request.query.taxonomy)),
  );

  typed.post(
    '/terms',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'term.create', entityType: ENTITY } },
      schema: {
        tags: ['tassonomie'],
        summary: 'Crea un termine',
        body: createBody,
        response: { 201: termSchema, ...errorResponses(400, 401, 403, 409) },
      },
    },
    async (request, reply) => {
      const id = await create(app.db, request.body);
      const row = await findById(app.db, id);
      if (!row) throw new Error('termine creato ma non rileggibile');
      return reply.code(201).send(row);
    },
  );

  typed.patch(
    '/terms/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'term.update', entityType: ENTITY } },
      schema: {
        tags: ['tassonomie'],
        summary: 'Modifica un termine',
        params: idParam,
        body: updateBody,
        response: { 200: termSchema, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const row = await update(app.db, request.params.id, request.body);
      if (!row) return reply.callNotFound();
      return reply.send(row);
    },
  );

  typed.delete(
    '/terms/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'term.delete', entityType: ENTITY } },
      schema: {
        tags: ['tassonomie'],
        summary: 'Elimina un termine non usato',
        params: idParam,
        response: { 204: noContent, ...errorResponses(401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const removed = await remove(app.db, request.params.id);
      if (!removed) return reply.callNotFound();
      return reply.code(204).send(null);
    },
  );
}
