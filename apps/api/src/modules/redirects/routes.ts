import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses, noContent } from '../../lib/openapiErrors.js';
import {
  createBody,
  idParam,
  listQuery,
  listResponse,
  redirectSchema,
  updateBody,
} from './schemas.js';
import { create, findById, list, remove, update } from './service.js';

/** Modulo `redirects`. */

const ENTITY = 'redirect';

type Row = NonNullable<Awaited<ReturnType<typeof findById>>>;

const serialise = (row: Row) => ({ ...row, lastHitAt: row.lastHitAt?.toISOString() ?? null });

export async function redirectRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/redirects',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['redirect'],
        summary: 'Elenca i redirect',
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

  typed.post(
    '/redirects',
    {
      onRequest: app.requirePermission(PERMISSIONS.settingsWrite),
      config: { audit: { action: 'redirect.create', entityType: ENTITY } },
      schema: {
        tags: ['redirect'],
        summary: 'Crea un redirect',
        body: createBody,
        response: { 201: redirectSchema, ...errorResponses(400, 401, 403, 409) },
      },
    },
    async (request, reply) => {
      const id = await create(app.db, request.body);
      const row = await findById(app.db, id);
      if (!row) throw new Error('redirect creato ma non rileggibile');
      return reply.code(201).send(serialise(row));
    },
  );

  typed.patch(
    '/redirects/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.settingsWrite),
      config: { audit: { action: 'redirect.update', entityType: ENTITY } },
      schema: {
        tags: ['redirect'],
        summary: 'Modifica o disattiva un redirect',
        params: idParam,
        body: updateBody,
        response: { 200: redirectSchema, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const row = await update(app.db, request.params.id, request.body);
      if (!row) return reply.callNotFound();
      return reply.send(serialise(row));
    },
  );

  typed.delete(
    '/redirects/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.settingsWrite),
      config: { audit: { action: 'redirect.delete', entityType: ENTITY } },
      schema: {
        tags: ['redirect'],
        summary: 'Elimina un redirect',
        params: idParam,
        response: { 204: noContent, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const removed = await remove(app.db, request.params.id);
      if (!removed) return reply.callNotFound();
      return reply.code(204).send(null);
    },
  );
}
