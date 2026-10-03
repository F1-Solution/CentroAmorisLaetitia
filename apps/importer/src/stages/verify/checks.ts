/**
 * Le otto verifiche di `importer-spec.md` §8.1 («VERIFICHE»). Ognuna
 * **misura**, non scrive dati di dominio (§16): legge le tabelle già
 * importate e, quando serve, la sorgente, e restituisce un
 * {@link VerificationCheck}.
 *
 * `files-vs-expected` elenca il bucket (DR-088): si esegue in `apply` e in
 * `importer verify`, e si dichiara `executed: false` nel `plan` completo o con
 * l'archiviazione irraggiungibile, invece di fingere un risultato
 * (`importer-spec.md` §16, ultimo paragrafo).
 */
import path from 'node:path';
import { and, eq, isNotNull } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { StageContext } from '../context.js';
import type { Bucket } from '../../storage/objectStore.js';
import type { CheckName, VerificationCheck } from '../../report/types.js';
import { checksumFile, createUploadIndex } from '../../source/files/uploads.js';
import { hasUploadsReference } from '../rewrite/urlRewrite.js';
import { isClassifiedPostmetaKey } from '../../preflight/constants.js';
import { loadContentRows, planContentPaths } from '../relations/contentPaths.js';
import { provisionalPath } from '../relations/paths.js';
import type { SqlRow } from '../../source/sql/types.js';

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function check(
  name: CheckName,
  value: number,
  expected: number,
  executed = true,
): VerificationCheck {
  return { check: name, value, expected, ok: executed && value === expected, executed };
}

/** Conta le stringhe che contengono ancora `wp-content/uploads`, negli stessi quattro ambiti di `rewrite`. */
export async function checkUploadsReferencesRemaining(
  ctx: StageContext,
): Promise<VerificationCheck> {
  const [contentsRows, sliderRows, settingsRows] = await Promise.all([
    ctx.tx
      .select({ blocks: schema.contents.blocks, contentHtml: schema.contents.contentHtml })
      .from(schema.contents),
    ctx.tx
      .select({
        heading: schema.sliderSlides.heading,
        body: schema.sliderSlides.body,
        linkUrl: schema.sliderSlides.linkUrl,
        settings: schema.sliderSlides.settings,
      })
      .from(schema.sliderSlides),
    ctx.tx.select({ value: schema.settings.value }).from(schema.settings),
  ]);

  let remaining = 0;
  const scan = (value: unknown): void => {
    if (typeof value === 'string') {
      if (hasUploadsReference(value)) remaining += 1;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scan(item);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const entry of Object.values(value)) scan(entry);
    }
  };

  for (const row of contentsRows) {
    scan(row.blocks);
    scan(row.contentHtml);
  }
  for (const row of sliderRows) {
    scan(row.heading);
    scan(row.body);
    scan(row.linkUrl);
    scan(row.settings);
  }
  for (const row of settingsRows) scan(row.value);

  return check('uploads-references-remaining', remaining, 0);
}

/**
 * Le chiavi di `media` e `media_variants` assenti dal bucket giusto (DR-088);
 * gli oggetti in più non contano (DR-092). Nel `plan` completo il bucket non è
 * stato scritto, e non c'è nulla da misurare.
 */
export async function checkFilesVsExpected(ctx: StageContext): Promise<VerificationCheck> {
  if (ctx.mode === 'plan' && !ctx.verifyOnly) return check('files-vs-expected', 0, 0, false);

  const [mediaRows, variantRows] = await Promise.all([
    ctx.tx
      .select({ storageKey: schema.media.storageKey, isPrivate: schema.media.isPrivate })
      .from(schema.media),
    ctx.tx
      .select({ storageKey: schema.mediaVariants.storageKey, isPrivate: schema.media.isPrivate })
      .from(schema.mediaVariants)
      .innerJoin(schema.media, eq(schema.media.id, schema.mediaVariants.mediaId)),
  ]);

  let present: Record<Bucket, ReadonlySet<string>>;
  try {
    present = {
      public: await ctx.storage.listKeys('public'),
      private: await ctx.storage.listKeys('private'),
    };
  } catch {
    // Archiviazione non raggiungibile: non dimostrata, mai «passata».
    return check('files-vs-expected', 0, 0, false);
  }

  let missing = 0;
  for (const row of [...mediaRows, ...variantRows]) {
    if (!present[row.isPrivate ? 'private' : 'public'].has(row.storageKey)) missing += 1;
  }
  return check('files-vs-expected', missing, 0);
}

/**
 * Ricalcola il checksum dei file pubblici sotto `uploadsPath` e lo confronta
 * con `media.checksum`. I 4 documenti riservati (`isPrivate = true`) vivono
 * fuori da `uploadsPath` (DR-058) e restano fuori da questa verifica: non è
 * una svista, è lo stesso perimetro di `stages/media/index.ts`.
 */
export async function checkChecksumMismatches(ctx: StageContext): Promise<VerificationCheck> {
  const rows = await ctx.tx
    .select({ storageKey: schema.media.storageKey, checksum: schema.media.checksum })
    .from(schema.media)
    .where(eq(schema.media.isPrivate, false));

  // DR-065: la chiave archiviata può differire per maiuscole dal nome su disco.
  const uploads = createUploadIndex(await ctx.source.uploadedFiles());
  let mismatches = 0;
  for (const row of rows) {
    try {
      const lookup = uploads.find(row.storageKey);
      if (lookup.kind !== 'exact' && lookup.kind !== 'case-insensitive') {
        mismatches += 1;
        continue;
      }
      const hex = await checksumFile(path.join(ctx.source.uploadsPath, lookup.file.relativePath));
      if (!Buffer.from(hex, 'hex').equals(row.checksum)) mismatches += 1;
    } catch {
      // File non trovato o non leggibile: è comunque un checksum che non
      // corrisponde, non una condizione a parte.
      mismatches += 1;
    }
  }
  return check('checksum-mismatches', mismatches, 0);
}

/**
 * Estrae ogni riferimento `/media/...` ancora presente nei quattro ambiti
 * (dopo `rewrite`, sono gli unici che dovrebbero comparire) e verifica che
 * corrisponda a una riga `media` o `media_variants` esistente.
 */
export async function checkMediaMissing(ctx: StageContext): Promise<VerificationCheck> {
  const [contentsRows, sliderRows, settingsRows, mediaRows, variantRows] = await Promise.all([
    ctx.tx
      .select({ blocks: schema.contents.blocks, contentHtml: schema.contents.contentHtml })
      .from(schema.contents),
    ctx.tx
      .select({
        heading: schema.sliderSlides.heading,
        body: schema.sliderSlides.body,
        linkUrl: schema.sliderSlides.linkUrl,
        settings: schema.sliderSlides.settings,
      })
      .from(schema.sliderSlides),
    ctx.tx.select({ value: schema.settings.value }).from(schema.settings),
    ctx.tx.select({ publicPath: schema.media.publicPath }).from(schema.media),
    ctx.tx.select({ publicPath: schema.mediaVariants.publicPath }).from(schema.mediaVariants),
  ]);

  const knownPaths = new Set<string>([
    ...mediaRows.map((r) => r.publicPath),
    ...variantRows.map((r) => r.publicPath),
  ]);

  const referenced = new Set<string>();
  const MEDIA_REFERENCE = /\/media\/[^\s"'()<>,]+/g;
  const scan = (value: unknown): void => {
    if (typeof value === 'string') {
      for (const match of value.matchAll(MEDIA_REFERENCE)) referenced.add(match[0]);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) scan(item);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const entry of Object.values(value)) scan(entry);
    }
  };

  for (const row of contentsRows) {
    scan(row.blocks);
    scan(row.contentHtml);
  }
  for (const row of sliderRows) {
    scan(row.heading);
    scan(row.body);
    scan(row.linkUrl);
    scan(row.settings);
  }
  for (const row of settingsRows) scan(row.value);

  let missing = 0;
  for (const reference of referenced) {
    if (!knownPaths.has(reference)) missing += 1;
  }
  return check('media-missing', missing, 0);
}

/**
 * Voci di menu `custom` il cui `url` è un percorso interno (comincia per
 * `/`) che non corrisponde a nessun contenuto, termine, documento o
 * redirect noto. Le voci `content`/`term` non possono essere "nel vuoto": lo
 * schema le vincola a una chiave esterna valida (`menu_items_target_matches_kind`).
 */
export async function checkMenuItemsDangling(ctx: StageContext): Promise<VerificationCheck> {
  const [menuRows, contentPaths, termPaths, documentSlugs, redirectPaths] = await Promise.all([
    ctx.tx
      .select({ url: schema.menuItems.url })
      .from(schema.menuItems)
      .where(and(eq(schema.menuItems.kind, 'custom'), isNotNull(schema.menuItems.url))),
    ctx.tx.select({ path: schema.contents.path }).from(schema.contents),
    ctx.tx.select({ path: schema.terms.path }).from(schema.terms),
    ctx.tx.select({ slug: schema.documents.slug }).from(schema.documents),
    ctx.tx.select({ sourcePath: schema.redirects.sourcePath }).from(schema.redirects),
  ]);

  const knownPaths = new Set<string>([
    ...contentPaths.map((r) => r.path),
    ...termPaths.map((r) => r.path),
    ...documentSlugs.map((r) => `/download/${r.slug}/`),
    ...redirectPaths.map((r) => r.sourcePath),
  ]);

  let dangling = 0;
  for (const row of menuRows) {
    const url = row.url ?? '';
    if (!url.startsWith('/')) continue; // esterno: non verificabile qui
    if (!knownPaths.has(url)) dangling += 1;
  }
  return check('menu-items-dangling', dangling, 0);
}

/** Le regole `exact` la cui destinazione non corrisponde a nulla di conosciuto. La regola `prefix` non è enumerabile. */
export async function checkRedirectsTo404(ctx: StageContext): Promise<VerificationCheck> {
  const [redirectRows, contentPaths, mediaPaths, variantPaths, documentSlugs] = await Promise.all([
    ctx.tx
      .select({ targetPath: schema.redirects.targetPath })
      .from(schema.redirects)
      .where(and(eq(schema.redirects.kind, 'exact'), eq(schema.redirects.isActive, true))),
    ctx.tx.select({ path: schema.contents.path }).from(schema.contents),
    ctx.tx.select({ publicPath: schema.media.publicPath }).from(schema.media),
    ctx.tx.select({ publicPath: schema.mediaVariants.publicPath }).from(schema.mediaVariants),
    ctx.tx.select({ slug: schema.documents.slug }).from(schema.documents),
  ]);

  const knownTargets = new Set<string>([
    ...contentPaths.map((r) => r.path),
    ...mediaPaths.map((r) => r.publicPath),
    ...variantPaths.map((r) => r.publicPath),
    ...documentSlugs.map((r) => `/download/${r.slug}/`),
  ]);

  let notFound = 0;
  for (const row of redirectRows) {
    if (!knownTargets.has(row.targetPath)) notFound += 1;
  }
  return check('redirects-to-404', notFound, 0);
}

/**
 * Un contenuto è "senza percorso reale" quando il suo `path` è ancora quello
 * provvisorio e il calcolo dei percorsi non ve lo assegna per decisione
 * (DR-063, DR-064): lo stesso calcolo di `relations`, non una sua copia.
 */
export async function checkContentsWithoutPath(ctx: StageContext): Promise<VerificationCheck> {
  const contentRows = await loadContentRows(ctx);
  const { resolvedPaths } = await planContentPaths(ctx, contentRows);

  let withoutPath = 0;
  for (const row of contentRows) {
    if (row.path !== provisionalPath(row.slug, row.legacyId)) continue;
    if (resolvedPaths.get(row.legacyId)?.provisional) continue;
    withoutPath += 1;
  }
  return check('contents-without-path', withoutPath, 0);
}

/** Le chiavi distinte di `wp_postmeta` non classificate né in §4.1 né in §4.2 del mapping. */
export async function checkMetaKeysUnclassified(ctx: StageContext): Promise<VerificationCheck> {
  const rows = (await ctx.source.rows('wp_postmeta')) as readonly SqlRow[];
  const distinctKeys = new Set(rows.map((row) => asString(row['meta_key'])));

  let unclassified = 0;
  for (const key of distinctKeys) {
    if (!isClassifiedPostmetaKey(key)) unclassified += 1;
  }
  return check('meta-keys-unclassified', unclassified, 0);
}

export async function runAllChecks(ctx: StageContext): Promise<readonly VerificationCheck[]> {
  return [
    await checkUploadsReferencesRemaining(ctx),
    await checkFilesVsExpected(ctx),
    await checkChecksumMismatches(ctx),
    await checkMediaMissing(ctx),
    await checkMenuItemsDangling(ctx),
    await checkRedirectsTo404(ctx),
    await checkContentsWithoutPath(ctx),
    await checkMetaKeysUnclassified(ctx),
  ];
}
