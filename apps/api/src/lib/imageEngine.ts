import sharp from 'sharp';
import type { Config } from '../config.js';

/** Solo JPEG, PNG e WebP da memoria: ogni altro lettore di `sharp` resta bloccato. */
const ALLOWED_LOADERS = [
  'VipsForeignLoadJpegBuffer',
  'VipsForeignLoadPngBuffer',
  'VipsForeignLoadWebpBuffer',
];

/** Impostazioni di `sharp` all'avvio: lettori ammessi, nessuna cache, fili limitati. */
export function configureImageEngine(config: Config): void {
  sharp.block({ operation: ['VipsForeignLoad'] });
  sharp.unblock({ operation: ALLOWED_LOADERS });
  sharp.cache(false);
  sharp.concurrency(config.MEDIA_IMAGE_THREADS);
}
