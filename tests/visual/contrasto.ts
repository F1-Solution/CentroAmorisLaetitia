import { normalizzaColore } from './interazioni';

/** Rapporto di contrasto WCAG 2.x (A-8, `acceptance-criteria.md` §6), su colori opachi. */

function canali(colore: string): [number, number, number, number] {
  const n = normalizzaColore(colore);
  if (n === 'transparent') return [0, 0, 0, 0];
  const m = /^rgba?\(([^)]+)\)$/.exec(n);
  if (!m) throw new Error(`colore non riconosciuto: ${colore}`);
  const [r, g, b, a] = m[1]!.split(',').map((p) => Number(p.trim()));
  return [r!, g!, b!, a ?? 1];
}

function luminanza(colore: string): number {
  const [r, g, b] = canali(colore).map((c, i) => {
    if (i === 3) return c;
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function rapporto(a: string, b: string): number {
  const [chiaro, scuro] = [luminanza(a), luminanza(b)].sort((x, y) => y - x);
  return (chiaro! + 0.05) / (scuro! + 0.05);
}

/** Arrotondato a due decimali, come lo riportano gli strumenti. */
export function contrasto(a: string, b: string): number {
  return Math.round(rapporto(a, b) * 100) / 100;
}

/** Un colore con alfa fuso su uno sfondo opaco. */
export function componi(primo: string, sfondo: string): string {
  const [r, g, b, a] = canali(primo);
  const [R, G, B] = canali(sfondo);
  const f = (x: number, y: number) => Math.round(x * a + y * (1 - a));
  return `rgb(${f(r, R)}, ${f(g, G)}, ${f(b, B)})`;
}

/** WCAG: almeno 24 px, o 18,66 px (14 pt) in grassetto. */
export function testoGrande(pixel: number, peso: number): boolean {
  return pixel >= 24 || (peso >= 700 && pixel >= 18.66);
}

/** Le due coppie che DR-115 rinvia a dopo l'approvazione della parità. */
const DECISE_DR115 = [
  ['#2ea3f2', '#fff'],
  ['#999', '#eee'],
].map(([t, s]) => `${normalizzaColore(t!)}|${normalizzaColore(s!)}`);

export type ClasseContrasto =
  'conforme' | 'non conforme già decisa da DR-115' | 'non conforme nuova';

export function classificaContrasto(
  testo: string,
  sfondo: string,
  grande: boolean,
): ClasseContrasto {
  if (rapporto(testo, sfondo) >= (grande ? 3 : 4.5)) return 'conforme';
  return DECISE_DR115.includes(`${normalizzaColore(testo)}|${normalizzaColore(sfondo)}`)
    ? 'non conforme già decisa da DR-115'
    : 'non conforme nuova';
}
