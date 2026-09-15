import { describe, expect, it } from 'vitest';
import { htmlPropsSchema } from '../../src/schema/html.js';

describe('htmlPropsSchema (blocco di riserva)', () => {
  it('accetta un caso valido, HTML non sanificato incluso', () => {
    const parsed = htmlPropsSchema.parse({ html: '<center>vecchio markup</center>', reason: 'divi_unmapped_markup' });
    expect(parsed.html).toBe('<center>vecchio markup</center>');
    expect(parsed.detail).toBeNull();
  });

  it('rifiuta html vuoto', () => {
    expect(() => htmlPropsSchema.parse({ html: '', reason: 'manual' })).toThrow();
  });

  it('rifiuta reason assente o fuori enum', () => {
    expect(() => htmlPropsSchema.parse({ html: 'x' })).toThrow();
    expect(() => htmlPropsSchema.parse({ html: 'x', reason: 'mistero' })).toThrow();
  });

  it('rifiuta detail più lungo di 200 caratteri', () => {
    expect(() => htmlPropsSchema.parse({ html: 'x', reason: 'manual', detail: 'a'.repeat(201) })).toThrow();
  });

  it('accetta ognuno dei cinque motivi ammessi', () => {
    for (const reason of ['wp_html_block', 'divi_unmapped_module', 'divi_unmapped_markup', 'shortcode_unknown', 'manual']) {
      expect(htmlPropsSchema.parse({ html: 'x', reason }).reason).toBe(reason);
    }
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => htmlPropsSchema.parse({ html: 'x', reason: 'manual', extra: 1 })).toThrow();
  });
});
