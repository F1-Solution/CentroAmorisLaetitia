import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AUTH_ACTIONS, writeAudit } from '../../auth/audit.js';
import { evaluateAttempts, identifierDigest, IDENTIFIER_ENTITY } from '../../auth/loginAttempts.js';
import {
  issueSession,
  listSessions,
  permissionsOfRole,
  revokeAllSessions,
  revokeSession,
  rolesHeldBy,
  setActiveContext,
  type IssuedSession,
  type RoleHeld,
} from '../../auth/sessions.js';
import type { Config } from '../../config.js';
import { csrfTokenForSession, hashAddress } from '../../lib/crypto.js';
import { errorResponses } from '../../lib/openapiErrors.js';
import { sessionOf } from '../../plugins/auth.js';
import {
  acknowledged,
  changePasswordBody,
  chooseContextBody,
  currentUser,
  loginBody,
  revokedCount,
  sessionSummary,
} from './schemas.js';
import { checkPassword, findByEmail, markLogin, setPassword } from './service.js';

/**
 * Modulo `auth`. Attua ADR-007 §3: sessioni opache, cookie `HttpOnly`, token
 * anti-CSRF derivato, limitazione dei tentativi, messaggio di errore unico.
 *
 * Il controllo 11 — recupero password — **non c'è, ed è voluto**: ADR-007 §3.1
 * lo dichiara fuori perimetro in Fase 1, perché con due account la
 * reimpostazione è manuale e un canale di recupero sarebbe superficie d'attacco
 * che non serve ancora.
 */

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Le vesti fra cui scegliere: una per ogni coppia ruolo-area posseduta.
 * `ux-proposals.md` §4.3: **chi ne possiede una sola non vede mai la schermata
 * di scelta**, entra direttamente. Per quelle persone il concetto di veste non
 * esiste proprio, e non va inventato per simmetria.
 */
function vestments(roles: readonly RoleHeld[]) {
  return roles.flatMap((role) => role.areas.map((area) => ({ roleId: role.roleId, area })));
}

/** Copia mutabile: lo schema di risposta non accetta un elenco di sola lettura. */
function serialiseRoles(roles: readonly RoleHeld[]) {
  return roles.map((role) => ({ ...role, areas: [...role.areas] }));
}

/** ADR-007 §3.1 controllo 3, in un posto solo per non poterlo scrivere diverso. */
function setSessionCookies(reply: FastifyReply, config: Config, session: IssuedSession): void {
  const maxAge = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
  reply.setCookie(config.SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  // Questo il client deve poterlo leggere: è la metà del doppio invio.
  reply.setCookie(config.CSRF_COOKIE_NAME, csrfTokenForSession(session.token, config.CSRF_SECRET), {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const ipOf = (ip: string) => hashAddress(ip, app.config.IP_HASH_SALT);

  typed.post(
    '/auth/login',
    {
      // Non c'è ancora una sessione da proteggere: l'accesso è difeso dalla
      // limitazione dei tentativi del controllo 8, non dal token anti-CSRF.
      config: { csrf: false as const },
      schema: {
        tags: ['autenticazione'],
        summary: 'Apre una sessione',
        body: loginBody,
        response: { 200: currentUser, ...errorResponses(400, 401, 429) },
      },
    },
    async (request, reply) => {
      const started = Date.now();
      const { email, password } = request.body;
      const ipHash = ipOf(request.ip);
      const digest = identifierDigest(email);

      /** Controllo 9: ogni esito occupa lo stesso tempo, riuscito o fallito. */
      const uniform = async () => {
        const elapsed = Date.now() - started;
        if (elapsed < app.config.LOGIN_UNIFORM_MS) {
          await pause(app.config.LOGIN_UNIFORM_MS - elapsed);
        }
      };

      const attempts = await evaluateAttempts(app.db, app.config, email, ipHash);
      if (attempts.delayMs > 0) await pause(attempts.delayMs);

      if (attempts.blocked) {
        await writeAudit(app.db, {
          action: AUTH_ACTIONS.login,
          outcome: 'failure',
          entityType: IDENTIFIER_ENTITY,
          entityId: digest,
          detail: { reason: 'too_many_attempts' },
          ipHash,
        });
        await uniform();
        return reply.code(429).send({
          error: {
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Troppi tentativi. Riprovare più tardi.',
            requestId: request.id,
          },
        });
      }

      const candidate = await findByEmail(app.db, email);
      const ok = await checkPassword(candidate, password, app.config);

      if (!ok || !candidate) {
        await writeAudit(app.db, {
          action: AUTH_ACTIONS.login,
          outcome: 'failure',
          entityType: IDENTIFIER_ENTITY,
          // Digest, non indirizzo: potrebbe essere di una persona che con
          // questo servizio non c'entra nulla.
          entityId: digest,
          // Che l'indirizzo esista o no non si scrive: sarebbe la stessa
          // enumerazione che il controllo 9 vieta di far trapelare.
          detail: { reason: 'invalid_credentials' },
          ipHash,
        });
        await uniform();
        return reply.code(401).send({
          error: {
            // Identico nei due casi: account inesistente e password errata.
            code: 'INVALID_CREDENTIALS',
            message: 'Indirizzo o password non corretti.',
            requestId: request.id,
          },
        });
      }

      const session = await issueSession(app.db, app.config, candidate.userId, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      await markLogin(app.db, candidate.userId);
      await writeAudit(app.db, {
        action: AUTH_ACTIONS.login,
        outcome: 'success',
        actorUserId: candidate.userId,
        actorLabel: candidate.fullName,
        sessionId: session.sessionId,
        ipHash,
      });

      setSessionCookies(reply, app.config, session);

      const rolesHeld = await rolesHeldBy(app.db, candidate.userId);
      const choices = vestments(rolesHeld);
      const only = choices.length === 1 ? choices[0] : undefined;
      if (only) await setActiveContext(app.db, session.sessionId, only.roleId, only.area);

      const permissions = only ? await permissionsOfRole(app.db, only.roleId) : new Set<string>();
      await uniform();

      return reply.send({
        userId: candidate.userId,
        email: candidate.email,
        fullName: candidate.fullName,
        mustChangePassword: false,
        permissions: [...permissions],
        activeRoleId: only?.roleId ?? null,
        activeArea: only?.area ?? null,
        rolesHeld: serialiseRoles(rolesHeld),
      });
    },
  );

  typed.post(
    '/auth/context',
    {
      onRequest: app.requireSession,
      schema: {
        tags: ['autenticazione'],
        summary: 'Sceglie la veste: ruolo attivo e area in cui si lavora',
        body: chooseContextBody,
        response: { 200: currentUser, ...errorResponses(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const session = sessionOf(request);
      const { roleId, area } = request.body;

      // Che il ruolo sia posseduto e l'area sia sua si verifica qui: il corpo
      // della richiesta lo dice il client, e il client non decide le vesti.
      const role = session.rolesHeld.find((held) => held.roleId === roleId);
      if (!role || !role.areas.includes(area)) {
        return reply.code(403).send({
          error: {
            code: 'NOT_AUTHORIZED',
            message: 'Operazione non consentita.',
            requestId: request.id,
          },
        });
      }

      await setActiveContext(app.db, session.sessionId, roleId, area);
      await writeAudit(app.db, {
        action: AUTH_ACTIONS.contextChanged,
        actorUserId: session.user.userId,
        actorLabel: session.user.fullName,
        actorRoleId: roleId,
        actorRoleLabel: role.label,
        actorArea: area,
        sessionId: session.sessionId,
        ipHash: ipOf(request.ip),
      });

      return reply.send({
        ...session.user,
        permissions: [...(await permissionsOfRole(app.db, roleId))],
        activeRoleId: roleId,
        activeArea: area,
        rolesHeld: serialiseRoles(session.rolesHeld),
      });
    },
  );

  typed.get(
    '/auth/me',
    {
      onRequest: app.requireSession,
      schema: {
        tags: ['autenticazione'],
        summary: 'Chi è la sessione in corso',
        response: { 200: currentUser, ...errorResponses(401) },
      },
    },
    async (request, reply) => {
      const session = sessionOf(request);
      return reply.send({
        ...session.user,
        permissions: [...session.permissions],
        activeRoleId: session.activeRoleId,
        activeArea: session.activeArea,
        rolesHeld: serialiseRoles(session.rolesHeld),
      });
    },
  );

  typed.post(
    '/auth/logout',
    {
      onRequest: app.requireSession,
      schema: {
        tags: ['autenticazione'],
        summary: 'Chiude la sessione in corso',
        response: { 200: acknowledged, ...errorResponses(401, 403) },
      },
    },
    async (request, reply) => {
      const session = sessionOf(request);
      await revokeSession(app.db, session.sessionId);
      await writeAudit(app.db, {
        action: AUTH_ACTIONS.logout,
        actorUserId: session.user.userId,
        actorLabel: session.user.fullName,
        sessionId: session.sessionId,
        ipHash: ipOf(request.ip),
      });
      reply.clearCookie(app.config.SESSION_COOKIE_NAME, { path: '/' });
      reply.clearCookie(app.config.CSRF_COOKIE_NAME, { path: '/' });
      return reply.send({ ok: true as const });
    },
  );

  typed.post(
    '/auth/password',
    {
      onRequest: app.requireSession,
      schema: {
        tags: ['autenticazione'],
        summary: 'Cambia la password della sessione in corso',
        body: changePasswordBody,
        response: { 200: acknowledged, ...errorResponses(400, 401, 403) },
      },
    },
    async (request, reply) => {
      const session = sessionOf(request);
      const owner = await findByEmail(app.db, session.user.email);
      const ok = await checkPassword(owner, request.body.currentPassword, app.config);

      if (!ok) {
        await writeAudit(app.db, {
          action: AUTH_ACTIONS.passwordChanged,
          outcome: 'failure',
          actorUserId: session.user.userId,
          actorLabel: session.user.fullName,
          sessionId: session.sessionId,
          ipHash: ipOf(request.ip),
        });
        return reply.code(403).send({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Indirizzo o password non corretti.',
            requestId: request.id,
          },
        });
      }

      await setPassword(app.db, app.config, session.user.userId, request.body.newPassword);
      // Controllo 5: il cambio password rigenera il token. Le altre sessioni
      // cadono — controllo 6 — e questa riparte con un token nuovo.
      await revokeAllSessions(app.db, session.user.userId);
      const renewed = await issueSession(app.db, app.config, session.user.userId, {
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      await writeAudit(app.db, {
        action: AUTH_ACTIONS.passwordChanged,
        actorUserId: session.user.userId,
        actorLabel: session.user.fullName,
        sessionId: renewed.sessionId,
        ipHash: ipOf(request.ip),
      });

      setSessionCookies(reply, app.config, renewed);
      return reply.send({ ok: true as const });
    },
  );

  typed.get(
    '/auth/sessions',
    {
      onRequest: app.requireSession,
      schema: {
        tags: ['autenticazione'],
        summary: 'Sessioni attive della persona',
        response: { 200: z.array(sessionSummary), ...errorResponses(401) },
      },
    },
    async (request, reply) => {
      const session = sessionOf(request);
      const rows = await listSessions(app.db, session.user.userId);
      return reply.send(
        rows.map((row) => ({
          id: row.id,
          issuedAt: row.issuedAt.toISOString(),
          lastSeenAt: row.lastSeenAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          userAgent: row.userAgent,
          current: row.id === session.sessionId,
        })),
      );
    },
  );

  typed.post(
    '/auth/sessions/revoke-all',
    {
      onRequest: app.requireSession,
      schema: {
        tags: ['autenticazione'],
        summary: 'Revoca tutte le altre sessioni della persona',
        response: { 200: revokedCount, ...errorResponses(401, 403) },
      },
    },
    async (request, reply) => {
      const session = sessionOf(request);
      const revoked = await revokeAllSessions(app.db, session.user.userId, session.sessionId);
      await writeAudit(app.db, {
        action: AUTH_ACTIONS.sessionsRevoked,
        actorUserId: session.user.userId,
        actorLabel: session.user.fullName,
        sessionId: session.sessionId,
        detail: { revoked },
        ipHash: ipOf(request.ip),
      });
      return reply.send({ revoked });
    },
  );
}
