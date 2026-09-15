/**
 * `content_text` si ottiene da `content_html` togliendo i tag e riducendo gli
 * spazi: una funzione sola, applicata dopo (`BLOCK-MODEL.md` §6.1).
 */
export function extractContentText(html: string): string {
  const withoutTags = html.replace(/<[^>]*>/g, ' ');
  const decoded = withoutTags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  return decoded.replace(/\s+/g, ' ').trim();
}
