import {
  blockDocumentSchema,
  extractContentText,
  serializeBlockDocument,
} from '@amoris/blocks/model';
import { schema, type Database } from '@amoris/db';
import { and, eq, sql } from 'drizzle-orm';
import { assemblePage, siteTitle, type PageContent } from '../public/page.js';
import { contentColumns, homeContentId } from '../public/service.js';

/** Anteprima della bozza (S14): la pagina come la servirebbe `/public/content`, con la copia di lavoro di chi chiede, senza scrivere nulla. */

function invalidDraft() {
  return Object.assign(new Error('La copia di lavoro contiene un blocco non valido.'), {
    statusCode: 422,
    code: 'CONTENT_PREVIEW_DRAFT_INVALID',
  });
}

/** `null` se il contenuto non esiste. */
export async function previewPage(db: Database, contentId: string, authorId: string) {
  const [row] = await db
    .select(contentColumns)
    .from(schema.contents)
    .where(eq(schema.contents.id, contentId))
    .limit(1);
  if (!row) return null;
  const [draft] = await db
    .select({
      title: schema.contentDrafts.title,
      excerpt: schema.contentDrafts.excerpt,
      blocks: schema.contentDrafts.blocks,
    })
    .from(schema.contentDrafts)
    .where(
      and(
        eq(schema.contentDrafts.contentId, contentId),
        eq(schema.contentDrafts.authorId, authorId),
      ),
    )
    .limit(1);

  const base: PageContent = {
    ...row,
    // S18: una bozza mai pubblicata ha come data il momento della richiesta.
    publishedAt: row.publishedAt ?? new Date(),
    isHome: row.id === (await homeContentId(db)),
  };
  const content = draft ? await applyDraft(db, base, draft) : base;
  const page = await assemblePage(db, content, await siteTitle(db));
  // Il sito rende l'anteprima come la pagina pubblicata: la pagina iniziale sta a «/», non al suo indirizzo.
  return { ...page, publicPath: base.isHome ? '/' : content.path };
}

/** Il testo cambia se differisce a meno degli spazi: la stessa espressione SQL del salvataggio. */
async function textDiffers(db: Database, contentId: string, text: string): Promise<boolean> {
  const [row] = await db
    .select({
      differs: sql<boolean>`regexp_replace(${schema.contents.contentText}, '\\s+', ' ', 'g') is distinct from regexp_replace(${text}::text, '\\s+', ' ', 'g')`,
    })
    .from(schema.contents)
    .where(eq(schema.contents.id, contentId));
  return row?.differs ?? true;
}

async function applyDraft(
  db: Database,
  base: PageContent,
  draft: { title: string; excerpt: string | null; blocks: unknown },
): Promise<PageContent> {
  const parsed = blockDocumentSchema.safeParse(draft.blocks);
  if (!parsed.success) throw invalidDraft();
  const contentText = extractContentText(serializeBlockDocument(parsed.data));
  // Come al salvataggio: l'estratto vuoto diventa NULL, poi si confronta com'è.
  const excerpt = draft.excerpt === '' ? null : draft.excerpt;
  const changed = (await textDiffers(db, base.id, contentText)) || excerpt !== base.excerpt;
  return {
    ...base,
    title: draft.title,
    excerpt,
    blocks: parsed.data,
    contentText,
    // Come al salvataggio: testo o estratto cambiati, la description importata non vale più.
    descriptionSource: changed ? null : base.descriptionSource,
  };
}
