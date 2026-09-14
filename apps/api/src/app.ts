import { createDatabase, type Database } from '@amoris/db';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  hasZodFastifySchemaValidationErrors,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Config } from './config.js';
import { healthRoutes } from './routes/health.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    config: Config;
  }
}

export type App = FastifyInstance & { withTypeProvider: unknown };

/**
 * Costruisce il servizio. Separato dall'avvio perché i test devono poterlo
 * creare senza aprire una porta.
 *
 * Perimetro di questa fase: stato del servizio e specifica OpenAPI. Le rotte di
 * dominio — contenuti, media, menu, SEO, redirect, impostazioni, autenticazione —
 * nascono in Fase 1D, un modulo per dominio come impone ADR-001 §3.
 */
export async function buildApp(config: Config) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Nei log non entrano intestazioni di autenticazione né cookie.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    // Il proxy davanti è Caddy (ADR-003): l'indirizzo del client arriva da lui.
    trustProxy: true,
    disableRequestLogging: config.NODE_ENV === 'test',
  }).withTypeProvider<ZodTypeProvider>();

  // Zod come unica fonte di verità: validazione, tipi e OpenAPI (ADR-001 §3).
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const { db, close } = createDatabase({ url: config.DATABASE_URL });
  app.decorate('db', db);
  app.decorate('config', config);
  app.addHook('onClose', async () => {
    await close();
  });

  await app.register(cors, {
    origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
    credentials: true,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'API del Centro per la Famiglia Amoris Laetitia',
        description:
          'Specifica generata dagli schemi Zod delle rotte: non è scritta a mano e non può divergere dal codice.',
        version: '0.1.0',
      },
      servers: [{ url: '/api', description: 'dietro il reverse proxy' }],
      tags: [{ name: 'stato', description: 'Stato del servizio e delle sue dipendenze' }],
    },
    transform: jsonSchemaTransform,
  });

  app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());

  app.setErrorHandler((caught: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(caught)) {
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'La richiesta non è valida.',
          details: caught.validation.map((issue) => ({
            path: issue.instancePath || issue.params.issue.path.join('.'),
            message: issue.message ?? 'valore non valido',
          })),
          requestId: request.id,
        },
      });
    }

    const status = caught.statusCode ?? 500;
    if (status >= 500) {
      request.log.error({ err: caught }, 'richiesta fallita');
    }

    return reply.code(status).send({
      error: {
        code: caught.code ?? 'INTERNAL_ERROR',
        // Sopra il 500 il messaggio non esce: potrebbe contenere dettagli interni.
        message: status >= 500 ? 'Errore interno del servizio.' : caught.message,
        requestId: request.id,
      },
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Risorsa non trovata.',
        requestId: request.id,
      },
    }),
  );

  await app.register(healthRoutes);

  return app;
}
