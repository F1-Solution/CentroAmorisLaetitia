/**
 * Il rimando di pagamento di DR-039: l'indirizzo PayPal Standard costruito dalla
 * configurazione del form importata dalla sorgente (valuta EUR, come la sorgente).
 */

interface PaypalSettings {
  readonly business: string;
  readonly sandbox: boolean;
  readonly donation: boolean;
}

function paypalSettings(definition: unknown): PaypalSettings | null {
  if (definition === null || typeof definition !== 'object') return null;
  const payment = (definition as Record<string, unknown>)['payment'];
  if (payment === null || typeof payment !== 'object') return null;
  const raw = payment as Record<string, unknown>;
  if (raw['provider'] !== 'paypal_standard' || typeof raw['business'] !== 'string') return null;
  if (raw['business'].trim() === '') return null;
  return {
    business: raw['business'],
    sandbox: raw['sandbox'] === true,
    donation: raw['donation'] === true,
  };
}

export function paymentUrl(
  definition: unknown,
  amount: number | null,
  itemName: string,
): string | null {
  const settings = paypalSettings(definition);
  if (!settings || amount === null || !(amount > 0)) return null;
  const host = settings.sandbox ? 'www.sandbox.paypal.com' : 'www.paypal.com';
  const query = new URLSearchParams({
    cmd: settings.donation ? '_donations' : '_xclick',
    business: settings.business,
    amount: amount.toFixed(2),
    currency_code: 'EUR',
    item_name: itemName,
  });
  return `https://${host}/cgi-bin/webscr?${query.toString()}`;
}
