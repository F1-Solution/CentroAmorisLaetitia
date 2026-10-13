import { describe, expect, it } from 'vitest';
import { sanitizeRichText, isSanitizedFixedPoint } from '../src/sanitize/sanitize.js';
import { stripDangerousMarkup } from '../src/sanitize/strip-dangerous.js';

const OK_CASES = [
  '<p>Testo semplice</p>',
  '<p>Con <strong>enfasi</strong> e <em>corsivo</em></p>',
  '<p>Con <b>grassetto</b> e <i>corsivo html</i></p>',
  '<ul><li>Uno</li><li>Due</li></ul>',
  '<ol><li>Uno</li></ol>',
  '<h2>Titolo di sezione</h2><h3>Sotto</h3><h4>Sotto</h4><h5>Sotto</h5><h6>Sotto</h6>',
  '<p>Riga<br>Altra riga</p>',
  '<hr>',
  '<table><thead><tr><th colspan="2">A</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
  '<p>Con <sub>pedice</sub> e <sup>apice</sup>, <u>sottolineato</u> e <s>barrato</s></p>',
  '<div><span class="nota" id="n1" title="titolo">annotazione</span></div>',
];

// Casi con più di un attributo: il sanificatore li riordina in modo
// alfabetico (§4, determinismo), quindi l'atteso non è l'ingresso letterale.
const OK_REORDERED_CASES: readonly [string, string][] = [
  [
    '<figure><img src="/media/a.jpg" alt="descrizione"><figcaption>Didascalia</figcaption></figure>',
    '<figure><img alt="descrizione" src="/media/a.jpg"><figcaption>Didascalia</figcaption></figure>',
  ],
  [
    '<p><a href="https://esempio.it" target="_blank" rel="noopener">link</a></p>',
    '<p><a href="https://esempio.it" rel="noopener" target="_blank">link</a></p>',
  ],
  [
    '<p><a href="mailto:a@esempio.invalid">scrivi</a></p>',
    '<p><a href="mailto:a@esempio.invalid">scrivi</a></p>',
  ],
  [
    '<p><a href="/pagina-interna/">interno</a></p>',
    '<p><a href="/pagina-interna/">interno</a></p>',
  ],
  ['<p><a href="#ancora">ancora</a></p>', '<p><a href="#ancora">ancora</a></p>'],
];

describe('sanitizeRichText — elenco chiuso (§5.1, §5.2)', () => {
  for (const html of OK_CASES) {
    it(`accetta e lascia invariato: ${html}`, () => {
      const outcome = sanitizeRichText(html);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.html).toBe(html);
      }
    });
  }

  for (const [input, expected] of OK_REORDERED_CASES) {
    it(`accetta e riordina gli attributi in modo deterministico: ${input}`, () => {
      const outcome = sanitizeRichText(input);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.html).toBe(expected);
      }
    });
  }

  it('è idempotente su tutta la batteria (§5.6): sanifica(sanifica(x)) === sanifica(x)', () => {
    for (const html of [...OK_CASES, ...OK_REORDERED_CASES.map(([, expected]) => expected)]) {
      const once = sanitizeRichText(html);
      expect(once.ok).toBe(true);
      if (!once.ok) continue;
      const twice = sanitizeRichText(once.html);
      expect(twice.ok).toBe(true);
      if (twice.ok) {
        expect(twice.html).toBe(once.html);
      }
    }
  });

  it('rifiuta h1: il titolo appartiene al template (ADR-005 §3.5)', () => {
    const outcome = sanitizeRichText('<h1>Titolo</h1>');
    expect(outcome.ok).toBe(false);
  });
});

describe('sanitizeRichText — rimozione di ciò che non è ammesso (§5.4)', () => {
  it('rimuove lo style in linea, mantenendo il testo (severità info)', () => {
    const outcome = sanitizeRichText('<p style="color:red">ciao</p>');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toBe('<p>ciao</p>');
      const issue = outcome.issues.find((i) => i.attribute === 'style');
      expect(issue?.severity).toBe('info');
      expect(issue?.value).toBe('color:red');
    }
  });

  // DR-134: le colonne Gutenberg dentro un testo Divi (ID 1138) tengono la loro proporzione.
  it('flex-basis di una frazione nota su div.wp-block-column diventa una classe', () => {
    const outcome = sanitizeRichText(
      '<div class="wp-block-column" style="flex-basis: 66.66%;"><p>x</p></div>',
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toBe('<div class="wp-block-column blk-basis-2_3"><p>x</p></div>');
    }
  });

  it('rimuove ogni altro style, anche su div.wp-block-column', () => {
    for (const style of [
      'flex-basis:66.66%;color:red',
      'flex-basis:url(x)',
      'width:50%',
      'flex-basis:12.3%',
    ]) {
      const outcome = sanitizeRichText(`<div class="wp-block-column" style="${style}">x</div>`);
      expect(outcome.ok && outcome.html).toBe('<div class="wp-block-column">x</div>');
    }
    const altrove = sanitizeRichText('<div class="altro" style="flex-basis:50%">x</div>');
    expect(altrove.ok && altrove.html).toBe('<div class="altro">x</div>');
  });

  it('la classe prodotta è un punto fisso', () => {
    expect(isSanitizedFixedPoint('<div class="wp-block-column blk-basis-1_3">x</div>')).toBe(true);
  });

  it('rimuove script con tutto il contenuto (severità error)', () => {
    const outcome = sanitizeRichText('<p>prima</p><script>alert(1)</script><p>dopo</p>');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toBe('<p>prima</p><p>dopo</p>');
      expect(outcome.issues.some((i) => i.severity === 'error' && i.element === 'script')).toBe(
        true,
      );
    }
  });

  it('rimuove iframe con tutto il contenuto', () => {
    const outcome = sanitizeRichText('<iframe src="https://esempio.it"></iframe>');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toBe('');
    }
  });

  it('rimuove un gestore di evento on*, mantenendo il contenuto (severità error)', () => {
    const outcome = sanitizeRichText('<p onclick="doStuff()">ciao</p>');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toBe('<p>ciao</p>');
      expect(outcome.issues.some((i) => i.severity === 'error' && i.attribute === 'onclick')).toBe(
        true,
      );
    }
  });

  it('rimuove data-start e data-end senza conteggio speciale (ADR-005 §1.3)', () => {
    const outcome = sanitizeRichText('<p data-start="12" data-end="34">ciao</p>');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toBe('<p>ciao</p>');
    }
  });

  it('rimuove href con schema non ammesso (javascript:), severità error', () => {
    const outcome = sanitizeRichText('<a href="javascript:alert(1)">x</a>');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toBe('<a>x</a>');
      expect(outcome.issues.some((i) => i.severity === 'error' && i.attribute === 'href')).toBe(
        true,
      );
    }
  });

  it('rimuove src con schema data:, severità error', () => {
    const outcome = sanitizeRichText('<img src="data:image/png;base64,AAAA" alt="x">');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toBe('<img alt="x">');
    }
  });

  it('rimuove un attributo non ammesso su un elemento specifico (colspan su un a)', () => {
    const outcome = sanitizeRichText('<a href="/pagina/" colspan="2">x</a>');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toBe('<a href="/pagina/">x</a>');
    }
  });

  it('un elemento ammesso in posizione non valida si ricolloca come un browser (li fuori da una lista)', () => {
    const outcome = sanitizeRichText('<p><li>x</li></p>');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.html).toContain('<li>x</li>');
    }
  });
});

describe('sanitizeRichText — elemento non ammesso e innocuo (§5.4, quarta riga)', () => {
  it("non sanifica nulla: fa fallire il tutto e riporta l'elemento", () => {
    const outcome = sanitizeRichText('<center>testo centrato</center>');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('unmapped_markup');
      expect(outcome.element).toBe('center');
    }
  });

  it('font non è ammesso: stesso esito', () => {
    const outcome = sanitizeRichText('<font color="red">x</font>');
    expect(outcome.ok).toBe(false);
  });
});

describe('isSanitizedFixedPoint', () => {
  it('è vero per html già sanificato', () => {
    expect(isSanitizedFixedPoint('<p>ciao</p>')).toBe(true);
  });

  it('è falso per html non sanificato', () => {
    expect(isSanitizedFixedPoint('<p style="color:red">ciao</p>')).toBe(false);
  });

  it('è falso quando il markup non è mappabile', () => {
    expect(isSanitizedFixedPoint('<center>x</center>')).toBe(false);
  });
});

describe('stripDangerousMarkup — il blocco di riserva (§3.14.2)', () => {
  it('conserva un elemento non ammesso ma innocuo (center)', () => {
    const result = stripDangerousMarkup('<center>testo</center>');
    expect(result.html).toBe('<center>testo</center>');
  });

  it('rimuove comunque script, iframe, object, embed, form, style come elemento', () => {
    for (const [tag, content] of [
      ['script', 'alert(1)'],
      ['iframe', ''],
      ['object', ''],
      ['embed', ''],
      ['form', '<input>'],
      ['style', 'body{color:red}'],
    ] as const) {
      const result = stripDangerousMarkup(`<div>prima<${tag}>${content}</${tag}>dopo</div>`);
      expect(result.html).toBe('<div>primadopo</div>');
    }
  });

  it('rimuove ogni attributo on*', () => {
    const result = stripDangerousMarkup('<div onclick="x()">ciao</div>');
    expect(result.html).toBe('<div>ciao</div>');
  });

  it('toglie gli indirizzi con uno schema eseguibile, anche mascherato', () => {
    const result = stripDangerousMarkup(
      '<a href="java&#9;script:x()">a</a><img src="data:text/html,x"><a href=" VBScript:x">b</a>',
    );
    expect(result.html).toBe('<a>a</a><img><a>b</a>');
    expect(result.issues.every((i) => i.severity === 'error')).toBe(true);
  });

  it('conserva gli indirizzi relativi e ordinari, come nella sorgente', () => {
    const html = '<a href="pagina.html">a</a><a href="/x/">b</a><a href="tel:+390000000">c</a>';
    expect(stripDangerousMarkup(html).html).toBe(html);
  });
});
