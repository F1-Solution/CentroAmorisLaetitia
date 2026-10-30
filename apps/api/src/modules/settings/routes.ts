import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses } from '../../lib/openapiErrors.js';
import { sessionOf } from '../../plugins/auth.js';
import {
  SETTING_VALUE_MESSAGES,
  SETTING_VALUE_SCHEMAS,
  homeChoicesResponse,
  keyParam,
  logoChoicesQuery,
  logoChoicesResponse,
  settingSchema,
  updateBody,
} from './schemas.js';
import {
  homeChoices,
  isPublicImage,
  isPublishedPage,
  list,
  logoChoices,
  update,
  type findByKey,
} from './service.js';

/**
 * Modulo `settings`.
 *
 * `isSecret` marca i valori che l'interfaccia non mostra in chiaro, e qui il
 * valore non esce affatto. Non è il posto delle credenziali: quelle stanno in
 * variabili d'ambiente (ADR-009 §4.3) e a database non arrivano mai.
 */

const ENTITY = 'setting';

type Row = Awaited<ReturnType<typeof findByKey>>;

/** Chiavi che indicano un media o un contenuto: lo schema ne controlla la forma, qui se ne controlla l'esistenza (W8-38). */
const REFERENCE_CHECKS: Readonly<
  Record<string, (db: FastifyInstance['db'], id: string) => Promise<boolean>>
> = {
  'site.logo_media_id': isPublicImage,
  'site.home_content_id': isPublishedPage,
};

/** Il valore di una chiave propria della tabella, senza trovare nulla di ereditato come `constructor`. */
function own<T>(table: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

/**
 * Un testo vuoto vale «nessun valore» (W8-37): torna `null` dove la forma lo ammette, così
 * un'impostazione nata `null` e svuotata dall'area torna com'era; il sito legge già `""` e
 * `null` allo stesso modo.
 */
function emptyAsNull(key: string, value: unknown): unknown {
  if (typeof value !== 'string' || value.trim() !== '') return value;
  const valueSchema = own(SETTING_VALUE_SCHEMAS, key);
  return !valueSchema || valueSchema.safeParse(null).success ? null : value;
}

function refuse(request: FastifyRequest, reply: FastifyReply, key: string) {
  return reply.code(400).send({
    error: {
      code: 'VALIDATION_FAILED',
      message:
        own(SETTING_VALUE_MESSAGES, key) ??
        'Il valore non ha la forma prevista per questa impostazione.',
      requestId: request.id,
    },
  });
}

function serialise(row: NonNullable<Row>) {
  return {
    ...row,
    value: row.isSecret ? null : row.value,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/settings',
    {
      onRequest: app.requirePermission(PERMISSIONS.siteSettingsWrite),
      schema: {
        tags: ['impostazioni'],
        summary: 'Elenca le impostazioni globali',
        response: { 200: z.array(settingSchema), ...errorResponses(401, 403) },
      },
    },
    async (_request, reply) => reply.send((await list(app.db)).map(serialise)),
  );

  typed.put(
    '/settings/:key',
    {
      onRequest: app.requirePermission(PERMISSIONS.siteSettingsWrite),
      config: { audit: { action: 'setting.update', entityType: ENTITY } },
      schema: {
        tags: ['impostazioni'],
        summary: 'Modifica il valore di un’impostazione esistente',
        params: keyParam,
        body: updateBody,
        response: { 200: settingSchema, ...errorResponses(400, 401, 403, 404) },
      },
    },
    async (request, reply) => {
      const key = request.params.key;
      const value = emptyAsNull(key, request.body.value);
      const parsed = own(SETTING_VALUE_SCHEMAS, key)?.safeParse(value);
      if (parsed && !parsed.success) return refuse(request, reply, key);
      // Si salva il valore nella forma dello schema: «10» scritto come testo diventa 10.
      const finalValue = parsed ? parsed.data : value;
      const exists = own(REFERENCE_CHECKS, key);
      if (exists && typeof finalValue === 'string' && !(await exists(app.db, finalValue))) {
        return refuse(request, reply, key);
      }
      const row = await update(
        app.db,
        key,
        { ...request.body, value: finalValue },
        sessionOf(request).user.userId,
      );
      if (!row) return reply.callNotFound();
      return reply.send(serialise(row));
    },
  );

  typed.get(
    '/settings/choices/logo',
    {
      onRequest: app.requirePermission(PERMISSIONS.siteSettingsWrite),
      schema: {
        tags: ['impostazioni'],
        summary: 'Elenca le immagini pubbliche fra cui scegliere il logo del sito',
        querystring: logoChoicesQuery,
        response: { 200: logoChoicesResponse, ...errorResponses(400, 401, 403) },
      },
    },
    async (request, reply) =>
      reply.send(await logoChoices(app.db, request.query.search?.trim() || undefined)),
  );

  typed.get(
    '/settings/choices/home',
    {
      onRequest: app.requirePermission(PERMISSIONS.siteSettingsWrite),
      schema: {
        tags: ['impostazioni'],
        summary: 'Elenca le pagine pubblicate fra cui scegliere la pagina iniziale',
        response: { 200: homeChoicesResponse, ...errorResponses(401, 403) },
      },
    },
    async (_request, reply) => reply.send(await homeChoices(app.db)),
  );
}
