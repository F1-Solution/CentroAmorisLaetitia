/**
 * DR-401: l'indirizzo che Caddy ha scritto per ultimo in `X-Forwarded-For`, da inoltrare all'API perché ricerca e
 * redirect si limitino per visitatore; senza intestazione non se ne inventa una.
 */
export function visitorHeaders(forwarded: string | null | undefined): Record<string, string> {
  const address = forwarded?.split(',').at(-1)?.trim();
  return address ? { 'x-forwarded-for': address } : {};
}
