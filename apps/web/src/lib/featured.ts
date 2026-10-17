import type { ImageAttributes, RenderMedia } from '@amoris/blocks';

/** La taglia `et-pb-post-main-image-fullwidth` di Divi: ritaglio 1080×675, mai ingrandito. */
const CROP_WIDTH = 1080;
const CROP_HEIGHT = 675;
const TABLET_WIDTH = 980;
const PHONE_WIDTH = 480;
const SIZES = '(min-width: 0px) and (max-width: 480px) 480px, (min-width: 481px) 1080px, 100vw';
const SIZES_WITH_TABLET =
  '(min-width: 0px) and (max-width: 480px) 480px, (min-width: 481px) and (max-width: 980px) 980px, (min-width: 981px) 1080px, 100vw';

type Variant = RenderMedia['variants'][number];

/** La variante larga `target` in proporzione all'originale, se esiste. */
function proportional(media: RenderMedia, target: number): Variant | undefined {
  const { width, height } = media;
  if (!width || !height) return undefined;
  const expected = Math.round((height * target) / width);
  return media.variants.find((v) => v.width === target && Math.abs(v.height - expected) <= 1);
}

/** L'immagine in evidenza nell'archivio, come la scrive il tema della sorgente (1E-W6). */
export function featuredImageAttributes(media: RenderMedia): ImageAttributes {
  const { width, height } = media;
  const crop =
    width && height
      ? media.variants.find(
          (v) =>
            v.width === Math.min(width, CROP_WIDTH) && v.height === Math.min(height, CROP_HEIGHT),
        )
      : undefined;
  if (!crop || !width || !height) return { src: media.publicPath };
  const phone = proportional(media, PHONE_WIDTH);
  if (!phone) return { src: crop.publicPath, width: CROP_WIDTH, height: CROP_HEIGHT };
  // Divi aggiunge la fascia del tablet solo se esiste la variante a 980 px.
  const tablet = proportional(media, TABLET_WIDTH);
  const sources = [crop, ...(tablet ? [tablet] : []), phone];
  const widths = [CROP_WIDTH, ...(tablet ? [TABLET_WIDTH] : []), PHONE_WIDTH];
  return {
    src: crop.publicPath,
    width: CROP_WIDTH,
    height: CROP_HEIGHT,
    srcSet: sources.map((v, i) => `${v.publicPath} ${widths[i]}w`).join(', '),
    sizes: tablet ? SIZES_WITH_TABLET : SIZES,
  };
}
