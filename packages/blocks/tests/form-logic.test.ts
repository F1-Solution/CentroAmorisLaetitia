import { describe, expect, it } from 'vitest';
import {
  choiceEntries,
  compositeKeys,
  isFieldVisible,
  visibleFieldIds,
  type LogicField,
} from '../src/form/logic.js';

/**
 * Logica condizionale dei form come WPForms (1E-W6, DR-133): gruppi in OR, regole
 * in AND, il valore di una regola è la chiave della scelta. Dati sintetici.
 */

const scelta: LogicField = {
  id: '9',
  type: 'radio',
  options: { choices: { '1': { label: 'Prima' }, '2': { label: 'Seconda' } } },
};
const spunta: LogicField = {
  id: '21',
  type: 'checkbox',
  options: { choices: { '1': { label: 'Mi serve' } } },
};
const dopoSeconda: LogicField = {
  id: '10',
  type: 'html',
  options: {
    conditional_logic: '1',
    conditional_type: 'show',
    conditionals: [[{ field: '9', operator: '==', value: '2' }]],
  },
};
const nascostoSeSpuntato: LogicField = {
  id: '22',
  type: 'text',
  options: {
    conditional_logic: '1',
    conditional_type: 'hide',
    conditionals: [[{ field: '21', operator: '==', value: '1' }]],
  },
};
const tutti = [scelta, spunta, dopoSeconda, nascostoSeSpuntato];

describe('choiceEntries', () => {
  it('conserva chiave ed etichetta, nell’ordine', () => {
    expect(choiceEntries(scelta.options)).toEqual([
      { key: '1', label: 'Prima' },
      { key: '2', label: 'Seconda' },
    ]);
  });
});

describe('isFieldVisible', () => {
  it('un campo senza condizioni è sempre visibile', () => {
    expect(isFieldVisible(scelta, tutti, {})).toBe(true);
  });

  it('«show»: visibile solo se la scelta della regola è quella selezionata', () => {
    expect(isFieldVisible(dopoSeconda, tutti, {})).toBe(false);
    expect(isFieldVisible(dopoSeconda, tutti, { '9': 'Prima' })).toBe(false);
    expect(isFieldVisible(dopoSeconda, tutti, { '9': 'Seconda' })).toBe(true);
  });

  it('«hide» con una casella: nascosto quando è spuntata', () => {
    expect(isFieldVisible(nascostoSeSpuntato, tutti, {})).toBe(true);
    expect(isFieldVisible(nascostoSeSpuntato, tutti, { '21': ['Mi serve'] })).toBe(false);
  });

  it('gruppi in OR, regole in AND', () => {
    const campo: LogicField = {
      id: 'x',
      type: 'text',
      options: {
        conditional_logic: '1',
        conditional_type: 'show',
        conditionals: [
          [
            { field: '9', operator: '==', value: '1' },
            { field: '21', operator: '==', value: '1' },
          ],
          [{ field: '9', operator: '==', value: '2' }],
        ],
      },
    };
    const lista = [...tutti, campo];
    expect(isFieldVisible(campo, lista, { '9': 'Prima' })).toBe(false);
    expect(isFieldVisible(campo, lista, { '9': 'Prima', '21': ['Mi serve'] })).toBe(true);
    expect(isFieldVisible(campo, lista, { '9': 'Seconda' })).toBe(true);
  });

  it('accetta anche le condizioni salvate come oggetto con chiavi numeriche', () => {
    const campo: LogicField = {
      ...dopoSeconda,
      options: {
        ...dopoSeconda.options,
        conditionals: { '0': { '0': { field: '9', operator: '==', value: '2' } } },
      },
    };
    expect(isFieldVisible(campo, [scelta, campo], { '9': 'Seconda' })).toBe(true);
  });
});

describe('visibleFieldIds', () => {
  it('restituisce gli identificativi dei campi visibili', () => {
    expect([...visibleFieldIds(tutti, { '9': 'Seconda' })]).toEqual(['9', '21', '10', '22']);
  });
});

describe('compositeKeys — sotto-campi condivisi fra pagina e server', () => {
  it('indirizzo senza seconda riga né paese, come i form della sorgente', () => {
    const keys = compositeKeys({
      type: 'address',
      options: { address2_hide: '1', country_hide: '1' },
    });
    expect(keys?.map((k) => k.key)).toEqual(['address1', 'city', 'state', 'postal']);
  });

  it('la seconda riga dell’indirizzo, se c’è, è facoltativa; il paese compare se non è nascosto', () => {
    const keys = compositeKeys({ type: 'address', options: {} }) ?? [];
    expect(keys.find((k) => k.key === 'address2')?.optional).toBe(true);
    expect(keys.map((k) => k.key)).toContain('country');
  });

  it('nome semplice ed email senza conferma non sono composti', () => {
    expect(compositeKeys({ type: 'name', options: { format: 'simple' } })).toBeNull();
    expect(compositeKeys({ type: 'email', options: {} })).toBeNull();
  });
});

describe('operatori numerici', () => {
  it('«>» e «<» confrontano numeri', () => {
    const numero: LogicField = { id: 'n', type: 'number', options: {} };
    const campo: LogicField = {
      id: 'x',
      type: 'text',
      options: {
        conditional_logic: '1',
        conditional_type: 'show',
        conditionals: [[{ field: 'n', operator: '>', value: '2' }]],
      },
    };
    expect(isFieldVisible(campo, [numero, campo], { n: '3' })).toBe(true);
    expect(isFieldVisible(campo, [numero, campo], { n: '1' })).toBe(false);
    expect(isFieldVisible(campo, [numero, campo], {})).toBe(false);
  });
});
