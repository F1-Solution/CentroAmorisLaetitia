/** L'indirizzo dell'anteprima di una bozza sul sito (S17): assoluto con `NEXT_PUBLIC_SITE_URL`, altrimenti relativo alla radice. */
export function previewUrl(contentId: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  return `${site}/anteprima/${contentId}/`;
}
