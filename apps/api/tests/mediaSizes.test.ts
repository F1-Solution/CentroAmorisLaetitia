import { describe, expect, it } from 'vitest';
import {
  RESPONSIVE_WIDTHS,
  SCALE_THRESHOLD,
  SIZE_SPECS,
  derivativeFileName,
  planDerivatives,
  resizeDimensions,
  scaledDimensions,
  sourceBaseName,
} from '../src/modules/media/sizes.js';

/**
 * Misure derivate di S8: lo stesso calcolo di `image_resize_dimensions` di WordPress,
 * con le misure del nucleo, di Divi e le responsive di Divi.
 */

const dims = (plans: readonly { width: number; height: number }[]) =>
  plans.map((plan) => `${plan.width}x${plan.height}`);

describe('elenco delle misure (S8)', () => {
  it('ha le tredici misure fisse e le tre soglie responsive', () => {
    expect(SIZE_SPECS.map((s) => `${s.width}x${s.height}${s.crop ? 'c' : ''}`)).toEqual([
      '150x150c',
      '300x300',
      '768x0',
      '1024x1024',
      '400x250c',
      '1080x675c',
      '400x284c',
      '510x382c',
      '1080x9999',
      '400x516c',
      '2880x1800c',
      '1536x1536',
      '2048x2048',
    ]);
    expect(RESPONSIVE_WIDTHS).toEqual([480, 980, 1280]);
    expect(SCALE_THRESHOLD).toBe(2560);
  });
});

describe('calcolo delle dimensioni come WordPress', () => {
  it('non ingrandisce mai', () => {
    expect(resizeDimensions(200, 100, 400, 250, true)).toBeNull();
    expect(resizeDimensions(200, 100, 768, 0, false)).toBeNull();
    expect(resizeDimensions(200, 100, 300, 300, false)).toBeNull();
  });

  it('ritaglia al centro e con il ritaglio un lato più corto del riquadro resta com’è', () => {
    // 600x300 in un riquadro 400x400 ritagliato: esce 400x300 (commento di WordPress).
    expect(resizeDimensions(600, 300, 400, 400, true)).toEqual({
      width: 400,
      height: 300,
      srcX: 100,
      srcY: 0,
      srcWidth: 400,
      srcHeight: 300,
    });
  });

  it('ritaglia l’area centrale del rapporto del riquadro', () => {
    expect(resizeDimensions(2000, 1500, 400, 250, true)).toEqual({
      width: 400,
      height: 250,
      srcX: 0,
      srcY: 125,
      srcWidth: 2000,
      srcHeight: 1250,
    });
  });

  it('scarta la misura uguale all’originale, con la tolleranza di un pixel', () => {
    expect(resizeDimensions(2000, 1500, 2880, 1800, true)).toBeNull();
    expect(resizeDimensions(1001, 1000, 1000, 1000, true)).toBeNull();
  });

  it('con altezza libera conta la sola larghezza', () => {
    expect(resizeDimensions(2000, 1500, 768, 0, false)).toMatchObject({ width: 768, height: 576 });
  });

  it('con proporzioni diverse dal riquadro sta dentro il riquadro', () => {
    expect(resizeDimensions(465, 700, 177, 177, false)).toMatchObject({ width: 118, height: 177 });
  });
});

describe('misure derivate di un originale', () => {
  it('orizzontale 2000x1500', () => {
    expect(dims(planDerivatives({ width: 2000, height: 1500 }))).toEqual([
      '150x150',
      '300x225',
      '768x576',
      '1024x768',
      '400x250',
      '1080x675',
      '400x284',
      '510x382',
      '1080x810',
      '400x516',
      '1536x1152',
      '480x360',
      '980x735',
      '1280x960',
    ]);
  });

  it('verticale 1500x2000, senza doppioni fra misure uguali', () => {
    expect(dims(planDerivatives({ width: 1500, height: 2000 }))).toEqual([
      '150x150',
      '225x300',
      '768x1024',
      '400x250',
      '1080x675',
      '400x284',
      '510x382',
      '1080x1440',
      '400x516',
      '1500x1800',
      '1152x1536',
      '480x640',
      '980x1307',
      '1280x1707',
    ]);
  });

  it('quadrato 1000x1000: le responsive grandi quanto l’originale si saltano', () => {
    expect(dims(planDerivatives({ width: 1000, height: 1000 }))).toEqual([
      '150x150',
      '300x300',
      '768x768',
      '400x250',
      '1000x675',
      '400x284',
      '510x382',
      '400x516',
      '480x480',
      '980x980',
    ]);
  });

  it('piccolo 200x100: resta solo il ritaglio più stretto', () => {
    expect(dims(planDerivatives({ width: 200, height: 100 }))).toEqual(['150x100']);
  });

  it('ogni misura ha il ritaglio di partenza per ritagliarla', () => {
    const plan = planDerivatives({ width: 2000, height: 1500 }).find((p) => p.width === 400);
    expect(plan).toMatchObject({
      width: 400,
      height: 250,
      srcY: 125,
      srcWidth: 2000,
      srcHeight: 1250,
    });
  });
});

describe('riduzione oltre i 2560 pixel', () => {
  it('riduce il lato lungo a 2560 mantenendo le proporzioni', () => {
    expect(scaledDimensions(4000, 3000)).toEqual({ width: 2560, height: 1920 });
    expect(scaledDimensions(3000, 5000)).toEqual({ width: 1536, height: 2560 });
  });

  it('non tocca un originale entro la soglia', () => {
    expect(scaledDimensions(2560, 1000)).toBeNull();
    expect(scaledDimensions(2000, 1500)).toBeNull();
  });
});

describe('nomi dei file derivati', () => {
  it('<base>-LxA.<est>', () => {
    expect(derivativeFileName('foto', 'jpg', 300, 225)).toBe('foto-300x225.jpg');
  });

  it('la base si ricava dal nome senza -scaled', () => {
    expect(sourceBaseName('foto-scaled.jpg')).toEqual({ base: 'foto', extension: 'jpg' });
    expect(sourceBaseName('foto.PNG')).toEqual({ base: 'foto', extension: 'PNG' });
    expect(sourceBaseName('a.b-scaled.webp')).toEqual({ base: 'a.b', extension: 'webp' });
  });
});
