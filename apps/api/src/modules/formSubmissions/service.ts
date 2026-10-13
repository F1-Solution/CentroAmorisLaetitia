import { schema, type Database } from '@amoris/db';
import { and, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  choiceEntries,
  compositeKeys,
  visibleFieldIds,
  type CompositeKey,
  type FormValues,
} from '@amoris/blocks/form';
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

const text = z.string().trim().max(5000);
const email = z.union([z.literal(''), z.email('indirizzo email non valido')]);

/** Sotto-campi dalla stessa definizione della pagina (`compositeKeys`, DR-133). */
function partsObject(keys: readonly CompositeKey[], required: boolean, inner: z.ZodString = text) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const part of keys) {
    shape[part.key] =
      required && !part.optional ? inner.min(1, 'campo obbligatorio') : inner.default('');
  }
  return z.object(shape).strict();
}

/** Solo le etichette offerte dal campo: un valore inventato non attiva rami condizionali. */
function oneOfChoices(field: DefinitionField): z.ZodType<string> {
  const labels = new Set(choiceEntries(field.options).map((choice) => choice.label));
  return z
    .string()
    .max(500)
    .refine((value) => labels.size === 0 || labels.has(value), 'scelta non prevista');
}

/** Un campo per tipo: `html` e `payment-single` non raccolgono un valore (ADR-010 §4.2). */
function zodForField(field: DefinitionField): z.ZodTypeAny {
  const { required } = field;
  if (field.type === 'checkbox') {
    const base = z.array(oneOfChoices(field)).max(50);
    return required ? base.min(1, 'scegli almeno un’opzione') : base.default([]);
  }
  if (field.type === 'radio') {
    const choice = oneOfChoices(field);
    return required ? choice : z.union([z.literal(''), choice]).default('');
  }
  const keys = compositeKeys(field);
  if (keys && field.type === 'email') {
    // La conferma si controlla e non si salva: resta l'indirizzo, come testo.
    return partsObject(keys, required)
      .refine((v) => v['primary'] === v['secondary'], 'le due email non coincidono')
      .refine((v) => email.safeParse(v['primary']).success, 'indirizzo email non valido')
      .transform((v) => v['primary'] as string);
  }
  if (keys) return partsObject(keys, required);
  if (field.type === 'email') {
    return required
      ? text.pipe(z.email('indirizzo email non valido'))
      : text.pipe(email).default('');
  }
  return required ? text.min(1, 'campo obbligatorio') : text.optional().default('');
}

/**
 * Generato dalla definizione del form, non scritto a mano (ADR-010 §4.3). Un
 * campo nascosto dalla logica condizionale non si chiede e non si salva, come
 * nella pagina (1E-W6).
 */
export function schemaForForm(
  fields: readonly DefinitionField[],
  values: FormValues,
): z.ZodType<Record<string, unknown>> {
  const visible = visibleFieldIds(fields, values);
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    if (field.type === 'html' || field.type === 'payment-single') continue;
    const schema = zodForField(field);
    shape[field.id] = !visible.has(field.id)
      ? z
          .unknown()
          .optional()
          .transform(() => undefined)
      : field.required
        ? schema
        : schema.optional();
  }
  return z
    .object(shape)
    .strict()
    .transform((data) =>
      Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
    );
}

/** Il pagamento si propone solo se il suo campo è visibile (es. scelta «PayPal», 1E-W6). */
export function paymentFieldVisible(
  fields: readonly DefinitionField[],
  values: FormValues,
): boolean {
  const payment = fields.find((field) => field.type === 'payment-single');
  return payment !== undefined && visibleFieldIds(fields, values).has(payment.id);
}

/** Un importo come lo scrive WPForms in euro: «100,00», anche «1.250,50». */
export function numericOption(
  options: Readonly<Record<string, unknown>>,
  key: string,
): number | null {
  const raw = options[key];
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const trimmed = raw.trim();
  const normalized =
    /^\d{1,3}(\.\d{3})*(,\d+)?$/.test(trimmed) || /^\d+,\d+$/.test(trimmed)
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
