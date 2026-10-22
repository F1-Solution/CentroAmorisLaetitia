import { z } from 'zod';

/**
 * Anteprima dell'eliminazione di un contenuto (wave 1G-W4): che cosa la impedisce
 * e che cosa resta puntato al suo indirizzo. Solo lettura.
 */

export const deletionPreviewSchema = z.object({
  /** Vero se figlie, voci di menu o pagina iniziale impediscono l'eliminazione. */
  blocked: z.boolean(),
  children: z.array(z.object({ id: z.string(), title: z.string(), path: z.string() })),
  menuItems: z.array(z.object({ id: z.string(), label: z.string(), menu: z.string() })),
  isHome: z.boolean(),
  /** Regole di redirect verso l'indirizzo: restano e non impediscono (D143-A). */
  redirectsToPath: z.array(z.object({ source: z.string() })),
});

export type DeletionPreview = z.infer<typeof deletionPreviewSchema>;
