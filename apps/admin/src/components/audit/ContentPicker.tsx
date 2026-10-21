'use client';

import { Button, TextField } from '@amoris/ui';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { ContentOption } from './types';

const DEBOUNCE_MS = 250;

export function contentOptionText(option: ContentOption): string {
  return `${option.title} (${option.type === 'post' ? 'Notizia' : 'Pagina'})`;
}

export interface ContentPickerProps {
  readonly chosen: ContentOption | null;
  readonly onChange: (option: ContentOption | null) => void;
}

/** Ricerca di un contenuto per titolo: sceglie su quale filtrare il registro. */
export function ContentPicker({ chosen, onChange }: ContentPickerProps): React.JSX.Element {
  const [text, setText] = useState('');
  const [options, setOptions] = useState<readonly ContentOption[]>([]);
  const [failed, setFailed] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const search = text.trim();
    if (!search) {
      setOptions([]);
      setFailed(false);
      setSearched(false);
      return;
    }
    let current = true;
    const timer = setTimeout(() => {
      api<{ items: ContentOption[] }>(`/audit/contents?${new URLSearchParams({ search })}`)
        .then((result) => {
          if (!current) return;
          setOptions(result.items);
          setFailed(false);
          setSearched(true);
        })
        .catch(() => {
          if (!current) return;
          setOptions([]);
          setFailed(true);
          setSearched(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [text]);

  if (chosen) {
    return (
      <div className="amoris-audit__picked">
        <span className="amoris-field__label">Contenuto</span>
        <span>{contentOptionText(chosen)}</span>
        <Button variant="tertiary" onClick={() => onChange(null)}>
          Togli il contenuto scelto
        </Button>
      </div>
    );
  }

  return (
    <div>
      <TextField
        label="Contenuto"
        value={text}
        helpText="Scrivi una parte del titolo e scegli dall’elenco."
        {...(failed ? { errorText: 'La ricerca non è riuscita: riprova.' } : {})}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Invio qui non invia il form dei filtri: la scelta si fa dall'elenco.
          if (event.key === 'Enter') event.preventDefault();
        }}
      />
      <p className="amoris-visually-hidden" role="status" aria-live="polite">
        {searched
          ? options.length > 0
            ? `${options.length} ${options.length === 1 ? 'contenuto trovato' : 'contenuti trovati'}`
            : 'Nessun contenuto trovato'
          : ''}
      </p>
      {options.length > 0 ? (
        <ul className="amoris-audit__options" aria-label="Contenuti trovati">
          {options.map((option) => (
            <li key={option.id}>
              <Button
                variant="tertiary"
                onClick={() => {
                  onChange(option);
                  setText('');
                  setOptions([]);
                  setSearched(false);
                }}
              >
                {contentOptionText(option)}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
