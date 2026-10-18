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
