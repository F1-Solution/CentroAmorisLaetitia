import type { FastifyInstance } from 'fastify';
import { constantTimeEquals, csrfTokenForSession } from '../lib/crypto.js';
import './routeConfig.js';

/**
 * ADR-007 §3.1 controllo 7: token a doppio invio su ogni richiesta che modifica
 * dati. «Il solo `SameSite` non basta» — quindi il cookie di sessione ha
 * `SameSite=Lax` **e** qui si pretende il token.
 *
 * Il token non è conservato da nessuna parte: si deriva dal token di sessione
 * con un segreto del servizio, quindi vale per quella sessione e per nessun'altra.
 */

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function registerCsrf(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    if (!MUTATING.has(request.method)) return;

    // Nessuna rotta trovata: la risposta giusta è 404, e un 403 qui
    // trasformerebbe ogni indirizzo inesistente in un divieto.
    if (!request.routeOptions.url) return;

    // L'accesso è l'unica rotta esentata: non c'è ancora una sessione da
    // proteggere, ed è già difesa dalla limitazione dei tentativi del controllo 8.
    if (request.routeOptions.config.csrf === false) return;

    const sessionToken = request.sessionToken;
    const cookie = request.cookies[app.config.CSRF_COOKIE_NAME];
    const header = request.headers['x-csrf-token'];

    const submitted = Array.isArray(header) ? header[0] : header;
    const expected = sessionToken
      ? csrfTokenForSession(sessionToken, app.config.CSRF_SECRET)
      : null;

    const valid =
      expected !== null &&
      typeof submitted === 'string' &&
      typeof cookie === 'string' &&
      constantTimeEquals(submitted, expected) &&
      constantTimeEquals(cookie, expected);

    if (!valid) {
      await reply.code(403).send({
        error: {
          code: 'CSRF_TOKEN_INVALID',
          message: 'La richiesta non porta un token valido.',
          requestId: request.id,
        },
      });
    }
  });
}
