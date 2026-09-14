import { livenessSchema, readinessSchema, type DependencyStatus } from '@amoris/contracts';
import { ping, type Database } from '@amoris/db';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

/**
 * Stato del servizio.
 *
 * Due endpoint distinti, perché rispondono a due domande diverse:
 * `live` chiede «il processo è vivo?» e serve a chi decide se riavviarlo;
 * `ready` chiede «può lavorare?» e serve a chi decide se mandargli traffico.
 * Confonderli significa riavviare un servizio sano perché il database è lento.
 */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health/live',
    {
      schema: {
        summary: 'Il processo è vivo',
        description: 'Risponde sempre finché il processo risponde. Non interroga nulla.',
        tags: ['stato'],
        response: { 200: livenessSchema },
      },
    },
    async () => ({ status: 'ok' as const, uptimeSeconds: Math.round(process.uptime()) }),
  );

  app.get(
    '/health/ready',
    {
      schema: {
        summary: 'Il servizio può lavorare',
        description: 'Interroga le dipendenze. Risponde 503 quando almeno una non è raggiungibile.',
        tags: ['stato'],
        response: { 200: readinessSchema, 503: readinessSchema },
      },
    },
    async (_request, reply) => {
      const dependencies: DependencyStatus[] = [await checkDatabase(app)];
      const ok = dependencies.every((dependency) => dependency.ok);
      return reply.code(ok ? 200 : 503).send({
        status: ok ? ('ok' as const) : ('degraded' as const),
        dependencies,
      });
    },
  );
};

async function checkDatabase(app: {
  db: Database;
  log: { warn: (obj: unknown, msg: string) => void };
}): Promise<DependencyStatus> {
  const started = Date.now();
  try {
    await ping(app.db);
    return { name: 'database', ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    app.log.warn({ err: error }, 'database non raggiungibile');
    // Messaggio volutamente generico: l'indirizzo e le credenziali non escono di qui.
    return { name: 'database', ok: false, error: 'non raggiungibile' };
  }
}
