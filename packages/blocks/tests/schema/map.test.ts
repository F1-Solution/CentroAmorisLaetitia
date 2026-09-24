import { describe, expect, it } from 'vitest';
import { mapPropsSchema } from '../../src/schema/map.js';

describe('mapPropsSchema', () => {
  it('accetta un caso valido, con lat/lng come stringhe', () => {
    const parsed = mapPropsSchema.parse({
      address: 'Via Roma 1',
      lat: '45.4642',
      lng: '9.1900000000000004',
    });
    expect(parsed.lat).toBe('45.4642');
    expect(parsed.lng).toBe('9.1900000000000004');
    expect(typeof parsed.lat).toBe('string');
  });

  it('rifiuta address assente', () => {
    expect(() => mapPropsSchema.parse({ lat: '1', lng: '1' })).toThrow();
  });

  it('rifiuta lat/lng in una forma non numerica', () => {
    expect(() => mapPropsSchema.parse({ address: 'x', lat: 'nord', lng: '1' })).toThrow();
  });

  it('rifiuta zoom fuori dai limiti 1..21', () => {
    expect(() => mapPropsSchema.parse({ address: 'x', lat: '1', lng: '1', zoom: 0 })).toThrow();
    expect(() => mapPropsSchema.parse({ address: 'x', lat: '1', lng: '1', zoom: 22 })).toThrow();
  });

  it('accetta segnaposto con titolo nullo', () => {
    const parsed = mapPropsSchema.parse({
      address: 'x',
      lat: '1',
      lng: '1',
      pins: [{ title: null, lat: '1', lng: '1', html: null }],
    });
    expect(parsed.pins).toHaveLength(1);
  });

  it('rifiuta una chiave sconosciuta', () => {
    expect(() => mapPropsSchema.parse({ address: 'x', lat: '1', lng: '1', extra: 1 })).toThrow();
  });
});
