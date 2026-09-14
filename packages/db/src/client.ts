import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

/**
 * Connessione a PostgreSQL. La convenzione dei nomi e' `snake_case` per
 * decisione DR-036: Drizzle la applica per convenzione, non annotazione per
 * annotazione (ADR-002 §3).
 */
export interface DatabaseOptions {
  readonly url: string;
  readonly maxConnections?: number;
}

export function createDatabase({ url, maxConnections = 10 }: DatabaseOptions) {
  const client = postgres(url, { max: maxConnections, onnotice: () => {} });
  const db = drizzle(client, { schema, casing: 'snake_case' });
  return { db, client, close: () => client.end({ timeout: 5 }) };
}

export type Database = ReturnType<typeof createDatabase>['db'];

/**
 * Verifica che il database risponda. Sta qui e non nel servizio API perche'
 * ADR-008 §3.3 tiene l'accesso al database dentro un pacchetto solo: chi lo usa
 * non importa l'ORM.
 */
export async function ping(db: Database): Promise<void> {
  await db.execute(sql`select 1`);
}
