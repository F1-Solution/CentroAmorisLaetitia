import { z } from 'zod';

/**
 * Schemi degli endpoint di stato. Sono schemi condivisi perché li usa anche chi
 * sorveglia il servizio, non solo il servizio stesso.
 */

/** Il processo è vivo. Non dice nulla sulle sue dipendenze. */
export const livenessSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
});

/** Stato di una singola dipendenza del servizio. */
export const dependencyStatusSchema = z.object({
  name: z.string(),
  ok: z.boolean(),
  latencyMs: z.number().nonnegative().optional(),
  /** Messaggio breve e non sensibile. Il dettaglio finisce nei log, non qui. */
  error: z.string().optional(),
});

/**
 * Il servizio è in grado di lavorare. Risponde `503` quando non lo è: un servizio
 * che dichiara di essere pronto mentre il database non risponde è peggio di uno
 * che dichiara di non esserlo.
 */
export const readinessSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  dependencies: z.array(dependencyStatusSchema),
});

export type Liveness = z.infer<typeof livenessSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
