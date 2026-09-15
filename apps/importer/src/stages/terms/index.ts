/**
 * Fase 4 `terms` (`importer-spec.md` §4): produce `terms`.
 *
 * `wp-to-postgres-mapping.md` §1.1 classifica `wp_terms` (48 righe) e
 * `wp_term_taxonomy` (48 righe) come sorgente di `terms`, ma «solo le
 * tassonomie utili» (`packages/db/src/schema/taxonomy.ts`): questa fase
 * importa **solo** `taxonomy = 'category'`. Le altre righe — `nav_menu`,
 * `link_category`, e ciò che resta — non producono termini: non c'è ancora
 * un uso per loro nel sistema nuovo, e importarle darebbe righe orfane.
 *
 * Ogni termine ha un identificatore numerico di sorgente (`wp_terms.term_id`):
 * questa fase usa `import_id_map`, non una chiave naturale.
 */
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';

interface CategoryRow {
  readonly termId: number;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly parentTermId: number; // 0 = radice
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

async function loadCategoryRows(ctx: StageContext): Promise<readonly CategoryRow[]> {
  const [termsRows, taxonomyRows] = await Promise.all([
    ctx.source.rows('wp_terms'),
    ctx.source.rows('wp_term_taxonomy'),
  ]);

  const termsById = new Map<number, { slug: string; name: string }>();
  for (const row of termsRows as readonly SqlRow[]) {
    const termId = asNumber(row['term_id']);
    termsById.set(termId, { slug: asString(row['slug']), name: asString(row['name']) });
  }

  const rows: CategoryRow[] = [];
  for (const row of taxonomyRows as readonly SqlRow[]) {
    if (asString(row['taxonomy']) !== 'category') continue;
    const termId = asNumber(row['term_id']);
    const term = termsById.get(termId);
    if (!term) continue; // riga di tassonomia senza il termine corrispondente: non classificabile qui
    rows.push({
      termId,
      slug: term.slug,
      name: term.name,
      description: asString(row['description']),
      parentTermId: asNumber(row['parent']),
    });
  }
  return rows;
}

/** Ordina radici prima dei figli, cosi' il genitore e' sempre gia' stato creato. */
function orderByDepth(rows: readonly CategoryRow[]): readonly CategoryRow[] {
  const byId = new Map(rows.map((r) => [r.termId, r]));
  const depthOf = (row: CategoryRow, seen: ReadonlySet<number> = new Set()): number => {
    if (row.parentTermId === 0 || seen.has(row.termId)) return 0;
    const parent = byId.get(row.parentTermId);
    if (!parent) return 0;
    return 1 + depthOf(parent, new Set([...seen, row.termId]));
  };
  return [...rows].sort((a, b) => depthOf(a) - depthOf(b));
}

export const termsStage: Stage = {
  name: 'terms',
  dependsOn: ['preflight'],

  async expected(ctx: StageContext) {
    return (await loadCategoryRows(ctx)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const rows = orderByDepth(await loadCategoryRows(ctx));
    const pathByTermId = new Map<number, string>();

    return forEachItem(
      ctx.tx,
      rows,
      (row): ItemKey => ({ sourceTable: 'wp_terms', sourceId: row.termId }),
      async (row, tx) => {
        const parentEntityId =
          row.parentTermId === 0
            ? null
            : await ctx.ids.find(tx, 'wp_terms', row.parentTermId, 'term');
        const parentPath = row.parentTermId === 0 ? '' : (pathByTermId.get(row.parentTermId) ?? '');
        const path = `/category${parentPath}/${row.slug}/`;
        pathByTermId.set(row.termId, `${parentPath}/${row.slug}`);

        const existingId = await ctx.ids.find(tx, 'wp_terms', row.termId, 'term');

        const [written] = await tx
          .insert(schema.terms)
          .values({
            id: existingId ?? undefined,
            taxonomy: 'category',
            slug: row.slug,
            name: row.name,
            description: row.description || null,
            parentId: parentEntityId,
            position: 0,
            path,
            legacyId: row.termId,
          })
          .onConflictDoUpdate({
            target: schema.terms.id,
            set: {
              taxonomy: 'category',
              slug: row.slug,
              name: row.name,
              description: row.description || null,
              parentId: parentEntityId,
              path,
              legacyId: row.termId,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.terms.id });

        if (!written) throw new Error('inserimento di terms non ha restituito una riga');

        // `import_id_map.run_id` è vincolato a `import_runs`: in `plan` non
        // esiste una riga lì (§5.2), quindi si ricorda senza collegarla a
        // un'esecuzione. In `apply`, `ctx.runId` è la riga creata prima di
        // eseguire le fasi (`cli/commands/apply.ts`).
        await ctx.ids.remember(
          tx,
          'wp_terms',
          row.termId,
          'term',
          written.id,
          ctx.mode === 'apply' ? ctx.runId : null,
          existingId ? 'updated' : 'created',
        );

        return existingId ? 'updated' : 'created';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'terms',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );
  },
};
