/** Riconoscimento di `/anteprima/<id>/` condiviso da proxy e pagina, sul percorso nella forma dei `params` di Next. */

export const PREVIEW_PREFIX = '/anteprima/';

/** Lo stesso UUID che l'API accetta (Zod): versione 1-8 e variante RFC. */
const PREVIEW_PATH =
  /^\/anteprima\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})\/$/;

/** Il percorso grezzo nella forma dei `params` di Next (segmenti decodificati e ricodificati); se non si decodifica resta com'è. */
export function asNextParams(rawPathname: string): string {
  try {
    return rawPathname
      .split('/')
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
  } catch {
    return rawPathname;
  }
}

/** L'indirizzo, già nella forma dei `params` di Next, appartiene all'anteprima. */
export const isPreviewPath = (rawPath: string): boolean => rawPath.startsWith(PREVIEW_PREFIX);

/** L'identificativo del contenuto, o `null` se non è un'anteprima valida. */
export const previewIdOf = (rawPath: string): string | null =>
  PREVIEW_PATH.exec(rawPath)?.[1] ?? null;
