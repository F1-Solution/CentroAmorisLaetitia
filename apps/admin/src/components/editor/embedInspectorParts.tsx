'use client';

import { TextField, type TextFieldProps } from '@amoris/ui';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';

/** Un media come lo restituisce `GET /media`, per i pannelli dei blocchi (DR-279). */
export interface LibraryMedia {
  readonly id: string;
  readonly publicPath: string;
  readonly fileName: string;
  readonly title: string | null;
  readonly mimeType: string;
  readonly isPrivate: boolean;
}

export interface LibraryMediaState {
  readonly items: readonly LibraryMedia[] | null;
  readonly error: string | null;
}

/** I media pubblici il cui tipo comincia con `mimePrefix`, caricati quando `active` è vero. */
export function usePublicMedia(mimePrefix: string, active = true, search = ''): LibraryMediaState {
  const [state, setState] = useState<LibraryMediaState>({ items: null, error: null });

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    const query = new URLSearchParams({ mimePrefix, perPage: '100' });
    if (search.trim()) query.set('search', search.trim());
    void (async () => {
      try {
        const list = await api<{ items: readonly LibraryMedia[] }>(`/media?${query.toString()}`, {
          signal: controller.signal,
        });
        // Un media riservato non comparirebbe sul sito (ADR-004 §3.6).
        if (!controller.signal.aborted)
          setState({ items: list.items.filter((item) => !item.isPrivate), error: null });
      } catch (caught) {
        if (!controller.signal.aborted)
          setState({
            items: null,
            error:
              caught instanceof ApiError
                ? caught.fullMessage
                : 'L’elenco dei media non si è caricato.',
          });
      }
    })();
    return () => controller.abort();
  }, [mimePrefix, active, search]);

  return state;
}

export interface CheckedTextFieldProps extends Omit<
  TextFieldProps,
  'value' | 'onChange' | 'errorText'
> {
  readonly value: string;
  /** Il messaggio in italiano se il testo non è ammesso, altrimenti `null`. */
  readonly validate: (text: string) => string | null;
  /** Riceve solo testi ammessi: uno non ammesso resta nel campo, con l'errore. */
  readonly onCommit: (text: string) => void;
}

/** Campo di testo che scrive nel blocco solo valori validi (DR-279). */
export function CheckedTextField({
  value,
  validate,
  onCommit,
  ...rest
}: CheckedTextFieldProps): React.JSX.Element {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
  return (
    <TextField
      {...rest}
      value={text}
      {...(error ? { errorText: error } : {})}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        const problem = validate(next);
        setError(problem);
        if (problem === null) onCommit(next);
      }}
    />
  );
}
