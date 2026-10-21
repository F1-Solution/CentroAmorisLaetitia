import { z } from 'zod';

/**
 * Schemi del cambio d'indirizzo di un contenuto (wave 1G-W3): il piano mostrato
 * nell'anteprima e applicato dalla scrittura, e le pagine che possono fare da genitore.
 */

/** Un contenuto il cui percorso cambia: il contenuto spostato o una sua discendente. */
export const addressMoveSchema = z.object({
  id: z.string(),
  title: z.string(),
  from: z.string(),
  to: z.string(),
  published: z.boolean(),
});

export const addressPlanSchema = z.object({
  /** Nuovo percorso del contenuto. */
  path: z.string(),
  moves: z.array(addressMoveSchema),
  /** Redirect 301 che nascono per i contenuti pubblicati (S1). */
  redirectsCreated: z.array(z.object({ from: z.string(), to: z.string() })),
  /** Regole esistenti che puntano alla nuova destinazione (D130-A, D131-A). */
  redirectsRetargeted: z.array(
    z.object({ source: z.string(), from: z.string(), to: z.string(), origin: z.string() }),
  ),
  /** Regole automatiche sull'indirizzo d'arrivo, che si tolgono (D131-A). */
  redirectsRemoved: z.array(z.object({ source: z.string(), target: z.string() })),
  /** Riferimenti scritti a mano a un vecchio indirizzo, che non si riscrivono (D132-A). */
  warnings: z.array(
    z.object({ kind: z.enum(['canonical', 'menu']), id: z.string(), value: z.string() }),
  ),
});

/** Pagina proposta come genitore. */
export const addressOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  path: z.string(),
});

export const addressOptionsSchema = z.object({ items: z.array(addressOptionSchema) });

export type AddressMove = z.infer<typeof addressMoveSchema>;
export type AddressPlan = z.infer<typeof addressPlanSchema>;
export type AddressOption = z.infer<typeof addressOptionSchema>;
export type AddressOptions = z.infer<typeof addressOptionsSchema>;
