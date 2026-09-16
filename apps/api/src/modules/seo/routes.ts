import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses } from '../../lib/openapiErrors.js';
import { sessionOf } from '../../plugins/auth.js';
import {
  contentIdParam,
  contentSeoBody,
  contentSeoSchema,
  scopeParam,
  templateBody,
  templateSchema,
} from './schemas.js';
import {
  contentExists,
  findContentSeo,
  listTemplates,
  upsertContentSeo,
  upsertTemplate,
} from './service.js';

/** Modulo `seo`. */

const withDate = <T extends { updatedAt: Date }>(row: T) => ({
  ...row,
  updatedAt: row.updatedAt.toISOString(),
});

export async function seoRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/seo/templates',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['seo'],
        summary: 'Template globali, uno per ambito',
        response: { 200: z.array(templateSchema), ...errorResponses(401, 403) },
      },
    },
    async (_request, reply) => reply.send((await listTemplates(app.db)).map(withDate)),
  );

  typed.put(
    '/seo/templates/:scope',
    {
      onRequest: app.requirePermission(PERMISSIONS.settingsWrite),
      config: { audit: { action: 'seo.template.update', entityType: 'seo_template' } },
      schema: {
        tags: ['seo'],
        summary: 'Crea o modifica il template di un ambito',
        params: scopeParam,
        body: templateBody,
        response: { 200: templateSchema, ...errorResponses(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const row = await upsertTemplate(
        app.db,
        request.params.scope,
        request.body,
        sessionOf(request).user.userId,
      );
      if (!row) throw new Error('template scritto ma non rileggibile');
      return reply.send(withDate(row));
    },
  );

  typed.get(
    '/seo/contents/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['seo'],
        summary: 'Sovrascrittura SEO di un contenuto',
        params: contentIdParam,
        response: { 200: contentSeoSchema, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await findContentSeo(app.db, request.params.id);
      if (!row) return reply.callNotFound();
      return reply.send(withDate(row));
    },
  );

  typed.put(
    '/seo/contents/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'seo.content.update', entityType: 'content_seo' } },
      schema: {
        tags: ['seo'],
        summary: 'Crea o modifica la sovrascrittura SEO di un contenuto',
        params: contentIdParam,
        body: contentSeoBody,
        response: { 200: contentSeoSchema, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      if (!(await contentExists(app.db, request.params.id))) return reply.callNotFound();
      const row = await upsertContentSeo(app.db, request.params.id, request.body);
      if (!row) throw new Error('sovrascrittura scritta ma non rileggibile');
      return reply.send(withDate(row));
    },
  );
}
