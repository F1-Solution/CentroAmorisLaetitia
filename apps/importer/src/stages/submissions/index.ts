/**
 * Fase 12 `submissions` (`importer-spec.md` §4): produce `form_submissions`.
 *
 * Sorgente: le 425 righe di `wp_wpforms_entries` (misurate — ADR-010 §1.1),
 * più `wp_wpforms_entry_meta` per lo stesso `entry_id` (206 righe, un solo
 * `type`: `log`). `wp_wpforms_entry_fields` (3.710 righe) **non è una
 * sorgente**: `wp-to-postgres-mapping.md` §5 la dichiara ridondante rispetto
 * a `fields` — utile solo per *verificare* il conteggio dei valori, non per
 * scrivere — e questa fase non la legge.
 *
 * ## Forma di `form_submissions.payload`
 *
 * ```
 * {
 *   fields: <wp_wpforms_entries.fields, JSON della compilazione>,
 *   entryMeta: <wp_wpforms_entries.meta, JSON interno del plugin>,
 *   legacyMeta: [ { legacyId, type, data }, ... ]   // da wp_wpforms_entry_meta
 * }
 * ```
 *
 * `entryMeta` e `legacyMeta` sono chiavi dichiarate e separate, come chiede
 * `wp-to-postgres-mapping.md` §5: non si mescolano dentro `fields`. Le
 * colonne `status, type, viewed, starred, post_id, user_id, user_uuid` sono
 * **escluse**: stato dell'interfaccia del plugin, non un fatto della
 * compilazione (stesso paragrafo).
 *
 * ## Privacy
 *
 * `payload` contiene dati personali reali (DR-026, R-04, MI-06): nessun suo
 * valore compare mai in un log, un commento o un test di questa fase — i
 * test usano dati sintetici su `example.invalid`. `ip_address` non entra mai
 * nel database in chiaro: `ipHash` è il digest SHA-256 di
 * `sale || indirizzo`, con il sale da `IMPORTER_IP_HASH_SALT`
 * (`runtime/config.ts`), che deve restare stabile fra le esecuzioni.
 *
 * ## Idempotenza — la differenza rispetto a tutte le altre fasi
 *
 * `importer-spec.md` §6.2: le compilazioni **non si aggiornano mai**, sono un
 * fatto storico. `form_submissions.legacy_id` ha un vincolo di unicità
 * (`form_submissions_legacy_unique`): si usa quello con
 * `INSERT … ON CONFLICT DO NOTHING`, mai `import_id_map` e mai un
 * `ON CONFLICT DO UPDATE`. Una riga già presente si conta `skipped`, non
 * `updated` — a differenza di `sliders`, `documents` e le altre fasi di
 * contenuto.
 */
import { createHash } from 'node:crypto';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';

interface LegacyMetaEntry {
  readonly legacyId: number;
  readonly type: string;
  readonly data: string;
}

interface EntryRow {
  readonly legacyId: number;
  readonly formLegacyId: number;
  readonly submittedAt: Date | null;
  readonly rawFields: string;
  readonly rawMeta: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly legacyMeta: readonly LegacyMetaEntry[];
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function asDate(value: SqlRow[string] | undefined): Date | null {
  const raw = asString(value);
  if (!raw) return null;
  const parsed = new Date(raw.includes(' ') ? raw.replace(' ', 'T') : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** JSON se possibile, altrimenti la stringa grezza: mai un'eccezione qui, la sorgente non lo garantisce. */
function parseJsonOrRaw(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function loadEntryRows(ctx: StageContext): Promise<readonly EntryRow[]> {
  const [entryRows, metaRows] = await Promise.all([
    ctx.source.rows('wp_wpforms_entries'),
    ctx.source.rows('wp_wpforms_entry_meta'),
  ]);

  const metaByEntry = new Map<number, LegacyMetaEntry[]>();
  for (const row of metaRows as readonly SqlRow[]) {
    const entryId = asNumber(row['entry_id']);
    const entry: LegacyMetaEntry = {
      legacyId: asNumber(row['id']),
      type: asString(row['type']),
      data: asString(row['data']),
    };
    const list = metaByEntry.get(entryId) ?? [];
    list.push(entry);
    metaByEntry.set(entryId, list);
  }

  return (entryRows as readonly SqlRow[]).map((row) => {
    const legacyId = asNumber(row['entry_id']);
    return {
      legacyId,
      formLegacyId: asNumber(row['form_id']),
      submittedAt: asDate(row['date']),
      rawFields: asString(row['fields']),
      rawMeta: asString(row['meta']),
      ipAddress: asString(row['ip_address']) || null,
      userAgent: asString(row['user_agent']) || null,
      legacyMeta: metaByEntry.get(legacyId) ?? [],
    };
  });
}

/** Digest SHA-256 di `sale || indirizzo` — mai l'indirizzo in chiaro (`importer-spec.md`, questo modulo). */
function hashIp(salt: string, ipAddress: string): Buffer {
  return createHash('sha256').update(`${salt}${ipAddress}`, 'utf8').digest();
}

export const submissionsStage: Stage = {
  name: 'submissions',
  dependsOn: ['forms'],

  async expected(ctx: StageContext) {
    return (await ctx.source.rows('wp_wpforms_entries')).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    // Il sale arriva dal contesto, non dall'ambiente (`stages/context.ts`):
    // senza, questa fase non puo' scrivere un digest e si ferma apertamente.
    const ipHashSalt = ctx.ipHashSalt;
    if (!ipHashSalt) {
      throw new Error(
        "la fase 'submissions' richiede il sale per il digest degli indirizzi IP: valorizzare IMPORTER_IP_HASH_SALT",
      );
    }
    const rows = await loadEntryRows(ctx);

    return forEachItem(
      ctx.tx,
      rows,
      (row): ItemKey => ({ sourceTable: 'wp_wpforms_entries', sourceId: row.legacyId }),
      async (row, tx) => {
        const formId = await ctx.ids.find(tx, 'wp_posts', row.formLegacyId, 'form');
        if (!formId) throw new Error('form-not-found'); // isolato per compilazione, mai per l'intera fase

        if (!row.submittedAt) throw new Error('submission-date-invalid');

        const payload = {
          fields: parseJsonOrRaw(row.rawFields),
          entryMeta: parseJsonOrRaw(row.rawMeta),
          legacyMeta: row.legacyMeta.map((m) => ({
            legacyId: m.legacyId,
            type: m.type,
            data: m.data,
          })),
        };

        const [written] = await tx
          .insert(schema.formSubmissions)
          .values({
            formId,
            submittedAt: row.submittedAt,
            origin: 'migration',
            payload,
            ipHash: row.ipAddress ? hashIp(ipHashSalt, row.ipAddress) : null,
            userAgent: row.userAgent,
            legacyId: row.legacyId,
          })
          .onConflictDoNothing({ target: schema.formSubmissions.legacyId })
          .returning({ id: schema.formSubmissions.id });

        // Mai aggiornata (`importer-spec.md` §6.2): se la riga esisteva già,
        // `returning()` non restituisce nulla, non un'entità aggiornata.
        return written ? 'created' : 'skipped';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'submissions',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );
  },
};
