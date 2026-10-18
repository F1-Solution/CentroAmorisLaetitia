/**
 * I media che chi rende conosce: la mappa che la lettura pubblica restituisce con
 * il contenuto (DR-104), indicizzata per identificativo. Senza mappa, come
 * nell'anteprima dell'area amministrativa, un'immagine resta il segnaposto con
 * l'identificativo.
 */
export interface RenderMedia {
  readonly publicPath: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly altText: string | null;
  readonly variants: readonly { publicPath: string; width: number; height: number }[];
}

export type MediaMap = Readonly<Record<string, RenderMedia>>;

export interface ImageAttributes {
  readonly src: string;
  readonly srcSet?: string;
  readonly sizes?: string;
  readonly width?: number;
  readonly height?: number;
}

/**
 * `src`, `srcset` e `sizes` come li scrive WordPress per un'immagine a piena
 * larghezza: le dimensioni derivate (ADR-004 §3.2, mai rigenerate) più
 * l'originale, e `sizes` pari alla larghezza dell'originale; con le derivate
 * Divi valgono i filtri del tema (I2, DR-183, DR-195).
 */
export function imageAttributes(media: RenderMedia, variant?: string | null): ImageAttributes {
  const chosen = variant
    ? media.variants.find((v) => `${v.width}x${v.height}` === variant)
    : undefined;
  const shown = chosen ?? {
    publicPath: media.publicPath,
    width: media.width ?? 0,
    height: media.height ?? 0,
  };
  const dimensions = {
    ...(shown.width ? { width: shown.width } : {}),
    ...(shown.height ? { height: shown.height } : {}),
  };
  const divi = diviResponsiveVariants(media);
  if (divi.length > 0 && shown.width) {
    return { src: shown.publicPath, ...diviSrcsetAndSizes(shown, divi), ...dimensions };
  }
  const candidates = wordpressCandidates(media, shown).map((c) => `${c.publicPath} ${c.width}w`);
  return {
    src: shown.publicPath,
    ...(candidates.length > 1 ? { srcSet: candidates.join(', ') } : {}),
    ...(shown.width ? { sizes: `(max-width: ${shown.width}px) 100vw, ${shown.width}px` } : {}),
    ...dimensions,
  };
}

interface Source {
  readonly publicPath: string;
  readonly width: number;
  readonly height: number;
}

/** Come `wp_calculate_image_srcset`: stessa proporzione, niente oltre 2048 px salvo la mostrata, una per larghezza (famiglia K). */
function wordpressCandidates(media: RenderMedia, shown: Source): Source[] {
  if (!shown.width || !shown.height) return [];
  const original =
    media.width && media.height
      ? [{ publicPath: media.publicPath, width: media.width, height: media.height }]
      : [];
  const all = [...media.variants, ...original];
  const eligible = (c: Source) =>
    (c.width <= MAX_SRCSET_WIDTH || c.publicPath === shown.publicPath) &&
    matchesRatio(shown.width, shown.height, c.width, c.height);
  // A parità di larghezza vince la mostrata, poi l'originale (caso B di I2).
  const byPriority = [
    ...all.filter((c) => c.publicPath === shown.publicPath),
    ...original,
    ...media.variants,
  ];
  const winners = new Map<number, string>();
  for (const c of byPriority) {
    if (eligible(c) && !winners.has(c.width)) winners.set(c.width, c.publicPath);
  }
  const emitted = new Set<number>();
  return all.filter((c) => {
    if (winners.get(c.width) !== c.publicPath || emitted.has(c.width)) return false;
    emitted.add(c.width);
    return true;
  });
}

/** Larghezze delle taglie `et-pb-image--responsive--*` di Divi (telefono, tablet, desktop). */
const DIVI_RESPONSIVE_WIDTHS: readonly number[] = [480, 980, 1280];

/** Derivate Divi riconosciute per larghezza e proporzione dell'originale (DR-183), in ordine crescente. */
function diviResponsiveVariants(media: RenderMedia): Source[] {
  const { width, height } = media;
  if (!width || !height) return [];
  const byWidth = new Map<number, Source>();
  for (const v of media.variants) {
    if (DIVI_RESPONSIVE_WIDTHS.includes(v.width) && matchesRatio(width, height, v.width, v.height))
      byWidth.set(v.width, v);
  }
  return [...byWidth.values()].sort((a, b) => a.width - b.width);
}

/** Porto di `et_filter_wp_calculate_image_srcset` e `et_filter_wp_calculate_image_sizes`; con una sola sorgente WordPress non scrive né `srcset` né `sizes`. */
function diviSrcsetAndSizes(
  shown: Source,
  responsive: readonly Source[],
): Pick<ImageAttributes, 'srcSet' | 'sizes'> {
  const included = responsive.filter((v) => v.width <= shown.width);
  const largestKey = responsive[responsive.length - 1]?.width ?? 0;
  const sources: Source[] = [...included];
  if (included.length > 0 && shown.width > largestKey) sources.push(shown);
  if (sources.length < 2) return {};
  const bands: string[] = [];
  let previous = 0;
  for (const v of included) {
    bands.push(
      `(min-width: ${previous ? previous + 1 : 0}px) and (max-width: ${v.width}px) ${v.width}px`,
    );
    previous = v.width;
  }
  if (shown.width > previous) bands.push(`(min-width: ${previous + 1}px) ${shown.width}px`);
  bands.push('100vw');
  return {
    srcSet: [...sources]
      .reverse()
      .map((s) => `${s.publicPath} ${s.width}w`)
      .join(', '),
    sizes: bands.join(', '),
  };
}

/** `max_srcset_image_width` predefinito di WordPress. */
const MAX_SRCSET_WIDTH = 2048;

/** Porto di `wp_image_matches_ratio()`: proporzioni uguali entro 1 px dopo il ridimensionamento. */
function matchesRatio(sourceW: number, sourceH: number, targetW: number, targetH: number): boolean {
  if (sourceW > targetW) {
    return Math.abs(Math.max(1, Math.round((sourceH * targetW) / sourceW)) - targetH) <= 1;
  }
  return Math.abs(Math.max(1, Math.round((targetH * sourceW) / targetW)) - sourceH) <= 1;
}

/**
 * Miniatura a misura fissa (`post_list`, 1E-W6): la variante più piccola che copre
 * il riquadro, come la taglia `thumbnail` 150×150 di WordPress, senza `srcset`.
 */
export function thumbnailAttributes(
  media: RenderMedia,
  width: number,
  height: number,
): ImageAttributes {
  const covering = [...media.variants]
    .filter((v) => v.width >= width && v.height >= height)
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];
  return { src: covering?.publicPath ?? media.publicPath, width, height };
}
