/** Un indirizzo del sito pubblico: assoluto con `NEXT_PUBLIC_SITE_URL`, altrimenti relativo alla radice. */
export function siteUrl(path: string): string {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  return `${site}${path}`;
}

/** L'indirizzo dell'anteprima di una bozza sul sito (S17). */
export function previewUrl(contentId: string): string {
  return siteUrl(`/anteprima/${contentId}/`);
}
