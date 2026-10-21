import type { AreaId } from './areas';

const BASE_PATH = '/admin';
const CHOICE_PARAM = 'dopo';

/** Indirizzo della scelta dell'area che conserva il percorso di arrivo. */
export function choiceUrlFor(pathname: string, search: string): string {
  const inner = pathname.startsWith(`${BASE_PATH}/`) ? pathname.slice(BASE_PATH.length) : pathname;
  return `/scelta-area?${CHOICE_PARAM}=${encodeURIComponent(`${inner}${search}`)}`;
}

/** Legge la meta di ritorno dall'indirizzo corrente, solo nel browser. */
export function readReturnParam(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(CHOICE_PARAM);
}

/** Restituisce la meta solo se è un percorso interno dell'area scelta, altrimenti null. */
export function safeReturnPath(raw: string | null, area: AreaId): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  // Niente barre rovesciate, caratteri di controllo o spazi: i browser li reinterpretano.
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    if (char === '\\' || code <= 0x20 || code === 0x7f) return null;
  }
  const [path = ''] = raw.split(/[?#]/, 1);
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (decoded.includes('\\') || decoded.split('/').some((segment) => segment === '..')) {
    return null;
  }
  const root = `/${area}`;
  return path === root || path.startsWith(`${root}/`) ? raw : null;
}
