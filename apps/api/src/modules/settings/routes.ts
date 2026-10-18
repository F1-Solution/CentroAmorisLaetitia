import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { errorResponses } from '../../lib/openapiErrors.js';
import { sessionOf } from '../../plugins/auth.js';
import { SETTING_VALUE_SCHEMAS, keyParam, settingSchema, updateBody } from './schemas.js';
import { list, update, type findByKey } from './service.js';

/**
 * Modulo `settings`.
 *
 * `isSecret` marca i valori che l'interfaccia non mostra in chiaro, e qui il
 * valore non esce affatto. Non è il posto delle credenziali: quelle stanno in
 * variabili d'ambiente (ADR-009 §4.3) e a database non arrivano mai.
 */

const ENTITY = 'setting';

type Row = Awaited<ReturnType<typeof findByKey>>;

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
      onRequest: app.requirePermission(PERMISSIONS.contentRead),
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
      onRequest: app.requirePermission(PERMISSIONS.settingsWrite),
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
      // `Object.hasOwn`: una chiave come `constructor` non deve trovare un valore ereditato.
      const valueSchema = Object.hasOwn(SETTING_VALUE_SCHEMAS, request.params.key)
        ? SETTING_VALUE_SCHEMAS[request.params.key]
        : undefined;
      if (valueSchema && !valueSchema.safeParse(request.body.value).success) {
        return reply.code(400).send({
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Il valore non ha la forma prevista per questa impostazione.',
            requestId: request.id,
          },
        });
      }
      const row = await update(
        app.db,
        request.params.key,
        request.body,
        sessionOf(request).user.userId,
      );
      if (!row) return reply.callNotFound();
      return reply.send(serialise(row));
    },
  );
}
