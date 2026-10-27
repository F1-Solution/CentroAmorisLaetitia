/** `video`. Non contiene blocchi (`BLOCK-MODEL.md` §3.7). */
import { z } from 'zod';
import { classesField, EntityRef } from '../common';

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

/** Identificativo di un video YouTube: 11 caratteri dell'alfabeto base64 per URL. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_WATCH_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com'];
const YOUTUBE_NOCOOKIE_HOSTS = ['youtube-nocookie.com', 'www.youtube-nocookie.com'];

/** Messaggio in italiano per un indirizzo video rifiutato (DR-279). */
export const YOUTUBE_URL_MESSAGE =
  'Serve un indirizzo YouTube che cominci con https:// (youtube.com/watch?v=…, youtu.be/…, youtube.com/embed/… o youtube-nocookie.com/embed/…).';

function youTubeIdOf(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') return segments.length === 1 ? (segments[0] ?? null) : null;
  if (YOUTUBE_WATCH_HOSTS.includes(host) && url.pathname === '/watch')
    return url.searchParams.get('v');
  if ([...YOUTUBE_WATCH_HOSTS, ...YOUTUBE_NOCOOKIE_HOSTS].includes(host) && segments[0] === 'embed')
    return segments.length === 2 ? (segments[1] ?? null) : null;
  return null;
}

/**
 * Un indirizzo YouTube scelto dall'editor, ricondotto alla forma `watch?v=` che la resa già
 * incorpora; `null` per ogni altro host, schema, porta o credenziale (DR-279).
 */
export function normalizeYouTubeUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const id = youTubeIdOf(url);
  return id && YOUTUBE_ID.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}
