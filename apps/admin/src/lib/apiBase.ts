/** Senza variabile vale il predefinito dello sviluppo locale. */
const LOCAL_DEFAULT = 'http://localhost:3002';

/** Con la variabile vuota l'API è sulla stessa origine, sotto `/api` instradato da Caddy (DR-360). */
const SAME_ORIGIN = '/api';

/** Base degli indirizzi dell'API per il browser, senza barra finale; letta in linea perché la build la fissi e tolga il ramo morto. */
export function apiBase(): string {
  const value = process.env.NEXT_PUBLIC_API_URL;
  if (value === undefined) return LOCAL_DEFAULT;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed === '' ? SAME_ORIGIN : trimmed;
}
