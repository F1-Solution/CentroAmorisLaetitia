import { useRef } from 'react';
import { Alert } from '../primitives/Alert.js';
import '../primitives/fields.css';
import './HtmlFallbackEditor.css';

export interface HtmlFallbackEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  errorText?: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Evidenziazione minima e proprietaria — nessuna libreria di terze parti
// (vincolo tecnico della wave). Opera sul testo già sanificato, quindi non
// introduce mai frammenti non sfuggiti in `dangerouslySetInnerHTML`.
const TOKEN_PATTERN = /(&lt;\/?[a-zA-Z][\w-]*|&gt;)|([a-zA-Z-]+)(?==)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g;

function highlightHtml(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replace(TOKEN_PATTERN, (match, tag: string | undefined, attr: string | undefined, str: string | undefined) => {
    if (tag) return `<span class="amoris-html-fallback__tag">${tag}</span>`;
    if (attr) return `<span class="amoris-html-fallback__attr">${attr}</span>`;
    if (str) return `<span class="amoris-html-fallback__string">${str}</span>`;
    return match;
  });
}

/**
 * Componente 45: editor del blocco di riserva `html`. Area di testo con
 * evidenziazione della sintassi, **non** testo ricco (ADR-006 §3.4): non
 * esiste alcun comando di formattazione, solo la sintassi resa leggibile.
 * L'avviso è **permanente**, non legato a uno stato: trattarlo come testo
 * ricco normalizzerebbe un frammento conservato per fedeltà.
 */
export function HtmlFallbackEditor({ value, onChange, disabled = false, errorText }: HtmlFallbackEditorProps): React.JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const hasError = Boolean(errorText);

  function syncScroll() {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }

  return (
    <div className="amoris-html-fallback">
      <Alert variant="warning" title="Blocco non convertito">
        Questo blocco non è stato convertito, modificarlo può alterare la resa.
      </Alert>
      <div className={['amoris-html-fallback__editor', hasError ? 'amoris-html-fallback__editor--error' : ''].filter(Boolean).join(' ')}>
        <pre
          ref={highlightRef}
          aria-hidden="true"
          className="amoris-html-fallback__highlight"
          // Sicuro: `highlightHtml` sfugge l'intero testo prima di avvolgerlo
          // in `<span>` statici (vedi sopra).
          dangerouslySetInnerHTML={{ __html: highlightHtml(value.length > 0 ? value : ' ') }}
        />
        <textarea
          ref={textareaRef}
          className="amoris-focusable amoris-html-fallback__textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onScroll={syncScroll}
          disabled={disabled}
          spellCheck={false}
          aria-label="Codice HTML del blocco di riserva"
          aria-invalid={hasError || undefined}
        />
      </div>
      {hasError ? (
        <p className="amoris-field__error" role="alert">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
