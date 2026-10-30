import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses, noContent } from '../../lib/openapiErrors.js';
import { sessionOf } from '../../plugins/auth.js';
import { categoryDeletion, findTermSeo, isCategory, upsertTermSeo } from './category.js';
import {
  createBody,
  idParam,
  listQuery,
  termDeletionSchema,
  termFieldLabels,
  termSchema,
  termSeoBody,
  termUpdateResponse,
  termSeoFieldLabels,
  termSeoSchema,
  updateBody,
} from './schemas.js';
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
        summary:
          'Modifica un termine; di una categoria nome, descrizione e genitrice, con i redirect 301 dagli indirizzi di prima (spostare chiede anche content.publish)',
        params: idParam,
        body: updateBody,
        response: { 200: termUpdateResponse, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const before = await findById(app.db, request.params.id);
      const row = await update(
        app.db,
        request.params.id,
        request.body,
        sessionOf(request).permissions,
      );
      if (!row) return reply.callNotFound();
      const { redirectSources, ...term } = row;
      request.auditRedirectSources = redirectSources;
      request.auditTarget = {
        entityId: row.id,
        detail: {
          fields: termFieldLabels(request.body),
          ...(before && before.path !== row.path ? { from: before.path, to: row.path } : {}),
        },
      };
      return reply.send(term);
    },
  );

  typed.get(
    '/terms/:id/deletion',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['tassonomie'],
        summary: 'Che cosa impedisce di eliminare una categoria',
        params: idParam,
        response: { 200: termDeletionSchema, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const preview = await categoryDeletion(app.db, request.params.id);
      if (!preview) return reply.callNotFound();
      return reply.send(preview);
    },
  );

  typed.get(
    '/terms/:id/seo',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['tassonomie'],
        summary: 'SEO dell’archivio di una categoria',
        params: idParam,
        response: { 200: termSeoSchema, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      if (!(await isCategory(app.db, request.params.id))) return reply.callNotFound();
      return reply.send(await findTermSeo(app.db, request.params.id));
    },
  );

  typed.put(
    '/terms/:id/seo',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'term.seo.update', entityType: 'term_seo' } },
      schema: {
        tags: ['tassonomie'],
        summary: 'Crea o modifica la SEO dell’archivio di una categoria',
        params: idParam,
        body: termSeoBody,
        response: { 200: termSeoSchema, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await upsertTermSeo(app.db, request.params.id, request.body);
      if (!row) return reply.callNotFound();
      request.auditTarget = {
        entityId: request.params.id,
        detail: { fields: termSeoFieldLabels(request.body) },
      };
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
        summary:
          'Elimina un termine non usato; una categoria con notizie, sottocategorie o voci di menu è rifiutata, e chiede anche content.publish',
        params: idParam,
        response: { 204: noContent, ...errorResponses(401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const removed = await remove(app.db, request.params.id, sessionOf(request).permissions);
      if (!removed) return reply.callNotFound();
      // Nome e percorso restano nel registro: la categoria non c'è più per ritrovarli.
      request.auditTarget = { entityId: request.params.id, detail: removed };
      return reply.code(204).send(null);
    },
  );
}
