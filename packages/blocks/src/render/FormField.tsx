'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { FormFieldData } from './data-maps';
import { choiceEntries, compositeKeys, type FieldValue } from '../form/logic';
import { sanitizeRichText } from '../sanitize';

/**
 * Un campo del form con il markup di WPForms della sorgente (1E-W6): segnaposto
 * dentro il campo, etichetta nascosta ma leggibile dagli ausili, sotto-campi
 * affiancati per nome, email con conferma e indirizzo (DR-133).
 */

type Options = Readonly<Record<string, unknown>>;

function text(options: Options, key: string): string {
  const value = options[key];
  return typeof value === 'string' ? value : '';
}

function flag(options: Options, key: string): boolean {
  const value = options[key];
  return value === '1' || value === true;
}

/** Segnaposto ed etichetta di ogni sotto-campo, come la sorgente; quelle dell'indirizzo misurate sulla pagina resa (U3, DR-157). */
const PART_TEXT: Readonly<Record<string, { placeholderKey: string; sublabel: string }>> = {
  first: { placeholderKey: 'first_placeholder', sublabel: 'Nome' },
  last: { placeholderKey: 'last_placeholder', sublabel: 'Cognome' },
  primary: { placeholderKey: 'placeholder', sublabel: 'Email' },
  secondary: { placeholderKey: 'confirmation_placeholder', sublabel: 'Conferma email' },
  address1: { placeholderKey: 'address1_placeholder', sublabel: 'Indirizzo (linea 1)' },
  address2: { placeholderKey: 'address2_placeholder', sublabel: 'Indirizzo (riga 2)' },
  city: { placeholderKey: 'city_placeholder', sublabel: 'Località' },
  state: { placeholderKey: 'state_placeholder', sublabel: 'Stato / Provincia / Regione' },
  postal: { placeholderKey: 'postal_placeholder', sublabel: 'Codice postale' },
  country: { placeholderKey: 'country_placeholder', sublabel: 'Paese' },
};

/** Le parti di un campo composto (`compositeKeys`, condivise col server) con i loro testi. */
function compositeParts(field: Pick<FormFieldData, 'type' | 'options'>):
  | readonly {
      key: string;
      placeholder: string;
      sublabel: string;
      half: boolean;
      optional: boolean;
    }[]
  | null {
  const keys = compositeKeys(field);
  if (!keys) return null;
  return keys.map((part) => ({
    ...part,
    placeholder: text(field.options, PART_TEXT[part.key]?.placeholderKey ?? ''),
    sublabel: PART_TEXT[part.key]?.sublabel ?? part.key,
  }));
}

interface FieldProps {
  readonly field: FormFieldData;
  readonly value: FieldValue | undefined;
  readonly onChange: (next: FieldValue) => void;
}

function Label({ field, htmlFor }: { field: FormFieldData; htmlFor?: string }) {
  const hidden = flag(field.options, 'label_hide');
  return (
    <label
      className={`wpforms-field-label${hidden ? ' wpforms-label-hide' : ''}`}
      htmlFor={htmlFor}
    >
      {field.label}
      {field.required ? <span className="wpforms-required-label"> *</span> : null}
    </label>
  );
}

function sizeClass(options: Options): string {
  const size = text(options, 'size');
  return size ? ` wpforms-field-${size}` : '';
}

/** `input_columns` di WPForms: scelte in linea o su due o tre colonne (U2, DR-157). */
function listClass(options: Options): string {
  const columns = text(options, 'input_columns');
  if (columns === 'inline') return ' wpforms-list-inline';
  return columns === '2' || columns === '3' ? ` wpforms-list-${columns}-columns` : '';
}

function Container({ field, children }: { field: FormFieldData; children: ReactNode }) {
  return (
    <div
      className={`wpforms-field wpforms-field-${field.type}${listClass(field.options)}`}
      data-field-type={field.type}
    >
      {children}
    </div>
  );
}

function HtmlField({ field }: { field: FormFieldData }) {
  const code = text(field.options, 'code');
  if (!code) return null;
  const outcome = sanitizeRichText(code);
  return (
    <Container field={field}>
      {outcome.ok ? (
        <div dangerouslySetInnerHTML={{ __html: outcome.html }} />
      ) : (
        <div>{code.replace(/<[^>]*>/g, '')}</div>
      )}
    </Container>
  );
}

function ChoicesField({ field, value, onChange }: FieldProps) {
  const multiple = field.type === 'checkbox';
  const selected = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [];
  const inputName = `blk-form-field-${field.id}`;
  return (
    <Container field={field}>
      <Label field={field} />
      <ul>
        {choiceEntries(field.options).map((choice) => {
          const id = `${inputName}-${choice.key}`;
          const checked = selected.includes(choice.label);
          return (
            <li key={choice.key}>
              <input
                id={id}
                type={multiple ? 'checkbox' : 'radio'}
                name={inputName}
                value={choice.label}
                checked={checked}
                required={!multiple && field.required}
                onChange={() =>
                  onChange(
                    multiple
                      ? checked
                        ? selected.filter((v) => v !== choice.label)
                        : [...selected, choice.label]
                      : choice.label,
                  )
                }
              />
              <label className="wpforms-field-label-inline" htmlFor={id}>
                {choice.label}
              </label>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}

function CompositeField({
  field,
  value,
  onChange,
  parts,
}: FieldProps & { parts: NonNullable<ReturnType<typeof compositeParts>> }) {
  const current: Readonly<Record<string, string>> =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Readonly<Record<string, string>>)
      : {};
  const sublabelHidden = flag(field.options, 'sublabel_hide');
  const inputType = field.type === 'email' ? 'email' : 'text';
  return (
    <Container field={field}>
      <Label field={field} htmlFor={`blk-form-field-${field.id}-${parts[0]?.key ?? ''}`} />
      {compositeRows(parts).map((row) => (
        <div key={row[0]?.key} className={`wpforms-field-row${sizeClass(field.options)}`}>
          {row.map((part, index) => {
            const id = `blk-form-field-${field.id}-${part.key}`;
            return (
              <div
                key={part.key}
                className={`wpforms-field-row-block${part.half ? ' wpforms-one-half' : ''}${index === 0 ? ' wpforms-first' : ''}`}
              >
                <input
                  id={id}
                  type={inputType}
                  placeholder={part.placeholder || undefined}
                  required={field.required && !part.optional}
                  value={current[part.key] ?? ''}
                  onChange={(event) => onChange({ ...current, [part.key]: event.target.value })}
                />
                <label
                  htmlFor={id}
                  className={`wpforms-field-sublabel after${sublabelHidden ? ' wpforms-sublabel-hide' : ''}`}
                >
                  {part.sublabel}
                </label>
              </div>
            );
          })}
        </div>
      ))}
    </Container>
  );
}

/** Le righe di WPForms: una per ogni parte intera, una per ogni coppia di metà (famiglia C+). */
function compositeRows<T extends { readonly half: boolean }>(parts: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (const part of parts) {
    const last = rows[rows.length - 1];
    if (part.half && last && last.length === 1 && last[0]?.half) last.push(part);
    else rows.push([part]);
  }
  return rows;
}

/**
 * Telefono con bandiera e prefissi (ADR-011): intl-tel-input caricata solo nel
 * browser; se non si carica, resta un normale campo telefono.
 */
/** Il numero come si salva: con il prefisso del paese scelto, salvo l'Italia o un «+» già scritto. */
export function phoneWithDialCode(
  typed: string,
  country: { iso2: string; dialCode: string } | null,
): string {
  const trimmed = typed.trim();
  if (!trimmed || trimmed.startsWith('+') || !country || country.iso2 === 'it') return typed;
  return `+${country.dialCode} ${trimmed}`;
}

function PhoneField({ field, value, onChange }: FieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(typeof value === 'string' ? value : '');
  const country = useRef<{ iso2: string; dialCode: string } | null>(null);
  const latest = useRef({ typed, onChange });
  latest.current = { typed, onChange };

  useEffect(() => {
    let destroy: (() => void) | null = null;
    let cancelled = false;
    const element = input.current;
    if (!element || text(field.options, 'format') !== 'smart') return undefined;
    import('intl-tel-input')
      .then(({ default: intlTelInput }) => {
        if (cancelled) return;
        const instance = intlTelInput(element, {
          initialCountry: 'it',
          placeholderNumberPolicy: 'OFF',
          containerClass: 'blk-iti',
        });
        // Il paese scelto con la bandiera entra nel valore inviato (revisione 1E-W6).
        const onCountry = () => {
          const data = instance.getSelectedCountry();
          country.current = data ? { iso2: data.iso2, dialCode: data.dialCode } : null;
          latest.current.onChange(phoneWithDialCode(latest.current.typed, country.current));
        };
        element.addEventListener('countrychange', onCountry);
        destroy = () => {
          element.removeEventListener('countrychange', onCountry);
          instance.destroy();
        };
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [field.options]);

  const id = `blk-form-field-${field.id}`;
  const placeholder = text(field.options, 'placeholder');
  return (
    <Container field={field}>
      <Label field={field} htmlFor={id} />
      <input
        ref={input}
        id={id}
        className={sizeClass(field.options).trim() || undefined}
        type="tel"
        placeholder={placeholder || undefined}
        required={field.required}
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
          onChange(phoneWithDialCode(event.target.value, country.current));
        }}
      />
    </Container>
  );
}

const INPUT_TYPE: Readonly<Record<string, string>> = {
  email: 'email',
  phone: 'tel',
  number: 'number',
};

/** I tipi che producono un campo in Fase 1 (ADR-010 §4.2): non `payment-single`. */
const RENDERED_TYPES = new Set([
  'text',
  'name',
  'email',
  'phone',
  'date-time',
  'address',
  'radio',
  'checkbox',
  'number',
  'html',
]);

export function FormField({ field, value, onChange }: FieldProps) {
  if (!RENDERED_TYPES.has(field.type)) return null;
  if (field.type === 'html') return <HtmlField field={field} />;
  if (field.type === 'radio' || field.type === 'checkbox') {
    return <ChoicesField field={field} value={value} onChange={onChange} />;
  }
  const parts = compositeParts(field);
  if (parts)
    return <CompositeField field={field} value={value} onChange={onChange} parts={parts} />;
  if (field.type === 'phone') return <PhoneField field={field} value={value} onChange={onChange} />;

  const id = `blk-form-field-${field.id}`;
  const placeholder =
    field.type === 'date-time'
      ? text(field.options, 'date_placeholder')
      : text(field.options, 'placeholder');
  return (
    <Container field={field}>
      <Label field={field} htmlFor={id} />
      <input
        id={id}
        className={sizeClass(field.options).trim() || undefined}
        type={INPUT_TYPE[field.type] ?? 'text'}
        placeholder={placeholder || undefined}
        required={field.required}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
      {field.description ? (
        <div className="wpforms-field-description">{field.description}</div>
      ) : null}
    </Container>
  );
}
