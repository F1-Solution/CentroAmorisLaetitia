/** Funzioni pure della T4 della `1E-W7` (A-2, A-5, A-7 di `acceptance-criteria.md` §6). */

export interface Punto {
  readonly x: number;
  readonly y: number;
}

/**
 * Indici dei passi del fuoco che vanno contro la posizione visiva: più in alto
 * del precedente oltre la tolleranza, o a sinistra nella stessa riga.
 */
export function inversioniOrdine(punti: readonly Punto[], tolleranza = 8): number[] {
  const out: number[] = [];
  for (let i = 1; i < punti.length; i += 1) {
    const a = punti[i - 1]!;
    const b = punti[i]!;
    const stessaRiga = Math.abs(b.y - a.y) <= tolleranza;
    if ((!stessaRiga && b.y < a.y) || (stessaRiga && b.x < a.x - tolleranza)) out.push(i);
  }
  return out;
}

/** Discese di più di un livello fra titoli consecutivi; il primo si misura da h0. */
export function saltiTitoli(livelli: readonly number[]): string[] {
  const out: string[] = [];
  let prima = 0;
  for (const l of livelli) {
    if (l > prima + 1) out.push(`${prima === 0 ? 'inizio' : `h${prima}`}→h${l}`);
    prima = l;
  }
  return out;
}

export interface Etichette {
  readonly labelFor: boolean;
  readonly labelContenitore: boolean;
  readonly ariaLabel: string;
  readonly ariaLabelledby: string;
}

export function etichettaMancante(e: Etichette): boolean {
  return !(
    e.labelFor ||
    e.labelContenitore ||
    e.ariaLabel.trim() !== '' ||
    e.ariaLabelledby.trim() !== ''
  );
}
