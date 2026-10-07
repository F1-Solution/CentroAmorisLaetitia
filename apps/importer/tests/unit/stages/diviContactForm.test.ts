import { describe, expect, it } from 'vitest';
import { findDiviContactForms } from '../../../src/stages/forms/diviContactForm.js';

/**
 * Il modulo di contatto di Divi diventa un form (DR-094). Shortcode sintetico
 * con la **forma** di quello reale: titolo, quattro campi, conferma, indirizzo
 * di destinazione inventato su un dominio `.invalid`.
 */
const SHORTCODE =
  '[et_pb_section][et_pb_row][et_pb_column type="4_4"]' +
  '[et_pb_contact_form email="segreteria@esempio.invalid" title="Richiesta informazioni" ' +
  'custom_message="Nome: %%Name%% Messaggio: %%Message%%" success_message="Grazie, ti ricontatteremo."]' +
  '[et_pb_contact_field field_id="Name" field_title="Nome"][/et_pb_contact_field]' +
  '[et_pb_contact_field field_id="Email" field_title="Indirizzo e-mail" field_type="email"][/et_pb_contact_field]' +
  '[et_pb_contact_field field_id="Phone" field_title="Telefono" required_mark="off"][/et_pb_contact_field]' +
  '[et_pb_contact_field field_id="Message" field_title="Messaggio" field_type="text"][/et_pb_contact_field]' +
  '[/et_pb_contact_form][/et_pb_column][/et_pb_row][/et_pb_section]';

describe('findDiviContactForms (DR-094)', () => {
  it('trova il modulo nella pagina pubblicata, con titolo, conferma e notifica', () => {
    const [form, ...altri] = findDiviContactForms([{ postId: 42, content: SHORTCODE }]).forms;
    expect(altri).toHaveLength(0);
    expect(form).toMatchObject({
      postId: 42,
      title: 'Richiesta informazioni',
      slug: 'contatto-richiesta-informazioni',
      confirmationMessage: 'Grazie, ti ricontatteremo.',
      notification: {
        recipients: 'segreteria@esempio.invalid',
        body: 'Nome: %%Name%% Messaggio: %%Message%%',
      },
    });
  });

  it('traduce i quattro campi: tipo, etichetta, obbligatorietà e ordine', () => {
    const [form] = findDiviContactForms([{ postId: 42, content: SHORTCODE }]).forms;
    expect(form!.fields.map((f) => [f.id, f.type, f.label, f.required, f.order])).toEqual([
      ['Name', 'text', 'Nome', true, 0],
      ['Email', 'email', 'Indirizzo e-mail', true, 1],
      ['Phone', 'text', 'Telefono', false, 2],
      ['Message', 'text', 'Messaggio', true, 3],
    ]);
    // Il campo «text» di Divi è un'area di testo su più righe.
    expect(form!.fields[3]!.options).toEqual({ multiline: true });
    expect(form!.fields[0]!.options).toEqual({});
  });

  it('una pagina senza modulo non produce nulla', () => {
    expect(findDiviContactForms([{ postId: 7, content: '[et_pb_text]Ciao[/et_pb_text]' }])).toEqual(
      {
        forms: [],
        issues: [],
      },
    );
  });

  it('due moduli con lo stesso titolo producono un form solo', () => {
    const { forms, issues } = findDiviContactForms([
      { postId: 42, content: SHORTCODE },
      { postId: 43, content: SHORTCODE },
    ]);
    expect(forms).toHaveLength(1);
    expect(forms[0]!.postId).toBe(42);
    expect(issues).toEqual([]);
  });

  it('due moduli con lo stesso titolo ma campi diversi: il secondo si segnala, non si fonde', () => {
    const diverso = SHORTCODE.replace('field_title="Telefono"', 'field_title="Cellulare"');
    const { forms, issues } = findDiviContactForms([
      { postId: 42, content: SHORTCODE },
      { postId: 43, content: diverso },
    ]);
    expect(forms).toHaveLength(1);
    expect(issues).toEqual([{ code: 'divi-form-title-conflict', postId: 43 }]);
  });

  it('un tipo di campo mai visto si segnala invece di diventare testo in silenzio', () => {
    const ignoto = SHORTCODE.replace('field_type="email"', 'field_type="select"');
    const { issues } = findDiviContactForms([{ postId: 42, content: ignoto }]);
    expect(issues).toEqual([{ code: 'divi-form-unknown-field-type', postId: 42 }]);
  });
});
