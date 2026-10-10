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
export function imageAttributes(media: RenderMedia): ImageAttributes {
  const candidates = [
    ...media.variants.map((variant) => `${variant.publicPath} ${variant.width}w`),
    ...(media.width ? [`${media.publicPath} ${media.width}w`] : []),
  ];
  return {
    src: media.publicPath,
    ...(candidates.length > 1 ? { srcSet: candidates.join(', ') } : {}),
    ...(media.width
      ? { sizes: `(max-width: ${media.width}px) 100vw, ${media.width}px`, width: media.width }
      : {}),
    ...(media.height ? { height: media.height } : {}),
  };
}
