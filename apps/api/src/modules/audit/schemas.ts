import { AUDIT_OUTCOMES, AUDIT_VIEWS } from '@amoris/contracts';
import { z } from 'zod';
import { FILTERABLE_ACTIONS } from './actions.js';

export { auditContentSearchSchema, auditListSchema } from '@amoris/contracts';

const CURSOR_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z)\|(\d{1,19})$/;

/** Primo istante che PostgreSQL accetta: l'anno 0000 non esiste. */
const MIN_INSTANT = new Date('0001-01-01T00:00:00Z').getTime();

const noControlChars = (value: string): boolean =>
  [...value].every((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code > 0x1f && code !== 0x7f;
  });
const NO_CONTROL_MESSAGE = 'caratteri di controllo non ammessi';

const MAX_BIGINT = 9223372036854775807n;

export interface Cursor {
  /** Istante con i microsecondi del database: un `Date` li troncherebbe. */
  readonly occurredAt: string;
  readonly id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.occurredAt}|${cursor.id}`, 'utf8').toString('base64url');
}

function decodeCursor(value: string): Cursor | null {
  const match = CURSOR_PATTERN.exec(Buffer.from(value, 'base64url').toString('utf8'));
  if (!match?.[1] || !match[2]) return null;
  // Superata la forma, il database potrebbe ancora rifiutare data o id: si controlla qui.
  // `Date` accetta 30 febbraio e simili: la data deve ritornare identica fino ai millisecondi.
  const parsed = new Date(match[1]);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 23) !== match[1].slice(0, 23)
  ) {
    return null;
  }
  if (parsed.getTime() < MIN_INSTANT) return null;
  if (BigInt(match[2]) > MAX_BIGINT) return null;
  return { occurredAt: match[1], id: match[2] };
}

const instant = z
  .union([z.iso.datetime({ offset: true }), z.iso.date()], { error: 'data ISO non valida' })
  .transform((value) => new Date(value))
  .refine((value) => value.getTime() >= MIN_INSTANT, 'data ISO non valida');

export const auditQuery = z
  .object({
    view: z.enum(AUDIT_VIEWS, { error: 'vista non valida' }).default('changes'),
    entityType: z.string().min(1).max(50).refine(noControlChars, NO_CONTROL_MESSAGE).optional(),
    entityId: z.string().min(1).max(200).refine(noControlChars, NO_CONTROL_MESSAGE).optional(),
    actorUserId: z.uuid({ error: 'identificativo di persona non valido' }).optional(),
    action: z
      .string()
      .refine((value) => FILTERABLE_ACTIONS.includes(value), 'tipo di operazione sconosciuto')
      .optional(),
    outcome: z.enum(AUDIT_OUTCOMES, { error: 'esito non valido' }).optional(),
    from: instant.optional(),
    to: instant
      .describe(
        'Estremo escluso; con la sola data (AAAA-MM-GG) è la mezzanotte UTC di quel giorno, esclusa.',
      )
      .optional(),
    cursor: z
      .string()
      .max(200)
      .transform((value, ctx) => {
        const decoded = decodeCursor(value);
        if (!decoded) ctx.addIssue({ code: 'custom', message: 'cursore non valido' });
        return decoded ?? { occurredAt: '', id: '' };
      })
      .optional(),
    limit: z.coerce
      .number({ error: 'limite non valido' })
      .int()
      .min(1, 'il limite minimo è 1')
      .max(100, 'il limite massimo è 100')
      .default(50),
  })
  .refine((query) => !query.from || !query.to || query.from < query.to, {
    message: 'la data di inizio deve precedere quella di fine',
    path: ['from'],
  });

export type AuditQuery = z.infer<typeof auditQuery>;

export const auditContentsQuery = z.object({
  search: z
    .string()
    .trim()
    .min(1, 'scrivi almeno una lettera')
    .max(100)
    .refine(noControlChars, NO_CONTROL_MESSAGE),
});
