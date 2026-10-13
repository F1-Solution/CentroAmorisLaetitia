import { describe, expect, it } from 'vitest';
import { paypalSettings } from '../../../src/stages/forms/payment.js';

/** DR-039: la configurazione PayPal di ogni form si porta dalla sorgente. Indirizzi sintetici. */

describe('configurazione del pagamento dei form (DR-039)', () => {
  it('porta conto, modalità e tipo di transazione, se il pagamento è attivo', () => {
    const parsed = {
      payments: {
        paypal_standard: {
          enable: '1',
          email: 'conto@example.invalid',
          mode: 'production',
          transaction: 'donation',
          shipping: '1',
        },
      },
    };
    expect(paypalSettings(parsed)).toEqual({
      provider: 'paypal_standard',
      business: 'conto@example.invalid',
      sandbox: false,
      donation: true,
    });
  });

  it('modalità di prova e acquisto semplice', () => {
    const parsed = {
      payments: {
        paypal_standard: {
          enable: '1',
          email: 'x@example.invalid',
          mode: 'test',
          transaction: 'product',
        },
      },
    };
    expect(paypalSettings(parsed)).toMatchObject({ sandbox: true, donation: false });
  });

  it('nessuna configurazione se disattivata, senza conto o assente', () => {
    expect(
      paypalSettings({
        payments: { paypal_standard: { enable: '0', email: 'x@example.invalid' } },
      }),
    ).toBeNull();
    expect(
      paypalSettings({ payments: { paypal_standard: { enable: '1', email: '' } } }),
    ).toBeNull();
    expect(paypalSettings({})).toBeNull();
  });
});
