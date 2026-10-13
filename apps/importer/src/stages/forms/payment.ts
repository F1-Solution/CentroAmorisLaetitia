/**
 * Il conto PayPal di ogni form, da `payments.paypal_standard` della sorgente:
 * serve al rimando di pagamento di DR-039. È un dato, non si scrive nei log.
 */

export interface PaypalSettings {
  readonly provider: 'paypal_standard';
  readonly business: string;
  readonly sandbox: boolean;
  readonly donation: boolean;
}

export function paypalSettings(parsed: Record<string, unknown>): PaypalSettings | null {
  const payments = parsed['payments'];
  if (payments === null || typeof payments !== 'object') return null;
  const paypal = (payments as Record<string, unknown>)['paypal_standard'];
  if (paypal === null || typeof paypal !== 'object') return null;
  const raw = paypal as Record<string, unknown>;
  const business = typeof raw['email'] === 'string' ? raw['email'].trim() : '';
  if (raw['enable'] !== '1' || business === '') return null;
  return {
    provider: 'paypal_standard',
    business,
    sandbox: raw['mode'] !== 'production',
    donation: raw['transaction'] === 'donation',
  };
}
