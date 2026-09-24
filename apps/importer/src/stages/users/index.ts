/**
 * Fase 2 `users` (`importer-spec.md` §4): produce `users`, `roles`,
 * `permissions`. `wp-to-postgres-mapping.md` §4.5: 52 righe di `wp_usermeta`,
 * **un solo utente**. Le password **non si importano** — `users.passwordHash`
 * resta nullo, `mustChangePassword = true` — `importer-spec.md` §12.
 *
 * `users` ha un identificatore numerico di sorgente (`wp_users.ID`): questa
 * fase usa `import_id_map`. `roles`/`permissions` sono chiave naturale, vedi
 * `roleSeed.ts`.
 */
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';
import { ensureSystemRole } from './roleSeed.js';
import { interpretCapabilities } from './capabilities.js';

interface SourceUser {
  readonly id: number;
  readonly email: string;
  readonly displayName: string;
  readonly userRegistered: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly nickname: string;
  readonly capabilitiesSerialized: string | null;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

async function loadSourceUsers(ctx: StageContext): Promise<readonly SourceUser[]> {
  const [userRows, metaRows] = await Promise.all([
    ctx.source.rows('wp_users'),
    ctx.source.rows('wp_usermeta'),
  ]);

  const metaByUser = new Map<number, Map<string, string>>();
  for (const row of metaRows as readonly SqlRow[]) {
    const userId = Number(row['user_id']);
    const key = asString(row['meta_key']);
    if (!metaByUser.has(userId)) metaByUser.set(userId, new Map());
    metaByUser.get(userId)!.set(key, asString(row['meta_value']));
  }

  return (userRows as readonly SqlRow[]).map((row) => {
    const id = Number(row['ID']);
    const meta = metaByUser.get(id) ?? new Map<string, string>();
    return {
      id,
      email: asString(row['user_email']),
      displayName: asString(row['display_name']),
      userRegistered: asString(row['user_registered']),
      firstName: meta.get('first_name') ?? '',
      lastName: meta.get('last_name') ?? '',
      nickname: meta.get('nickname') ?? '',
      capabilitiesSerialized: meta.get('wp_capabilities') ?? null,
    };
  });
}

function fullNameOf(user: SourceUser): string {
  if (user.displayName.trim()) return user.displayName.trim();
  const composed = `${user.firstName} ${user.lastName}`.trim();
  if (composed) return composed;
  if (user.nickname.trim()) return user.nickname.trim();
  return `Persona ${user.id}`;
}

function parseTimestamp(raw: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const usersStage: Stage = {
  name: 'users',
  dependsOn: ['preflight'],

  async expected(ctx: StageContext) {
    return (await ctx.source.rows('wp_users')).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const roleId = await ensureSystemRole(ctx.tx);
    const users = await loadSourceUsers(ctx);

    return forEachItem(
      ctx.tx,
      users,
      (user): ItemKey => ({ sourceTable: 'wp_users', sourceId: user.id }),
      async (user, tx) => {
        if (!user.email) {
          throw new Error('utente sorgente senza indirizzo email');
        }

        const existingId = await ctx.ids.find(tx, 'wp_users', user.id, 'user');
        const createdAt = parseTimestamp(user.userRegistered);

        const [written] = await tx
          .insert(schema.users)
          .values({
            id: existingId ?? undefined,
            email: user.email,
            fullName: fullNameOf(user),
            isActive: true,
            mustChangePassword: true,
            legacyId: user.id,
            createdAt,
          })
          .onConflictDoUpdate({
            target: schema.users.id,
            set: {
              email: user.email,
              fullName: fullNameOf(user),
              legacyId: user.id,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.users.id });

        if (!written) throw new Error('inserimento di users non ha restituito una riga');

        // `import_id_map.run_id` è vincolato a `import_runs`: in `plan` non
        // esiste una riga lì (§5.2), quindi si ricorda senza collegarla a
        // un'esecuzione.
        await ctx.ids.remember(
          tx,
          'wp_users',
          user.id,
          'user',
          written.id,
          ctx.mode === 'apply' ? ctx.runId : null,
          existingId ? 'updated' : 'created',
        );

        // ADR-007 §3.2: un solo ruolo esiste, `editor`. Lo si assegna sempre —
        // in Fase 1 non c'è un secondo ruolo a cui assegnare chi non ha
        // `administrator` — ma una capacità non riconosciuta o assente è un
        // caso non atteso sulla sorgente misurata (1 utente, amministratore),
        // e si segnala.
        const capabilities = user.capabilitiesSerialized
          ? interpretCapabilities(user.capabilitiesSerialized)
          : { mapsToEditor: false, capabilityNames: [] };

        await tx
          .insert(schema.userRoles)
          .values({ userId: written.id, roleId })
          .onConflictDoNothing();

        if (!capabilities.mapsToEditor) {
          await ctx.issues.record({
            severity: 'warning',
            stage: 'users',
            code: 'unclassified-capabilities',
            sourceTable: 'wp_usermeta',
            sourceId: user.id,
            detail: null,
          });
        }

        return existingId ? 'updated' : 'created';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'users',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );
  },
};
