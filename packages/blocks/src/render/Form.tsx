'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { FormBlock } from '../schema/block';
import { blockClassName } from './class-name';
import type { FormData } from './data-maps';
import { isAllowedUrl } from '../sanitize';
import { visibleFieldIds, type FieldValue } from '../form/logic';
import { FormField } from './FormField';

export interface FormComponentProps {
  readonly block: FormBlock;
  /** La definizione del form, dalla lettura pubblica; senza, resta il segnaposto di prima. */
  readonly form?: FormData | undefined;
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
  const [values, setValues] = useState<Record<string, FieldValue>>({});
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
  // Logica condizionale come la sorgente: i campi nascosti non si vedono e non si inviano.
  const visible = visibleFieldIds(fields, values);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form) return;
    setStatus('sending');
    try {
      const response = await fetch(`/forms/${encodeURIComponent(form.slug)}/submissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          values: Object.fromEntries(Object.entries(values).filter(([id]) => visible.has(id))),
          honeypot,
          startedAt,
        }),
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
      {fields
        .filter((field) => visible.has(field.id))
        .map((field) => (
          <FormField
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
      <div className="wpforms-submit-container">
        <button type="submit" className="wpforms-submit" disabled={status === 'sending'}>
          {status === 'sending'
            ? (form.submitTextProcessing ?? 'Invio in corso…')
            : (form.submitText ?? 'Invia')}
        </button>
      </div>
    </form>
  );
}
