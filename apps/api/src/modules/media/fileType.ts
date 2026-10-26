import {
  MEDIA_ERROR_STATUS,
  extensionOf,
  mediaMessages,
  mediaRules,
  type MediaErrorCode,
  type MediaLimits,
  type MediaRule,
} from '@amoris/contracts';
import sharp from 'sharp';

/** Riconoscimento del tipo dal contenuto e controlli sul file caricato (S3, S5). */

/** Rifiuto con codice stabile: il gestore degli errori lo risponde così com'è. */
export function mediaError(code: MediaErrorCode, message: string): Error {
  return Object.assign(new Error(message), { statusCode: MEDIA_ERROR_STATUS[code], code });
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Marche ISO base-media di un MP4, in minuscolo e senza spazi finali; `qt` (QuickTime) non c'è. */
const MP4_BRANDS = new Set([
  'isom',
  'iso2',
  'iso3',
  'iso4',
  'iso5',
  'iso6',
  'iso7',
  'iso8',
  'iso9',
  'mp41',
  'mp42',
  'mp71',
  'avc1',
  'dash',
  'msnv',
  'xavc',
  'mmp4',
  '3gp4',
  '3gp5',
  '3gp6',
  '3gp7',
  '3g2a',
  'm4v',
  'm4vh',
  'm4vp',
  'f4v',
  'ndsc',
]);

/** Impostazione di `sharp` per ogni lettura: «danneggiato» vuol dire troncato o illeggibile, non un avviso. */
export const IMAGE_FAIL_ON = 'truncated' as const;

const ascii = (buffer: Buffer, start: number, end: number): string =>
  buffer.toString('latin1', start, end);

const FTYP_MIN_SIZE = 16;
const FTYP_MAX_SIZE = 4096;

/** Blocco ftyp a offset 4, di 16-4096 byte, con una marca MP4 principale o compatibile. */
function isMp4(buffer: Buffer): boolean {
  if (buffer.length < FTYP_MIN_SIZE || ascii(buffer, 4, 8) !== 'ftyp') return false;
  const size = buffer.readUInt32BE(0);
  if (size < FTYP_MIN_SIZE || size > FTYP_MAX_SIZE) return false;
  const end = Math.min(size, buffer.length);
  if (isMp4Brand(ascii(buffer, 8, 12))) return true;
  for (let at = 16; at + 4 <= end; at += 4) {
    if (isMp4Brand(ascii(buffer, at, at + 4))) return true;
  }
  return false;
}

const isMp4Brand = (brand: string): boolean => MP4_BRANDS.has(brand.toLowerCase().trimEnd());

/** Tipo del file dalle firme dei primi byte, `null` se non è fra quelli noti. */
export function detectMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (buffer.length >= 12 && ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buffer.length >= 5 && ascii(buffer, 0, 5) === '%PDF-') return 'application/pdf';
  if (isMp4(buffer)) return 'video/mp4';
  return null;
}

export interface InspectedFile {
  readonly mime: string;
  readonly rule: MediaRule;
  /** Misure dichiarate dall'intestazione, per le immagini. */
  readonly declared?: { readonly width: number; readonly height: number };
}

/** Controlla un file caricato: tipo dal contenuto (mai quello del browser), estensione, peso e, per le immagini, pixel e integrità. */
export async function inspectUpload(
  fileName: string,
  body: Buffer,
  limits: MediaLimits,
): Promise<InspectedFile> {
  const rules = mediaRules(limits);
  const mime = detectMime(body);
  const rule = mime ? rules.find((candidate) => candidate.mime === mime) : undefined;
  if (!mime || !rule) {
    throw mediaError('MEDIA_TYPE_NOT_ALLOWED', mediaMessages.typeNotAllowed(fileName, rules));
  }
  if (!rule.extensions.includes(extensionOf(fileName))) {
    throw mediaError('MEDIA_NAME_MISMATCH', mediaMessages.nameMismatch(fileName, rule));
  }
  if (body.byteLength > rule.maxBytes) {
    throw mediaError('MEDIA_TOO_LARGE', mediaMessages.tooLarge(fileName, rule));
  }
  if (!rule.maxPixels) return { mime, rule };

  const declared = await readImageHeader(fileName, body);
  assertSameFormat(fileName, mime, declared.format);
  if (declared.pages > 1 || (mime === 'image/png' && isApng(body))) {
    throw mediaError('MEDIA_TYPE_NOT_ALLOWED', mediaMessages.animatedNotAllowed(fileName));
  }
  if (declared.width * declared.height > rule.maxPixels) {
    throw mediaError(
      'MEDIA_TOO_MANY_PIXELS',
      mediaMessages.tooManyPixels(fileName, rule.maxPixels),
    );
  }
  await assertDecodable(fileName, body, rule.maxPixels);
  return { mime, rule, declared };
}

const FORMAT_OF_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Il formato letto da `sharp` deve essere quello dichiarato dalle firme. */
export function assertSameFormat(fileName: string, mime: string, format: string | undefined): void {
  if (format !== FORMAT_OF_MIME[mime]) {
    throw mediaError('MEDIA_FILE_INVALID', mediaMessages.fileInvalid(fileName));
  }
}

/** Un PNG animato (APNG) ha il blocco `acTL` prima dei dati dell'immagine. */
function isApng(body: Buffer): boolean {
  const control = body.indexOf('acTL', 8, 'latin1');
  if (control < 0) return false;
  const data = body.indexOf('IDAT', 8, 'latin1');
  return data < 0 || control < data;
}

/** Legge solo l'intestazione: non decodifica l'immagine. */
async function readImageHeader(
  fileName: string,
  body: Buffer,
): Promise<{ width: number; height: number; pages: number; format: string | undefined }> {
  try {
    const {
      width,
      height,
      pages = 1,
      format,
    } = await sharp(body, {
      limitInputPixels: false,
      failOn: IMAGE_FAIL_ON,
    }).metadata();
    if (!width || !height) throw new Error('misure assenti');
    return { width, height, pages, format };
  } catch {
    throw mediaError('MEDIA_FILE_INVALID', mediaMessages.fileInvalid(fileName));
  }
}

/** Decodifica in streaming riducendo a un pixel, così un file troncato non passa. */
async function assertDecodable(fileName: string, body: Buffer, maxPixels: number): Promise<void> {
  try {
    await sharp(body, { limitInputPixels: maxPixels, sequentialRead: true, failOn: IMAGE_FAIL_ON })
      .resize(1, 1)
      .raw()
      .toBuffer();
  } catch {
    throw mediaError('MEDIA_FILE_INVALID', mediaMessages.fileInvalid(fileName));
  }
}
