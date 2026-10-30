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

/**
 * I1 (DR-194): il bottone «Invia» del form di contatto Divi su `/contatti/`. Al
 * passaggio del puntatore la sorgente rende trasparente il bordo, sposta il testo
 * a sinistra (`padding: .3em 2em .3em .7em`) e mostra la freccia `:after`, glifo
 * `5` di ETmodules, da opacità 0 a 1 in 0,2 s (`style.min.css` del tema:
 * `.et_pb_button`, `.et_pb_button:hover`, `.et_pb_button:after`).
 */
describe('blocks.css — bottone «Invia» del form di contatto (I1)', () => {
  const css = readFileSync(path.join(__dirname, '../src/styles/blocks.css'), 'utf-8').replace(
    /\s+/g,
    ' ',
  );

  function regola(selettore: string): string {
    const inizio = css.indexOf(`${selettore} {`);
    if (inizio < 0) return '';
    return css.slice(inizio, css.indexOf('}', inizio));
  }

  it('il bottone è il riferimento della freccia e ha la transizione di 0,2 s', () => {
    const r = regola('.et_pb_contact_submit');
    expect(r).toMatch(/position: relative;/);
    expect(r).toMatch(/transition: all 0\.2s;/);
  });

  it('al passaggio: bordo trasparente e spaziatura come Divi', () => {
    const r = regola('.et_pb_contact_submit:hover');
    expect(r).toMatch(/border-color: transparent;/);
    expect(r).toMatch(/padding: 0\.3em 2em 0\.3em 0\.7em;/);
  });

  it('la freccia è il glifo 5 di ETmodules, nascosta a riposo', () => {
    const r = regola('.et_pb_contact_submit::after');
    expect(r).toMatch(/content: '5';/);
    expect(r).toMatch(/font-family: ETmodules;/);
    expect(r).toMatch(/font-size: 32px;/);
    expect(r).toMatch(/line-height: 1em;/);
    expect(r).toMatch(/position: absolute;/);
    expect(r).toMatch(/margin-left: -1em;/);
    expect(r).toMatch(/opacity: 0;/);
    expect(r).toMatch(/transition: all 0\.2s;/);
  });

  it('al passaggio la freccia compare al suo posto', () => {
    const r = regola('.et_pb_contact_submit:hover::after');
    expect(r).toMatch(/opacity: 1;/);
    expect(r).toMatch(/margin-left: 0;/);
  });
});

/**
 * W8-11: `.blk-image` ha `line-height: 0` per togliere lo spazio sotto l'immagine;
 * la didascalia fuori da una riga Divi non deve ereditarlo, o ha altezza 0.
 */
describe('blocks.css — didascalia del blocco Immagine (W8-11)', () => {
  const css = readFileSync(path.join(__dirname, '../src/styles/blocks.css'), 'utf-8').replace(
    /\s+/g,
    ' ',
  );

  it('la didascalia ripristina l’interlinea normale', () => {
    const inizio = css.indexOf('.blk-image figcaption {');
    expect(inizio).toBeGreaterThanOrEqual(0);
    expect(css.slice(inizio, css.indexOf('}', inizio))).toMatch(/line-height: normal;/);
  });
});

/**
 * T2b (DR-311): il cuore nei titoli delle slide. Nella sorgente RevSlider dà a ogni
 * `rs-module i[class^="fa-"]` il carattere FontAwesome 4.7 (`rs6.css`: `display:
 * inline-block; font: normal normal normal 14px/1 FontAwesome; font-size: inherit`) e
 * `font-awesome.css` disegna `.fa-heart:before { content: "\f004" }`; colore e
 * dimensione si ereditano dal titolo. Il sito usa un sottoinsieme locale col solo cuore.
 */
describe('blocks.css — cuore nei titoli delle slide (T2b)', () => {
  const css = readFileSync(path.join(__dirname, '../src/styles/blocks.css'), 'utf-8').replace(
    /\s+/g,
    ' ',
  );
  const fonts = path.join(__dirname, '../public/fonts/fontawesome');

  function regola(selettore: string): string {
    const inizio = css.indexOf(`${selettore} {`);
    if (inizio < 0) return '';
    return css.slice(inizio, css.indexOf('}', inizio));
  }

  it('dichiara il sottoinsieme locale di Font Awesome, presente fra i file pubblici', () => {
    const face = /@font-face \{[^}]*FontAwesomeHeart[^}]*\}/.exec(css)?.[0] ?? '';
    expect(face).toContain(
      "url(/fonts/fontawesome/fontawesome-heart-subset.woff2) format('woff2')",
    );
    expect(face).toContain('font-display: block');
    const font = readFileSync(path.join(fonts, 'fontawesome-heart-subset.woff2'));
    expect(font.subarray(0, 4).toString('latin1')).toBe('wOF2');
    expect(readFileSync(path.join(fonts, 'LEGGIMI.txt'), 'utf-8')).toContain('U+F004');
    expect(readFileSync(path.join(fonts, 'OFL.txt'), 'utf-8')).toContain(
      'SIL OPEN FONT LICENSE Version 1.1',
    );
  });

  it('l’icona eredita dimensione e colore del titolo, come in RevSlider', () => {
    const r = regola('.blk-slide-icon-heart');
    expect(r).toContain('display: inline-block');
    expect(r).toContain('font-family: FontAwesomeHeart');
    expect(r).toContain('font-size: inherit');
    expect(r).toContain('line-height: 1');
    expect(r).not.toMatch(/color:|margin/);
  });

  it('il glifo è il cuore U+F004', () => {
    expect(regola('.blk-slide-icon-heart::before')).toContain(String.raw`content: '\f004'`);
  });
});
