import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

/**
 * Impostazioni globali. Requisiti RC-03, RC-05, RC-09, RC-10, RC-11.
 *
 * `isSecret` esiste per marcare valori da non mostrare in chiaro
 * nell'interfaccia, **non** per conservare credenziali: chiavi API, password e
 * token stanno in variabili d'ambiente (ADR-009 §4.3), mai a database.
 */
export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  label: text().notNull(),
  description: text(),
  isSecret: boolean().notNull().default(false),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
});
