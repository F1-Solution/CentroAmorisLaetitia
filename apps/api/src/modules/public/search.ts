import { type Database } from '@amoris/db';
import { sql, type SQL } from 'drizzle-orm';
import { homeContentId } from './service.js';

/**
 * Ricerca del sito pubblico (DR-144), come `WP_Query::parse_search()` e
 * `parse_search_order()` della sorgente: ogni termine in titolo, riassunto o
 * testo; ordine per pertinenza del titolo, poi per data. Pagine, articoli e
 * download pubblici, come il tipo `any` di WordPress.
 *
 * Differenze note: WordPress confronta il contenuto grezzo (shortcode e
 * attributi compresi), qui il testo visibile; maiuscole e accenti si ignorano
 * come la collazione `utf8mb4_unicode_ci`, per le lettere accentate italiane;
 * apici e virgolette tipografici valgono come quelli dritti.
 */

/** Traduzione italiana di WordPress della lista delle parole vuote (`it_IT.po`). */
const STOPWORDS = new Set(
  'su,un,uno,una,sono,siete,come,alle,allo,alla,essere,di,da,per,in,con,per,tra,fra,come,è,egli,ella,essi,loro,il,al,le,lo,oppure,questo,quello,queste,questi,quelli,quelle,a,era,eri,erano,cosa,quando,dove,chi,www'.split(
    ',',
  ),
);

/** Lo stesso schema di `preg_match_all` di WordPress. */
const TERM_PATTERN = /".*?("|$)|((?<=[\t ",+])|^)[^\t ",+]+/g;

export interface ParsedSearch {
  /** I termini da cercare; un `-` iniziale esclude. */
  readonly terms: readonly string[];
  /** I termini trovati prima dello scarto: sopra 1 si ordina per pertinenza. */
  readonly count: number;
  readonly sentence: string;
}

export function parseSearch(raw: string): ParsedSearch {
  const sentence = raw.replace(/[\r\n]/g, '');
  if (sentence === '') return { terms: [], count: 0, sentence };
  const matches = sentence.match(TERM_PATTERN) ?? [];
  if (matches.length === 0) return { terms: [sentence], count: 1, sentence };
  const checked = matches.flatMap((match) => {
    const term = /^".+"$/.test(match) ? trimChars(match, `"'`) : trimChars(match, `"' `);
    if (!term || /^[a-z-]$/i.test(term)) return [];
    if (STOPWORDS.has(term.toLowerCase())) return [];
    return [term];
  });
  const terms = checked.length === 0 || checked.length > 9 ? [sentence] : checked;
  return { terms, count: matches.length, sentence };
}

function trimChars(value: string, chars: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && chars.includes(value.charAt(start))) start += 1;
  while (end > start && chars.includes(value.charAt(end - 1))) end -= 1;
  return value.slice(start, end);
}

const ACCENTED = 'àáâãäåèéêëìíîïòóôõöùúûüçñ‘’“”';
const PLAIN = `aaaaaaeeeeiiiiooooouuuucn''""`;

/**
 * Minuscole, lettere accentate e apici tipografici ridotti, sulla colonna e sul
 * modello allo stesso modo: il testo importato ha gli apici di `wptexturize`, chi
 * cerca scrive quelli dritti, come il grezzo in cui cercava la sorgente (DR-151).
 */
function fold(expression: SQL): SQL {
  return sql`translate(lower(${expression}), ${ACCENTED}, ${PLAIN})`;
}

function like(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function matches(column: SQL, term: string): SQL {
  return sql`${fold(column)} like ${fold(sql`${like(term)}`)}`;
}

const TITLE = sql.raw('title');
const EXCERPT = sql.raw('excerpt');
const BODY = sql.raw('body');

function whereClause(parsed: ParsedSearch): SQL {
  const parts = parsed.terms.map((term) => {
    if (term.startsWith('-')) {
      const word = term.slice(1);
      return sql`(not ${matches(TITLE, word)} and not ${matches(EXCERPT, word)} and not ${matches(BODY, word)})`;
    }
    return sql`(${matches(TITLE, term)} or ${matches(EXCERPT, term)} or ${matches(BODY, term)})`;
  });
  return parts.length === 0 ? sql`true` : sql.join(parts, sql` and `);
}

/** `parse_search_order()`: la pertinenza viene prima della data. */
function relevanceOrder(parsed: ParsedSearch): SQL | null {
  const titleTerms = parsed.terms.filter((term) => !term.startsWith('-'));
  if (parsed.count > 1) {
    const whole = /(?:\s|^)-/.test(parsed.sentence) ? null : parsed.sentence;
    const cases: SQL[] = [];
    if (whole) cases.push(sql`when ${matches(TITLE, whole)} then 1`);
    if (titleTerms.length > 0 && titleTerms.length < 7) {
      cases.push(
        sql`when ${sql.join(
          titleTerms.map((t) => matches(TITLE, t)),
          sql` and `,
        )} then 2`,
      );
      if (titleTerms.length > 1) {
        cases.push(
          sql`when ${sql.join(
            titleTerms.map((t) => matches(TITLE, t)),
            sql` or `,
          )} then 3`,
        );
      }
    }
    if (whole) {
      cases.push(sql`when ${matches(EXCERPT, whole)} then 4`);
      cases.push(sql`when ${matches(BODY, whole)} then 5`);
    }
    return cases.length > 0 ? sql`(case ${sql.join(cases, sql` `)} else 6 end) asc` : null;
  }
  const first = titleTerms[0];
  return first ? sql`(${matches(TITLE, first)}) desc` : null;
}

export interface SearchRow {
  readonly id: string;
  readonly type: 'page' | 'post' | 'document';
  readonly path: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly contentText: string;
  readonly summarySource: string | null;
  readonly featuredMediaId: string | null;
  readonly publishedAt: Date | null;
}

export async function searchPublished(
  db: Database,
  query: { readonly s: string; readonly page: number; readonly perPage: number },
): Promise<{ rows: SearchRow[]; total: number }> {
  const parsed = parseSearch(query.s);
  const homeId = await homeContentId(db);
  const corpus = sql`(
    select c.id, c.type::text as type, case when c.id = ${homeId}::uuid then '/' else c.path end as path, c.title,
           coalesce(c.excerpt, '') as excerpt, c.content_text as body,
           c.summary_source, c.featured_media_id, c.published_at
      from contents c
     where c.status = 'published'
    union all
    select d.id, 'document' as type, '/download/' || d.slug || '/', d.title, '', '', null, null, d.published_at
      from documents d
     where d.is_private = false
  ) as corpus`;
  const where = whereClause(parsed);
  const relevance = relevanceOrder(parsed);
  const order = sql.join(
    [...(relevance ? [relevance] : []), sql`published_at desc nulls last`, sql`id desc`],
    sql`, `,
  );
  const offset = (query.page - 1) * query.perPage;
  const [found, counted] = await Promise.all([
    db.execute<{
      id: string;
      type: SearchRow['type'];
      path: string;
      title: string;
      excerpt: string;
      body: string;
      summary_source: string | null;
      featured_media_id: string | null;
      published_at: Date | string | null;
    }>(sql`select id, type, path, title, excerpt, body, summary_source, featured_media_id, published_at
             from ${corpus} where ${where} order by ${order}
             limit ${query.perPage} offset ${offset}`),
    db.execute<{ total: number }>(sql`select count(*)::int as total from ${corpus} where ${where}`),
  ]);
  const rows = [...found].map((row) => ({
    id: row.id,
    type: row.type,
    path: row.path,
    title: row.title,
    excerpt: row.excerpt === '' ? null : row.excerpt,
    contentText: row.body,
    summarySource: row.summary_source,
    featuredMediaId: row.featured_media_id,
    publishedAt: row.published_at === null ? null : new Date(row.published_at),
  }));
  return { rows, total: [...counted][0]?.total ?? 0 };
}
