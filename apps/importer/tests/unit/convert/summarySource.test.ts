import { describe, expect, it } from 'vitest';
import { summarySource } from '../../../src/convert/shared/summary-source.js';

/** Testo da cui la sorgente conta l'estratto, `truncate_post()` di Divi (D71, DR-155). Dati sintetici. */
describe('summarySource', () => {
  it('scrive per esteso le entità prodotte da wptexturize e lascia i caratteri dell’autore', () => {
    expect(summarySource('<p>L\'incontro "aperto" e l’altro</p>')).toBe(
      'L&#8217;incontro &#8220;aperto&#8221; e l’altro',
    );
  });

  it('toglie didascalie, audio ed embed con il loro contenuto', () => {
    expect(
      summarySource(
        'Prima [caption id="1"]<img src="x.jpg"> Foto[/caption] dopo [embed]https://example.test[/embed]',
      ),
    ).toBe('Prima dopo');
  });

  it('toglie tag, script e commenti senza aggiungere spazi', () => {
    expect(summarySource('<!-- wp:paragraph --><p>Uno</p><script>x()</script><p>due</p>')).toBe(
      'Unodue',
    );
  });

  it('gli shortcode separano i segmenti come in WordPress e diventano spazi', () => {
    expect(
      summarySource(
        '[et_pb_text admin_label="Testo"]"Uno"[/et_pb_text][et_pb_text]Due[/et_pb_text]',
      ),
    ).toBe('&#8220;Uno&#8221; Due');
  });

  it('riduce gli spazi bianchi e si ferma a 600 caratteri', () => {
    const out = summarySource(`a\r\n\r\n  b ${'x'.repeat(700)}`);
    expect(out.startsWith('a b x')).toBe(true);
    expect(Array.from(out)).toHaveLength(600);
  });
});
