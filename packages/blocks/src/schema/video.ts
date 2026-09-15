/** `video`. Non contiene blocchi (`BLOCK-MODEL.md` §3.7). */
import { z } from 'zod';
import { classesField, EntityRef } from '../common.js';

export const videoPropsSchema = z
  .object({
    src: z.string().min(1),
    provider: z.enum(['youtube', 'vimeo', 'file', 'other']).default('other'),
    posterMediaId: EntityRef.nullable().default(null),
    posterSrc: z.string().nullable().default(null),
    classes: classesField,
  })
  .strict();

export type VideoProps = z.infer<typeof videoPropsSchema>;

/**
 * Come si deriva `provider` (§3.7.1). Deterministico, applicato sul dominio in
 * minuscolo. Si applica **una volta**, all'import: il valore poi si conserva.
 */
export function deriveVideoProvider(src: string): VideoProps['provider'] {
  if (src.startsWith('/media/')) {
    return 'file';
  }
  let host = '';
  try {
    host = new URL(src).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'youtu.be') {
    return 'youtube';
  }
  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    return 'vimeo';
  }
  return 'other';
}
