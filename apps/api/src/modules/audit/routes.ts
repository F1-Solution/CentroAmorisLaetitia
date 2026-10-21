import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses } from '../../lib/openapiErrors.js';
import {
  auditContentSearchSchema,
  auditContentsQuery,
  auditListSchema,
  auditQuery,
} from './schemas.js';
import { listAudit, searchContents } from './service.js';

/** Modulo `audit`, area Impostazioni, permesso `audit.read` (DR-227): sola lettura. */
export async function auditRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  // Nomi di persone: nessuna risposta del modulo resta in cache.
  app.addHook('onSend', async (_request, reply) => {
    void reply.header('Cache-Control', 'no-store');
  });

  typed.get(
    '/audit',
    {
      onRequest: app.requirePermission(PERMISSIONS.auditRead),
      schema: {
        tags: ['registro'],
        summary: 'Registro delle operazioni, dalla più recente, con filtri e cursore',
        querystring: auditQuery,
        response: { 200: auditListSchema, ...errorResponses(400, 401, 403) },
      },
    },
    async (request, reply) => reply.send(await listAudit(app.db, request.query)),
  );

  typed.get(
    '/audit/contents',
    {
      onRequest: app.requirePermission(PERMISSIONS.auditRead),
      schema: {
        tags: ['registro'],
        summary: 'Cerca un contenuto per titolo, per filtrare il registro',
        querystring: auditContentsQuery,
        response: { 200: auditContentSearchSchema, ...errorResponses(400, 401, 403) },
      },
    },
    async (request, reply) =>
      reply.send({ items: await searchContents(app.db, request.query.search) }),
  );
}
