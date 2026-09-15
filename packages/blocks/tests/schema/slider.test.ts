import { describe, expect, it } from 'vitest';
import { sliderPropsSchema } from '../../src/schema/slider.js';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('sliderPropsSchema', () => {
  it('accetta un caso valido', () => {
    expect(sliderPropsSchema.parse({ sliderId: uuid }).sliderId).toBe(uuid);
  });

  it('rifiuta sliderId assente o non uuid', () => {
    expect(() => sliderPropsSchema.parse({})).toThrow();
    expect(() => sliderPropsSchema.parse({ sliderId: 'x' })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => sliderPropsSchema.parse({ sliderId: uuid, extra: 1 })).toThrow();
  });
});
