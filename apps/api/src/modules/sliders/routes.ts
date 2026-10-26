import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses } from '../../lib/openapiErrors.js';
import { editorialSliderSchema, idParam, replaceBody, sliderSummarySchema } from './schemas.js';
import { findById, list, replaceSlides } from './service.js';

/** Modulo `sliders`: lettura dei caroselli e sostituzione dell'elenco ordinato delle slide. */

export async function sliderRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/sliders',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['caroselli'],
        summary: 'Elenca i caroselli, per titolo',
        response: { 200: z.array(sliderSummarySchema), ...errorResponses(401, 403) },
      },
    },
    async (_request, reply) => reply.send(await list(app.db)),
  );

  typed.get(
    '/sliders/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['caroselli'],
        summary: 'Legge un carosello con le slide e i contenuti che lo mostrano',
        params: idParam,
        response: { 200: editorialSliderSchema, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await findById(app.db, request.params.id);
      if (!row) return reply.callNotFound();
      return reply.send(row);
    },
  );

  typed.put(
    '/sliders/:id/slides',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'slider.update', entityType: 'slider' } },
      schema: {
        tags: ['caroselli'],
        summary: "Sostituisce l'elenco ordinato delle slide di un carosello",
        params: idParam,
        body: replaceBody,
        response: { 200: editorialSliderSchema, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await replaceSlides(app.db, request.params.id, request.body);
      if (!row) return reply.callNotFound();
      return reply.send(row);
    },
  );
}
