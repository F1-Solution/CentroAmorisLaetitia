import type { LastChange } from '@amoris/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses, noContent } from '../../lib/openapiErrors.js';
import { lastChangeOf } from '../audit/service.js';
import { homeContentId } from '../public/service.js';
import { sessionOf } from '../../plugins/auth.js';
import { applyAddressChange, parentOptions, planAddressChange } from './address.js';
import {
  addressChangeBody,
  addressChangeResponse,
  addressOptionsSchema,
  addressPlanSchema,
  addressPreviewQuery,
  contentDetail,
  contentDetailWithChange,
  createBody,
  draftBody,
  draftDetail,
  idParam,
  listQuery,
  listResponse,
  updateBody,
} from './schemas.js';
import {
  assertTitleAllowed,
  create,
  discardDraft,
  findById,
  findDraft,
  list,
  remove,
  saveDraft,
  setPublication,
  update,
} from './service.js';

/** Modulo `content` (ADR-001 §3 punto 1). */

const ENTITY = 'content';

function serialiseSummary(row: Awaited<ReturnType<typeof list>>['items'][number]) {
  return {
    ...row,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serialiseDetail(row: NonNullable<Awaited<ReturnType<typeof findById>>>) {
  return {
    ...row,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    blocks: row.blocks as { schema: number; blocks: unknown[] },
  };
}

/** La riga del registro la scrive il hook all'invio della risposta: l'ultima modifica è già questa (D127). */
function changeBy(request: FastifyRequest): LastChange {
  return { actorLabel: sessionOf(request).user.fullName, occurredAt: new Date().toISOString() };
}

export async function contentRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/contents',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['contenuti'],
        summary: 'Elenca i contenuti, con filtri e impaginazione',
        querystring: listQuery,
        response: { 200: listResponse, ...errorResponses(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const { items, total } = await list(app.db, request.query);
      return reply.send({
        items: items.map(serialiseSummary),
        meta: { total, page: request.query.page, perPage: request.query.perPage },
      });
    },
  );

  typed.get(
    '/contents/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['contenuti'],
        summary: 'Un contenuto con il suo documento a blocchi',
        params: idParam,
        response: { 200: contentDetailWithChange, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await findById(app.db, request.params.id);
      if (!row) return reply.callNotFound();
      const lastChange = await lastChangeOf(app.db, row.id);
      const isHome = (await homeContentId(app.db)) === row.id;
      // Porta il nome di una persona: non resta in cache.
      void reply.header('Cache-Control', 'no-store');
      return reply.send({ ...serialiseDetail(row), lastChange, isHome });
    },
  );

  typed.get(
    '/contents/:id/address/options',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['contenuti'],
        summary: 'Le pagine che possono fare da genitore del contenuto',
        params: idParam,
        response: { 200: addressOptionsSchema, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const items = await parentOptions(app.db, request.params.id);
      if (!items) return reply.callNotFound();
      return reply.send({ items });
    },
  );

  typed.get(
    '/contents/:id/address/preview',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['contenuti'],
        summary: 'Anteprima del cambio d’indirizzo: percorsi e redirect, senza scrivere nulla',
        params: idParam,
        querystring: addressPreviewQuery,
        response: { 200: addressPlanSchema, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const plan = await planAddressChange(app.db, request.params.id, {
        slug: request.query.slug,
        parentId: request.query.parentId || null,
      });
      if (!plan) return reply.callNotFound();
      return reply.send(plan);
    },
  );

  typed.put(
    '/contents/:id/address',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'content.address.update', entityType: ENTITY } },
      schema: {
        tags: ['contenuti'],
        summary:
          'Cambia slug e genitore: percorsi delle discendenti e redirect nella stessa transazione',
        params: idParam,
        body: addressChangeBody,
        response: { 200: addressChangeResponse, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const plan = await applyAddressChange(
        app.db,
        id,
        request.body,
        sessionOf(request).permissions,
      );
      if (!plan) return reply.callNotFound();
      // Solo conteggi: gli indirizzi stanno già in contenuti e regole.
      request.auditTarget = {
        entityId: id,
        detail: {
          moved: plan.moves.length,
          redirectsCreated: plan.redirectsCreated.length,
          redirectsRetargeted: plan.redirectsRetargeted.length,
          redirectsRemoved: plan.redirectsRemoved.length,
        },
      };
      const row = await findById(app.db, id);
      if (!row) throw new Error('contenuto spostato ma non rileggibile');
      const isHome = (await homeContentId(app.db)) === id;
      return reply.send({
        content: { ...serialiseDetail(row), lastChange: changeBy(request), isHome },
        plan,
      });
    },
  );

  typed.post(
    '/contents',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'content.create', entityType: ENTITY } },
      schema: {
        tags: ['contenuti'],
        summary: 'Crea un contenuto, sempre in bozza',
        body: createBody,
        response: { 201: contentDetail, ...errorResponses(400, 401, 403, 409) },
      },
    },
    async (request, reply) => {
      const id = await create(app.db, request.body, sessionOf(request).user.userId);
      request.auditTarget = { entityId: id };
      const row = await findById(app.db, id);
      if (!row) throw new Error('contenuto creato ma non rileggibile');
      return reply.code(201).send(serialiseDetail(row));
    },
  );

  typed.patch(
    '/contents/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'content.update', entityType: ENTITY } },
      schema: {
        tags: ['contenuti'],
        summary: 'Modifica un contenuto',
        params: idParam,
        body: updateBody,
        response: { 200: contentDetail, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const row = await update(app.db, request.params.id, request.body);
      if (!row) return reply.callNotFound();
      return reply.send(serialiseDetail(row));
    },
  );

  typed.post(
    '/contents/:id/publish',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentPublish),
      config: { audit: { action: 'content.publish', entityType: ENTITY } },
      schema: {
        tags: ['contenuti'],
        summary: 'Pubblica un contenuto',
        params: idParam,
        response: { 200: contentDetail, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await setPublication(app.db, request.params.id, true);
      if (!row) return reply.callNotFound();
      return reply.send(serialiseDetail(row));
    },
  );

  typed.post(
    '/contents/:id/unpublish',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentPublish),
      config: { audit: { action: 'content.unpublish', entityType: ENTITY } },
      schema: {
        tags: ['contenuti'],
        summary: 'Ritira un contenuto pubblicato',
        params: idParam,
        response: { 200: contentDetail, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await setPublication(app.db, request.params.id, false);
      if (!row) return reply.callNotFound();
      return reply.send(serialiseDetail(row));
    },
  );

  typed.delete(
    '/contents/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'content.delete', entityType: ENTITY } },
      schema: {
        tags: ['contenuti'],
        summary: 'Elimina un contenuto senza figli',
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

  /**
   * Copie di lavoro (DR-068). Sono **della persona**: il percorso non le nomina
   * perche' non c'e' nulla da nominare, la copia e' quella di chi ha la
   * sessione in corso. Nessuna di queste tre rotte scrive in `contents`.
   */

  typed.put(
    '/contents/:id/draft',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'content.draft.save', entityType: ENTITY } },
      schema: {
        tags: ['contenuti'],
        summary: 'Salva la copia di lavoro: il contenuto pubblicato non cambia',
        params: idParam,
        body: draftBody,
        response: { 200: draftDetail, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      const content = await findById(app.db, request.params.id);
      if (!content) return reply.callNotFound();
      assertTitleAllowed(request.body.title, content.title);

      const row = await saveDraft(
        app.db,
        request.params.id,
        sessionOf(request).user.userId,
        request.body,
      );
      if (!row) return reply.callNotFound();

      return reply.send({
        contentId: row.contentId,
        title: row.title,
        excerpt: row.excerpt,
        blocks: row.blocks as { schema: number; blocks: unknown[] },
        baseUpdatedAt: row.baseUpdatedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        stillCurrent: row.baseUpdatedAt.getTime() === content.updatedAt.getTime(),
      });
    },
  );

  typed.get(
    '/contents/:id/draft',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      schema: {
        tags: ['contenuti'],
        summary: 'La propria copia di lavoro, se esiste',
        params: idParam,
        response: { 200: draftDetail, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const row = await findDraft(app.db, request.params.id, sessionOf(request).user.userId);
      if (!row) return reply.callNotFound();
      return reply.send({
        contentId: row.contentId,
        title: row.title,
        excerpt: row.excerpt,
        blocks: row.blocks as { schema: number; blocks: unknown[] },
        baseUpdatedAt: row.baseUpdatedAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        stillCurrent: row.baseUpdatedAt.getTime() === row.contentUpdatedAt.getTime(),
      });
    },
  );

  typed.delete(
    '/contents/:id/draft',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'content.draft.discard', entityType: ENTITY } },
      schema: {
        tags: ['contenuti'],
        summary: 'Scarta la propria copia di lavoro',
        params: idParam,
        response: { 204: noContent, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const discarded = await discardDraft(
        app.db,
        request.params.id,
        sessionOf(request).user.userId,
      );
      if (!discarded) return reply.callNotFound();
      return reply.code(204).send(null);
    },
  );
}
