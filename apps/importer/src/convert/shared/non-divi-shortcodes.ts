/**
 * Gli shortcode fuori da Divi (`divi-shortcode-strategy.md` §2.1): `[catposts]`
 * → `post_list`, `[doc]` → `document`, `[hash]` e `[UID]` sono da esaminare —
 * in questa wave si convertono comunque in `rich_text` se producono testo, per
 * non perdere nulla in silenzio, e si scarta il caso in cui non producano
 * niente. `[wpdm_user_dashboard]` e `[event_dashboard]` si eliminano: plugin
 * disattivati, non producono nulla (1A §5).
 *
 * Condiviso fra il convertitore Gutenberg (`wp:shortcode`) e quello Divi (uno
 * shortcode incontrato fuori dai moduli `et_pb_*`): stessa destinazione, sia
 * che compaia avvolto in un blocco Gutenberg sia che compaia nudo dentro Divi.
 */
import {
  docBlockPropsSchema,
  htmlPropsSchema,
  postListPropsSchema,
  type BlockNode,
} from './blocks.js';
import type { ConvertContext } from './context.js';
import { buildRichTextOrFallback } from './rich-text.js';
import type { ParsedShortcode } from '../divi/shortcodes.js';

const SILENTLY_REMOVED = new Set(['wpdm_user_dashboard', 'event_dashboard']);

export interface NonDiviShortcodeResult {
  readonly block: BlockNode | null;
}

export function convertNonDiviShortcode(
  shortcode: ParsedShortcode,
  ctx: ConvertContext,
): NonDiviShortcodeResult {
  const { tag } = shortcode;

  if (SILENTLY_REMOVED.has(tag)) {
    return { block: null };
  }

  if (tag === 'catposts') {
    return { block: buildPostList(shortcode, ctx) };
  }

  if (tag === 'doc') {
    return { block: buildDocument(shortcode, ctx) };
  }

  if (tag === 'hash' || tag === 'UID') {
    // «Se non produce nulla nel reso, si elimina; se produce testo, diventa
    // rich_text» (§2.1). Qui non abbiamo il reso di WordPress: si conserva il
    // contenuto letterale dello shortcode come testo, cosi' nulla si perde;
    // se risultasse, alla verifica visiva della Fase 1E, che non produce
    // nulla, si eliminerà a quel punto, con quel dato alla mano.
    const built = buildRichTextOrFallback(ctx, shortcode.raw, {
      start: shortcode.start,
      end: shortcode.end,
    });
    return { block: built ?? null };
  }

  ctx.push({ severity: 'warning', code: 'unknown-shortcode', detail: tag });
  const built = buildRichTextOrFallback(ctx, shortcode.raw, {
    start: shortcode.start,
    end: shortcode.end,
  });
  return { block: built ?? null };
}

const KNOWN_CATPOSTS_PARAMS = new Set([
  // Il nome della configurazione salvata, che la fase `contents` espande (DR-116).
  'name',
  'category',
  'cat',
  'limit',
  'number',
  'thumb',
  'date',
  'excerpt',
  'order',
  // La configurazione salvata (DR-116) lo passa come `offset`.
  'offset',
  // Dalla configurazione salvata, 1E-W6.
  'thumb_top',
  'thumb_w',
  'thumb_h',
  'excerpt_length',
  'excerpt_more_text',
  'default_thumbnail',
]);

function positiveInt(raw: string | undefined, max: number): number | null {
  return raw && /^\d+$/.test(raw) && Number(raw) >= 1 ? Math.min(Number(raw), max) : null;
}

function buildPostList(shortcode: ParsedShortcode, ctx: ConvertContext): BlockNode {
  for (const key of Object.keys(shortcode.attrs)) {
    if (!KNOWN_CATPOSTS_PARAMS.has(key)) {
      ctx.push({ severity: 'warning', code: 'unexpected-catposts-param', detail: key });
    }
  }

  const rawLimit = shortcode.attrs.limit ?? shortcode.attrs.number;
  const limit =
    rawLimit && /^\d+$/.test(rawLimit) ? Math.min(Math.max(Number(rawLimit), 1), 50) : null;

  // Nessun risolutore verso `terms` in questa wave: la categoria indicata
  // nello shortcode si registrerà come `termIds` quando la fase `terms`
  // (`1D-W4`) fornirà il risolutore; qui l'elenco resta vuoto, non inventato.
  const termIds: string[] = [];

  // Un flag assente vale acceso, come prima; «0», «false» o vuoto lo spengono.
  const flag = (key: string) => {
    const value = shortcode.attrs[key];
    return value === undefined || !['', '0', 'false', 'no', 'off'].includes(value.toLowerCase());
  };

  // DR-130: «inizia dall'articolo N», contato da 1 (`class-widget.php`: si salta solo con N > 1).
  const rawOffset = shortcode.attrs.offset;
  const offset = rawOffset && /^\d+$/.test(rawOffset) ? Math.max(Number(rawOffset) - 1, 0) : 0;

  // Con la miniatura in alto il modello del plugin non ha la data (`cat-posts.php`).
  const thumbTop = shortcode.attrs.thumb_top !== undefined && flag('thumb_top');
  const defaultThumbnail = shortcode.attrs.default_thumbnail;
  const defaultThumbnailMediaId =
    defaultThumbnail && ctx.resolvers.resolveMedia
      ? ctx.resolvers.resolveMedia(defaultThumbnail)
      : null;

  const props = postListPropsSchema.parse({
    termIds,
    limit,
    offset,
    showThumbnail: flag('thumb'),
    showDate: flag('date') && !(thumbTop && flag('thumb')),
    showExcerpt: flag('excerpt'),
    order: 'date_desc',
    thumbnailWidth: positiveInt(shortcode.attrs.thumb_w, 2000),
    thumbnailHeight: positiveInt(shortcode.attrs.thumb_h, 2000),
    excerptWords: positiveInt(shortcode.attrs.excerpt_length, 1000),
    excerptMoreText: shortcode.attrs.excerpt_more_text?.trim() || null,
    defaultThumbnailMediaId,
    classes: [],
  });

  return {
    type: 'post_list',
    id: ctx.allocateId('post_list', shortcode.start, shortcode.end),
    props,
    children: [],
  };
}

function buildDocument(shortcode: ParsedShortcode, ctx: ConvertContext): BlockNode | null {
  const legacyRef = shortcode.attrs.id ?? shortcode.attrs.ID;
  const documentId =
    legacyRef && ctx.resolvers.resolveDocument ? ctx.resolvers.resolveDocument(legacyRef) : null;

  if (documentId === null) {
    ctx.push({
      severity: 'warning',
      code: 'unresolved-document-reference',
      detail: legacyRef ?? '(assente)',
    });
    return {
      type: 'html',
      id: ctx.allocateId('html', shortcode.start, shortcode.end),
      props: htmlPropsSchema.parse({
        html: `<div>[doc ${legacyRef ?? ''}]</div>`,
        reason: 'divi_unmapped_module',
        detail: 'doc',
        classes: [],
      }),
      children: [],
    };
  }

  const props = docBlockPropsSchema.parse({
    documentId,
    label: shortcode.attrs.label ?? null,
    display: 'link',
    classes: [],
  });

  return {
    type: 'document',
    id: ctx.allocateId('document', shortcode.start, shortcode.end),
    props,
    children: [],
  };
}
