import { schema, type Database } from '@amoris/db';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

/**
 * Lettura pubblica (DR-104): ciò che il sito pubblico può sapere senza accesso.
 *
 * La regola è una sola e sta qui, non nelle rotte: **solo ciò che è pubblicato e
 * non riservato**. Bozze, contenuti ritirati, media e documenti riservati, voci di
 * menu non pubbliche non escono da nessuna funzione di questo file; le prove
 * negative di `tests/publicRead.test.ts` lo verificano rotta per rotta (1E-16).
 */

// ── Riferimenti dentro i blocchi ──────────────────────────────────────────────

const MEDIA_KEYS = new Set(['mediaId', 'backgroundMediaId', 'posterMediaId']);

/** Ciò che serve a risolvere un blocco `post_list`: i suoi stessi parametri (DR-116). */
export interface PostListRef {
  readonly blockId: string;
  readonly termIds: readonly string[];
  readonly limit: number | null;
  readonly offset: number;
  readonly order: 'date_desc' | 'date_asc' | 'title_asc';
}

export interface BlockRefs {
  readonly mediaIds: Set<string>;
  readonly sliderIds: Set<string>;
  readonly documentIds: Set<string>;
  readonly formIds: Set<string>;
  readonly postLists: PostListRef[];
}

function isPostListNode(
  node: Record<string, unknown>,
): node is { id: string; props: Record<string, unknown> } {
  return (
    node['type'] === 'post_list' &&
    typeof node['id'] === 'string' &&
    typeof node['props'] === 'object'
  );
}

/** Gli identificativi citati da un documento a blocchi, a qualunque profondità. */
export function collectRefs(document: unknown): BlockRefs {
  const refs: BlockRefs = {
    mediaIds: new Set(),
    sliderIds: new Set(),
    documentIds: new Set(),
    formIds: new Set(),
    postLists: [],
  };
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (isPostListNode(record)) {
      const props = record.props;
      refs.postLists.push({
        blockId: record.id,
        termIds: Array.isArray(props['termIds']) ? (props['termIds'] as string[]) : [],
        limit: typeof props['limit'] === 'number' ? props['limit'] : null,
        offset: typeof props['offset'] === 'number' ? props['offset'] : 0,
        order:
          props['order'] === 'date_asc' || props['order'] === 'title_asc'
            ? props['order']
            : 'date_desc',
      });
    }
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string') {
        if (MEDIA_KEYS.has(key)) refs.mediaIds.add(value);
        else if (key === 'sliderId') refs.sliderIds.add(value);
        else if (key === 'documentId') refs.documentIds.add(value);
        else if (key === 'formId') refs.formIds.add(value);
      } else visit(value);
    }
  };
  visit(document);
  return refs;
}

// ── Media ────────────────────────────────────────────────────────────────────

export interface PublicMedia {
  readonly id: string;
  readonly publicPath: string;
  readonly mimeType: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly title: string | null;
  readonly altText: string | null;
  readonly caption: string | null;
  readonly variants: { publicPath: string; width: number; height: number }[];
}

/** I media pubblici fra quelli chiesti, con le loro dimensioni derivate. I riservati non ci sono. */
export async function mediaByIds(
  db: Database,
  ids: Iterable<string>,
): Promise<Record<string, PublicMedia>> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return {};
  const rows = await db
    .select({
      id: schema.media.id,
      publicPath: schema.media.publicPath,
      mimeType: schema.media.mimeType,
      width: schema.media.width,
      height: schema.media.height,
      title: schema.media.title,
      altText: schema.media.altText,
      caption: schema.media.caption,
    })
    .from(schema.media)
    .where(and(inArray(schema.media.id, wanted), eq(schema.media.isPrivate, false)));
  if (rows.length === 0) return {};
  const variants = await db
    .select({
      mediaId: schema.mediaVariants.mediaId,
      publicPath: schema.mediaVariants.publicPath,
      width: schema.mediaVariants.width,
      height: schema.mediaVariants.height,
    })
    .from(schema.mediaVariants)
    .where(
      inArray(
        schema.mediaVariants.mediaId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(schema.mediaVariants.width));
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        ...row,
        variants: variants
          .filter((variant) => variant.mediaId === row.id)
          .map(({ publicPath, width, height }) => ({ publicPath, width, height })),
      },
    ]),
  );
}

export interface ServedFile {
  readonly storageKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksum: Buffer;
  readonly updatedAt: Date;
}

/**
 * Il file servito a `/media/…` (ADR-004 §3.6): un originale o una dimensione
 * derivata, **solo** di un media non riservato. Un percorso del bucket riservato
 * non ha risposta, nemmeno se il file esiste.
 */
export async function fileByPublicPath(db: Database, path: string): Promise<ServedFile | null> {
  const [original] = await db
    .select({
      storageKey: schema.media.storageKey,
      mimeType: schema.media.mimeType,
      byteSize: schema.media.byteSize,
      checksum: schema.media.checksum,
      updatedAt: schema.media.updatedAt,
    })
    .from(schema.media)
    .where(and(eq(schema.media.publicPath, path), eq(schema.media.isPrivate, false)))
    .limit(1);
  if (original) return original;

  const [variant] = await db
    .select({
      storageKey: schema.mediaVariants.storageKey,
      mimeType: schema.media.mimeType,
      byteSize: schema.mediaVariants.byteSize,
      checksum: schema.mediaVariants.checksum,
      updatedAt: schema.media.updatedAt,
    })
    .from(schema.mediaVariants)
    .innerJoin(schema.media, eq(schema.media.id, schema.mediaVariants.mediaId))
    .where(and(eq(schema.mediaVariants.publicPath, path), eq(schema.media.isPrivate, false)))
    .limit(1);
  return variant ?? null;
}

// ── Impostazioni ─────────────────────────────────────────────────────────────

/**
 * Le sole impostazioni che il sito pubblico legge. Elenco chiuso: una chiave
 * nuova non diventa pubblica per caso. L'identificativo delle analisi non c'è:
 * DR-107 esclude le analisi dalla Fase 1E.
 */
export const PUBLIC_SETTING_KEYS = [
  'site.title',
  'site.description',
  'site.locale',
  'site.timezone',
  'site.date_format',
  'site.time_format',
  'site.start_of_week',
  'content.posts_per_page',
  'seo.robots_txt',
  'seo.sitemap_enabled',
  // DR-117: logo e piè di pagina, importati dal tema e modificabili dal CMS.
  'site.logo_media_id',
  'site.footer_html',
] as const;

export async function publicSettings(db: Database): Promise<Record<string, unknown>> {
  const rows = await db
    .select({ key: schema.settings.key, value: schema.settings.value })
    .from(schema.settings)
    .where(
      and(
        inArray(schema.settings.key, [...PUBLIC_SETTING_KEYS]),
        eq(schema.settings.isSecret, false),
      ),
    );
  const settings: Record<string, unknown> = Object.fromEntries(
    rows.map((row) => [row.key, row.value]),
  );
  // L'indirizzo del logo, se il media esiste ed è pubblico: il sito non lo cerca da sé.
  const logoId = settings['site.logo_media_id'];
  if (typeof logoId === 'string') {
    const logo = (await mediaByIds(db, [logoId]))[logoId];
    if (logo) settings['site.logo_path'] = logo.publicPath;
  }
  return settings;
}

// ── SEO ──────────────────────────────────────────────────────────────────────

export interface ResolvedSeo {
  readonly title: string;
  readonly description: string | null;
  readonly canonicalPath: string;
  readonly robots: string;
  readonly ogTitle: string;
  readonly ogDescription: string | null;
  readonly ogType: string;
  readonly ogImagePath: string | null;
}

/** Sostituisce i segnaposto dei template globali; quelli sconosciuti restano come sono. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (whole, name: string) => values[name] ?? whole).trim();
}

/**
 * Descrizione quando la sovrascrittura non c'è (DR-040: i metadati mancanti si
 * correggono, non si riproducono): l'estratto, altrimenti l'inizio del testo,
 * tagliato a 160 caratteri su un confine di parola. Regola da confrontare con
 * `seo-rendered-baseline.csv` nella `1E-W7`.
 */
export function fallbackDescription(excerpt: string | null, text: string): string | null {
  const source = (excerpt?.trim() || text.replace(/\s+/g, ' ').trim()).trim();
  if (source === '') return null;
  if (source.length <= 160) return source;
  const cut = source.slice(0, 160);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Le direttive per i motori di ricerca, nell'ordine in cui le scrive la sorgente. */
export function robotsDirectives(
  noindex: boolean,
  nofollow: boolean,
  fromTemplate: readonly string[],
): string {
  return [
    ...(noindex ? ['noindex'] : []),
    ...(nofollow ? ['nofollow'] : []),
    ...fromTemplate,
    'max-image-preview:large',
  ]
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(', ');
}

// ── Contenuti ────────────────────────────────────────────────────────────────

const contentColumns = {
  id: schema.contents.id,
  type: schema.contents.type,
  path: schema.contents.path,
  slug: schema.contents.slug,
  title: schema.contents.title,
  showTitle: schema.contents.showTitle,
  excerpt: schema.contents.excerpt,
  blocks: schema.contents.blocks,
  contentText: schema.contents.contentText,
  featuredMediaId: schema.contents.featuredMediaId,
  publishedAt: schema.contents.publishedAt,
  updatedAt: schema.contents.updatedAt,
};

/**
 * La pagina iniziale: il contenuto indicato da `settings['site.home_content_id']`
 * (`wp-to-postgres-mapping.md` §5, `page_on_front`). Si serve a `/`, e il suo
 * percorso proprio risponde 301 verso `/`, come nella sorgente.
 */
export async function homeContentId(db: Database): Promise<string | null> {
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, 'site.home_content_id'))
    .limit(1);
  return typeof row?.value === 'string' ? row.value : null;
}

/**
 * Un contenuto **pubblicato** per percorso. Bozze e contenuti ritirati non
 * esistono, qui. A `/` risponde la pagina iniziale; al suo percorso proprio
 * nessun contenuto, perché lì vale il redirect verso `/`.
 */
export async function publishedByPath(db: Database, path: string) {
  const homeId = await homeContentId(db);
  const published = eq(schema.contents.status, 'published');
  const [row] = await db
    .select(contentColumns)
    .from(schema.contents)
    .where(
      path === '/' && homeId
        ? and(eq(schema.contents.id, homeId), published)
        : and(eq(schema.contents.path, path), published),
    )
    .limit(1);
  if (!row) return null;
  if (path !== '/' && row.id === homeId) return null;
  return { ...row, isHome: row.id === homeId || path === '/' };
}

export async function seoForContent(
  db: Database,
  content: {
    id: string;
    type: 'page' | 'post';
    path: string;
    title: string;
    excerpt: string | null;
    contentText: string;
    isHome: boolean;
  },
  siteTitle: string,
): Promise<ResolvedSeo> {
  const scope = content.isHome ? 'home' : content.type;
  const [template] = await db
    .select()
    .from(schema.seoTemplates)
    .where(eq(schema.seoTemplates.scope, scope))
    .limit(1);
  const [override] = await db
    .select()
    .from(schema.contentSeo)
    .where(eq(schema.contentSeo.contentId, content.id))
    .limit(1);
  const values = { title: content.title, site_title: siteTitle };
  const title =
    override?.title?.trim() ||
    fillTemplate(template?.titleTemplate ?? '{title} - {site_title}', values);
  const description =
    override?.description?.trim() ||
    (template?.descriptionTemplate ? fillTemplate(template.descriptionTemplate, values) : '') ||
    fallbackDescription(content.excerpt, content.contentText);
  const ogImage = override?.ogImageId ? await mediaByIds(db, [override.ogImageId]) : {};
  return {
    title,
    description: description || null,
    canonicalPath: override?.canonicalUrl?.trim() || (content.isHome ? '/' : content.path),
    robots: robotsDirectives(
      override?.robotsNoindex ?? false,
      override?.robotsNofollow ?? false,
      template?.robotsDirectives ?? [],
    ),
    ogTitle: override?.ogTitle?.trim() || title,
    ogDescription: override?.ogDescription?.trim() || description || null,
    ogType: template?.ogType ?? (scope === 'home' ? 'website' : 'article'),
    ogImagePath: Object.values(ogImage)[0]?.publicPath ?? null,
  };
}

/** Le categorie di un contenuto, per l'intestazione degli articoli. */
export async function termsOfContent(db: Database, contentId: string) {
  return db
    .select({
      id: schema.terms.id,
      taxonomy: schema.terms.taxonomy,
      slug: schema.terms.slug,
      name: schema.terms.name,
      path: schema.terms.path,
    })
    .from(schema.contentTerms)
    .innerJoin(schema.terms, eq(schema.terms.id, schema.contentTerms.termId))
    .where(eq(schema.contentTerms.contentId, contentId))
    .orderBy(asc(schema.contentTerms.position));
}

// ── Carosello e documenti ────────────────────────────────────────────────────

export async function slidersByIds(db: Database, ids: Iterable<string>) {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return {};
  const sliders = await db
    .select({ id: schema.sliders.id, key: schema.sliders.key, settings: schema.sliders.settings })
    .from(schema.sliders)
    .where(inArray(schema.sliders.id, wanted));
  if (sliders.length === 0) return {};
  const slides = await db
    .select({
      sliderId: schema.sliderSlides.sliderId,
      position: schema.sliderSlides.position,
      mediaId: schema.sliderSlides.mediaId,
      heading: schema.sliderSlides.heading,
      body: schema.sliderSlides.body,
      linkUrl: schema.sliderSlides.linkUrl,
      linkLabel: schema.sliderSlides.linkLabel,
      settings: schema.sliderSlides.settings,
    })
    .from(schema.sliderSlides)
    .where(
      inArray(
        schema.sliderSlides.sliderId,
        sliders.map((slider) => slider.id),
      ),
    )
    .orderBy(asc(schema.sliderSlides.position));
  return Object.fromEntries(
    sliders.map((slider) => [
      slider.id,
      {
        ...slider,
        slides: slides
          .filter((slide) => slide.sliderId === slider.id)
          .map(({ sliderId: _sliderId, ...slide }) => slide),
      },
    ]),
  );
}

// ── Form ─────────────────────────────────────────────────────────────────────

export interface PublicFormField {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly required: boolean;
  readonly order: number;
  readonly description: string | null;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface PublicForm {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly confirmationMessage: string | null;
  readonly requiresPayment: boolean;
  readonly fields: PublicFormField[];
  /**
   * Il rimando di pagamento di DR-039: importo dal campo `payment-single` della
   * definizione; l'indirizzo non è configurato in questa fase (nessun dato reale
   * di PayPal è stato importato) e resta `null` finché l'utente non lo fornisce.
   */
  readonly payment: { readonly amount: number | null; readonly url: string | null } | null;
}

function numericOption(options: Readonly<Record<string, unknown>>, key: string): number | null {
  const raw = options[key];
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Le definizioni dei form citati, se attivi: il form bozza o disattivato non esce (1E-16). */
export async function formsByIds(
  db: Database,
  ids: Iterable<string>,
): Promise<Record<string, PublicForm>> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return {};
  const rows = await db
    .select({
      id: schema.forms.id,
      slug: schema.forms.slug,
      title: schema.forms.title,
      definition: schema.forms.definition,
      confirmationMessage: schema.forms.confirmationMessage,
      requiresPayment: schema.forms.requiresPayment,
    })
    .from(schema.forms)
    .where(and(inArray(schema.forms.id, wanted), eq(schema.forms.isActive, true)));

  const out: Record<string, PublicForm> = {};
  for (const row of rows) {
    const definition = row.definition as { fields?: unknown } | null;
    const rawFields = Array.isArray(definition?.fields) ? definition.fields : [];
    const fields = rawFields.filter(
      (f): f is PublicFormField =>
        f !== null &&
        typeof f === 'object' &&
        typeof (f as Record<string, unknown>)['id'] === 'string' &&
        typeof (f as Record<string, unknown>)['type'] === 'string',
    );
    const paymentField = fields.find((f) => f.type === 'payment-single');
    out[row.id] = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      confirmationMessage: row.confirmationMessage,
      requiresPayment: row.requiresPayment,
      // ADR-010 §4.2: ogni tipo noto tranne `payment-single`, che non si rende in Fase 1.
      fields: fields
        .filter((f) => f.type !== 'payment-single')
        .map((f) => ({
          id: f.id,
          type: f.type,
          label: f.label ?? '',
          required: Boolean(f.required),
          order: typeof f.order === 'number' ? f.order : 0,
          description: typeof f.description === 'string' ? f.description : null,
          options: typeof f.options === 'object' && f.options !== null ? f.options : {},
        })),
      payment: row.requiresPayment
        ? {
            amount: paymentField
              ? (numericOption(paymentField.options ?? {}, 'amount') ??
                numericOption(paymentField.options ?? {}, 'price'))
              : null,
            url: null,
          }
        : null,
    };
  }
  return out;
}

// ── Elenco articoli del blocco `post_list` ──────────────────────────────────

export interface PublicPostListItem {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly excerpt: string | null;
  readonly featuredMediaId: string | null;
  readonly publishedAt: string | null;
}

/** Una richiesta per ogni blocco: i loro parametri, non quelli dell'archivio, decidono (DR-116). */
export async function postListsByRefs(
  db: Database,
  refs: readonly PostListRef[],
): Promise<Record<string, PublicPostListItem[]>> {
  const out: Record<string, PublicPostListItem[]> = {};
  for (const ref of refs) {
    const { rows } = await publishedPosts(db, {
      termIds: ref.termIds,
      page: 1,
      perPage: ref.limit ?? 10,
      offset: ref.offset,
      order: ref.order,
    });
    out[ref.blockId] = rows.map((row) => ({
      id: row.id,
      path: row.path,
      title: row.title,
      excerpt: row.excerpt,
      featuredMediaId: row.featuredMediaId,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    }));
  }
  return out;
}

/** I documenti pubblici fra quelli chiesti: riservati, o con il file riservato, non escono. */
export async function documentsBy(
  db: Database,
  where: { ids: Iterable<string> } | { slug: string },
) {
  const ids = 'ids' in where ? [...new Set(where.ids)] : [];
  if ('ids' in where && ids.length === 0) return [];
  const filter =
    'slug' in where ? eq(schema.documents.slug, where.slug) : inArray(schema.documents.id, ids);
  return db
    .select({
      id: schema.documents.id,
      slug: schema.documents.slug,
      title: schema.documents.title,
      description: schema.documents.description,
      mediaId: schema.documents.mediaId,
      updatedAt: schema.documents.updatedAt,
    })
    .from(schema.documents)
    .innerJoin(schema.media, eq(schema.media.id, schema.documents.mediaId))
    .where(and(filter, eq(schema.documents.isPrivate, false), eq(schema.media.isPrivate, false)));
}

// ── Menu ─────────────────────────────────────────────────────────────────────

export interface PublicMenuItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly target: string | null;
  readonly cssClasses: string | null;
  readonly children: PublicMenuItem[];
}

/**
 * Il menu come lo vede chi non ha fatto accesso: le sole voci `public`, i cui
 * antenati sono tutti pubblici, che puntano a un contenuto pubblicato o a una
 * tassonomia esistente. Una voce esclusa porta via con sé i suoi figli.
 */
export async function publicMenu(db: Database, key: string): Promise<PublicMenuItem[] | null> {
  const [menu] = await db
    .select({ id: schema.menus.id })
    .from(schema.menus)
    .where(eq(schema.menus.key, key))
    .limit(1);
  if (!menu) return null;

  const rows = await db
    .select({
      id: schema.menuItems.id,
      parentId: schema.menuItems.parentId,
      position: schema.menuItems.position,
      kind: schema.menuItems.kind,
      label: schema.menuItems.label,
      url: schema.menuItems.url,
      linkTarget: schema.menuItems.linkTarget,
      cssClasses: schema.menuItems.cssClasses,
      visibility: schema.menuItems.visibility,
      contentId: schema.contents.id,
      contentPath: schema.contents.path,
      contentStatus: schema.contents.status,
      contentTitle: schema.contents.title,
      termPath: schema.terms.path,
      termName: schema.terms.name,
    })
    .from(schema.menuItems)
    .leftJoin(schema.contents, eq(schema.contents.id, schema.menuItems.contentId))
    .leftJoin(schema.terms, eq(schema.terms.id, schema.menuItems.termId))
    .where(eq(schema.menuItems.menuId, menu.id))
    .orderBy(asc(schema.menuItems.position));

  const homeId = await homeContentId(db);
  const hrefOf = (row: (typeof rows)[number]): string | null => {
    if (row.visibility !== 'public') return null;
    if (row.kind === 'content') {
      if (row.contentStatus !== 'published') return null;
      return row.contentId === homeId ? '/' : row.contentPath;
    }
    if (row.kind === 'term') return row.termPath;
    return row.url;
  };

  // Profondità massima: un ciclo nei dati non deve far crollare il servizio.
  const build = (parentId: string | null, depth = 0): PublicMenuItem[] =>
    depth > 10
      ? []
      : rows
          .filter((row) => row.parentId === parentId)
          .flatMap((row) => {
            const href = hrefOf(row);
            if (href === null) return [];
            return [
              {
                id: row.id,
                // Come in WordPress: una voce senza titolo prende quello del suo bersaglio.
                label: row.label.trim() || row.contentTitle || row.termName || row.label,
                href,
                target: row.linkTarget,
                cssClasses: row.cssClasses,
                children: build(row.id, depth + 1),
              },
            ];
          });
  return build(null);
}

// ── Articoli e tassonomie ────────────────────────────────────────────────────

export async function termByPath(db: Database, path: string) {
  const [term] = await db
    .select({
      id: schema.terms.id,
      taxonomy: schema.terms.taxonomy,
      slug: schema.terms.slug,
      name: schema.terms.name,
      description: schema.terms.description,
      path: schema.terms.path,
    })
    .from(schema.terms)
    .where(eq(schema.terms.path, path))
    .limit(1);
  return term ?? null;
}

export interface PostQuery {
  readonly termIds: readonly string[];
  readonly page: number;
  readonly perPage: number;
  readonly offset: number;
  readonly order: 'date_desc' | 'date_asc' | 'title_asc';
}

/** Gli articoli **pubblicati**, per gli archivi e per il blocco `post_list`. */
export async function publishedPosts(db: Database, query: PostQuery) {
  const conditions = [eq(schema.contents.type, 'post'), eq(schema.contents.status, 'published')];
  if (query.termIds.length > 0) {
    conditions.push(
      inArray(
        schema.contents.id,
        db
          .select({ id: schema.contentTerms.contentId })
          .from(schema.contentTerms)
          .where(inArray(schema.contentTerms.termId, [...query.termIds])),
      ),
    );
  }
  const where = and(...conditions);
  const order =
    query.order === 'title_asc'
      ? [asc(schema.contents.title)]
      : query.order === 'date_asc'
        ? [asc(schema.contents.publishedAt), asc(schema.contents.id)]
        : [desc(schema.contents.publishedAt), desc(schema.contents.id)];
  const [rows, [count]] = await Promise.all([
    db
      .select({
        id: schema.contents.id,
        path: schema.contents.path,
        title: schema.contents.title,
        excerpt: schema.contents.excerpt,
        contentText: schema.contents.contentText,
        featuredMediaId: schema.contents.featuredMediaId,
        publishedAt: schema.contents.publishedAt,
      })
      .from(schema.contents)
      .where(where)
      .orderBy(...order)
      .limit(query.perPage)
      .offset((query.page - 1) * query.perPage + query.offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.contents)
      .where(where),
  ]);
  return { rows, total: count?.total ?? 0 };
}

// ── Redirect ─────────────────────────────────────────────────────────────────

/**
 * La regola che si applica a un percorso: prima quella esatta, poi il prefisso più
 * lungo, che porta con sé il resto del percorso. Solo regole attive. È così che
 * `/wp-content/uploads/2017/09/file.png` diventa `/media/2017/09/file.png`
 * (ADR-004, la regola `prefix` importata).
 */
export async function resolveRedirect(db: Database, path: string) {
  const homeId = await homeContentId(db);
  if (homeId && path !== '/') {
    const [home] = await db
      .select({ path: schema.contents.path })
      .from(schema.contents)
      .where(eq(schema.contents.id, homeId))
      .limit(1);
    if (home?.path === path) return { targetPath: '/', statusCode: 301 };
  }

  // Come in WordPress, un contenuto pubblicato vince su una regola con lo stesso
  // percorso: è il caso di una pagina allegato importata con lo slug di un articolo.
  const [published] = await db
    .select({ id: schema.contents.id })
    .from(schema.contents)
    .where(and(eq(schema.contents.path, path), eq(schema.contents.status, 'published')))
    .limit(1);
  if (published && published.id !== homeId) return null;

  const [exact] = await db
    .select({ targetPath: schema.redirects.targetPath, statusCode: schema.redirects.statusCode })
    .from(schema.redirects)
    .where(
      and(
        eq(schema.redirects.sourcePath, path),
        eq(schema.redirects.kind, 'exact'),
        eq(schema.redirects.isActive, true),
      ),
    )
    .limit(1);
  if (exact) return exact;

  const [prefix] = await db
    .select({
      sourcePath: schema.redirects.sourcePath,
      targetPath: schema.redirects.targetPath,
      statusCode: schema.redirects.statusCode,
    })
    .from(schema.redirects)
    .where(
      and(
        eq(schema.redirects.kind, 'prefix'),
        eq(schema.redirects.isActive, true),
        sql`starts_with(${path}, ${schema.redirects.sourcePath})`,
      ),
    )
    .orderBy(desc(sql`length(${schema.redirects.sourcePath})`))
    .limit(1);
  if (!prefix) return null;
  // Una regola a prefisso porta con sé il resto del percorso solo verso il sito
  // stesso: con una destinazione esterna, il resto deciso da chi chiede finirebbe
  // nell'indirizzo di un altro dominio.
  if (!prefix.targetPath.startsWith('/') || prefix.targetPath.startsWith('//')) return null;
  return {
    targetPath: prefix.targetPath + path.slice(prefix.sourcePath.length),
    statusCode: prefix.statusCode,
  };
}

// ── Mappa del sito ───────────────────────────────────────────────────────────

/** Ciò che la mappa del sito elenca: contenuti pubblicati non esclusi dai motori, e le categorie. */
export async function sitemapEntries(db: Database) {
  const homeId = await homeContentId(db);
  const rows = await db
    .select({
      id: schema.contents.id,
      path: schema.contents.path,
      type: schema.contents.type,
      updatedAt: schema.contents.updatedAt,
    })
    .from(schema.contents)
    .leftJoin(schema.contentSeo, eq(schema.contentSeo.contentId, schema.contents.id))
    .where(
      and(
        eq(schema.contents.status, 'published'),
        sql`coalesce(${schema.contentSeo.robotsNoindex}, false) = false`,
      ),
    )
    .orderBy(asc(schema.contents.path));
  const contents = rows.map(({ id, ...row }) => (id === homeId ? { ...row, path: '/' } : row));
  const terms = await db
    .select({ path: schema.terms.path, updatedAt: schema.terms.updatedAt })
    .from(schema.terms)
    .where(
      and(
        eq(schema.terms.taxonomy, 'category'),
        inArray(
          schema.terms.id,
          db
            .select({ id: schema.contentTerms.termId })
            .from(schema.contentTerms)
            .innerJoin(schema.contents, eq(schema.contents.id, schema.contentTerms.contentId))
            .where(eq(schema.contents.status, 'published')),
        ),
      ),
    )
    .orderBy(asc(schema.terms.path));
  return { contents, terms };
}
