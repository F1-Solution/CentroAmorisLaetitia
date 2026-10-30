import type { UpdateAccountBody } from '@amoris/contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PERMISSIONS } from '../../auth/permissions.js';
import { hashAddress } from '../../lib/crypto.js';
import { errorResponses } from '../../lib/openapiErrors.js';
import { sessionOf } from '../../plugins/auth.js';
import { verifyCurrentPassword } from '../auth/service.js';
import {
  accountListSchema,
  createAccountBodySchema,
  createAccountResponseSchema,
  idParam,
  passwordResetBodySchema,
  passwordResetResponseSchema,
  updateAccountBodySchema,
  updateAccountResponseSchema,
} from './schemas.js';
import {
  createAccount,
  findAccount,
  listAccounts,
  resetPassword,
  updateAccount,
  type AccountRow,
} from './service.js';

/**
 * Modulo `accounts`, area Impostazioni, permesso `users.manage` (DR-227). La
 * password temporanea esce solo dalla creazione e dalla reimpostazione (DR-228);
 * il registro riceve l'id dell'account, mai indirizzi o password.
 */

const ENTITY = 'account';

/** Tetto per indirizzo sulle scritture: generano credenziali e revocano sessioni. */
const WRITE_LIMIT = { max: 30, timeWindow: '1 minute' };

const serialise = (row: AccountRow) => ({
  ...row,
  lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});

function conflict(request: FastifyRequest, reply: FastifyReply, code: string, message: string) {
  return reply.code(409).send({ error: { code, message, requestId: request.id } });
}

function unknownRole(request: FastifyRequest, reply: FastifyReply) {
  return reply.code(400).send({
    error: { code: 'VALIDATION_FAILED', message: 'Ruolo non disponibile.', requestId: request.id },
  });
}

/**
 * DR-288: sul proprio account ogni modifica chiede la password attuale, con il
 * conteggio e il registro di `/auth/password`; vero se ha già risposto con un
 * rifiuto (una risposta è *thenable*, quindi non si restituisce). Sugli account
 * altrui il campo si ignora.
 */
async function refuseWithoutCurrentPassword(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  targetId: string,
  currentPassword: string | undefined,
): Promise<boolean> {
  const session = sessionOf(request);
  if (targetId !== session.user.userId) return false;
  const refuse = (status: number, code: string, message: string): true => {
    void reply.code(status).send({ error: { code, message, requestId: request.id } });
    return true;
  };
  if (!currentPassword) {
    return refuse(
      400,
      'CURRENT_PASSWORD_REQUIRED',
      'Per modificare il proprio account serve la password attuale.',
    );
  }
  const verdict = await verifyCurrentPassword(
    app.db,
    app.config,
    { ...session.user, sessionId: session.sessionId },
    currentPassword,
    hashAddress(request.ip, app.config.IP_HASH_SALT),
    'account',
  );
  if (verdict === 'blocked') {
    return refuse(429, 'TOO_MANY_ATTEMPTS', 'Troppi tentativi. Riprovare più tardi.');
  }
  if (verdict === 'invalid') {
    return refuse(403, 'INVALID_CREDENTIALS', 'Indirizzo o password non corretti.');
  }
  return false;
}

/** Una richiesta, una riga: la disattivazione prevale sul cambio di ruoli, che prevale sul resto. */
function updateAction(body: UpdateAccountBody): string {
  if (body.isActive === false) return 'account.deactivate';
  if (body.isActive === true) return 'account.reactivate';
  if (body.roleKeys) return 'account.roles';
  return 'account.update';
}

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  // Elenco con nomi e indirizzi, password temporanee: nessuna risposta del modulo resta in cache (ASVS 8.2.1).
  app.addHook('onSend', async (_request, reply) => {
    void reply.header('Cache-Control', 'no-store');
  });

  typed.get(
    '/accounts',
    {
      onRequest: app.requirePermission(PERMISSIONS.usersManage),
      schema: {
        tags: ['account'],
        summary: 'Elenca gli account con i loro ruoli',
        response: { 200: accountListSchema, ...errorResponses(401, 403) },
      },
    },
    async (_request, reply) => reply.send({ items: (await listAccounts(app.db)).map(serialise) }),
  );

  typed.post(
    '/accounts',
    {
      onRequest: app.requirePermission(PERMISSIONS.usersManage),
      config: {
        rateLimit: WRITE_LIMIT,
        audit: { action: 'account.create', entityType: ENTITY },
      },
      schema: {
        tags: ['account'],
        summary: 'Crea un account con una password temporanea mostrata una sola volta',
        body: createAccountBodySchema,
        response: {
          201: createAccountResponseSchema,
          ...errorResponses(400, 401, 403, 409, 429),
        },
      },
    },
    async (request, reply) => {
      const result = await createAccount(
        app.db,
        app.config,
        request.body,
        sessionOf(request).user.userId,
      );
      if (result.kind === 'unknown_role') return unknownRole(request, reply);
      if (result.kind === 'email_taken') {
        return conflict(
          request,
          reply,
          'EMAIL_TAKEN',
          'Esiste già un account con questo indirizzo.',
        );
      }
      request.auditTarget = {
        entityId: result.id,
        detail: { accountId: result.id, roleKeys: [...request.body.roleKeys].sort() },
      };
      const account = await findAccount(app.db, result.id);
      if (!account) throw new Error('account creato ma non rileggibile');
      return reply
        .code(201)
        .send({ account: serialise(account), temporaryPassword: result.temporaryPassword });
    },
  );

  typed.patch(
    '/accounts/:id',
    {
      onRequest: app.requirePermission(PERMISSIONS.usersManage),
      config: {
        rateLimit: WRITE_LIMIT,
        audit: { action: 'account.update', entityType: ENTITY },
      },
      schema: {
        tags: ['account'],
        summary:
          'Modifica nome, email, ruoli o stato di un account; un indirizzo nuovo chiude le sue sessioni; sul proprio serve la password attuale',
        params: idParam,
        body: updateAccountBodySchema,
        response: {
          200: updateAccountResponseSchema,
          ...errorResponses(400, 401, 403, 404, 409, 429),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { currentPassword, ...body } = request.body;
      request.declaredAudit = { action: updateAction(body), entityType: ENTITY };
      const detail = {
        accountId: id,
        ...(body.roleKeys ? { roleKeys: [...body.roleKeys].sort() } : {}),
      };
      request.auditTarget = { entityId: id, detail };
      if (await refuseWithoutCurrentPassword(app, request, reply, id, currentPassword))
        return reply;
      const result = await updateAccount(app.db, id, body, sessionOf(request).user.userId);
      if (result.kind === 'not_found') return reply.callNotFound();
      if (result.kind === 'unknown_role') return unknownRole(request, reply);
      if (result.kind === 'email_taken') {
        return conflict(
          request,
          reply,
          'EMAIL_TAKEN',
          'Esiste già un account con questo indirizzo.',
        );
      }
      if (result.kind === 'last_admin') {
        return conflict(
          request,
          reply,
          'LAST_ADMINISTRATOR',
          'Non è possibile: nessun account attivo avrebbe più il ruolo di amministrazione.',
        );
      }
      // Nomi dei campi cambiati, mai i valori: nessun indirizzo nel registro (DR-282).
      if (result.fields.length > 0) {
        request.auditTarget = { entityId: id, detail: { ...detail, fields: result.fields } };
      }
      const account = await findAccount(app.db, id);
      if (!account) return reply.callNotFound();
      return reply.send({ account: serialise(account) });
    },
  );

  typed.post(
    '/accounts/:id/password-reset',
    {
      onRequest: app.requirePermission(PERMISSIONS.usersManage),
      config: {
        rateLimit: WRITE_LIMIT,
        audit: { action: 'account.password_reset', entityType: ENTITY },
      },
      schema: {
        tags: ['account'],
        summary:
          'Reimposta la password: nuova password temporanea, sessioni chiuse; corpo facoltativo, `currentPassword` serve solo sulla propria',
        params: idParam,
        body: passwordResetBodySchema,
        response: {
          200: passwordResetResponseSchema,
          ...errorResponses(400, 401, 403, 404, 429),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      request.auditTarget = { entityId: id, detail: { accountId: id } };
      const currentPassword = request.body?.currentPassword;
      if (await refuseWithoutCurrentPassword(app, request, reply, id, currentPassword))
        return reply;
      const temporaryPassword = await resetPassword(app.db, app.config, id);
      if (!temporaryPassword) return reply.callNotFound();
      return reply.send({ temporaryPassword });
    },
  );
}
