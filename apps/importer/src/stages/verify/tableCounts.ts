/**
 * Misura i volumi **di tabella** (`report/tableCounts.ts`) e li confronta con
 * `EXPECTED_TABLE_COUNTS` — la tabella di `database-schema.md` §6, distinta
 * dai conteggi per fase di `report/constants.ts` (vedi la nota lì).
 *
 * DR-099: si contano solo le righe nate dall'import, così che un account
 * locale o il lavoro fatto nel CMS non spostino il volume. Una riga è
 * dell'import se il suo id, o quello del genitore, sta in `import_id_map`,
 * oppure, dove la tabella non passa dalla mappa, se ha origine `migration`.
 */
import { count, eq, inArray, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { schema } from '@amoris/db';
import type { Tx } from '../../persistence/tx.js';
import type { StageContext } from '../context.js';
import type { EntityKind } from '../types.js';
import {
  ALL_TABLE_COUNT_ROWS,
  EXPECTED_MEDIA_VARIANTS_ESTIMATE,
  EXPECTED_TABLE_COUNTS,
  type TableCountCheck,
  type TableCountRowName,
} from '../../report/tableCounts.js';

interface ImportedRows {
  readonly table: PgTable;
  readonly where: (tx: Tx) => SQL;
}

function mappedAs(column: PgColumn, entity: EntityKind): (tx: Tx) => SQL {
  return (tx) =>
    inArray(
      column,
      tx
        .select({ id: schema.importIdMap.entityId })
        .from(schema.importIdMap)
        .where(eq(schema.importIdMap.entity, entity)),
    );
}

const IMPORTED_ROWS: Readonly<Record<TableCountRowName, ImportedRows>> = {
  contents: { table: schema.contents, where: mappedAs(schema.contents.id, 'content') },
  media: { table: schema.media, where: mappedAs(schema.media.id, 'media') },
  terms: { table: schema.terms, where: mappedAs(schema.terms.id, 'term') },
  menu_items: { table: schema.menuItems, where: mappedAs(schema.menuItems.id, 'menu_item') },
  redirects: { table: schema.redirects, where: () => eq(schema.redirects.origin, 'migration') },
  forms: { table: schema.forms, where: mappedAs(schema.forms.id, 'form') },
  form_notifications: {
    table: schema.formNotifications,
    where: mappedAs(schema.formNotifications.formId, 'form'),
  },
  form_submissions: {
    table: schema.formSubmissions,
    where: () => eq(schema.formSubmissions.origin, 'migration'),
  },
  documents: { table: schema.documents, where: mappedAs(schema.documents.id, 'document') },
  slider_slides: {
    table: schema.sliderSlides,
    where: mappedAs(schema.sliderSlides.id, 'slider_slide'),
  },
  users: { table: schema.users, where: mappedAs(schema.users.id, 'user') },
  content_seo: {
    table: schema.contentSeo,
    where: mappedAs(schema.contentSeo.contentId, 'content'),
  },
};

async function countRows(ctx: StageContext, table: PgTable, where?: SQL): Promise<number> {
  const [row] = await ctx.tx.select({ n: count() }).from(table).where(where);
  return row?.n ?? 0;
}

export async function measureTableCounts(ctx: StageContext): Promise<readonly TableCountCheck[]> {
  const results: TableCountCheck[] = [];
  for (const row of ALL_TABLE_COUNT_ROWS) {
    const { table, where } = IMPORTED_ROWS[row];
    const value = await countRows(ctx, table, where(ctx.tx));
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
