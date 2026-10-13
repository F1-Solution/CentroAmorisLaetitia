import { describe, expect, it } from 'vitest';
import { paymentUrl } from '../src/modules/formSubmissions/payment.js';

/** DR-039: indirizzo di pagamento dalla configurazione importata. Conto sintetico. */

const definition = (payment: unknown) => ({ fields: [], payment });
const conto = {
  provider: 'paypal_standard',
  business: 'conto@example.invalid',
  sandbox: false,
  donation: true,
};

describe('rimando di pagamento (DR-039)', () => {
  it('donazione con importo, valuta e causale', () => {
    const url = new URL(paymentUrl(definition(conto), 35, 'Corso sintetico') ?? '');
    expect(url.host).toBe('www.paypal.com');
    expect(url.searchParams.get('cmd')).toBe('_donations');
    expect(url.searchParams.get('business')).toBe('conto@example.invalid');
    expect(url.searchParams.get('amount')).toBe('35.00');
    expect(url.searchParams.get('currency_code')).toBe('EUR');
    expect(url.searchParams.get('item_name')).toBe('Corso sintetico');
  });

  it('modalità di prova e acquisto semplice', () => {
    const url = new URL(
      paymentUrl(definition({ ...conto, sandbox: true, donation: false }), 10, 'x') ?? '',
    );
    expect(url.host).toBe('www.sandbox.paypal.com');
    expect(url.searchParams.get('cmd')).toBe('_xclick');
  });

  it('nessun indirizzo senza conto o senza importo', () => {
    expect(paymentUrl(definition(null), 35, 'x')).toBeNull();
    expect(paymentUrl({ fields: [] }, 35, 'x')).toBeNull();
    expect(paymentUrl(definition(conto), null, 'x')).toBeNull();
    expect(paymentUrl(definition(conto), 0, 'x')).toBeNull();
  });
});
