/**
 * `content_text` si ottiene da `content_html` togliendo i tag e riducendo gli
 * spazi: una funzione sola, applicata dopo (`BLOCK-MODEL.md` §6.1). I confini
 * dei blocchi diventano un a capo, così una frase non attraversa due paragrafi,
 * come nel testo grezzo della sorgente (DR-146); i tag in linea, uno spazio.
 */
const BLOCK_TAG =
  /<\/?(?:address|article|aside|blockquote|br|dd|details|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi;

export function extractContentText(html: string): string {
  const withoutTags = html.replace(BLOCK_TAG, '\n').replace(/<[^>]*>/g, ' ');
  const decoded = withoutTags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  return decoded
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n[\s]*/g, '\n')
    .trim();
}
