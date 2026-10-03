import { sql, type SQL } from 'drizzle-orm';

/** L'ora del database al millisecondo (DR-091): un solo orologio per i confronti della protezione redazionale. */
export function databaseNow(): SQL {
  return sql`date_trunc('milliseconds', now())`;
}
