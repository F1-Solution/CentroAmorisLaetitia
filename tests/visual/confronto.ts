import { createHash } from 'node:crypto';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

/**
 * Il confronto di `visual-regression-plan.md` §6: tolleranza per pixel 0,1 sulla
 * distanza percettiva, percentuale di pixel diversi, e l'area contigua più grande.
 *
 * «Area contigua oltre 32 × 32» si misura così: componenti connesse a 8 vicini
 * dei pixel diversi; una componente supera la regola se il suo rettangolo
 * di ingombro è più largo **e** più alto di 32 pixel.
 */

export const TOLLERANZA_PIXEL = 0.1;
export const LATO_AREA_MASSIMA = 32;

export interface Area {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Esito {
  /** `false` se le due immagini non hanno le stesse dimensioni: non si confrontano. */
  readonly confrontabile: boolean;
  readonly larghezza: number;
  readonly altezze: readonly [number, number];
  readonly pixelDiversi: number;
  readonly percentuale: number;
  readonly areaMassima: Area | null;
  /** Le componenti oltre 32 × 32, per proporre una maschera o cercare la causa. */
  readonly areeOltreSoglia: readonly Area[];
  readonly immagineDifferenza: Buffer | null;
}

export function impronta(png: Buffer): string {
  return createHash('sha256').update(png).digest('hex');
}

export function confronta(a: Buffer, b: Buffer): Esito {
  const pa = PNG.sync.read(a);
  const pb = PNG.sync.read(b);
  if (pa.width !== pb.width || pa.height !== pb.height) {
    return {
      confrontabile: false,
      larghezza: pa.width,
      altezze: [pa.height, pb.height],
      pixelDiversi: 0,
      percentuale: 100,
      areaMassima: null,
      areeOltreSoglia: [],
      immagineDifferenza: null,
    };
  }
  const { width, height } = pa;
  const diff = new PNG({ width, height });
  const pixelDiversi = pixelmatch(pa.data, pb.data, diff.data, width, height, {
    threshold: TOLLERANZA_PIXEL,
    includeAA: false,
    alpha: 0.2,
    diffColor: [255, 0, 0],
    aaColor: [255, 255, 0],
  });
  const aree = componenti(diff.data, width, height);
  const areaMassima = aree.reduce<Area | null>(
    (max, area) => (max === null || area.w * area.h > max.w * max.h ? area : max),
    null,
  );
  return {
    confrontabile: true,
    larghezza: width,
    altezze: [height, height],
    pixelDiversi,
    percentuale: (pixelDiversi / (width * height)) * 100,
    areaMassima,
    areeOltreSoglia: aree.filter(
      (area) => area.w > LATO_AREA_MASSIMA && area.h > LATO_AREA_MASSIMA,
    ),
    immagineDifferenza: pixelDiversi > 0 ? PNG.sync.write(diff) : null,
  };
}

/** I pixel segnati in rosso pieno da pixelmatch, raggruppati in componenti connesse. */
function componenti(data: Buffer, width: number, height: number): Area[] {
  const diverso = (i: number) =>
    data[i * 4] === 255 && data[i * 4 + 1] === 0 && data[i * 4 + 2] === 0;
  const visto = new Uint8Array(width * height);
  const coda = new Int32Array(width * height);
  const aree: Area[] = [];
  for (let start = 0; start < width * height; start += 1) {
    if (visto[start] || !diverso(start)) continue;
    let testa = 0;
    let fine = 0;
    coda[fine++] = start;
    visto[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (testa < fine) {
      const i = coda[testa++] as number;
      const x = i % width;
      const y = (i - x) / width;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (!visto[j] && diverso(j)) {
            visto[j] = 1;
            coda[fine++] = j;
          }
        }
      }
    }
    aree.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
  }
  return aree;
}
