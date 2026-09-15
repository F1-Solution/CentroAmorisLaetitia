import { useEffect, useId, useRef, useState } from 'react';
import { trapTabKey } from '../layout/focus-trap.js';
import type { CommandResult } from './types.js';
import './CommandSearch.css';

export interface CommandSearchProps {
  /** Nome dell'ambiente attivo, mostrato nel titolo per ricordare l'ambito (DR-054). */
  activeAreaLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
  /**
   * Risultati già filtrati all'ambiente attivo da chi usa il componente. Il
   * componente non ne aggiunge altri e non naviga fuori da questo elenco: è
   * così che si rispetta DR-054 — la ricerca rapida raggiunge **solo**
   * l'ambiente attivo, mai un salto silenzioso in un'altra area.
   */
  results: CommandResult[];
  onSelect: (result: CommandResult) => void;
  loading?: boolean;
  errorText?: string;
}

/**
 * Componente 12: ricerca e comandi con `Ctrl+K`, **acceleratore** e mai unica
 * via di navigazione (§7.4 punto 4): le due colonne di `AreaNav` e
 * `SectionNav` restano montate dietro questo pannello, sempre — il componente
 * non le nasconde né le sostituisce.
 */
export function CommandSearch({
  activeAreaLabel,
  query,
  onQueryChange,
  results,
  onSelect,
  loading = false,
  errorText,
}: CommandSearchProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const listId = useId();

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      const node = dialogRef.current;
      if (node) trapTabKey(node, event);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) {
    return (
      <button type="button" className="amoris-focusable amoris-command-search__trigger" onClick={() => setOpen(true)}>
        Cerca <kbd>Ctrl</kbd>+<kbd>K</kbd>
      </button>
    );
  }

  const resultsAnnouncement = loading
    ? 'Ricerca in corso'
    : errorText
      ? errorText
      : results.length === 0
        ? 'Nessun risultato'
        : `${results.length} risultati trovati`;

  return (
    <div className="amoris-command-search-overlay">
      <div
        ref={dialogRef}
        className="amoris-command-search"
        role="dialog"
        aria-modal="true"
        aria-label={`Ricerca in ${activeAreaLabel}`}
      >
        <label className="amoris-command-search__label" htmlFor={`${listId}-input`}>
          Cerca in {activeAreaLabel}
        </label>
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="text"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          className="amoris-command-search__input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <p className="amoris-visually-hidden" role="status" aria-live="polite">
          {resultsAnnouncement}
        </p>
        {errorText ? (
          <p className="amoris-command-search__error" role="alert">
            {errorText}
          </p>
        ) : null}
        <ul id={listId} className="amoris-command-search__list">
          {results.map((result) => (
            <li key={result.id}>
              <button
                type="button"
                className="amoris-focusable amoris-command-search__option"
                onClick={() => {
                  setOpen(false);
                  onSelect(result);
                }}
              >
                <span>{result.label}</span>
                {result.group ? <span className="amoris-command-search__group">{result.group}</span> : null}
              </button>
            </li>
          ))}
        </ul>
        {!loading && !errorText && results.length === 0 ? (
          <p className="amoris-command-search__empty">Nessun risultato in {activeAreaLabel}.</p>
        ) : null}
      </div>
    </div>
  );
}
