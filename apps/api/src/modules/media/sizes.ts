/** Misure derivate di un'immagine (S8): le stesse che WordPress e il tema Divi generavano, con `image_resize_dimensions`. */

export interface SizeSpec {
  readonly width: number;
  /** Zero vuol dire altezza libera, come in `add_image_size`. */
  readonly height: number;
  readonly crop: boolean;
}

/** Riquadro e punto di partenza di una misura derivata, già calcolati sull'originale. */
export interface ResizePlan {
  readonly width: number;
  readonly height: number;
  readonly srcX: number;
  readonly srcY: number;
  readonly srcWidth: number;
  readonly srcHeight: number;
}

/** Ordine di WordPress: miniatura, medie, grande, misure di Divi, poi 1536 e 2048 del nucleo. */
export const SIZE_SPECS: readonly SizeSpec[] = [
  { width: 150, height: 150, crop: true },
  { width: 300, height: 300, crop: false },
  { width: 768, height: 0, crop: false },
  { width: 1024, height: 1024, crop: false },
  { width: 400, height: 250, crop: true },
  { width: 1080, height: 675, crop: true },
  { width: 400, height: 284, crop: true },
  { width: 510, height: 382, crop: true },
  { width: 1080, height: 9999, crop: false },
  { width: 400, height: 516, crop: true },
  { width: 2880, height: 1800, crop: true },
  { width: 1536, height: 1536, crop: false },
  { width: 2048, height: 2048, crop: false },
];

/** `et_screen_sizes()` di Divi: desktop, tablet e telefono, in sola larghezza. */
export const RESPONSIVE_WIDTHS: readonly number[] = [480, 980, 1280];

/** `big_image_size_threshold` di WordPress. */
export const SCALE_THRESHOLD = 2560;

/** `round()` di PHP, che per i valori positivi arrotonda la metà per eccesso. */
const round = (value: number): number => Math.round(value);

/** `wp_constrain_dimensions`: sta nel riquadro senza ingrandire, altezza 0 = libera. */
function constrainDimensions(
  currentWidth: number,
  currentHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (!maxWidth && !maxHeight) return { width: currentWidth, height: currentHeight };

  let widthRatio = 1;
  let heightRatio = 1;
  let didWidth = false;
  let didHeight = false;
  if (maxWidth > 0 && currentWidth > 0 && currentWidth > maxWidth) {
    widthRatio = maxWidth / currentWidth;
    didWidth = true;
  }
  if (maxHeight > 0 && currentHeight > 0 && currentHeight > maxHeight) {
    heightRatio = maxHeight / currentHeight;
    didHeight = true;
  }

  const smaller = Math.min(widthRatio, heightRatio);
  const larger = Math.max(widthRatio, heightRatio);
  const overflows =
    round(currentWidth * larger) > maxWidth || round(currentHeight * larger) > maxHeight;
  const ratio = overflows ? smaller : larger;

  let width = Math.max(1, round(currentWidth * ratio));
  let height = Math.max(1, round(currentHeight * ratio));
  // Un pixel corto per l'arrotondamento: si porta al massimo.
  if (didWidth && width === maxWidth - 1) width = maxWidth;
  if (didHeight && height === maxHeight - 1) height = maxHeight;
  return { width, height };
}

/** `image_resize_dimensions` con `crop` al centro: `null` se la misura ingrandirebbe o coincide con l'originale a meno di un pixel. */
export function resizeDimensions(
  origWidth: number,
  origHeight: number,
  destWidth: number,
  destHeight: number,
  crop: boolean,
): ResizePlan | null {
  if (origWidth <= 0 || origHeight <= 0) return null;
  if (destWidth <= 0 && destHeight <= 0) return null;

  if (!destHeight) {
    if (origWidth < destWidth) return null;
  } else if (!destWidth) {
    if (origHeight < destHeight) return null;
  } else if (origWidth < destWidth && origHeight < destHeight) {
    return null;
  }

  let width: number;
  let height: number;
  let srcX = 0;
  let srcY = 0;
  let srcWidth = origWidth;
  let srcHeight = origHeight;

  if (crop) {
    const aspect = origWidth / origHeight;
    width = Math.min(destWidth, origWidth);
    height = Math.min(destHeight, origHeight);
    if (!width) width = round(height * aspect);
    if (!height) height = round(width / aspect);
    const sizeRatio = Math.max(width / origWidth, height / origHeight);
    srcWidth = round(width / sizeRatio);
    srcHeight = round(height / sizeRatio);
    srcX = Math.floor((origWidth - srcWidth) / 2);
    srcY = Math.floor((origHeight - srcHeight) / 2);
  } else {
    ({ width, height } = constrainDimensions(origWidth, origHeight, destWidth, destHeight));
  }

  if (Math.abs(width - origWidth) <= 1 && Math.abs(height - origHeight) <= 1) return null;
  return { width, height, srcX, srcY, srcWidth, srcHeight };
}

/** Dimensioni dell'originale ridotto alla soglia, `null` se è entro 2560 pixel. */
export function scaledDimensions(
  width: number,
  height: number,
): { width: number; height: number } | null {
  if (width <= SCALE_THRESHOLD && height <= SCALE_THRESHOLD) return null;
  return constrainDimensions(width, height, SCALE_THRESHOLD, SCALE_THRESHOLD);
}

/** Le derivate di un originale senza doppioni: `source` è l'originale orientato, `stored` il file conservato dopo la riduzione. */
export function planDerivatives(
  source: { readonly width: number; readonly height: number },
  stored: { readonly width: number; readonly height: number } = source,
): readonly ResizePlan[] {
  const plans: ResizePlan[] = [];
  const seen = new Set<string>();
  const add = (plan: ResizePlan | null): void => {
    if (!plan) return;
    const key = `${plan.width}x${plan.height}`;
    if (seen.has(key)) return;
    seen.add(key);
    plans.push(plan);
  };

  for (const spec of SIZE_SPECS) {
    add(resizeDimensions(source.width, source.height, spec.width, spec.height, spec.crop));
  }
  for (const width of RESPONSIVE_WIDTHS) {
    if (width >= stored.width) continue;
    const height = round(width / (stored.width / stored.height));
    add(resizeDimensions(source.width, source.height, width, height, true));
  }
  return plans;
}

/** `<base>-LxA.<est>`. */
export function derivativeFileName(
  base: string,
  extension: string,
  width: number,
  height: number,
): string {
  return `${base}-${width}x${height}.${extension}`;
}

/** Nome senza estensione ed estensione (senza punto), vuota se manca. */
export function splitFileName(fileName: string): { stem: string; extension: string } {
  const dot = fileName.lastIndexOf('.');
  return dot < 0
    ? { stem: fileName, extension: '' }
    : { stem: fileName.slice(0, dot), extension: fileName.slice(dot + 1) };
}

/** Base e estensione di un file, senza il `-scaled` che WordPress aggiunge agli originali ridotti. */
export function sourceBaseName(fileName: string): { base: string; extension: string } {
  const { stem, extension } = splitFileName(fileName);
  return { base: stem.replace(/-scaled$/, ''), extension };
}
