import type { FormFieldData } from './data-maps';
import type { FieldValue } from '../form/logic';

/**
 * Campi del modulo di contatto di Divi (`et_pb_contact_field`, T di DR-157):
 * etichetta nascosta dal tema, segnaposto, area di testo per il messaggio.
 */

interface Placed {
  readonly field: FormFieldData;
  readonly half: boolean;
  readonly last: boolean;
}

/** I tipi che il modulo di Divi conosce; gli altri passano dalla resa comune dei campi. */
export function isDiviContactField(field: FormFieldData): boolean {
  return field.type === 'text' || field.type === 'email';
}

/**
 * Le classi che Divi calcola: un campo senza `fullwidth_field` occupa metà riga, e
 * `et_pb_contact_field_last` chiude la riga (campo intero, o secondo di due metà).
 */
export function diviContactLayout(fields: readonly FormFieldData[]): Placed[] {
  let openHalf = false;
  return fields.map((field) => {
    const half = field.options['fullwidth'] !== true;
    const last = !half || openHalf;
    openHalf = half && !openHalf;
    return { field, half, last };
  });
}

interface DiviContactFieldProps {
  readonly field: FormFieldData;
  readonly half: boolean;
  readonly last: boolean;
  readonly value: FieldValue | undefined;
  readonly onChange: (next: FieldValue) => void;
}

export function DiviContactField({ field, half, last, value, onChange }: DiviContactFieldProps) {
  const id = `blk-form-field-${field.id}`;
  const className = [
    'et_pb_contact_field',
    half ? 'et_pb_contact_field_half' : null,
    last ? 'et_pb_contact_field_last' : null,
  ]
    .filter(Boolean)
    .join(' ');
  const text = typeof value === 'string' ? value : '';
  return (
    <p className={className}>
      <label className="et_pb_contact_form_label" htmlFor={id}>
        {field.label}
      </label>
      {field.options['multiline'] === true ? (
        <textarea
          id={id}
          aria-label={field.label}
          className="et_pb_contact_message input"
          placeholder={field.label}
          required={field.required}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          aria-label={field.label}
          className="input"
          type={field.type === 'email' ? 'email' : 'text'}
          placeholder={field.label}
          required={field.required}
          value={text}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </p>
  );
}
