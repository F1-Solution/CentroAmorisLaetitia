import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../src/tokens/contrast.js';
import { lightColorTokens } from '../src/tokens/tokens.js';

/**
 * La barra superiore è l'unica regione che esce dal tema: il documento di
 * design la vuole «chiara, mai scura» (§6 componente 4). Fissarne il solo fondo
 * lascia però i figli agli inchiostri del tema attivo, e in tema scuro si
 * ottiene testo chiaro su bianco: circa 2:1, illeggibile.
 *
 * Questi test non verificano un valore: verificano che l'ancoraggio esista.
 * Se qualcuno toglie il blocco `.amoris-top-bar` da `tokens.css`, falliscono.
 */

const tokensCss = readFileSync(
  path.join(import.meta.dirname, '..', 'src', 'tokens', 'tokens.css'),
  'utf8',
);

/** I valori dichiarati dentro il blocco `.amoris-top-bar` di `tokens.css`. */
function topBarScope(): Record<string, string> {
  const block = /\.amoris-top-bar\s*\{([^}]*)\}/.exec(tokensCss);
  if (!block?.[1]) {
    throw new Error(
      'Il blocco `.amoris-top-bar` non esiste più in tokens.css: la barra superiore ' +
        'seguirebbe il tema e in tema scuro diventerebbe illeggibile.',
    );
  }
  const values: Record<string, string> = {};
  for (const line of block[1].split(';')) {
    const pair = /--amoris-([a-z-]+)\s*:\s*(#[0-9A-Fa-f]{6})/.exec(line);
    if (pair?.[1] && pair[2]) values[pair[1]] = pair[2].toUpperCase();
  }
  return values;
}

describe('barra superiore — resta leggibile anche in tema scuro', () => {
  const scope = topBarScope();

  it('ancora il proprio sottoalbero ai valori del tema chiaro', () => {
    for (const name of ['bg-surface', 'text-primary', 'text-secondary', 'border'] as const) {
      expect(scope[name], `manca --amoris-${name} nel blocco .amoris-top-bar`).toBe(
        lightColorTokens[name].toUpperCase(),
      );
    }
  });

  it('il testo primario sul fondo fisso supera 4,5:1', () => {
    const bg = scope['bg-surface'];
    const ink = scope['text-primary'];
    expect(bg).toBeDefined();
    expect(ink).toBeDefined();
    expect(contrastRatio(ink as string, bg as string)).toBeGreaterThanOrEqual(4.5);
  });

  it('il testo secondario sul fondo fisso supera 4,5:1', () => {
    const bg = scope['bg-surface'];
    const ink = scope['text-secondary'];
    expect(contrastRatio(ink as string, bg as string)).toBeGreaterThanOrEqual(4.5);
  });

  it('gli inchiostri del tema scuro sul fondo fisso NON sarebbero leggibili', () => {
    // È la prova che l'ancoraggio serve davvero, non che è prudenza.
    expect(contrastRatio('#A2AFBF', '#FFFFFF')).toBeLessThan(4.5);
  });
});
