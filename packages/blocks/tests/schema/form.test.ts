import { describe, expect, it } from 'vitest';
import { formPropsSchema } from '../../src/schema/form.js';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('formPropsSchema', () => {
  it('accetta un caso valido', () => {
    const parsed = formPropsSchema.parse({ formId: uuid, origin: 'wpforms' });
    expect(parsed.showTitle).toBe(false);
    expect(parsed.showDescription).toBe(false);
  });

  it('rifiuta formId assente', () => {
    expect(() => formPropsSchema.parse({ origin: 'wpforms' })).toThrow();
  });

  it('rifiuta formId non uuid', () => {
    expect(() => formPropsSchema.parse({ formId: 'non-uuid', origin: 'wpforms' })).toThrow();
  });

  it('rifiuta origin assente o fuori enum', () => {
    expect(() => formPropsSchema.parse({ formId: uuid })).toThrow();
    expect(() => formPropsSchema.parse({ formId: uuid, origin: 'gravityforms' })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => formPropsSchema.parse({ formId: uuid, origin: 'divi', extra: 1 })).toThrow();
  });
});
