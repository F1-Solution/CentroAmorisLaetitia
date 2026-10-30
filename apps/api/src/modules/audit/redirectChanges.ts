import type { AddressPlan } from '@amoris/contracts';
import { schema, type Database } from '@amoris/db';
import type { AuditEntry } from '../../auth/audit.js';

/**
 * Redirect creati, riscritti o tolti da un cambio d'indirizzo o di categoria (W8-31, HO-046 §5):
 * si confronta la tabella prima e dopo, ma solo per le regole del piano applicato dalla richiesta.
 */

/** Azioni dichiarate dalle rotte che possono toccare le regole come effetto collaterale. */
export const REDIRECT_CAUSES: ReadonlySet<string> = new Set([
  'content.address.update',
  'term.update',
]);

interface RuleState {
  readonly source: string;
  readonly target: string;
  readonly isActive: boolean;
}

export type RedirectSnapshot = ReadonlyMap<string, RuleState>;

export async function snapshotRedirects(db: Database): Promise<RedirectSnapshot> {
  const rows = await db
    .select({
      id: schema.redirects.id,
      source: schema.redirects.sourcePath,
      target: schema.redirects.targetPath,
      isActive: schema.redirects.isActive,
    })
    .from(schema.redirects);
  return new Map(rows.map((row) => [row.id, row]));
}

/** Indirizzi di partenza delle regole che il piano applicato crea, riscrive o toglie. */
export function redirectSourcesOf(
  plan: Pick<AddressPlan, 'redirectsCreated' | 'redirectsRetargeted' | 'redirectsRemoved'>,
): ReadonlySet<string> {
  return new Set([
    ...plan.redirectsCreated.map((rule) => rule.from),
    ...plan.redirectsRetargeted.map((rule) => rule.source),
    ...plan.redirectsRemoved.map((rule) => rule.source),
  ]);
}

/** Una riga per regola del piano: l'indirizzo di partenza come nome, la destinazione nel dettaglio. */
export function redirectAuditEntries(
  before: RedirectSnapshot,
  after: RedirectSnapshot,
  cause: string,
  sources: ReadonlySet<string>,
): AuditEntry[] {
  const entry = (action: string, id: string, rule: RuleState): AuditEntry => ({
    action,
    entityType: 'redirect',
    entityId: id,
    detail: { label: rule.source, target: rule.target, automatic: true, cause },
  });
  const entries: AuditEntry[] = [];
  for (const [id, rule] of after) {
    if (!sources.has(rule.source)) continue;
    const old = before.get(id);
    if (!old) entries.push(entry('redirect.create', id, rule));
    else if (old.target !== rule.target || old.isActive !== rule.isActive) {
      entries.push(entry('redirect.update', id, rule));
    }
  }
  for (const [id, rule] of before) {
    if (sources.has(rule.source) && !after.has(id))
      entries.push(entry('redirect.delete', id, rule));
  }
  return entries;
}
