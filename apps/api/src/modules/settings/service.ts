import { schema, type Database } from '@amoris/db';
import { asc, eq } from 'drizzle-orm';

/** Servizio del dominio `settings`. */

const columns = {
  key: schema.settings.key,
  value: schema.settings.value,
  label: schema.settings.label,
  description: schema.settings.description,
  isSecret: schema.settings.isSecret,
  updatedAt: schema.settings.updatedAt,
};

export function list(db: Database) {
  return db.select(columns).from(schema.settings).orderBy(asc(schema.settings.key));
}

export async function findByKey(db: Database, key: string) {
  const [row] = await db
    .select(columns)
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1);
  return row ?? null;
}

export async function update(
  db: Database,
  key: string,
  input: { value: unknown; label?: string | undefined; description?: string | null | undefined },
  updatedBy: string,
) {
  const current = await findByKey(db, key);
  if (!current) return null;

  await db
    .update(schema.settings)
    .set({
      value: input.value,
      label: input.label ?? current.label,
      description: input.description === undefined ? current.description : input.description,
      updatedAt: new Date(),
      updatedBy,
    })
    .where(eq(schema.settings.key, key));
  return findByKey(db, key);
}
