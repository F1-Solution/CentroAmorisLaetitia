import { schema, type Database } from '@amoris/db';
import { asc } from 'drizzle-orm';

/** Servizio del dominio `roles`. Sola lettura: i ruoli non si creano da qui. */

export function list(db: Database) {
  return db
    .select({ key: schema.roles.key, label: schema.roles.label })
    .from(schema.roles)
    .orderBy(asc(schema.roles.key));
}
