import { PNG } from 'pngjs';

/** Un colore opaco, in componenti 0-255. */
export interface Colore {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export const ROSSO: Colore = { r: 220, g: 30, b: 30 };
export const BLU: Colore = { r: 30, g: 60, b: 220 };

/** Un PNG a tinta unita generato nella prova: nessun file binario nel repository, nessun soggetto. */
export function pngTintaUnita(larghezza: number, altezza: number, colore: Colore): Buffer {
  const immagine = new PNG({ width: larghezza, height: altezza });
  for (let byte = 0; byte < immagine.data.length; byte += 4) {
    immagine.data[byte] = colore.r;
    immagine.data[byte + 1] = colore.g;
    immagine.data[byte + 2] = colore.b;
    immagine.data[byte + 3] = 255;
  }
  return PNG.sync.write(immagine);
}

/** Misure e pixel centrale di un PNG ricevuto dal sito. */
export function leggiPng(corpo: Buffer): { width: number; height: number; centro: Colore } {
  const immagine = PNG.sync.read(corpo);
  const punto =
    (Math.floor(immagine.height / 2) * immagine.width + Math.floor(immagine.width / 2)) * 4;
  return {
    width: immagine.width,
    height: immagine.height,
    centro: {
      r: immagine.data[punto] ?? -1,
      g: immagine.data[punto + 1] ?? -1,
      b: immagine.data[punto + 2] ?? -1,
    },
  };
}

/** Vero se i componenti distano al più `tolleranza`: la codifica può spostare un livello. */
export function coloreProssimo(trovato: Colore, atteso: Colore, tolleranza = 6): boolean {
  return (
    Math.abs(trovato.r - atteso.r) <= tolleranza &&
    Math.abs(trovato.g - atteso.g) <= tolleranza &&
    Math.abs(trovato.b - atteso.b) <= tolleranza
  );
}
