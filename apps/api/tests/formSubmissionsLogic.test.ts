import { describe, expect, it } from 'vitest';
import {
  numericOption,
  paymentFieldVisible,
  schemaForForm,
  type DefinitionField,
} from '../src/modules/formSubmissions/service.js';

/**
 * Validazione dell'invio come la pagina (1E-W6, DR-133): campi composti, conferma
 * dell'email, logica condizionale, importo con la virgola. Solo dati sintetici.
 */

const fields: readonly DefinitionField[] = [
  {
    id: '1',
    type: 'name',
    required: true,
    options: { format: 'first-last' },
  },
  { id: '6', type: 'email', required: true, options: { confirmation: '1' } },
  {
    id: '4',
    type: 'address',
    required: false,
    options: { scheme: 'international', address2_hide: '1', country_hide: '1' },
  },
  {
    id: '21',
    type: 'checkbox',
    required: false,
    options: { choices: { '1': { label: 'Mi serve' } } },
  },
  {
    id: '22',
    type: 'text',
    required: true,
    options: {
      conditional_logic: '1',
      conditional_type: 'show',
      conditionals: [[{ field: '21', operator: '==', value: '1' }]],
    },
  },
  {
    id: '9',
    type: 'radio',
    required: true,
    options: { choices: { '1': { label: 'Online' }, '2': { label: 'Bonifico' } } },
  },
  {
    id: '7',
    type: 'payment-single',
    required: false,
    options: {
      price: '100,00',
      conditional_logic: '1',
      conditional_type: 'show',
      conditionals: [[{ field: '9', operator: '==', value: '1' }]],
    },
  },
];

const base = {
  '1': { first: 'Anna', last: 'Sintetica' },
  '6': { primary: 'anna@esempio.invalid', secondary: 'anna@esempio.invalid' },
  '9': 'Bonifico',
};

describe('schemaForForm', () => {
  it('accetta nome e cognome, email confermata (salvata una volta) e indirizzo', () => {
    const values = {
      ...base,
      '4': { address1: 'Via Sintetica 1', city: 'Terni', state: 'TR', postal: '05100' },
    };
    const parsed = schemaForForm(fields, values).safeParse(values);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data['1']).toEqual({ first: 'Anna', last: 'Sintetica' });
      expect(parsed.data['6']).toBe('anna@esempio.invalid');
    }
  });

  it('rifiuta una conferma dell’email diversa e un nome senza cognome', () => {
    const diversa = {
      ...base,
      '6': { primary: 'a@esempio.invalid', secondary: 'b@esempio.invalid' },
    };
    expect(schemaForForm(fields, diversa).safeParse(diversa).success).toBe(false);
    const senzaCognome = { ...base, '1': { first: 'Anna', last: '' } };
    expect(schemaForForm(fields, senzaCognome).safeParse(senzaCognome).success).toBe(false);
  });

  it('un obbligatorio nascosto dalla logica condizionale non si chiede e non si salva', () => {
    const parsed = schemaForForm(fields, base).safeParse({ ...base, '22': 'non dovuto' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).not.toHaveProperty('22');
  });

  it('lo stesso campo diventa obbligatorio quando è visibile', () => {
    const values = { ...base, '21': ['Mi serve'] };
    expect(schemaForForm(fields, values).safeParse(values).success).toBe(false);
    const completo = { ...values, '22': 'Due, di 3 e 5 anni' };
    expect(schemaForForm(fields, completo).safeParse(completo).success).toBe(true);
  });
});

describe('pagamento condizionato', () => {
  it('si propone solo se il campo di pagamento è visibile', () => {
    expect(paymentFieldVisible(fields, base)).toBe(false);
    expect(paymentFieldVisible(fields, { ...base, '9': 'Online' })).toBe(true);
  });

  it('legge l’importo scritto con la virgola, anche con il separatore delle migliaia', () => {
    expect(numericOption({ price: '100,00' }, 'price')).toBe(100);
    expect(numericOption({ price: '1.250,50' }, 'price')).toBe(1250.5);
    expect(numericOption({ price: '35' }, 'price')).toBe(35);
    expect(numericOption({ price: 'cento' }, 'price')).toBeNull();
  });
});

describe('scelte ed email (revisione 1E-W6)', () => {
  it('rifiuta una scelta non offerta dal campo, anche se attiverebbe un ramo', () => {
    const inventata = { ...base, '9': 'Gratis' };
    expect(schemaForForm(fields, inventata).safeParse(inventata).success).toBe(false);
    const casella = { ...base, '21': ['Altro'] };
    expect(schemaForForm(fields, casella).safeParse(casella).success).toBe(false);
  });

  it('rifiuta un indirizzo email non valido, anche confermato', () => {
    const sbagliata = { ...base, '6': { primary: 'non-una-email', secondary: 'non-una-email' } };
    expect(schemaForForm(fields, sbagliata).safeParse(sbagliata).success).toBe(false);
  });
});
