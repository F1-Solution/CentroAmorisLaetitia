/**
 * Normalizzazione degli URL relativi allo schema del **sito stesso**
 * (`//www.centroamorislaetitia.it/...`, `//centroamorislaetitia.it/...`), da
 * fare **prima** di passare il frammento al sanificatore di `@amoris/blocks`,
 * che ora rifiuta ogni URL relativo allo schema (`sanitize/url.ts`).
 *
 * La riscrittura da `/wp-content/uploads/` a `/media/` resta la fase 15
 * dell'importer (ADR-004 §3.3): qui si tocca **solo** la forma
 * `//host/percorso` → `/percorso`, e solo quando l'host è uno dei due del
 * sito. Ogni altro host relativo allo schema (per esempio un CDN esterno)
 * resta intatto e verrà comunque scartato dal sanificatore, come previsto.
 */
const SITE_HOSTS = new Set(['www.centroamorislaetitia.it', 'centroamorislaetitia.it']);

export interface UrlNormalizationResult {
  readonly html: string;
  /** Quante occorrenze sono state normalizzate — vanno contate, non fatte di nascosto. */
  readonly count: number;
}

const SCHEME_RELATIVE_SITE_URL = /\/\/(www\.centroamorislaetitia\.it|centroamorislaetitia\.it)(\/[^"'\s)>]*)?/g;

/**
 * Sostituisce ogni occorrenza di `//<host-del-sito>/percorso` con `/percorso`
 * dentro un frammento HTML (o dentro un singolo valore di attributo). Puro:
 * nessun accesso a rete o disco.
 */
export function normalizeSameSiteUrls(html: string): UrlNormalizationResult {
  let count = 0;
  const out = html.replace(SCHEME_RELATIVE_SITE_URL, (match, host: string, path: string | undefined) => {
    void host;
    count += 1;
    return path ?? '/';
  });
  return { html: out, count };
}

/** Vero se il valore, considerato da solo, è un URL relativo allo schema del sito stesso. */
export function isSameSiteSchemeRelative(value: string): boolean {
  const trimmed = value.trim();
  for (const host of SITE_HOSTS) {
    if (trimmed.startsWith(`//${host}`)) {
      return true;
    }
  }
  return false;
}

/** Normalizza un singolo valore (per esempio un `src` letto direttamente da un attributo Divi). */
export function normalizeSameSiteUrlValue(value: string): { value: string; normalized: boolean } {
  if (!isSameSiteSchemeRelative(value)) {
    return { value, normalized: false };
  }
  const result = normalizeSameSiteUrls(value);
  return { value: result.html, normalized: result.count > 0 };
}
