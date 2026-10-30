import { schema, type Database } from '@amoris/db';
import { eq } from 'drizzle-orm';

/** Nome con cui il registro indica un oggetto, letto quando la riga si scrive (W8-20). */

/** Oggetti il cui nome si conserva nel dettaglio della riga. */
export const LABELLED_ENTITIES: ReadonlySet<string> = new Set(['media', 'redirect', 'menu_item']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID.test(value);

/** Ambiti dei modelli SEO, con i nomi di `SCOPE_LABEL` in `apps/admin/src/components/seo/SeoTemplates.tsx`: cambiarli insieme. */
const SEO_SCOPE_LABELS: Readonly<Record<string, string>> = {
  home: 'Pagina iniziale',
  page: 'Pagine',
  post: 'Notizie',
  category: 'Categorie',
  attachment: 'Allegati',
  search: 'Risultati di ricerca',
};

export const seoScopeLabel = (scope: string): string => SEO_SCOPE_LABELS[scope] ?? scope;

async function menuItemLabel(db: Database, id: string): Promise<string | null> {
  const [item] = await db
    .select({
      label: schema.menuItems.label,
      contentTitle: schema.contents.title,
      contentPath: schema.contents.path,
      termName: schema.terms.name,
    })
    .from(schema.menuItems)
    .leftJoin(schema.contents, eq(schema.contents.id, schema.menuItems.contentId))
    .leftJoin(schema.terms, eq(schema.terms.id, schema.menuItems.termId))
    .where(eq(schema.menuItems.id, id));
  if (!item) return null;
  // Mai l'indirizzo della voce (può essere un `mailto:`): la riserva è quella dell'area.
  return item.label || item.contentTitle || item.contentPath || item.termName || 'voce senza nome';
}

/** `null` se l'oggetto non c'è (più) o non ha un nome da mostrare. */
export async function resolveObjectLabel(
  db: Database,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  if (!LABELLED_ENTITIES.has(entityType) || !isUuid(entityId)) return null;
  if (entityType === 'media') {
    const [row] = await db
      .select({ title: schema.media.title, fileName: schema.media.fileName })
      .from(schema.media)
      .where(eq(schema.media.id, entityId));
    return row ? row.title || row.fileName || null : null;
  }
  if (entityType === 'redirect') {
    const [row] = await db
      .select({ source: schema.redirects.sourcePath })
      .from(schema.redirects)
      .where(eq(schema.redirects.id, entityId));
    return row?.source ?? null;
  }
  return menuItemLabel(db, entityId);
}
