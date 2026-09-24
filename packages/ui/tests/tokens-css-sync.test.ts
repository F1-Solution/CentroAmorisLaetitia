import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { darkColorTokens, lightColorTokens } from '../src/tokens/tokens.js';

// Nota: si usa `import.meta.dirname` invece di `new URL(..., import.meta.url)`
// perché nell'ambiente di test `jsdom` il costruttore `URL` globale risolve i
// percorsi relativi contro la finta origine del browser (`http://localhost:3000`)
// invece che contro il file del modulo.
const cssPath = join(import.meta.dirname, '../src/tokens/tokens.css');
const css = readFileSync(cssPath, 'utf8');

function cssValueFor(varName: string, inDarkBlock: boolean): string | null {
  const blockRegex = inDarkBlock
    ? /:root\[data-theme='dark'\]\s*\{([^}]*)\}/
    : /:root\s*\{([^}]*)\}/;
  const block = css.match(blockRegex);
  if (!block) return null;
  const declRegex = new RegExp(`--amoris-${varName}:\\s*(#[0-9A-Fa-f]{6})`);
  const decl = block[1].match(declRegex);
  return decl ? decl[1].toUpperCase() : null;
}

describe('sincronia fra tokens.ts e tokens.css', () => {
  it.each(Object.entries(lightColorTokens))(
    'chiaro: --amoris-%s vale come in tokens.ts',
    (name, hex) => {
      expect(cssValueFor(name, false)).toBe(hex.toUpperCase());
    },
  );

  it.each(Object.entries(darkColorTokens))(
    'scuro: --amoris-%s vale come in tokens.ts',
    (name, hex) => {
      expect(cssValueFor(name, true)).toBe(hex.toUpperCase());
    },
  );

  it('nessun valore esadecimale compare fuori da tokens.css (§2.3 punto 5)', () => {
    const srcDir = join(import.meta.dirname, '../src');
    const hexPattern = /#[0-9A-Fa-f]{6}\b/;

    function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((entry) => {
        const full = `${dir}/${entry}`;
        if (statSync(full).isDirectory()) return walk(full);
        return [full];
      });
    }

    const offenders = walk(srcDir)
      .filter(
        (file) =>
          (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css')) &&
          !file.endsWith('tokens.css') &&
          !file.endsWith('tokens.ts') &&
          !file.endsWith('contrast-pairs.ts'),
      )
      .filter((file) => hexPattern.test(readFileSync(file, 'utf8')));

    expect(offenders).toEqual([]);
  });
});
