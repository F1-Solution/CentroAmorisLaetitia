'use client';

import { TextField } from '@amoris/ui';
import { useEffect, useRef, useState } from 'react';

export const MISSING_CURRENT_PASSWORD = 'Scrivi la tua password attuale.';

export interface CurrentPassword {
  readonly value: string;
  readonly setValue: (value: string) => void;
  /** L'errore mostrato sul campo: quello del controllo locale o quello dell'API. */
  readonly error: string | null;
  /** Vero se manca: mostra l'errore, porta il fuoco sul campo e ferma l'invio. */
  readonly isMissing: () => boolean;
  readonly fieldRef: React.RefObject<HTMLDivElement | null>;
}

function focusField(fieldRef: React.RefObject<HTMLDivElement | null>): void {
  fieldRef.current?.querySelector('input')?.focus();
}

/**
 * Stato della password attuale chiesta sul proprio account (DR-288): vive solo
 * nella finestra aperta; a ogni rifiuto dell'API, contato da `refusals`, si svuota e riprende il fuoco.
 */
export function useCurrentPassword(apiError: string | null, refusals: number): CurrentPassword {
  const [value, setValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (refusals === 0) return;
    setValue('');
    focusField(fieldRef);
  }, [refusals]);

  return {
    value,
    setValue: (next) => {
      setValue(next);
      if (next) setLocalError(null);
    },
    error: localError ?? apiError,
    isMissing: () => {
      if (value) return false;
      setLocalError(MISSING_CURRENT_PASSWORD);
      focusField(fieldRef);
      return true;
    },
    fieldRef,
  };
}

export interface CurrentPasswordFieldProps {
  readonly state: CurrentPassword;
  readonly disabled: boolean;
}

/** Campo «Password attuale» delle modifiche al proprio account; l'errore è annunciato dal campo. */
export function CurrentPasswordField({
  state,
  disabled,
}: CurrentPasswordFieldProps): React.JSX.Element {
  return (
    <div ref={state.fieldRef}>
      <TextField
        label="Password attuale"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        helpText="Per modificare il tuo account conferma con la password con cui sei entrato."
        value={state.value}
        {...(state.error ? { errorText: state.error } : {})}
        onChange={(event) => state.setValue(event.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
