/**
 * Analizza `_wp_attachment_metadata` (`wp-to-postgres-mapping.md` §4.1, 165
 * righe attese): larghezza e altezza dell'originale, e l'elenco delle
 * dimensioni derivate che diventano `media_variants`.
 *
 * Le dimensioni derivate **non sono limitate** alle quattro di `1B-W0` §8.6
 * (150, 300, 768, 1024 px): il tema Divi registra dimensioni proprie (per
 * esempio `et-pb-post-main-image`), misurate nella sorgente. Si importa ogni
 * voce presente in `sizes`, quale che sia il suo nome — ADR-004 §3.2 non pone
 * un limite alle dimensioni, solo alla loro origine (non si rigenerano).
 */
import { phpUnserialize, type PhpMap, type PhpValue } from '../../source/php/unserialize.js';

export interface AttachmentVariant {
  readonly sizeName: string;
  /** Solo il nome del file: sta nella stessa cartella dell'originale. */
  readonly file: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
}

export interface AttachmentMetadata {
  readonly width: number | null;
  readonly height: number | null;
  readonly variants: readonly AttachmentVariant[];
}

const EMPTY_METADATA: AttachmentMetadata = { width: null, height: null, variants: [] };

function asMap(value: PhpValue | undefined): PhpMap | null {
  return value instanceof Map ? value : null;
}

function asNumber(value: PhpValue | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

function asString(value: PhpValue | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * `raw` è il testo grezzo di `wp_postmeta.meta_value`, o `null`/stringa vuota
 * quando la chiave manca per quell'allegato (5 righe su 170, `wp-to-postgres-mapping.md`
 * §4.1: 165 su 170). Un valore non analizzabile è un errore dell'elemento e si
 * lascia risalire al chiamante (`forEachItem` lo isola).
 */
export function parseAttachmentMetadata(raw: string | null | undefined): AttachmentMetadata {
  if (!raw) return EMPTY_METADATA;

  const root = asMap(phpUnserialize(raw));
  if (!root) return EMPTY_METADATA;

  const width = asNumber(root.get('width'));
  const height = asNumber(root.get('height'));
  const sizes = asMap(root.get('sizes'));

  const variants: AttachmentVariant[] = [];
  if (sizes) {
    for (const [sizeName, entry] of sizes) {
      const size = asMap(entry);
      if (!size) continue;
      const file = asString(size.get('file'));
      const variantWidth = asNumber(size.get('width'));
      const variantHeight = asNumber(size.get('height'));
      const mimeType = asString(size.get('mime-type'));
      // Una voce incompleta non si inventa: si scarta e basta (nessuna
      // dimensione derivata da questa voce entra in `media_variants`).
      if (!file || variantWidth === null || variantHeight === null || !mimeType) continue;
      variants.push({ sizeName: String(sizeName), file, width: variantWidth, height: variantHeight, mimeType });
    }
  }

  return { width, height, variants };
}
