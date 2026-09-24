/**
 * Fase 1 `settings` (`importer-spec.md` §4): produce `settings` e
 * `seo_templates` — la stessa fase per entrambe, come classificato in
 * `wp-to-postgres-mapping.md` §1.1 e §6.
 *
 * Entrambe le tabelle hanno una chiave naturale (`settings.key`,
 * `seo_templates.scope`): questa fase non usa `import_id_map`, aggiorna con
 * `INSERT … ON CONFLICT`.
 */
import { eq, sql } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { addStageResults } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import { SETTINGS_DEFINITIONS, type SettingsDefinition } from './definitions.js';
import { SEO_TEMPLATE_DEFINITIONS } from './seoTemplatesDefinitions.js';
import type { SqlRow } from '../../source/sql/types.js';

/**
 * `settings.value` è `jsonb NOT NULL`: un valore JavaScript `null` (per
 * `analytics.ga4_measurement_id` e `contact.address`, non ancora configurati)
 * deve diventare il letterale JSON `null`, non `NULL` di SQL — altrimenti il
 * vincolo `NOT NULL` lo rifiuta.
 */
function jsonbValue(value: unknown) {
  return value === null ? sql`'null'::jsonb` : value;
}

async function loadOptionValues(
  ctx: StageContext,
): Promise<ReadonlyMap<string, { value: string; optionId: number }>> {
  const rows = await ctx.source.rows('wp_options');
  const byName = new Map<string, { value: string; optionId: number }>();
  for (const row of rows as readonly SqlRow[]) {
    const name = row['option_name'];
    if (typeof name !== 'string') continue;
    const value = row['option_value'];
    const optionId = row['option_id'];
    byName.set(name, {
      value: value === null ? '' : String(value),
      optionId: typeof optionId === 'number' ? optionId : 0,
    });
  }
  return byName;
}

function defaultSourceKey(
  definition: SettingsDefinition & { source: { kind: 'default' } },
): ItemKey {
  return { sourceTable: 'settings', sourceId: definition.source.syntheticId };
}

async function runSettings(ctx: StageContext): Promise<StageResult> {
  const options = await loadOptionValues(ctx);

  return forEachItem(
    ctx.tx,
    SETTINGS_DEFINITIONS,
    (definition) => {
      if (definition.source.kind === 'wp_options') {
        const found = options.get(definition.source.optionName);
        return { sourceTable: 'wp_options', sourceId: found?.optionId ?? 0 };
      }
      return defaultSourceKey(definition as SettingsDefinition & { source: { kind: 'default' } });
    },
    async (definition, tx) => {
      let value: unknown;
      if (definition.source.kind === 'wp_options') {
        const found = options.get(definition.source.optionName);
        if (!found) {
          await ctx.issues.record({
            severity: 'warning',
            stage: 'settings',
            code: 'settings-value-missing',
            sourceTable: 'wp_options',
            sourceId: 0,
            detail: 'option-not-found',
          });
          return 'skipped';
        }
        value = definition.parse(found.value);
      } else {
        value = definition.defaultValue;
      }

      const [existing] = await tx
        .select({ key: schema.settings.key })
        .from(schema.settings)
        .where(eq(schema.settings.key, definition.key));

      await tx
        .insert(schema.settings)
        .values({
          key: definition.key,
          value: jsonbValue(value),
          label: definition.label,
          description: definition.description,
          isSecret: definition.isSecret,
        })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: {
            value: jsonbValue(value),
            label: definition.label,
            description: definition.description,
            updatedAt: new Date(),
          },
        });

      return existing ? 'updated' : 'created';
    },
    async (key, error) => {
      await ctx.issues.record({
        severity: 'error',
        stage: 'settings',
        code: 'item-import-failed',
        sourceTable: key.sourceTable,
        sourceId: key.sourceId,
        detail: error instanceof Error ? error.name : 'unknown-error',
      });
    },
  );
}

async function runSeoTemplates(ctx: StageContext): Promise<StageResult> {
  const indexed = SEO_TEMPLATE_DEFINITIONS.map((definition, index) => ({ definition, index }));
  return forEachItem(
    ctx.tx,
    indexed,
    ({ index }): ItemKey => ({ sourceTable: 'seo_templates', sourceId: index }),
    async ({ definition }, tx) => {
      const [existing] = await tx
        .select({ scope: schema.seoTemplates.scope })
        .from(schema.seoTemplates)
        .where(eq(schema.seoTemplates.scope, definition.scope));

      await tx
        .insert(schema.seoTemplates)
        .values({
          scope: definition.scope,
          titleTemplate: definition.titleTemplate,
          descriptionTemplate: definition.descriptionTemplate,
        })
        .onConflictDoUpdate({
          target: schema.seoTemplates.scope,
          set: {
            titleTemplate: definition.titleTemplate,
            descriptionTemplate: definition.descriptionTemplate,
            updatedAt: new Date(),
          },
        });

      return existing ? 'updated' : 'created';
    },
    async (key, error) => {
      await ctx.issues.record({
        severity: 'error',
        stage: 'settings',
        code: 'item-import-failed',
        sourceTable: key.sourceTable,
        sourceId: key.sourceId,
        detail: error instanceof Error ? error.name : 'unknown-error',
      });
    },
  );
}

export const settingsStage: Stage = {
  name: 'settings',
  dependsOn: ['preflight'],

  async expected() {
    return SETTINGS_DEFINITIONS.length + SEO_TEMPLATE_DEFINITIONS.length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const settingsResult = await runSettings(ctx);
    const seoResult = await runSeoTemplates(ctx);
    // La riga `settings` del rapporto conta le impostazioni, non i template
    // SEO, che non hanno una riga propria in `importer-spec.md` §8.1.
    return { ...addStageResults(settingsResult, seoResult), rowResult: settingsResult };
  },
};
