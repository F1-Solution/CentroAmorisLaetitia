import { describe, expect, it } from 'vitest';
import { docBlockPropsSchema } from '../../src/schema/document-block.js';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('docBlockPropsSchema (blocco "document")', () => {
  it('accetta un caso valido con i predefiniti', () => {
    const parsed = docBlockPropsSchema.parse({ documentId: uuid });
    expect(parsed.display).toBe('link');
    expect(parsed.label).toBeNull();
  });

  it('rifiuta documentId assente o non uuid', () => {
    expect(() => docBlockPropsSchema.parse({})).toThrow();
    expect(() => docBlockPropsSchema.parse({ documentId: 'x' })).toThrow();
  });

  it('rifiuta display fuori enum', () => {
    expect(() => docBlockPropsSchema.parse({ documentId: uuid, display: 'popup' })).toThrow();
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => docBlockPropsSchema.parse({ documentId: uuid, extra: 1 })).toThrow();
  });
});
