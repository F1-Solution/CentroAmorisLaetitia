import type { Page } from '@playwright/test';

/**
 * Lettura dei metadati di una pagina servita senza JavaScript, comune al
 * riferimento (`1E-W1`) e al sito nuovo (`1E-W7`, criterio 1E-8).
 */

export const CAMPI = [
  'http',
  'title',
  'description',
  'canonical',
  'og_title',
  'og_description',
  'og_image',
  'og_type',
  'robots',
  'h1',
  'schema_types',
] as const;

export type Campo = (typeof CAMPI)[number];
export type Metadati = Record<Campo, string>;

/** Il file della 1B conserva le entità HTML come le serviva la pagina. */
export function decodifica(testo: string): string {
  const nominate: Record<string, string> = {
    quot: '"',
    amp: '&',
    lt: '<',
    gt: '>',
    apos: "'",
    nbsp: ' ',
  };
  return testo.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (intera, nome: string) => {
    if (nome[0] === '#') {
      const codice =
        nome[1]?.toLowerCase() === 'x' ? parseInt(nome.slice(2), 16) : parseInt(nome.slice(1), 10);
      return String.fromCodePoint(codice);
    }
    return nominate[nome.toLowerCase()] ?? intera;
  });
}

/** Il file della 1B ha alcune lettere accentate perse in `�`: valgono come jolly. */
export function coincide(atteso: string, misurato: string): boolean {
  const a = decodifica(atteso).replace(/\s+/g, ' ').trim();
  const m = misurato.replace(/\s+/g, ' ').trim();
  if (!a.includes('�')) return a === m;
  const modello = a
    .split('�')
    .map((parte) => parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.{1,2}');
  return new RegExp(`^${modello}$`, 'u').test(m);
}

/** Gli indirizzi assoluti dipendono dall'origine servita: si confronta il percorso. */
export function relativo(valore: string): string {
  return valore.replace(/^https?:\/\/[^/]+/, '');
}

/** `tsx` aggiunge `__name(...)` alle funzioni con nome: nel browser va definito. */
export const NOMI = 'window.__name = (f) => f';

export function csv(righe: readonly (readonly string[])[]): string {
  return `${righe
    .map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replaceAll('"', '""')}"` : c)).join(','))
    .join('\n')}\n`;
}

/** Apre `indirizzo` nella pagina (senza JavaScript) e ne legge gli 11 campi. */
export async function leggiMetadati(
  page: Page,
  indirizzo: string,
): Promise<{ valori: Metadati; byte: number }> {
  const risposta = await page.goto(indirizzo, { waitUntil: 'domcontentloaded' });
  const byte = (await risposta?.body())?.length ?? 0;
  await page.evaluate(NOMI);
  const misurato = await page.evaluate(() => {
    const meta = (sel: string) => document.querySelector(sel)?.getAttribute('content') ?? '';
    const tipi = new Set<string>();
    const raccogli = (nodo: unknown): void => {
      if (Array.isArray(nodo)) nodo.forEach(raccogli);
      else if (nodo && typeof nodo === 'object') {
        for (const [k, v] of Object.entries(nodo)) {
          if (k === '@type') [v].flat().forEach((t) => tipi.add(String(t)));
          else raccogli(v);
        }
      }
    };
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        raccogli(JSON.parse(s.textContent ?? ''));
      } catch {
        // JSON non valido: nessun tipo.
      }
    }
    return {
      title: document.title,
      description: meta('meta[name="description"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
      og_title: meta('meta[property="og:title"]'),
      og_description: meta('meta[property="og:description"]'),
      og_image: meta('meta[property="og:image"]'),
      og_type: meta('meta[property="og:type"]'),
      robots: meta('meta[name="robots"]'),
      h1: [...document.querySelectorAll('h1')].map((h) => h.textContent?.trim() ?? '').join(' | '),
      schema_types: [...tipi].sort().join(','),
    };
  });
  return {
    byte,
    valori: {
      ...misurato,
      http: String(risposta?.status() ?? 0),
      canonical: relativo(misurato.canonical),
      og_image: relativo(misurato.og_image),
    },
  };
}
