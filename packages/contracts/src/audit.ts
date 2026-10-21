import { z } from 'zod';

/**
 * Schemi del registro delle operazioni (wave 1G-W2): la risposta di `GET /audit`
 * e l'ultima modifica di un contenuto. Mai impronte di indirizzi, sessioni o dettagli.
 */

export const AUDIT_VIEWS = ['changes', 'all'] as const;
export const AUDIT_OUTCOMES = ['success', 'failure'] as const;

export const auditItemSchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  actorUserId: z.string().nullable(),
  actorLabel: z.string().nullable(),
  actorRoleLabel: z.string().nullable(),
  actorArea: z.string().nullable(),
  action: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  entityLabel: z.string().nullable(),
  /** Pagina o notizia, solo per i contenuti ancora presenti: serve a costruire il collegamento. */
  contentType: z.enum(['page', 'post']).nullable(),
  outcome: z.enum(AUDIT_OUTCOMES),
});

export const auditListSchema = z.object({
  items: z.array(auditItemSchema),
  nextCursor: z.string().nullable(),
});

/** Contenuto proposto dalla ricerca per titolo del filtro del registro. */
export const auditContentOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['page', 'post']),
});

export const auditContentSearchSchema = z.object({ items: z.array(auditContentOptionSchema) });

/** Ultima modifica di un contenuto: dal registro, oppure la data della sorgente importata (D127). */
export const lastChangeSchema = z
  .union([
    z.object({ actorLabel: z.string(), occurredAt: z.string() }),
    z.object({ importedAt: z.string() }),
  ])
  .nullable();

export type AuditItem = z.infer<typeof auditItemSchema>;
export type AuditList = z.infer<typeof auditListSchema>;
export type LastChange = z.infer<typeof lastChangeSchema>;
export type AuditContentOption = z.infer<typeof auditContentOptionSchema>;
