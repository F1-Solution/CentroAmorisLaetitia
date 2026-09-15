/** Stessa forma della classe usata dal serializzatore (`BLOCK-MODEL.md` §6.2). */
export function blockClassName(kind: string, classes: readonly string[]): string {
  return ['blk', `blk-${kind}`, ...classes].join(' ');
}
