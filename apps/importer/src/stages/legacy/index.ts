/**
 * Fase 13 `legacy` (`importer-spec.md` §4): produce `legacy_email_log` e
 * `legacy_download_stats`.
 *
 * DR-026: si importa tutto, senza bonifica. Queste due tabelle **non
 * alimentano alcuna funzione** della Fase 1 (`packages/db/src/schema/legacy.ts`):
 * esistono solo per non perdere dati, in attesa di una verifica legale (MI-06).
 *
 * Sorgenti:
 * - `wp_wpmailsmtp_debug_events` (187 righe misurate), colonne
 *   `id, content, initiator, event_type, created_at` → `legacy_email_log`
 *   (`occurredAt` da `created_at`, `eventType` da `event_type`, `payload` con
 *   il resto — `content` e `initiator` includono destinatari di email: **dati
 *   personali**, mai stampati né qui né altrove).
 * - `wp_ahm_download_stats` (1 riga misurata), colonne
 *   `id, pid, uid, year, month, day, timestamp, ip, filename, agent` →
 *   `legacy_download_stats`. **`ip` non si conserva in chiaro**: lo schema
 *   non ha una colonna `ipHash` per questa tabella (a differenza di
 *   `form_submissions`), quindi il digest SHA-256 di `sale || indirizzo`
 *   (stesso sale di `stages/submissions/index.ts`,
 *   `IMPORTER_IP_HASH_SALT`) sta dentro `payload`, sotto la chiave dichiarata
 *   `ipHashHex` — il valore originale non compare in nessuna colonna.
 *
 * Idempotenza (`importer-spec.md` §6.2): **solo inserimento, mai
 * aggiornamento**. Entrambe le tabelle hanno un vincolo di unicità su
 * `legacyId`: alla riesecuzione la riga già presente si conta `skipped`, mai
 * `updated` — stessa differenza già spiegata in `stages/submissions/index.ts`.
 */
import { createHash } from 'node:crypto';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';

interface EmailLogRow {
  readonly legacyId: number;
  readonly occurredAt: Date | null;
  readonly eventType: string | null;
  readonly content: string;
  readonly initiator: string;
}

interface DownloadStatRow {
  readonly legacyId: number;
  readonly occurredAt: Date | null;
  readonly pid: number;
  readonly uid: number;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly ipAddress: string | null;
  readonly filename: string;
  readonly agent: string;
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
  const asEpochSeconds = Number.parseInt(raw, 10);
  // `wp_ahm_download_stats.timestamp` è un intero Unix; `created_at` è una
  // data testuale MySQL. Si prova prima come intero, poi come data.
  if (/^\d+$/.test(raw) && asEpochSeconds > 0) return new Date(asEpochSeconds * 1000);
  const parsed = new Date(raw.includes(' ') ? raw.replace(' ', 'T') : raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadEmailLogRows(ctx: StageContext): Promise<readonly EmailLogRow[]> {
  const rows = await ctx.source.rows('wp_wpmailsmtp_debug_events');
  return (rows as readonly SqlRow[]).map((row) => ({
    legacyId: asNumber(row['id']),
    occurredAt: asDate(row['created_at']),
    eventType: asString(row['event_type']) || null,
    content: asString(row['content']),
    initiator: asString(row['initiator']),
  }));
}

async function loadDownloadStatRows(ctx: StageContext): Promise<readonly DownloadStatRow[]> {
  const rows = await ctx.source.rows('wp_ahm_download_stats');
  return (rows as readonly SqlRow[]).map((row) => ({
    legacyId: asNumber(row['id']),
    occurredAt: asDate(row['timestamp']),
    pid: asNumber(row['pid']),
    uid: asNumber(row['uid']),
    year: asNumber(row['year']),
    month: asNumber(row['month']),
    day: asNumber(row['day']),
    ipAddress: asString(row['ip']) || null,
    filename: asString(row['filename']),
    agent: asString(row['agent']),
  }));
}

/** Digest SHA-256 di `sale || indirizzo`, in esadecimale: mai l'indirizzo in chiaro. */
function hashIpHex(salt: string, ipAddress: string): string {
  return createHash('sha256').update(`${salt}${ipAddress}`, 'utf8').digest('hex');
}

export const legacyStage: Stage = {
  name: 'legacy',
  dependsOn: [],

  async expected(ctx: StageContext) {
    const [emailRows, downloadRows] = await Promise.all([
      ctx.source.rows('wp_wpmailsmtp_debug_events'),
      ctx.source.rows('wp_ahm_download_stats'),
    ]);
    return emailRows.length + downloadRows.length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    // Il sale arriva dal contesto, non dall'ambiente (`stages/context.ts`):
    // senza, questa fase non puo' scrivere un digest e si ferma apertamente.
    const ipHashSalt = ctx.ipHashSalt;
    if (!ipHashSalt) {
      throw new Error(
        "la fase 'legacy' richiede il sale per il digest degli indirizzi IP: valorizzare IMPORTER_IP_HASH_SALT",
      );
    }
    const emailRows = await loadEmailLogRows(ctx);
    const downloadRows = await loadDownloadStatRows(ctx);

    const items: (
      | { readonly kind: 'email'; readonly row: EmailLogRow }
      | { readonly kind: 'download'; readonly row: DownloadStatRow }
    )[] = [
      ...emailRows.map((row) => ({ kind: 'email' as const, row })),
      ...downloadRows.map((row) => ({ kind: 'download' as const, row })),
    ];

    return forEachItem(
      ctx.tx,
      items,
      (item): ItemKey =>
        item.kind === 'email'
          ? { sourceTable: 'wp_wpmailsmtp_debug_events', sourceId: item.row.legacyId }
          : { sourceTable: 'wp_ahm_download_stats', sourceId: item.row.legacyId },
      async (item, tx) => {
        if (item.kind === 'email') {
          const row = item.row;
          const [written] = await tx
            .insert(schema.legacyEmailLog)
            .values({
              occurredAt: row.occurredAt,
              eventType: row.eventType,
              payload: { content: row.content, initiator: row.initiator },
              legacyId: row.legacyId,
            })
            .onConflictDoNothing({ target: schema.legacyEmailLog.legacyId })
            .returning({ id: schema.legacyEmailLog.id });
          return written ? 'created' : 'skipped'; // mai aggiornata, importer-spec.md §6.2
        }

        const row = item.row;
        const [written] = await tx
          .insert(schema.legacyDownloadStats)
          .values({
            occurredAt: row.occurredAt,
            payload: {
              pid: row.pid,
              uid: row.uid,
              year: row.year,
              month: row.month,
              day: row.day,
              filename: row.filename,
              agent: row.agent,
              // Digest, mai l'indirizzo in chiaro: vedi il commento di testa.
              ipHashHex: row.ipAddress ? hashIpHex(ipHashSalt, row.ipAddress) : null,
            },
            legacyId: row.legacyId,
          })
          .onConflictDoNothing({ target: schema.legacyDownloadStats.legacyId })
          .returning({ id: schema.legacyDownloadStats.id });
        return written ? 'created' : 'skipped';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'legacy',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );
  },
};
