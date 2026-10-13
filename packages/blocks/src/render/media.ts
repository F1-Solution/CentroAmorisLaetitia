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
 * l'originale, e `sizes` pari alla larghezza dell'originale.
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
  const all = [
    ...media.variants,
    ...(media.width && media.height
      ? [{ publicPath: media.publicPath, width: media.width, height: media.height }]
      : []),
  ];
  // Come `wp_calculate_image_srcset`: stessa proporzione, niente oltre 2048 px salvo l'immagine mostrata, una per larghezza (famiglia K).
  const seen = new Set<number>();
  const candidates = all
    .filter((c) => {
      if (!shown.width || !shown.height) return false;
      if (c.width > MAX_SRCSET_WIDTH && c.publicPath !== shown.publicPath) return false;
      if (!matchesRatio(shown.width, shown.height, c.width, c.height) || seen.has(c.width))
        return false;
      seen.add(c.width);
      return true;
    })
    .map((c) => `${c.publicPath} ${c.width}w`);
  return {
    src: shown.publicPath,
    ...(candidates.length > 1 ? { srcSet: candidates.join(', ') } : {}),
    ...(shown.width
      ? { sizes: `(max-width: ${shown.width}px) 100vw, ${shown.width}px`, width: shown.width }
      : {}),
    ...(shown.height ? { height: shown.height } : {}),
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
