/**
 * Funzioni pure della T3 della `1E-W7` (§8 voci 1, 2, 3, 5, 6, 7, 8 di
 * `visual-regression-plan.md`): confronti fra sito e riferimento, senza browser.
 */

export type Stili = Readonly<Record<string, string>>;

export interface DifferenzaStile {
  readonly proprieta: string;
  readonly riferimento: string;
  readonly sito: string;
}

/** Colori in `rgb()`/`rgba()` canonici; alfa 0 è `transparent` (tolleranza 0, `W7-PLAN.md` T3). */
export function normalizzaColore(valore: string): string {
  const v = valore.trim().toLowerCase();
  if (v === 'transparent') return 'transparent';
  const esa = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (esa) {
    const h = esa[1]!.length === 3 ? [...esa[1]!].map((c) => c + c).join('') : esa[1]!;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return `rgb(${r}, ${g}, ${b})`;
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(v);
  if (!fn) return v;
  const parti = fn[1]!.split(/[\s,/]+/).filter(Boolean);
  const [r, g, b] = parti.slice(0, 3).map((p) => String(Math.round(Number(p))));
  const alfa = parti[3] === undefined ? 1 : Number(parti[3]);
  if (alfa === 0) return 'transparent';
  return alfa === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alfa})`;
}

function normalizzaValore(proprieta: string, valore: string): string {
  if (proprieta.includes('color')) return normalizzaColore(valore);
  if (proprieta === 'opacity') return String(Number(valore));
  return valore.trim();
}

/** Le proprietà del riferimento che il sito rende in modo diverso. */
export function confrontaStili(riferimento: Stili, sito: Stili): DifferenzaStile[] {
  return Object.keys(riferimento)
    .map((proprieta) => ({
      proprieta,
      riferimento: normalizzaValore(proprieta, riferimento[proprieta] ?? ''),
      sito: normalizzaValore(proprieta, sito[proprieta] ?? ''),
    }))
    .filter((d) => d.riferimento !== d.sito);
}

export interface SpostamentoLayout {
  readonly value: number;
  readonly hadRecentInput: boolean;
}

/** Cumulative Layout Shift come lo somma il browser, arrotondato a 4 decimali. */
export function cls(eventi: readonly SpostamentoLayout[]): number {
  const somma = eventi.filter((e) => !e.hadRecentInput).reduce((s, e) => s + e.value, 0);
  return Math.round(somma * 10_000) / 10_000;
}

export interface Passo {
  readonly larghezza: number;
  readonly firma: string;
}

export interface Passaggio {
  readonly larghezza: number;
  readonly da: string;
  readonly a: string;
}

/** Scendendo di larghezza, i punti in cui la firma del layout cambia (D78 = A, DR-168). */
export function passaggi(passi: readonly Passo[]): Passaggio[] {
  const ordinati = [...passi].sort((x, y) => y.larghezza - x.larghezza);
  const out: Passaggio[] = [];
  for (let i = 1; i < ordinati.length; i += 1) {
    const prima = ordinati[i - 1]!;
    const ora = ordinati[i]!;
    if (prima.firma !== ora.firma)
      out.push({ larghezza: ora.larghezza, da: prima.firma, a: ora.firma });
  }
  return out;
}

/** Stessi passaggi alla stessa larghezza; ogni scarto descritto in una riga. */
export function confrontaPassaggi(
  riferimento: readonly Passaggio[],
  sito: readonly Passaggio[],
): string[] {
  const chiave = (p: Passaggio) => `${p.da}→${p.a}`;
  const rif = new Map(riferimento.map((p) => [chiave(p), p.larghezza]));
  const sit = new Map(sito.map((p) => [chiave(p), p.larghezza]));
  const tutte = [...new Set([...rif.keys(), ...sit.keys()])];
  return tutte
    .filter((k) => rif.get(k) !== sit.get(k))
    .map((k) => {
      const r = rif.has(k) ? `${rif.get(k)} px` : 'assente';
      const s = sit.has(k) ? `${sit.get(k)} px` : 'assente';
      return `${k}: riferimento ${r}, sito ${s}`;
    });
}

/** Il nome del file senza percorso, dimensione generata (`-300x200`) ed estensione. */
export function chiaveImmagine(src: string): string {
  const percorso = src.split(/[?#]/)[0] ?? '';
  const nome = decodeURIComponent(percorso.slice(percorso.lastIndexOf('/') + 1));
  return nome
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/-\d+x\d+$/, '')
    .replace(/-scaled$/, '')
    .toLowerCase();
}

export interface ImmagineServita {
  readonly src: string;
  readonly naturalWidth: number;
}

export type EsitoImmagine =
  'uguale' | 'più grande' | 'più piccola' | 'solo riferimento' | 'solo sito';

export interface ConfrontoImmagine {
  readonly chiave: string;
  /** Il file servito, con la dimensione derivata nel nome. */
  readonly riferimento: string | null;
  readonly sito: string | null;
  readonly esito: EsitoImmagine;
}

function nomeFile(src: string): string {
  const percorso = src.split(/[?#]/)[0] ?? '';
  return decodeURIComponent(percorso.slice(percorso.lastIndexOf('/') + 1));
}

/** Larghezza della dimensione derivata (`-1024x576`); l'originale, senza suffisso, è la più grande. */
function larghezzaFile(nome: string): number {
  const m = /-(\d+)x\d+\.[a-z0-9]+$/i.exec(nome);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

/**
 * Per immagine: il file servito dal sito contro quello scelto dalla sorgente
 * (ADR-004 §3.2, derivate importate e non rigenerate). `naturalWidth` non serve:
 * con `srcset` il browser lo divide per la densità ricavata da `sizes`.
 */
export function confrontaImmagini(
  riferimento: readonly ImmagineServita[],
  sito: readonly ImmagineServita[],
): ConfrontoImmagine[] {
  const piuGrande = (lista: readonly ImmagineServita[]) => {
    const m = new Map<string, string>();
    for (const i of lista) {
      const nome = nomeFile(i.src);
      const k = chiaveImmagine(i.src);
      const prima = m.get(k);
      if (!prima || larghezzaFile(nome) > larghezzaFile(prima)) m.set(k, nome);
    }
    return m;
  };
  const rif = piuGrande(riferimento);
  const sit = piuGrande(sito);
  return [...new Set([...rif.keys(), ...sit.keys()])].map((chiave) => {
    const r = rif.get(chiave) ?? null;
    const s = sit.get(chiave) ?? null;
    const esito: EsitoImmagine =
      r === null
        ? 'solo sito'
        : s === null
          ? 'solo riferimento'
          : r.toLowerCase() === s.toLowerCase() || larghezzaFile(r) === larghezzaFile(s)
            ? 'uguale'
            : larghezzaFile(s) > larghezzaFile(r)
              ? 'più grande'
              : 'più piccola';
    return { chiave, riferimento: r, sito: s, esito };
  });
}

export type Esito =
  'superato' | 'non superato' | 'difetto anche nella sorgente' | 'non applicabile';

/** `null` quando la voce non esiste nella pagina; un difetto comune si classifica a parte (R7-2). */
export function esitoVoce(sito: boolean | null, riferimento: boolean | null): Esito {
  if (sito === null) return 'non applicabile';
  if (sito) return 'superato';
  return riferimento === false ? 'difetto anche nella sorgente' : 'non superato';
}
