import { describe, expect, it } from 'vitest';
import { colorTokensByTheme } from '../src/tokens/tokens.js';
import { contrastRatio, CONTRAST_MINIMUMS } from '../src/tokens/contrast.js';
import { contrastPairs } from '../src/tokens/contrast-pairs.js';

describe('rapporti di contrasto, capitolo 2 di design-system.md', () => {
  it.each(contrastPairs)('$theme: $note ($documented:1 dichiarato)', (pair) => {
    const tokens = colorTokensByTheme[pair.theme];
    const computed = contrastRatio(tokens[pair.fg], tokens[pair.bg]);

    // Il valore ricalcolato deve coincidere con quello dichiarato nel documento,
    // entro l'arrotondamento a due cifre (§12: "coincidono ... entro
    // l'arrotondamento a due cifre"). Una tolleranza più larga non si accorgerebbe
    // di un token scambiato con un altro di contrasto simile.
    expect(computed).toBeCloseTo(pair.documented, 1);

    const minimum = CONTRAST_MINIMUMS[pair.role];
    if (minimum !== null) {
      expect(computed).toBeGreaterThanOrEqual(minimum);
    }
  });

  it('fallisce se un token scende sotto la soglia dichiarata (prova della prova)', () => {
    // text-primary è pensato per restare sopra 4.5:1 su bg-surface in entrambi i
    // temi. Un fondo quasi identico al testo deve far fallire il minimo di testo:
    // dimostra che il test sopra si accorgerebbe di una regressione reale.
    const almostSameAsText = '#18222F'; // vicinissimo a text-primary chiaro
    const ratio = contrastRatio(colorTokensByTheme.light['text-primary'], almostSameAsText);
    expect(ratio).toBeLessThan(CONTRAST_MINIMUMS.text as number);
  });
});
