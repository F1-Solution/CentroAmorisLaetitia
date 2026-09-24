import { describe, expect, it } from 'vitest';
import { richTextPropsSchema } from '../../src/schema/rich-text.js';

describe('richTextPropsSchema', () => {
  it('accetta html già sanificato, punto fisso della sanificazione', () => {
    const parsed = richTextPropsSchema.parse({ html: '<p>Ciao <strong>mondo</strong></p>' });
    expect(parsed.html).toBe('<p>Ciao <strong>mondo</strong></p>');
  });

  it('rifiuta html vuoto', () => {
    expect(() => richTextPropsSchema.parse({ html: '' })).toThrow();
  });

  it('rifiuta html non sanificato (uno script dentro)', () => {
    expect(() =>
      richTextPropsSchema.parse({ html: '<p>ciao</p><script>alert(1)</script>' }),
    ).toThrow();
  });

  it('rifiuta html con un attributo non ammesso ancora presente (non è un punto fisso)', () => {
    expect(() => richTextPropsSchema.parse({ html: '<p style="color:red">ciao</p>' })).toThrow();
  });

  it('rifiuta h1: il titolo appartiene al template (ADR-005 §3.5)', () => {
    expect(() => richTextPropsSchema.parse({ html: '<h1>Titolo</h1>' })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => richTextPropsSchema.parse({ html: '<p>ciao</p>', extra: 1 })).toThrow();
  });

  it('applica i predefiniti sugli altri campi', () => {
    const parsed = richTextPropsSchema.parse({ html: '<p>ciao</p>' });
    expect(parsed.textAlign).toBeNull();
    expect(parsed.border).toBeNull();
    expect(parsed.classes).toEqual([]);
  });
});
