/**
 * Risolutore verso `media` per il convertitore (`convert/shared/context.ts`,
 * `ConvertResolvers.resolveMedia`). La fase 15 `rewrite` (ADR-004 §3.3) non è
 * ancora avvenuta: i riferimenti nella sorgente sono ancora nella forma
 * `/wp-content/uploads/<percorso>`, non `/media/<percorso>`. Questo
 * risolutore lavora quindi sulla forma sorgente, non su quella di
 * destinazione.
 *
 * Costruito una volta per fase da `media.storageKey` (l'originale) e da
 * `media_variants.storageKey` (le dimensioni derivate, che condividono la
 * cartella dell'originale — `attachmentMetadata.ts`): entrambe già sono il
 * percorso relativo a `uploads/`, cioè la stessa forma che compare dopo
 * `/wp-content/uploads/` nella sorgente. Un riferimento a una variante risolve
 * comunque all'id del media **originale**: il modello a blocchi non ha
 * un'entità separata per le dimensioni derivate (`BLOCK-MODEL.md` §3.5).
 */
import { schema } from '@amoris/db';
import type { Tx } from '../../persistence/tx.js';

const UPLOADS_PREFIX = '/wp-content/uploads/';

/** Estrae il percorso relativo a `uploads/` da un `src`, o `null` se non lo riguarda. */
export function extractUploadsRelativePath(src: string): string | null {
  const trimmed = src.trim();
  const index = trimmed.indexOf(UPLOADS_PREFIX);
  if (index === -1) return null;
  const withoutPrefix = trimmed.slice(index + UPLOADS_PREFIX.length);
  const withoutQuery = withoutPrefix.split(/[?#]/)[0] ?? '';
  return withoutQuery.length > 0 ? withoutQuery : null;
}

export type MediaLookup = (relativePath: string) => string | null;

/** Carica `media` e `media_variants` una volta e restituisce una funzione di ricerca pura. */
export async function buildMediaLookup(tx: Tx): Promise<MediaLookup> {
  const byRelativePath = new Map<string, string>();

  const originals = await tx
    .select({ id: schema.media.id, storageKey: schema.media.storageKey })
    .from(schema.media);
  for (const row of originals) {
    byRelativePath.set(row.storageKey, row.id);
  }

  const variants = await tx
    .select({ mediaId: schema.mediaVariants.mediaId, storageKey: schema.mediaVariants.storageKey })
    .from(schema.mediaVariants);
  for (const row of variants) {
    if (!byRelativePath.has(row.storageKey)) {
      byRelativePath.set(row.storageKey, row.mediaId);
    }
  }

  return (relativePath: string) => byRelativePath.get(relativePath) ?? null;
}

/** Adatta `MediaLookup` alla forma `MediaResolver` richiesta dal convertitore (`src` intero, non solo il percorso relativo). */
export function createMediaResolver(lookup: MediaLookup): (src: string) => string | null {
  return (src: string) => {
    const relativePath = extractUploadsRelativePath(src);
    if (relativePath === null) return null;
    return lookup(relativePath);
  };
}
