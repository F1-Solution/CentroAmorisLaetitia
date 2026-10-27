/**
 * Feed RSS 2.0 della sorgente (`/feed/` e `/<categoria>/feed/`): gli ultimi
 * articoli pubblicati. È un indirizzo non visivo; il confronto strutturale con la
 * sorgente è della `1E-W7` (`visual-regression-plan.md` §9).
 */

/** `posts_per_rss` di WordPress: nella sorgente vale il predefinito. */
export const FEED_ITEMS = 10;

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface FeedItem {
  readonly title: string;
  readonly path: string;
  readonly publishedAt: string | null;
  readonly summary: string | null;
}

export function renderFeed(options: {
  readonly siteUrl: string;
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly items: readonly FeedItem[];
  /** «Lingua del sito» in BCP 47, come `get_bloginfo_rss('language')` (DR-270). */
  readonly language: string;
}): string {
  const { siteUrl, title, description, path, items, language } = options;
  const entries = items
    .map(
      (item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(siteUrl + item.path)}</link>
      <guid isPermaLink="true">${escapeXml(siteUrl + item.path)}</guid>
      ${item.publishedAt ? `<pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>` : ''}
      ${item.summary ? `<description>${escapeXml(item.summary)}</description>` : ''}
    </item>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <atom:link href="${escapeXml(`${siteUrl}${path}feed/`)}" rel="self" type="application/rss+xml" />
    <link>${escapeXml(siteUrl + path)}</link>
    <description>${escapeXml(description)}</description>
    <language>${escapeXml(language)}</language>${entries}
  </channel>
</rss>
`;
}
