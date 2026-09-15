/**
 * Estrazione minima di attributi da un singolo tag HTML grezzo, con espressioni
 * regolari — non un analizzatore completo. Usata solo per leggere `<img>`,
 * `<a>` e `<figcaption>` dentro blocchi Gutenberg già noti per struttura
 * (`wp:image`, `wp:media-text`); non per sanificare, e non per `rich_text`,
 * che passa da `sanitizeRichText` (`@amoris/blocks`). Niente dipendenza nuova:
 * `parse5` resta un vincolo di `packages/blocks` (`PLAN.md` §5), non di
 * `apps/importer`.
 */

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function parseTagAttributes(tagInner: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tagInner.matchAll(ATTR_RE)) {
    const name = match[1]!.toLowerCase();
    const value = match[2] ?? match[3] ?? '';
    attrs[name] = value;
  }
  return attrs;
}

export function findFirstTag(html: string, tagName: string): { attrs: Record<string, string>; index: number } | null {
  const re = new RegExp(`<${tagName}\\b([^>]*)>`, 'i');
  const match = re.exec(html);
  if (!match) return null;
  return { attrs: parseTagAttributes(match[1] ?? ''), index: match.index };
}

export function findTagContent(html: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = re.exec(html);
  return match ? match[1]! : null;
}
