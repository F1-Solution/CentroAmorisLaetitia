import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * I1 (1E-W7): al passaggio del puntatore le voci del menu scendono a opacità 0,7
 * con una transizione, come nelle regole di Divi della sorgente
 * (`css/dynamic-assets/header.css`, `header_shared.css`). Gli stessi selettori
 * tengono la stessa precedenza della sorgente.
 */
describe('layout.css — hover del menu (I1)', () => {
  const css = readFileSync(path.join(__dirname, '../src/styles/layout.css'), 'utf-8').replace(
    /\s+/g,
    ' ',
  );

  function regola(selettore: string): string {
    const inizio = css.indexOf(`${selettore} {`);
    if (inizio < 0) return '';
    return css.slice(inizio, css.indexOf('}', inizio));
  }

  it('voci di primo livello: opacità 0,7 al passaggio', () => {
    expect(regola('#top-menu-nav > ul > li > a:hover')).toMatch(/opacity: 0\.7;/);
  });

  it('voci di primo livello: transizione di 0,4 s', () => {
    expect(regola('#top-menu a')).toMatch(/transition: all 0\.4s ease-in-out;/);
  });

  it('sottomenu e menu per telefono: sfondo e opacità al passaggio', () => {
    const r = regola('.et_mobile_menu li a:hover, .nav ul li a:hover');
    expect(r).toMatch(/background-color: rgba\(0, 0, 0, 0\.03\);/);
    expect(r).toMatch(/opacity: 0\.7;/);
  });

  it('sottomenu e menu per telefono: transizione di 0,2 s', () => {
    expect(regola('.et_mobile_menu li a, .nav li li a')).toMatch(
      /transition: all 0\.2s ease-in-out;/,
    );
  });
});

describe('layout.css — archivio dei download (DR-181)', () => {
  const css = readFileSync(path.join(__dirname, '../src/styles/layout.css'), 'utf-8').replace(
    /\s+/g,
    ' ',
  );

  it('le voci dei moduli non hanno lo spazio inferiore del blog, come nella sorgente', () => {
    const inizio = css.indexOf('.et_pb_post.wpdmpro:not(.single) {');
    expect(inizio).toBeGreaterThan(-1);
    expect(css.slice(inizio, css.indexOf('}', inizio))).toMatch(/margin-bottom: 0;/);
  });

  it('la data senza margine inferiore e i titoli grandi anche al telefono, come nella sorgente', () => {
    const regola = (sel: string) => {
      const i = css.indexOf(`${sel} {`);
      return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
    };
    expect(regola('.et_pb_post.wpdmpro:not(.single) .post-meta')).toMatch(/margin-bottom: 0;/);
    const titolo = regola('.et_pb_post.wpdmpro:not(.single) h2');
    expect(titolo).toMatch(/padding-bottom: 10px;/);
    expect(titolo).toMatch(/font-size: var\(--font-size-h2\);/);
  });
});
