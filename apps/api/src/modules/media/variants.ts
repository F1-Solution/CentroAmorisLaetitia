import sharp, { type Sharp } from 'sharp';
import { IMAGE_FAIL_ON } from './fileType.js';
import { planDerivatives, scaledDimensions, type ResizePlan } from './sizes.js';

/** Elaborazione delle immagini (D145-A, S8): originale riscritto e ridotto oltre i 2560 px, da cui nascono le derivate. */

const JPEG_QUALITY = 82;
const WEBP_QUALITY = 86;

/** Un file già codificato con le misure che ha davvero. */
export interface EncodedImage {
  readonly body: Buffer;
  readonly width: number;
  readonly height: number;
}

export interface ProcessedImage {
  /** Il file da conservare: orientato, senza metadati, ridotto oltre i 2560 px. */
  readonly original: EncodedImage;
  /** Vero se l'originale è stato ridotto: il nome diventa `<base>-scaled`. */
  readonly scaled: boolean;
  readonly derivatives: readonly EncodedImage[];
}

/** Misure dell'immagine come si vede, cioè dopo l'orientamento EXIF. */
export async function orientedSize(
  body: Buffer,
  maxPixels: number,
): Promise<{ width: number; height: number; palette: boolean }> {
  const meta = await sharp(body, {
    limitInputPixels: maxPixels,
    failOn: IMAGE_FAIL_ON,
  }).metadata();
  const { width = 0, height = 0, orientation = 1, isPalette = false } = meta;
  // Gli orientamenti da 5 a 8 scambiano larghezza e altezza.
  const size = orientation >= 5 ? { width: height, height: width } : { width, height };
  return { ...size, palette: isPalette };
}

/** Un WebP senza perdita ha il blocco `VP8L` come primo dato dell'immagine. */
export function isLosslessWebp(body: Buffer): boolean {
  if (body.length < 16 || body.toString('latin1', 8, 12) !== 'WEBP') return false;
  let at = 12;
  for (let step = 0; step < 16 && at + 8 <= body.length; step += 1) {
    const type = body.toString('latin1', at, at + 4);
    if (type === 'VP8L') return true;
    if (type === 'VP8 ') return false;
    at += 8 + body.readUInt32LE(at + 4) + (body.readUInt32LE(at + 4) % 2);
  }
  return false;
}

/** Come si codifica: a tavolozza o senza perdita se l'ingresso lo era. */
export interface EncodeStyle {
  readonly palette: boolean;
  readonly lossless: boolean;
}

const encode = async (pipeline: Sharp, mime: string, style: EncodeStyle): Promise<EncodedImage> => {
  const format =
    mime === 'image/png'
      ? pipeline.png(style.palette ? { palette: true } : {})
      : mime === 'image/webp'
        ? pipeline.webp(style.lossless ? { lossless: true } : { quality: WEBP_QUALITY })
        : pipeline.jpeg({ quality: JPEG_QUALITY });
  const { data, info } = await format.toBuffer({ resolveWithObject: true });
  return { body: data, width: info.width, height: info.height };
};

/** Un originale orientato; `sharp` non porta con sé alcun metadato senza `withMetadata`. */
const source = (body: Buffer, maxPixels: number): Sharp =>
  sharp(body, { limitInputPixels: maxPixels, failOn: IMAGE_FAIL_ON }).rotate();

function derive(body: Buffer, maxPixels: number, plan: ResizePlan, whole: boolean): Sharp {
  const pipeline = source(body, maxPixels);
  const cropped = whole
    ? pipeline
    : pipeline.extract({
        left: plan.srcX,
        top: plan.srcY,
        width: plan.srcWidth,
        height: plan.srcHeight,
      });
  return cropped.resize({ width: plan.width, height: plan.height, fit: 'fill' });
}

/** L'originale da conservare e le derivate, prodotte una alla volta dall'originale intero come faceva WordPress. */
export async function processImage(
  body: Buffer,
  mime: string,
  maxPixels: number,
): Promise<ProcessedImage> {
  const size = await orientedSize(body, maxPixels);
  const style: EncodeStyle = {
    palette: mime === 'image/png' && size.palette,
    lossless: mime === 'image/webp' && isLosslessWebp(body),
  };
  const reduced = scaledDimensions(size.width, size.height);
  const stored = reduced ?? size;

  const original = await encode(
    reduced
      ? source(body, maxPixels).resize({
          width: reduced.width,
          height: reduced.height,
          fit: 'fill',
        })
      : source(body, maxPixels),
    mime,
    style,
  );

  const derivatives: EncodedImage[] = [];
  for (const plan of planDerivatives(size, stored)) {
    const whole = plan.srcWidth >= size.width && plan.srcHeight >= size.height;
    derivatives.push(await encode(derive(body, maxPixels, plan, whole), mime, style));
  }
  return { original, scaled: reduced !== null, derivatives };
}
