import { describe, expect, it } from 'vitest';
import { jsonObjectKeyOrder, parseFormPost } from '../../../src/stages/forms/parse.js';

/**
 * Analisi della definizione WPForms (1E-W6). Il JSON è scritto come testo, non con
 * `JSON.stringify`: solo così le chiavi numeriche restano nell'ordine della
 * sorgente, che `JSON.parse` riordinerebbe. Dati sintetici.
 */

const raw = `{"fields":{"13":{"id":"13","type":"html","code":"<b>Dati</b>"},"1":{"id":"1","type":"name","label":"Nome","required":"1","size":"medium","format":"first-last","label_hide":"1","sublabel_hide":"1","first_placeholder":"Nome","last_placeholder":"Cognome","css":"x"},"9":{"id":"9","type":"radio","label":"Pagamento","choices":{"1":{"label":"Online"},"2":{"label":"Bonifico"}}},"10":{"id":"10","type":"html","code":"<p>Istruzioni</p>","conditional_logic":"1","conditional_type":"show","conditionals":[[{"field":"9","operator":"==","value":"2"}]]},"4":{"id":"4","type":"address","label":"Indirizzo","scheme":"international","address2_hide":"1","country_hide":"1","address1_placeholder":"Indirizzo","city_placeholder":"Città","state_placeholder":"Provincia","postal_placeholder":"CAP"},"6":{"id":"6","type":"email","label":"Email","confirmation":"1","placeholder":"Email","confirmation_placeholder":"Conferma email"},"3":{"id":"3","type":"date-time","label":"Data","date_placeholder":"gg/mm/aaaa","date_format":"d/m/Y"}},"settings":{"form_title":"Sintetico","notifications":{"2":{"notification_name":"Seconda"},"1":{"notification_name":"Prima"}}}}`;

describe('jsonObjectKeyOrder', () => {
  it('legge le chiavi di un oggetto annidato nell’ordine del testo', () => {
    expect(jsonObjectKeyOrder(raw, ['fields'])).toEqual(['13', '1', '9', '10', '4', '6', '3']);
    expect(jsonObjectKeyOrder(raw, ['settings', 'notifications'])).toEqual(['2', '1']);
  });

  it('ignora le parentesi dentro le stringhe e restituisce vuoto se il percorso manca', () => {
    expect(jsonObjectKeyOrder('{"a":{"x":"{\\"}","b":1}}', ['a'])).toEqual(['x', 'b']);
    expect(jsonObjectKeyOrder(raw, ['assente'])).toEqual([]);
  });
});

describe('parseFormPost', () => {
  const parsed = parseFormPost(raw);

  it('campi e notifiche nell’ordine della sorgente', () => {
    expect(parsed.fields.map((f) => f.id)).toEqual(['13', '1', '9', '10', '4', '6', '3']);
    expect(parsed.fields.map((f) => f.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(parsed.notifications.map((n) => n.name)).toEqual(['Seconda', 'Prima']);
  });

  it('tiene ciò che serve alla resa: segnaposto, misura, etichette nascoste, condizioni', () => {
    const byId = new Map(parsed.fields.map((f) => [f.id, f.options]));
    expect(byId.get('1')).toMatchObject({
      size: 'medium',
      label_hide: '1',
      sublabel_hide: '1',
      first_placeholder: 'Nome',
      last_placeholder: 'Cognome',
    });
    expect(byId.get('1')).not.toHaveProperty('css');
    expect(byId.get('10')).toMatchObject({
      conditional_logic: '1',
      conditional_type: 'show',
      conditionals: [[{ field: '9', operator: '==', value: '2' }]],
    });
    expect(byId.get('4')).toMatchObject({ address2_hide: '1', city_placeholder: 'Città' });
    expect(byId.get('6')).toMatchObject({ confirmation_placeholder: 'Conferma email' });
    expect(byId.get('3')).toMatchObject({ date_placeholder: 'gg/mm/aaaa' });
  });
});
