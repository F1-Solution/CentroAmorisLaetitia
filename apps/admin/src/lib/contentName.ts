/** Il nome con cui un contenuto compare negli elenchi dell'area anche senza titolo, o con soli spazi (W8-24, W9-N3, DR-331). */
export function contentName(title: string, isHome = false): string {
  return title.trim() ? title : isHome ? 'Pagina iniziale' : 'Senza titolo';
}
