import { schema } from '@amoris/db';
import type { StageContext } from '../context.js';
import type { SqlRow } from '../../source/sql/types.js';

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * `page_on_front` → `settings['site.home_content_id']` (`wp-to-postgres-mapping.md`
 * §5, DR-114). Si scrive qui e non nella fase `settings`, perché richiede
 * l'identificativo di un contenuto, che nasce in questa fase
 * (`IMPORTER-DESIGN.md` §11.4).
 *
 * Solo con `show_on_front = page`: con `posts` la sorgente non ha una pagina
 * iniziale statica, e non se ne inventa una.
 */
export async function writeHomeContentSetting(
  ctx: StageContext,
  optionRows: readonly SqlRow[],
): Promise<void> {
  const option = (name: string) => optionRows.find((r) => asString(r['option_name']) === name);
  if (asString(option('show_on_front')?.['option_value']) !== 'page') return;

  const front = option('page_on_front');
  const legacyId = Number.parseInt(asString(front?.['option_value']), 10);
  if (!Number.isInteger(legacyId) || legacyId <= 0) return;

  const contentId = await ctx.ids.find(ctx.tx, 'wp_posts', legacyId, 'content');
  if (!contentId) {
    await ctx.issues.record({
      severity: 'warning',
      stage: 'contents',
      code: 'home-content-missing',
      sourceTable: 'wp_options',
      sourceId: typeof front?.['option_id'] === 'number' ? front['option_id'] : 0,
      detail: 'page-on-front-not-imported',
    });
    return;
  }

  const values = {
    value: contentId,
    label: 'Pagina iniziale',
    description: 'Il contenuto servito all’indirizzo «/».',
  };
  await ctx.tx
    .insert(schema.settings)
    .values({ key: 'site.home_content_id', ...values })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { ...values, updatedAt: new Date() },
    });
}
