/**
 * Regole di redirect attese e loro esito (criterio 1E-9, `1E-W7` T2).
 *
 * Le regole si ricavano dalle fonti documentate, non dal database: le pagine
 * allegato e i documenti da `url-matrix.csv`, gli slug storici dal §3.3 di
 * `wp-to-postgres-mapping.md`, il prefisso dei media da ADR-004 §3.4.
 */

export type Gruppo = 'allegato' | 'allegato oscurato' | 'download' | 'slug storico' | 'prefisso';

export interface Regola {
  readonly origine: string;
  readonly gruppo: Gruppo;
  /** La destinazione come la misurò la sorgente; vuota dove non ce n'è una. */
  readonly destinazioneSorgente: string;
}

export interface Atteso {
  readonly stato: number;
  readonly destinazione: string;
}

const UPLOADS = '/wp-content/uploads/';
const MEDIA = '/media/';

/** Percorso senza origine e con i caratteri decodificati, per confrontare codifiche diverse. */
export function normalizza(valore: string): string {
  const percorso = valore.replace(/^https?:\/\/[^/]+/, '');
  try {
    return decodeURI(percorso);
  } catch {
    return percorso;
  }
}

const versoMedia = (percorso: string): string =>
  percorso.startsWith(UPLOADS) ? MEDIA + percorso.slice(UPLOADS.length) : percorso;

export function attesoPer(regola: Regola): Atteso {
  switch (regola.gruppo) {
    // Un contenuto pubblicato con lo stesso percorso vince sulla regola, come in WordPress.
    case 'allegato oscurato':
      return { stato: 200, destinazione: '' };
    case 'prefisso':
      return { stato: 301, destinazione: normalizza(versoMedia(regola.origine)) };
    default:
      return { stato: 301, destinazione: normalizza(versoMedia(regola.destinazioneSorgente)) };
  }
}

/** Una riga di `url-matrix.csv` come la legge `leggiCsv`. */
type RigaMatrice = Readonly<Record<string, string>>;

/** Pagine allegato (170, DR-034 e DR-065) e documenti scaricabili (4) della matrice. */
export function regoleDallaMatrice(righe: readonly RigaMatrice[]): Regola[] {
  return righe.flatMap((r): Regola[] => {
    const origine = r['url'] ?? '';
    const destinazioneSorgente = r['destinazione_redirect'] ?? '';
    if (r['tipo'] === 'wpdmpro' && r['stato_misurato'] === '301') {
      return [{ origine, gruppo: 'download', destinazioneSorgente }];
    }
    if (r['tipo'] !== 'attachment') return [];
    const gruppo: Gruppo = r['stato_misurato'] === '301' ? 'allegato' : 'allegato oscurato';
    return [{ origine, gruppo, destinazioneSorgente }];
  });
}

/** Le righe `| `/vecchio/` | **301** | `/nuovo/` |` della tabella del §3.3 del mapping. */
export function slugStorici(markdown: string): Regola[] {
  return [...markdown.matchAll(/^\| `(\/[^`]*)` \| \*\*301\*\* \| `(\/[^`]*)` \|$/gm)].map((m) => ({
    origine: m[1]!,
    gruppo: 'slug storico',
    destinazioneSorgente: m[2]!,
  }));
}

/** Generatore deterministico (mulberry32): lo stesso seme ridà lo stesso campione. */
function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` elementi distinti di `elenco`, scelti con Fisher-Yates parziale su una copia. */
export function campione<T>(elenco: readonly T[], n: number, seme: number): T[] {
  const copia = [...elenco];
  const caso = generatore(seme);
  const quanti = Math.min(n, copia.length);
  for (let i = 0; i < quanti; i += 1) {
    const j = i + Math.floor(caso() * (copia.length - i));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia.slice(0, quanti);
}

/** Controllo simmetrico del §10: un 200 non diventa redirect, un 301 non diventa pagina. */
export function confrontoSimmetrico(statoMatrice: number, statoSito: number): string | null {
  const redirect = statoSito >= 300 && statoSito < 400;
  if (statoMatrice === 200 && redirect) return 'inversione 200 → 3xx';
  if (statoMatrice === 301 && statoSito === 200) return 'inversione 301 → 200';
  return null;
}
