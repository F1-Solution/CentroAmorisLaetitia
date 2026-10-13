'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { FormBlock } from '../schema/block';
import { blockClassName } from './class-name';
import type { FormData, FormFieldData } from './data-maps';
import { isAllowedUrl } from '../sanitize';

export interface FormComponentProps {
  readonly block: FormBlock;
  /** La definizione del form, dalla lettura pubblica; senza, resta il segnaposto di prima. */
  readonly form?: FormData | undefined;
}

/** I tipi che producono un campo d'inserimento in Fase 1 (ADR-010 §4.2): non `html`, non `payment-single`. */
const RENDERED_INPUT_TYPES = new Set([
  'text',
  'name',
  'email',
  'phone',
  'date-time',
  'address',
  'radio',
  'checkbox',
  'number',
]);

function choiceLabel(choice: unknown): string | null {
  if (typeof choice === 'string') return choice;
  if (choice && typeof choice === 'object') {
    const record = choice as Record<string, unknown>;
    if (typeof record['label'] === 'string' && record['label'] !== '') return record['label'];
    if (typeof record['value'] === 'string' && record['value'] !== '') return record['value'];
  }
  return null;
}

/**
 * `options.choices` arriva come oggetto con chiavi numeriche (`{"1": {...}}`),
 * non come array: così lo salva il plugin d'origine (misurato sui dati reali).
 */
function choiceLabels(options: Readonly<Record<string, unknown>>): readonly string[] {
  const raw = options['choices'];
  const values = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw as Record<string, unknown>)
      : [];
  return values.map(choiceLabel).filter((value): value is string => value !== null);
}

function Field({
  field,
  value,
  onChange,
}: {
  readonly field: FormFieldData;
  readonly value: string | readonly string[] | undefined;
  readonly onChange: (next: string | readonly string[]) => void;
}) {
  const inputId = `blk-form-field-${field.id}`;
  if (field.type === 'html') {
    const code = field.options['code'];
    // Testo semplice, non markup: il blob non passa dalla sanificazione dei blocchi (ADR-010 §4.2).
    return typeof code === 'string' ? <p className="blk-form-static">{code}</p> : null;
  }
  if (!RENDERED_INPUT_TYPES.has(field.type)) return null;

  const label = (
    <label htmlFor={inputId}>
      {field.label}
      {field.required ? <span aria-hidden="true"> *</span> : null}
    </label>
  );

  if (field.type === 'radio') {
    const choices = choiceLabels(field.options);
    return (
      <fieldset className="blk-form-field" data-field-type={field.type}>
        <legend>
          {field.label}
          {field.required ? <span aria-hidden="true"> *</span> : null}
        </legend>
        {choices.map((choice) => (
          <label key={choice} className="blk-form-radio-option">
            <input
              type="radio"
              name={inputId}
              value={choice}
              checked={value === choice}
              required={field.required}
              onChange={() => onChange(choice)}
            />
            {choice}
          </label>
        ))}
      </fieldset>
    );
  }

  if (field.type === 'checkbox') {
    const choices = choiceLabels(field.options);
    const selected = Array.isArray(value) ? value : [];
    const toggle = (choice: string) =>
      onChange(
        selected.includes(choice) ? selected.filter((v) => v !== choice) : [...selected, choice],
      );
    return (
      <fieldset className="blk-form-field" data-field-type={field.type}>
        <legend>
          {field.label}
          {field.required ? <span aria-hidden="true"> *</span> : null}
        </legend>
        {choices.map((choice) => (
          <label key={choice} className="blk-form-checkbox-option">
            <input
              type="checkbox"
              checked={selected.includes(choice)}
              onChange={() => toggle(choice)}
            />
            {choice}
          </label>
        ))}
      </fieldset>
    );
  }

  const inputType =
    field.type === 'email'
      ? 'email'
      : field.type === 'phone'
        ? 'tel'
        : field.type === 'number'
          ? 'number'
          : 'text';

  return (
    <div className="blk-form-field" data-field-type={field.type}>
      {label}
      <input
        id={inputId}
        type={inputType}
        required={field.required}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
      {field.description ? <p className="blk-form-field-description">{field.description}</p> : null}
    </div>
  );
}

interface SubmitSuccess {
  readonly ok: true;
  readonly confirmationMessage: string;
  readonly payment: {
    readonly required: boolean;
    readonly amount: number | null;
    readonly url: string | null;
  };
}

/** La stessa busta d'errore di tutto il servizio (`openapiErrors.ts`). */
interface SubmitError {
  readonly error: { readonly code: string; readonly message: string };
}

/**
 * Invio salvato nel database, senza email (DR-108). Campo esca e marca
 * temporale minima (ADR-010 §4.4): nessun captcha di terze parti.
 */
export function Form({ block, form }: FormComponentProps) {
  const className = blockClassName('form', block.props.classes);
  const [values, setValues] = useState<Record<string, string | readonly string[]>>({});
  const [honeypot, setHoneypot] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [success, setSuccess] = useState<SubmitSuccess | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setStartedAt(Date.now());
  }, []);

  if (!form) {
    return (
      <div
        className={className}
        id={block.id}
        data-form-id={block.props.formId}
        data-origin={block.props.origin}
      />
    );
  }

  const fields = [...form.fields].sort((a, b) => a.order - b.order);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form) return;
    setStatus('sending');
    try {
      const response = await fetch(`/forms/${encodeURIComponent(form.slug)}/submissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ values, honeypot, startedAt }),
      });
      const body = (await response.json().catch(() => null)) as SubmitSuccess | SubmitError | null;
      if (response.ok && body && 'ok' in body && body.ok) {
        setSuccess(body);
        setStatus('done');
      } else {
        setErrorMessage(
          body && 'error' in body
            ? body.error.message
            : 'Non è stato possibile inviare la richiesta.',
        );
        setStatus('error');
      }
    } catch {
      setErrorMessage('Servizio non raggiungibile: riprova più tardi.');
      setStatus('error');
    }
  }

  if (status === 'done' && success) {
    const paymentUrl =
      success.payment.url && isAllowedUrl(success.payment.url) ? success.payment.url : null;
    return (
      <div className={className} id={block.id} data-form-id={block.props.formId} data-sent="true">
        <p className="blk-form-confirmation">
          {success.confirmationMessage || form.confirmationMessage || 'Richiesta inviata.'}
        </p>
        {success.payment.required ? (
          <p className="blk-form-payment">
            {success.payment.amount !== null ? (
              <>Importo da versare: {success.payment.amount.toFixed(2)} €. </>
            ) : null}
            {paymentUrl ? (
              <a href={paymentUrl}>Vai al pagamento</a>
            ) : (
              'Sarai ricontattato per il pagamento.'
            )}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className={className}
      id={block.id}
      data-form-id={block.props.formId}
      data-origin={block.props.origin}
      onSubmit={handleSubmit}
      noValidate
    >
      {block.props.showTitle ? (
        // Il modulo di contatto di Divi rende il suo titolo come `h1` (criterio 1E-14).
        block.props.origin === 'divi' ? (
          <h1 className="blk-form-title et_pb_contact_main_title">{form.title}</h1>
        ) : (
          <h2 className="blk-form-title">{form.title}</h2>
        )
      ) : null}
      {fields.map((field) => (
        <Field
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(next) => setValues((prev) => ({ ...prev, [field.id]: next }))}
        />
      ))}
      {/* Campo esca: invisibile a chi vede la pagina, compilato solo da invii automatici. */}
      <label className="blk-form-trap" aria-hidden="true">
        Non compilare questo campo
        <input
          type="text"
          name="sito_web"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
      </label>
      {status === 'error' && errorMessage ? (
        <p className="blk-form-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <button type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Invio in corso…' : 'Invia'}
      </button>
    </form>
  );
}
