/**
 * Fase 3 `media` (`importer-spec.md` §4): produce `media`, `media_variants`,
 * e gli oggetti nei due bucket dello storage (ADR-004).
 *
 * Sorgente: `wp_posts` con `post_type = 'attachment'` (170 righe attese,
 * `wp-to-postgres-mapping.md` §2). Il percorso reale del file viene da
 * `wp_postmeta._wp_attached_file`; le dimensioni derivate da
 * `_wp_attachment_metadata` (`attachmentMetadata.ts`); il testo alternativo
 * da `_wp_attachment_image_alt`.
 *
 * **Scostamento misurato, non ipotizzato** (vedi anche `IMPORTER-DESIGN.md`
 * §11.1 punto 2, e la risposta finale di questa wave): ADR-004 §3.6 e
 * `wp-to-postgres-mapping.md` §4.1 presuppongono che questa fase produca
 * anche i 4 media riservati di `cuar_private_file` (DR-033), instradati verso
 * `media-private`. Misurato sulla sorgente: i 4 file di
 * `cuar_private_file_file` **non sono allegati** — non esiste, per nessuno di
 * loro, una riga `wp_posts` con `post_type = 'attachment'` che li referenzi.
 * Il plugin Customer Area li gestisce in un proprio archivio,
 * `wp-content/customer-area/storage/<uuid>/<nomefile>`, **fuori** da
 * `uploads/` — un percorso che nè ADR-004 §3.2 nè il lettore di `uploads/`
 * conoscono. Non essendo allegati, non compaiono fra le 170 righe di questa
 * fase: **nessuna riga `media` prodotta qui ha `isPrivate = true`**. La
 * decisione su come importare quei 4 file — e se serva un secondo lettore di
 * sorgente per `wp-content/customer-area/storage/` — appartiene alla fase 9
 * `documents`, fuori dal perimetro di questa wave, e va posta all'utente.
 */
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';
import { checksumFile, type UploadedFile } from '../../source/files/uploads.js';
import { parseAttachmentMetadata, type AttachmentVariant } from './attachmentMetadata.js';

interface SourceAttachment {
  readonly id: number;
  readonly title: string;
  readonly caption: string | null;
  readonly mimeType: string;
  readonly postDate: string;
  readonly authorLegacyId: number | null;
  readonly attachedFile: string | null;
  readonly metadataRaw: string | null;
  readonly altText: string | null;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number.parseInt(value, 10);
  return null;
}

function parseTimestamp(raw: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** La cartella del file derivato è sempre quella del file originale (WordPress non ne usa un'altra). */
function siblingRelativePath(attachedFile: string, fileName: string): string {
  const dir = path.posix.dirname(attachedFile);
  return dir === '.' ? fileName : `${dir}/${fileName}`;
}

async function loadSourceAttachments(ctx: StageContext): Promise<readonly SourceAttachment[]> {
  const [postRows, metaRows] = await Promise.all([
    ctx.source.rows('wp_posts'),
    ctx.source.rows('wp_postmeta'),
  ]);

  const metaByPost = new Map<number, Map<string, string>>();
  for (const row of metaRows as readonly SqlRow[]) {
    const postId = asNumber(row['post_id']);
    if (postId === null) continue;
    const key = asString(row['meta_key']);
    if (!metaByPost.has(postId)) metaByPost.set(postId, new Map());
    metaByPost.get(postId)!.set(key, asString(row['meta_value']));
  }

  return (postRows as readonly SqlRow[])
    .filter((row) => asString(row['post_type']) === 'attachment')
    .map((row) => {
      const id = asNumber(row['ID']) ?? 0;
      const meta = metaByPost.get(id) ?? new Map<string, string>();
      return {
        id,
        title: asString(row['post_title']),
        caption: asString(row['post_excerpt']) || null,
        mimeType: asString(row['post_mime_type']),
        postDate: asString(row['post_date']),
        authorLegacyId: asNumber(row['post_author']),
        attachedFile: meta.get('_wp_attached_file') || null,
        metadataRaw: meta.get('_wp_attachment_metadata') || null,
        altText: meta.get('_wp_attachment_image_alt') || null,
      };
    });
}

export const mediaStage: Stage = {
  name: 'media',
  dependsOn: ['users'],

  async expected(ctx: StageContext) {
    return (await loadSourceAttachments(ctx)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const attachments = await loadSourceAttachments(ctx);
    const uploaded = await ctx.source.uploadedFiles();
    const uploadedByPath = new Map<string, UploadedFile>(uploaded.map((f) => [f.relativePath, f]));

    // `media_variants` è una riga a sé del rapporto (`importer-spec.md`
    // §8.1) pur essendo prodotta da questa fase: si conta qui, perché dopo
    // la transazione non sarebbe piu' contabile in `plan`. Il conteggio di
    // un allegato si somma solo quando l'allegato è andato a buon fine: se
    // il suo savepoint viene annullato, le sue varianti non esistono.
    const variants: { created: number; updated: number; skipped: number; errors: number } = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };

    const result = await forEachItem(
      ctx.tx,
      attachments,
      (row): ItemKey => ({ sourceTable: 'wp_posts', sourceId: row.id }),
      async (row, tx) => {
        if (!row.attachedFile) {
          throw new Error('allegato sorgente senza _wp_attached_file');
        }
        const original = uploadedByPath.get(row.attachedFile);
        if (!original) {
          // Il file non esiste sotto `uploads/`, o sta in una delle cartelle
          // escluse (`source/files/uploads.ts`) — in entrambi i casi non è
          // recuperabile qui: `uploads.real.test.ts` copre il conteggio, non
          // il singolo file.
          throw new Error(`file sorgente non trovato: ${row.attachedFile}`);
        }

        // Nessun allegato di questa sorgente è riservato — vedi il commento
        // in testa al modulo. Il campo resta qui, e a `false`, perché lo
        // schema e ADR-004 §3.6 lo richiedono per ogni riga di `media`.
        const isPrivate = false;
        const bucket = isPrivate ? 'private' : 'public';

        const storageKey = row.attachedFile;
        const publicPath = `/media/${row.attachedFile}`;
        const checksumHex = await checksumFile(path.join(ctx.source.uploadsPath, row.attachedFile));
        const checksum = Buffer.from(checksumHex, 'hex');

        const existingId = await ctx.ids.find(tx, 'wp_posts', row.id, 'media');
        let existingChecksum: Buffer | null = null;
        if (existingId) {
          const [existing] = await tx
            .select({ checksum: schema.media.checksum })
            .from(schema.media)
            .where(eq(schema.media.id, existingId));
          existingChecksum = existing?.checksum ?? null;
        }
        const needsUpload = !existingChecksum || !existingChecksum.equals(checksum);

        // Il file entra nel bucket **prima** della riga (`importer-spec.md`
        // §7): in `plan` non si scrive mai nel bucket (§5.2).
        if (ctx.mode === 'apply' && needsUpload) {
          await ctx.storage.put(
            bucket,
            storageKey,
            path.join(ctx.source.uploadsPath, row.attachedFile),
            row.mimeType,
            original.sizeBytes,
          );
        }

        const authorEntityId = row.authorLegacyId
          ? await ctx.ids.find(tx, 'wp_users', row.authorLegacyId, 'user')
          : null;
        const metadata = parseAttachmentMetadata(row.metadataRaw);

        const [written] = await tx
          .insert(schema.media)
          .values({
            id: existingId ?? undefined,
            storageKey,
            publicPath,
            fileName: path.posix.basename(row.attachedFile),
            mimeType: row.mimeType,
            byteSize: original.sizeBytes,
            width: metadata.width,
            height: metadata.height,
            checksum,
            title: row.title || null,
            altText: row.altText,
            caption: row.caption,
            description: null,
            isPrivate,
            uploadedAt: parseTimestamp(row.postDate) ?? new Date(),
            uploadedBy: authorEntityId,
            legacyId: row.id,
          })
          .onConflictDoUpdate({
            target: schema.media.id,
            set: {
              storageKey,
              publicPath,
              fileName: path.posix.basename(row.attachedFile),
              mimeType: row.mimeType,
              byteSize: original.sizeBytes,
              width: metadata.width,
              height: metadata.height,
              checksum,
              title: row.title || null,
              altText: row.altText,
              caption: row.caption,
              isPrivate,
              legacyId: row.id,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.media.id });

        if (!written) throw new Error('inserimento di media non ha restituito una riga');

        await ctx.ids.remember(
          tx,
          'wp_posts',
          row.id,
          'media',
          written.id,
          ctx.mode === 'apply' ? ctx.runId : null,
          existingId ? 'updated' : 'created',
        );

        const tally = { created: 0, updated: 0, skipped: 0, errors: 0 };
        for (const variant of metadata.variants) {
          const outcome = await importVariant(ctx, tx, row, variant, bucket, written.id, uploadedByPath);
          tally[outcome] += 1;
        }
        variants.created += tally.created;
        variants.updated += tally.updated;
        variants.skipped += tally.skipped;
        variants.errors += tally.errors;

        return existingId ? 'updated' : 'created';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'media',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );

    return { ...result, extraRows: { media_variants: variants } };
  },
};

/**
 * Una dimensione derivata mancante sul disco non fa fallire l'intero allegato
 * — solo quella variante manca, e lo si segnala. L'originale e le altre
 * varianti restano importate (`importer-spec.md` §7: l'isolamento è per
 * elemento, e qui l'elemento utile a un redattore è l'allegato intero, non la
 * singola miniatura).
 */
async function importVariant(
  ctx: StageContext,
  tx: StageContext['tx'],
  row: SourceAttachment,
  variant: AttachmentVariant,
  bucket: 'public' | 'private',
  mediaId: string,
  uploadedByPath: ReadonlyMap<string, UploadedFile>,
): Promise<'created' | 'updated' | 'skipped'> {
  if (!row.attachedFile) return 'skipped';
  const relativePath = siblingRelativePath(row.attachedFile, variant.file);
  const uploadedVariant = uploadedByPath.get(relativePath);
  if (!uploadedVariant) {
    await ctx.issues.record({
      severity: 'warning',
      stage: 'media',
      code: 'item-import-failed',
      sourceTable: 'wp_postmeta',
      sourceId: row.id,
      detail: 'unknown-error',
    });
    return 'skipped';
  }

  const publicPath = `/media/${relativePath}`;
  const checksumHex = await checksumFile(path.join(ctx.source.uploadsPath, relativePath));
  const checksum = Buffer.from(checksumHex, 'hex');

  const [existingVariant] = await tx
    .select({ checksum: schema.mediaVariants.checksum })
    .from(schema.mediaVariants)
    .where(eq(schema.mediaVariants.publicPath, publicPath));
  const needsUpload = !existingVariant || !existingVariant.checksum.equals(checksum);

  if (ctx.mode === 'apply' && needsUpload) {
    await ctx.storage.put(
      bucket,
      relativePath,
      path.join(ctx.source.uploadsPath, relativePath),
      variant.mimeType,
      uploadedVariant.sizeBytes,
    );
  }

  await tx
    .insert(schema.mediaVariants)
    .values({
      mediaId,
      storageKey: relativePath,
      publicPath,
      width: variant.width,
      height: variant.height,
      byteSize: uploadedVariant.sizeBytes,
      checksum,
    })
    .onConflictDoUpdate({
      target: schema.mediaVariants.publicPath,
      set: {
        mediaId,
        storageKey: relativePath,
        width: variant.width,
        height: variant.height,
        byteSize: uploadedVariant.sizeBytes,
        checksum,
      },
    });

  return existingVariant ? 'updated' : 'created';
}
