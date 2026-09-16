import type { FastifyInstance } from 'fastify';
import { writeAudit } from '../auth/audit.js';
import { hashAddress } from '../lib/crypto.js';
import './routeConfig.js';

/**
 * ADR-001 §3 punto 3: **un hook solo** scrive il registro delle operazioni per
 * ogni richiesta che modifica dati. Nessuna rotta lo scrive da sé — le sole
 * righe che nascono altrove sono i cinque eventi di autenticazione di ADR-007
 * §3.1 controllo 10, che non corrispondono uno a uno a una richiesta.
 *
 * Criterio di uscita 20: una riga per **ogni** richiesta che modifica dati, sia
 * riuscita sia fallita.
 *
 * L'hook è `onSend` e non `onResponse`, e la differenza conta: `onResponse`
 * corre **dopo** che la risposta è partita, quindi il client saprebbe che
 * l'operazione è riuscita prima che la riga esista, e un arresto del processo in
 * quella finestra la perderebbe senza che nessuno se ne accorga. Con `onSend` la
 * riga è scritta prima che la risposta esca.
 */

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Rotta che ha accettato la richiesta, annotata all'ingresso. Serve perché
     * un gestore che delega alla risposta «non trovato» perde la rotta lungo la
     * strada, e senza questa la scrittura fallita non lascerebbe traccia.
     */
    matchedRoute: string | null;
    /** Azione dichiarata dalla rotta, annotata all'ingresso per lo stesso motivo. */
    declaredAudit: { action: string; entityType?: string } | null;
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function registerAuditHook(app: FastifyInstance): void {
  app.decorateRequest('matchedRoute', null);
  app.decorateRequest('declaredAudit', null);

  app.addHook('onRequest', async (request) => {
    request.matchedRoute = request.routeOptions.url ?? null;
    request.declaredAudit = request.routeOptions.config.audit ?? null;
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (!MUTATING.has(request.method)) return payload;

    // Richiesta che non ha trovato alcuna rotta: non ha modificato nulla, e
    // registrarla direbbe solo che qualcuno ha bussato a una porta che non c'è.
    const route = request.matchedRoute;
    if (!route) return payload;

    // Le rotte di autenticazione scrivono già la propria riga, con il dettaglio
    // che solo loro conoscono: qui si raddoppierebbe soltanto.
    if (route.startsWith('/auth/')) return payload;

    const declared = request.declaredAudit;
    const params = request.params as Record<string, string> | undefined;

    try {
      await writeAudit(app.db, {
        action: declared?.action ?? `${request.method} ${route}`,
        actorUserId: request.auth?.user.userId ?? null,
        actorLabel: request.auth?.user.fullName ?? null,
        entityType: declared?.entityType ?? null,
        entityId: params?.id ?? params?.key ?? params?.scope ?? null,
        outcome: reply.statusCode < 400 ? 'success' : 'failure',
        detail: { status: reply.statusCode, method: request.method },
        ipHash: hashAddress(request.ip, app.config.IP_HASH_SALT),
        sessionId: request.auth?.sessionId ?? null,
      });
    } catch (caught) {
      // Il registro non deve poter far fallire l'operazione che ha già avuto
      // effetto, ma un suo guasto non va perso: finisce nel log del servizio.
      request.log.error({ err: caught }, 'registro delle operazioni non scritto');
    }

    return payload;
  });
}
