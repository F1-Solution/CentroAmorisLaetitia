/**
 * Ruoli e permessi di sistema (ADR-007 §3.2): un solo ruolo, `editor`, con
 * cinque permessi. Non arrivano da `wp_users`/`wp_usermeta`: sono vocabolario
 * fisso dell'applicazione nuova, seminato a ogni esecuzione della fase
 * `users`. Chiave naturale (`roles.key`, `permissions.key`): nessun
 * `import_id_map`.
 */
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Tx } from '../../persistence/tx.js';

export const SYSTEM_ROLE_KEY = 'editor';

const SYSTEM_PERMISSIONS: readonly { key: string; label: string }[] = [
  { key: 'content.read', label: 'Leggere i contenuti' },
  { key: 'content.write', label: 'Modificare i contenuti' },
  { key: 'content.publish', label: 'Pubblicare i contenuti' },
  { key: 'media.write', label: 'Caricare e modificare i media' },
  { key: 'settings.write', label: 'Modificare le impostazioni' },
];

/** Restituisce l'id del ruolo `editor`, creandolo se non esiste ancora. */
export async function ensureSystemRole(tx: Tx): Promise<string> {
  for (const permission of SYSTEM_PERMISSIONS) {
    await tx
      .insert(schema.permissions)
      .values({ key: permission.key, label: permission.label })
      .onConflictDoUpdate({ target: schema.permissions.key, set: { label: permission.label } });
  }

  const [existingRole] = await tx
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.key, SYSTEM_ROLE_KEY));

  const roleId =
    existingRole?.id ??
    (
      await tx
        .insert(schema.roles)
        .values({ key: SYSTEM_ROLE_KEY, label: 'Redazione', isSystem: true })
        .returning({ id: schema.roles.id })
    )[0]?.id;

  if (!roleId) throw new Error('impossibile creare o trovare il ruolo di sistema editor');

  for (const permission of SYSTEM_PERMISSIONS) {
    await tx
      .insert(schema.rolePermissions)
      .values({ roleId, permissionKey: permission.key })
      .onConflictDoNothing();
  }

  return roleId;
}
