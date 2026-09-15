/**
 * Misura i volumi **di tabella** (`report/tableCounts.ts`) e li confronta con
 * `EXPECTED_TABLE_COUNTS` — la tabella di `database-schema.md` §6, distinta
 * dai conteggi per fase di `report/constants.ts` (vedi la nota lì).
 */
import { count } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { schema } from '@amoris/db';
import type { StageContext } from '../context.js';
import {
  ALL_TABLE_COUNT_ROWS,
  EXPECTED_MEDIA_VARIANTS_ESTIMATE,
  EXPECTED_TABLE_COUNTS,
  type TableCountCheck,
  type TableCountRowName,
} from '../../report/tableCounts.js';

const TABLE_BY_ROW: Readonly<Record<TableCountRowName, PgTable>> = {
  contents: schema.contents,
  media: schema.media,
  terms: schema.terms,
  menu_items: schema.menuItems,
  redirects: schema.redirects,
  forms: schema.forms,
  form_notifications: schema.formNotifications,
  form_submissions: schema.formSubmissions,
  documents: schema.documents,
  slider_slides: schema.sliderSlides,
  users: schema.users,
  content_seo: schema.contentSeo,
};

async function countRows(ctx: StageContext, table: PgTable): Promise<number> {
  const [row] = await ctx.tx.select({ n: count() }).from(table);
  return row?.n ?? 0;
}

export async function measureTableCounts(ctx: StageContext): Promise<readonly TableCountCheck[]> {
  const results: TableCountCheck[] = [];
  for (const row of ALL_TABLE_COUNT_ROWS) {
    const value = await countRows(ctx, TABLE_BY_ROW[row]);
    const expected = EXPECTED_TABLE_COUNTS[row];
    results.push({ table: row, value, expected, ok: value === expected });
  }
  return results;
}

/** Stima, non un'uguaglianza (`wp-to-postgres-mapping.md` §3.4): misurata e riportata, mai motivo di fallimento da sola. */
export async function measureMediaVariantsEstimate(
  ctx: StageContext,
): Promise<{ value: number; expected: number }> {
  const value = await countRows(ctx, schema.mediaVariants);
  return { value, expected: EXPECTED_MEDIA_VARIANTS_ESTIMATE };
}
