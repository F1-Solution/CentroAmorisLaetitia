import type { FastifyInstance, FastifyRequest } from 'fastify';
import { writeAudit, writeAuditMany } from '../auth/audit.js';
import { hashAddress } from '../lib/crypto.js';
import { isUuid, LABELLED_ENTITIES, resolveObjectLabel } from '../modules/audit/objectLabel.js';
import {
  REDIRECT_CAUSES,
  redirectAuditEntries,
  snapshotRedirects,
  type RedirectSnapshot,
} from '../modules/audit/redirectChanges.js';
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
    /** Entità toccata e dettaglio non personale, quando il gestore li conosce solo a lavoro fatto. */
    auditTarget: { entityId: string; detail?: Record<string, unknown> } | null;
    /** Nome dell'oggetto prima della richiesta: dopo un'eliminazione non si può più leggere. */
    auditLabelBefore: string | null;
    /** Regole di redirect prima di una richiesta che può crearne, riscriverne o toglierne. */
    auditRedirectsBefore: RedirectSnapshot | null;
    /** Indirizzi di partenza delle regole del piano applicato da questa richiesta (I1 della T6). */
    auditRedirectSources: ReadonlySet<string> | null;
  }
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** L'etichetta del ruolo attivo, conservata come `actorLabel`: il ruolo puo' sparire. */
function activeRoleLabel(request: FastifyRequest): string | undefined {
  const auth = request.auth;
  if (!auth?.activeRoleId) return undefined;
  return auth.rolesHeld.find((role) => role.roleId === auth.activeRoleId)?.label;
}

/** Identificativo dell'oggetto appena creato, letto dalla risposta quando la rotta non lo dichiara. */
function createdId(entityType: string | null, status: number, payload: unknown): string | null {
  if (status !== 201 || !entityType || !LABELLED_ENTITIES.has(entityType)) return null;
  if (typeof payload !== 'string') return null;
  try {
    const id = (JSON.parse(payload) as { id?: unknown }).id;
    return typeof id === 'string' && isUuid(id) ? id : null;
  } catch {
    return null;
  }
}

export function registerAuditHook(app: FastifyInstance): void {
  app.decorateRequest('matchedRoute', null);
  app.decorateRequest('declaredAudit', null);
  app.decorateRequest('auditTarget', null);
  app.decorateRequest('auditLabelBefore', null);
  app.decorateRequest('auditRedirectsBefore', null);
  app.decorateRequest('auditRedirectSources', null);

  app.addHook('onRequest', async (request) => {
    request.matchedRoute = request.routeOptions.url ?? null;
    request.declaredAudit = request.routeOptions.config.audit ?? null;
  });

  app.addHook('preHandler', async (request) => {
    if (!MUTATING.has(request.method)) return;
    const declared = request.declaredAudit;
    const id = (request.params as Record<string, string> | undefined)?.id;
    try {
      if (declared?.entityType && LABELLED_ENTITIES.has(declared.entityType) && id) {
        request.auditLabelBefore = await resolveObjectLabel(app.db, declared.entityType, id);
      }
      if (declared && REDIRECT_CAUSES.has(declared.action)) {
        request.auditRedirectsBefore = await snapshotRedirects(app.db);
      }
    } catch (caught) {
      request.log.error({ err: caught }, 'stato precedente per il registro non letto');
    }
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

    const succeeded = reply.statusCode < 400;
    const entityType = declared?.entityType ?? null;
    try {
      const entityId =
        request.auditTarget?.entityId ??
        params?.id ??
        createdId(entityType, reply.statusCode, payload) ??
        params?.key ??
        params?.scope;
      const label =
        entityType && entityId
          ? ((await resolveObjectLabel(app.db, entityType, entityId)) ?? request.auditLabelBefore)
          : null;
      const actor = {
        actorUserId: request.auth?.user.userId ?? null,
        actorLabel: request.auth?.user.fullName ?? null,
        ipHash: hashAddress(request.ip, app.config.IP_HASH_SALT),
        sessionId: request.auth?.sessionId ?? null,
        // «Registrato da Rosalba, area Tesoreria»: l'atto resta attribuito
        // alla veste in cui e' stato compiuto (`ux-proposals.md` §4.3).
        actorRoleId: request.auth?.activeRoleId ?? null,
        actorRoleLabel: activeRoleLabel(request) ?? null,
        actorArea: request.auth?.activeArea ?? null,
      };
      await writeAudit(app.db, {
        ...actor,
        action: declared?.action ?? `${request.method} ${route}`,
        entityType,
        entityId: entityId ?? null,
        outcome: succeeded ? 'success' : 'failure',
        detail: {
          ...request.auditTarget?.detail,
          ...(label ? { label } : {}),
          status: reply.statusCode,
          method: request.method,
        },
      });
      // Una riga per ogni redirect che la richiesta ha creato, riscritto o tolto (W8-31).
      const sources = request.auditRedirectSources;
      if (succeeded && declared && request.auditRedirectsBefore && sources?.size) {
        const changes = redirectAuditEntries(
          request.auditRedirectsBefore,
          await snapshotRedirects(app.db),
          declared.action,
          sources,
        );
        await writeAuditMany(
          app.db,
          changes.map((change) => ({
            ...actor,
            ...change,
            detail: { ...change.detail, status: reply.statusCode, method: request.method },
          })),
        );
      }
    } catch (caught) {
      // Il registro non deve poter far fallire l'operazione che ha già avuto
      // effetto, ma un suo guasto non va perso: finisce nel log del servizio.
      request.log.error({ err: caught }, 'registro delle operazioni non scritto');
    }

    return payload;
  });
}
