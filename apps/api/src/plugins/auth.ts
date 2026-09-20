import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { resolveSession, type ResolvedSession } from '../auth/sessions.js';
import type { Permission } from '../auth/permissions.js';
import './routeConfig.js';

/**
 * Riconoscimento della sessione e autorizzazione.
 *
 * Il cookie arriva, la sessione si risolve a database e il risultato resta
 * attaccato alla richiesta. Nessuna rotta rilegge il cookie da sé.
 */

declare module 'fastify' {
  interface FastifyRequest {
    /** Sessione risolta, oppure `null` per una richiesta anonima. */
    auth: ResolvedSession | null;
    /** Token di sessione grezzo: serve solo al controllo anti-CSRF. */
    sessionToken: string | null;
  }
  interface FastifyInstance {
    requireSession(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requirePermission(
      permission: Permission,
    ): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function notAuthenticated(request: FastifyRequest, reply: FastifyReply): void {
  void reply.code(401).send({
    error: {
      code: 'NOT_AUTHENTICATED',
      message: 'Serve un accesso valido.',
      requestId: request.id,
    },
  });
}

/**
 * `ux-proposals.md` §4.4 punto 2, attuato da DR-067: il sistema rifiuta i dati
 * di un'altra area **anche quando il permesso ci sarebbe**. Il permesso non
 * basta, serve essere nell'area giusta — ed è questo che rende la separazione
 * non aggirabile per distrazione.
 *
 * Il controllo viene **prima** di quello sul permesso: altrimenti la risposta
 * distinguerebbe «sei nell'area sbagliata» da «non hai il permesso», che è la
 * stessa mappa dei permessi che il controllo 9 di ADR-007 §3.1 vieta di far
 * trapelare da un messaggio di errore.
 *
 * Restituisce `true` se ha già risposto e il gestore non deve proseguire.
 */
function wrongArea(request: FastifyRequest, reply: FastifyReply): boolean {
  const required = request.routeOptions.config.area;
  if (!required) return false;
  if (request.auth?.activeArea === required) return false;

  void reply.code(403).send({
    error: {
      code: 'NOT_AUTHORIZED',
      message: 'Operazione non consentita.',
      requestId: request.id,
    },
  });
  return true;
}

/**
 * Sessione certa. Si usa **solo** dentro rotte che hanno `requireSession` o
 * `requirePermission`: lì il gestore non viene raggiunto senza sessione, e
 * questa funzione toglie di mezzo un controllo che il tipo non sa fare da sé.
 */
export function sessionOf(request: FastifyRequest): ResolvedSession {
  if (!request.auth) throw new Error('rotta protetta raggiunta senza sessione');
  return request.auth;
}

export function registerAuth(app: FastifyInstance): void {
  app.decorateRequest('auth', null);
  app.decorateRequest('sessionToken', null);

  app.addHook('onRequest', async (request) => {
    const token = request.cookies[app.config.SESSION_COOKIE_NAME];
    if (!token) return;
    request.sessionToken = token;
    request.auth = await resolveSession(app.db, app.config, token);
  });

  app.decorate('requireSession', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.auth) {
      notAuthenticated(request, reply);
      return;
    }
    wrongArea(request, reply);
  });

  app.decorate('requirePermission', (permission: Permission) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        notAuthenticated(request, reply);
        return;
      }
      if (wrongArea(request, reply)) return;
      if (!request.auth.permissions.has(permission)) {
        // Stesso principio del controllo 9: il messaggio non dice quale
        // permesso manchi, perché sarebbe una mappa dei permessi.
        await reply.code(403).send({
          error: {
            code: 'NOT_AUTHORIZED',
            message: 'Operazione non consentita.',
            requestId: request.id,
          },
        });
      }
    };
  });
}
