import type { ImageAttributes, RenderMedia } from '@amoris/blocks';

/** La taglia `et-pb-post-main-image-fullwidth` di Divi: ritaglio 1080×675, mai ingrandito. */
const CROP_WIDTH = 1080;
const CROP_HEIGHT = 675;
const PHONE_WIDTH = 480;
const SIZES = '(min-width: 0px) and (max-width: 480px) 480px, (min-width: 481px) 1080px, 100vw';

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
  const phoneHeight = Math.round((height * PHONE_WIDTH) / width);
  const phone = media.variants.find(
    (v) => v.width === PHONE_WIDTH && Math.abs(v.height - phoneHeight) <= 1,
  );
  return {
    src: crop.publicPath,
    width: CROP_WIDTH,
    height: CROP_HEIGHT,
    ...(phone
      ? {
          srcSet: `${crop.publicPath} ${CROP_WIDTH}w, ${phone.publicPath} ${PHONE_WIDTH}w`,
          sizes: SIZES,
        }
      : {}),
  };
}
