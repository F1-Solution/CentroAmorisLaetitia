import { schema, type Database } from '@amoris/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Config } from '../../config.js';

/**
 * Invio di un form pubblico (ADR-010 §4.3–§4.4). Niente stato in memoria: la
 * limitazione si legge dalle compilazioni già scritte, come `loginAttempts.ts`
 * legge dal registro delle operazioni.
 */

export interface DefinitionField {
  readonly id: string;
  readonly type: string;
  readonly required: boolean;
  readonly options: Readonly<Record<string, unknown>>;
}

/** I campi noti della definizione grezza, con i tipi minimi per validare e salvare. */
export function parseDefinitionFields(definition: unknown): readonly DefinitionField[] {
  const raw =
    definition && typeof definition === 'object'
      ? (definition as { fields?: unknown }).fields
      : null;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (f): f is DefinitionField =>
      f !== null &&
      typeof f === 'object' &&
      typeof (f as Record<string, unknown>)['id'] === 'string' &&
      typeof (f as Record<string, unknown>)['type'] === 'string',
  );
}

export async function evaluateSubmissionAttempts(
  db: Database,
  config: Config,
  formId: string,
  ipHash: Buffer | null,
): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - config.FORM_SUBMIT_WINDOW_MINUTES * 60_000);
  const [perIp] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.formSubmissions)
    .where(
      and(
        eq(schema.formSubmissions.ipHash, ipHash),
        gte(schema.formSubmissions.submittedAt, since),
      ),
    );
  const [perFormAndIp] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.formSubmissions)
    .where(
      and(
        eq(schema.formSubmissions.formId, formId),
        eq(schema.formSubmissions.ipHash, ipHash),
        gte(schema.formSubmissions.submittedAt, since),
      ),
    );
  return (
    (perIp?.count ?? 0) >= config.FORM_SUBMIT_MAX_PER_IP ||
    (perFormAndIp?.count ?? 0) >= config.FORM_SUBMIT_MAX_PER_FORM_AND_IP
  );
}

/** Un campo per tipo: `html` e `payment-single` non raccolgono un valore (ADR-010 §4.2). */
function zodForField(field: DefinitionField): z.ZodTypeAny {
  if (field.type === 'checkbox') {
    const base = z.array(z.string().max(500)).max(50);
    return field.required ? base.min(1, 'scegli almeno un’opzione') : base.default([]);
  }
  const base = z.string().trim().max(5000);
  return field.required ? base.min(1, 'campo obbligatorio') : base.optional().default('');
}

/** Generato dalla definizione del form, non scritto a mano (ADR-010 §4.3). */
export function schemaForForm(
  fields: readonly DefinitionField[],
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.type === 'html' || field.type === 'payment-single') continue;
    shape[field.id] = zodForField(field);
  }
  return z.object(shape).strict();
}

export function numericOption(
  options: Readonly<Record<string, unknown>>,
  key: string,
): number | null {
  const raw = options[key];
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
