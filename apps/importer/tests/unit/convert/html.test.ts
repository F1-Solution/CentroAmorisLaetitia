import { describe, expect, it } from 'vitest';
import { convertContent } from '../../../src/convert/index.js';
import { detectContentFamily } from '../../../src/convert/family.js';

describe('convertContent — famiglia HTML nudo', () => {
  it('un contenuto senza commenti wp: e senza shortcode Divi è HTML nudo', () => {
    expect(detectContentFamily('<p>Solo un paragrafo, nessun costrutto riconosciuto.</p>')).toBe('html');
  });

  it('diventa un unico rich_text (ADR-005 §3.3 regola 3)', () => {
    const html = '<p>Un contenuto <strong>semplice</strong>, con un <a href="/pagina">collegamento</a>.</p>';
    const result = convertContent({ legacyContentId: 200, postContent: html });
    expect(result.family).toBe('html');
    expect(result.document.blocks).toHaveLength(1);
    const block = result.document.blocks[0]!;
    if (block.type !== 'rich_text') throw new Error('atteso rich_text');
    expect(block.props.html).toContain('<strong>semplice</strong>');
    expect(block.props.html).toContain('href="/pagina"');
  });

  it('un elemento non ammesso ma innocuo diventa un blocco di riserva html', () => {
    const html = '<center>testo centrato, elemento non nella lista chiusa</center>';
    const result = convertContent({ legacyContentId: 201, postContent: html });
    const block = result.document.blocks[0]!;
    if (block.type !== 'html') throw new Error('atteso html');
    expect(block.props.reason).toBe('divi_unmapped_markup');
    expect(block.props.detail).toBe('center');
  });

  it('un elemento pericoloso si rimuove anche nel blocco di riserva', () => {
    const html = '<center><script>alert(1)</script>testo residuo</center>';
    const result = convertContent({ legacyContentId: 202, postContent: html });
    const block = result.document.blocks[0]!;
    if (block.type !== 'html') throw new Error('atteso html');
    expect(block.props.html).not.toContain('<script>');
    expect(block.props.html).toContain('testo residuo');
    expect(result.issues.some((i) => i.code === 'sanitize-removed')).toBe(true);
  });
});
