import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPACING_VARIABLES } from '@amoris/blocks';

/**
 * Le spaziature arrivano come proprietà personalizzate in linea, che il CSS
 * eredita: senza un reset su ogni blocco, righe e colonne prendono il padding
 * della sezione (famiglia Q, DR-157). La regola deve coprire l'intero elenco.
 */
describe('blocks.css — reset delle spaziature in linea (Q)', () => {
  const css = readFileSync(path.join(__dirname, '../src/styles/blocks.css'), 'utf-8');
  const reset = /\.blk\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

  it.each(SPACING_VARIABLES)('%s torna a initial su ogni blocco', (name) => {
    expect(reset).toMatch(new RegExp(`${name}:\\s*initial;`));
  });
});
