import { createDatabase, type Database } from '@amoris/db';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
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
import { createObjectStore, type ObjectStore } from './lib/objectStore.js';
import { authRoutes } from './modules/auth/routes.js';
import { contentRoutes } from './modules/content/routes.js';
import { mediaRoutes } from './modules/media/routes.js';
import { menuRoutes } from './modules/menu/routes.js';
import { redirectRoutes } from './modules/redirects/routes.js';
import { seoRoutes } from './modules/seo/routes.js';
import { settingsRoutes } from './modules/settings/routes.js';
import { termRoutes } from './modules/terms/routes.js';
import { registerAuditHook } from './plugins/audit.js';
import { registerAuth } from './plugins/auth.js';
import { registerCsrf } from './plugins/csrf.js';
import './plugins/routeConfig.js';
import { healthRoutes } from './routes/health.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    config: Config;
    objectStore: ObjectStore;
  }
}

export type App = FastifyInstance & { withTypeProvider: unknown };

export interface BuildOptions {
  /** Archivio a oggetti alternativo: i test non parlano con un bucket vero. */
  readonly objectStore?: ObjectStore;
}

/**
 * Costruisce il servizio. Separato dall'avvio perché i test devono poterlo
 * creare senza aprire una porta.
 *
 * L'ordine in cui si registra non è indifferente:
 *  1. i cookie, altrimenti la sessione non si legge;
 *  2. il riconoscimento della sessione, che riempie `request.auth`;
 *  3. il controllo anti-CSRF, che ha bisogno del token di sessione del passo 2;
 *  4. l'hook del registro delle operazioni, che vuole sapere chi ha agito.
 */
export async function buildApp(config: Config, options: BuildOptions = {}) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Nei log non entrano intestazioni di autenticazione né cookie.
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    // Il proxy davanti è Caddy (ADR-003): l'indirizzo del client arriva da lui.
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  // Zod come unica fonte di verità: validazione, tipi e OpenAPI (ADR-001 §3).
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const { db, close } = createDatabase({ url: config.DATABASE_URL });
  app.decorate('db', db);
  app.decorate('config', config);
  app.decorate('objectStore', options.objectStore ?? createObjectStore(config));
  app.addHook('onClose', async () => {
    await close();
  });

  await app.register(cors, {
    origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 64 * 1024 * 1024, files: 1 } });
  /**
   * ADR-007 §3.1 controllo 8, prima metà: un tetto complessivo per indirizzo.
   * Il conteggio per account e il ritardo progressivo stanno nel modulo `auth`,
   * perché hanno bisogno di sapere **chi** sta tentando.
   */
  await app.register(rateLimit, { global: false, max: 300, timeWindow: '1 minute' });

  registerAuth(app);
  registerCsrf(app);
  registerAuditHook(app);

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'API del Centro per la Famiglia Amoris Laetitia',
        description:
          'Specifica generata dagli schemi Zod delle rotte: non è scritta a mano e non può divergere dal codice.',
        version: '0.2.0',
      },
      servers: [{ url: '/api', description: 'dietro il reverse proxy' }],
      tags: [
        { name: 'stato', description: 'Stato del servizio e delle sue dipendenze' },
        { name: 'autenticazione', description: 'Accesso, sessioni, password' },
        { name: 'contenuti', description: 'Pagine e articoli' },
        { name: 'tassonomie', description: 'Categorie e tag' },
        { name: 'media', description: 'Archivio dei file' },
        { name: 'menu', description: 'Voci di navigazione' },
        { name: 'seo', description: 'Template globali e sovrascritture' },
        { name: 'redirect', description: 'Reindirizzamenti, che sono dati' },
        { name: 'impostazioni', description: 'Impostazioni globali del sito' },
      ],
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
  // Un modulo per dominio, come impone ADR-001 §3 punto 1.
  await app.register(authRoutes);
  await app.register(contentRoutes);
  await app.register(termRoutes);
  await app.register(mediaRoutes);
  await app.register(menuRoutes);
  await app.register(seoRoutes);
  await app.register(redirectRoutes);
  await app.register(settingsRoutes);

  return app;
}
