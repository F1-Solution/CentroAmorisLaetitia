import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses, noContent } from '../../lib/openapiErrors.js';
import {
  createItemBody,
  idParam,
  keyParam,
  menuItemSchema,
  menuSchema,
  updateItemBody,
} from './schemas.js';
import {
  createItem,
  findItem,
  findMenuByKey,
  listItems,
  listMenus,
  removeItem,
  updateItem,
} from './service.js';

/** Modulo `menu`. */

const ENTITY = 'menu_item';

export async function menuRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/menus',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['menu'],
        summary: 'Elenca i menu',
        response: { 200: z.array(menuSchema), ...errorResponses(401, 403) },
      },
    },
    async (_request, reply) => reply.send(await listMenus(app.db)),
  );

  typed.get(
    '/menus/:key/items',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
      schema: {
        tags: ['menu'],
        summary: 'Voci di un menu, ordinate',
        params: keyParam,
        response: { 200: z.array(menuItemSchema), ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const menu = await findMenuByKey(app.db, request.params.key);
      if (!menu) return reply.callNotFound();
      return reply.send(await listItems(app.db, menu.id));
    },
  );

  typed.post(
    '/menus/:key/items',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'menu.item.create', entityType: ENTITY } },
      schema: {
        tags: ['menu'],
        summary: 'Aggiunge una voce a un menu',
        params: keyParam,
        body: createItemBody,
        response: { 201: menuItemSchema, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const menu = await findMenuByKey(app.db, request.params.key);
      if (!menu) return reply.callNotFound();
      const id = await createItem(app.db, menu.id, request.body);
      const row = await findItem(app.db, id);
      if (!row) throw new Error('voce creata ma non rileggibile');
      return reply.code(201).send(row);
    },
  );

  typed.patch(
    '/menu-items/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'menu.item.update', entityType: ENTITY } },
      schema: {
        tags: ['menu'],
        summary: 'Modifica una voce di menu, annidamento e visibilità comprese',
        params: idParam,
        body: updateItemBody,
        response: { 200: menuItemSchema, ...errorResponses(400, 401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      const row = await updateItem(app.db, request.params.id, request.body);
      if (!row) return reply.callNotFound();
      return reply.send(row);
    },
  );

  typed.delete(
    '/menu-items/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.contentWrite),
      config: { audit: { action: 'menu.item.delete', entityType: ENTITY } },
      schema: {
        tags: ['menu'],
        summary: 'Elimina una voce di menu e le sue discendenti',
        params: idParam,
        response: { 204: noContent, ...errorResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const removed = await removeItem(app.db, request.params.id);
      if (!removed) return reply.callNotFound();
      return reply.code(204).send(null);
    },
  );
}
