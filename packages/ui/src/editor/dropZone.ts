/** Dove finisce l'elemento trascinato rispetto a quello di arrivo (DR-082, DR-084). */
export type DropZone = 'before' | 'inside' | 'after';

/**
 * Fasce della riga di arrivo: sopra e sotto per «accanto», il centro per
 * «dentro» (DR-084). Se l'elemento non accetta figli, la riga ha due metà.
 */
export function dropZoneFor(offsetY: number, height: number, canNest: boolean): DropZone {
  const ratio = height > 0 ? offsetY / height : 0;
  if (!canNest) return ratio < 0.5 ? 'before' : 'after';
  if (ratio < 0.25) return 'before';
  if (ratio < 0.75) return 'inside';
  return 'after';
}
