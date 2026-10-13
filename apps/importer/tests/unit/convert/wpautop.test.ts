import { describe, expect, it } from 'vitest';
import { wpautop } from '../../../src/convert/shared/wpautop.js';

/**
 * Porto di `wpautop()` (rilievo della `1E-W6`): un «a capo» singolo diventa
 * `<br />`, una riga vuota separa i paragrafi, il contenuto già a blocchi non
 * si tocca due volte.
 */

describe('wpautop', () => {
  it('stringa vuota resta vuota', () => {
    expect(wpautop('')).toBe('');
    expect(wpautop('   ')).toBe('');
  });

  it('due righe separate da una riga vuota diventano due paragrafi', () => {
    expect(wpautop('Prima riga\n\nSeconda riga')).toBe('<p>Prima riga</p>\n<p>Seconda riga</p>\n');
  });

  it('un solo «a capo» diventa <br />', () => {
    expect(wpautop('Prima riga\nSeconda riga')).toBe('<p>Prima riga<br />\nSeconda riga</p>\n');
  });

  it('il caso misurato: titoletti in grassetto seguiti da righe, come la sorgente', () => {
    const input =
      ' <strong>A CHI SI RIVOLGE</strong>\nRagazzi e ragazze di età compresa tra i 14 e i 18 anni\n\n<strong>CONTENUTI</strong>\nPrimo rigo.\nSecondo rigo.';
    const out = wpautop(input);
    // Non incapsula due paragrafi dentro lo stesso <p>, e ogni riga della
    // sorgente resta separata da un <br />: è questo che il rilievo chiedeva.
    expect(out).toContain('<strong>A CHI SI RIVOLGE</strong><br />\nRagazzi e ragazze');
    expect(out).toContain('<strong>CONTENUTI</strong><br />\nPrimo rigo.<br />\nSecondo rigo.');
    expect((out.match(/<p>/g) ?? []).length).toBe(2);
  });

  it('un tag di blocco già presente non viene incapsulato in <p> due volte', () => {
    expect(wpautop('<h2 class="wp-block-heading">Titolo</h2>')).not.toContain('<p>');
  });

  it('un <p> esplicito della sorgente resta un solo paragrafo', () => {
    const out = wpautop('<p>Già un paragrafo.</p>');
    expect(out).toContain('<p>Già un paragrafo.</p>');
    expect((out.match(/<p>/g) ?? []).length).toBe(1);
  });

  it('il contenuto di <pre> non si tocca', () => {
    const input = '<pre>riga 1\nriga 2</pre>';
    expect(wpautop(input)).toContain('<pre>riga 1\nriga 2</pre>');
  });

  it('due <br> consecutivi contano come una riga vuota', () => {
    expect(wpautop('Uno<br><br>Due')).toBe('<p>Uno</p>\n<p>Due</p>\n');
  });
});
