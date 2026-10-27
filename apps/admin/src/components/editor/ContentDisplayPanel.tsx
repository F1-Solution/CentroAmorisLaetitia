'use client';

import { Alert, Button, CheckboxField, FieldGroup, SelectField } from '@amoris/ui';
import { useEffect, useId, useState } from 'react';
import { api, ApiError } from '../../lib/api';

/** Titolo, spazio fra le colonne e primo piano (DR-278, DR-286), salvati da soli con un PATCH dei campi cambiati. */

export interface DisplayValues {
  readonly showTitle: boolean;
  /** Da 1 a 4; `null` = valore del tema, 2 (DR-149). */
  readonly gutterWidth: number | null;
  readonly isSticky: boolean;
}

const GUTTER_OPTIONS = [
  { value: '', label: 'Come il tema (2)' },
  { value: '1', label: '1 — il più stretto' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4 — il più largo' },
];

export interface ContentDisplayPanelProps {
  readonly contentId: string;
  readonly type: 'page' | 'post';
  /** Il documento comincia con una sezione, cioè è costruito con il builder di Divi. */
  readonly startsWithSection: boolean;
  readonly initial: DisplayValues;
  readonly disabled: boolean;
  /** `updatedAt` è la data di modifica che il PATCH ha dato al contenuto. */
  readonly onSaved: (values: DisplayValues, updatedAt?: string) => void;
}

/** I soli campi diversi da quelli salvati: un campo che non c'entra non si scrive. */
function changedFields(
  initial: DisplayValues,
  next: DisplayValues,
  type: 'page' | 'post',
): Partial<DisplayValues> {
  return {
    ...(next.showTitle !== initial.showTitle ? { showTitle: next.showTitle } : {}),
    ...(next.gutterWidth !== initial.gutterWidth ? { gutterWidth: next.gutterWidth } : {}),
    ...(type === 'post' && next.isSticky !== initial.isSticky ? { isSticky: next.isSticky } : {}),
  };
}

/** Che cosa fa la casella sul sito, come il tema della sorgente. */
const TITLE_HELP = {
  page: 'Spento, il titolo resta solo per i lettori di schermo, se la pagina non ne ha già uno nel testo.',
  sectionPage:
    'Questa pagina comincia con una sezione: come nel sito di partenza, il sito non mostra il titolo delle pagine costruite a sezioni, qualunque sia la scelta.',
  post: 'Spento, una notizia costruita a sezioni perde titolo e data, come nel sito di partenza; le altre perdono il solo titolo.',
} as const;

export function ContentDisplayPanel({
  contentId,
  type,
  startsWithSection,
  initial,
  disabled,
  onSaved,
}: ContentDisplayPanelProps): React.JSX.Element {
  const [values, setValues] = useState<DisplayValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const titleHelpId = useId();
  const stickyHelpId = useId();

  const { showTitle, gutterWidth, isSticky } = initial;
  useEffect(
    () => setValues({ showTitle, gutterWidth, isSticky }),
    [showTitle, gutterWidth, isSticky],
  );

  const body = changedFields(initial, values, type);
  const unchanged = Object.keys(body).length === 0;

  function change(patch: Partial<DisplayValues>): void {
    setNotice(false);
    setValues((current) => ({ ...current, ...patch }));
  }

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(false);
    try {
      const saved = await api<{ updatedAt?: string } | undefined>(`/contents/${contentId}`, {
        method: 'PATCH',
        body,
      });
      onSaved(values, saved?.updatedAt);
      setNotice(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Salvataggio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FieldGroup
      title="Titolo e colonne"
      description="Come nel sito di partenza. Si salvano qui, senza toccare il contenuto."
      disabled={disabled || busy}
    >
      {error ? (
        <Alert variant="error" title="Impostazioni non salvate">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="success" title="Impostazioni salvate">
          Il sito usa le nuove impostazioni.
        </Alert>
      ) : null}
      <CheckboxField
        label={type === 'page' ? 'Mostra il titolo della pagina' : 'Mostra il titolo della notizia'}
        checked={values.showTitle}
        // Divi `page.php`: una pagina costruita a sezioni non mostra mai il titolo.
        disabled={type === 'page' && startsWithSection}
        aria-describedby={titleHelpId}
        onChange={(event) => change({ showTitle: event.target.checked })}
      />
      <p id={titleHelpId} className="amoris-field__help">
        {TITLE_HELP[type === 'page' && startsWithSection ? 'sectionPage' : type]}
      </p>
      <SelectField
        label="Spazio fra le colonne"
        options={GUTTER_OPTIONS}
        value={values.gutterWidth === null ? '' : String(values.gutterWidth)}
        helpText="La spaziatura del tema per questa pagina: conta nelle colonne del piè di pagina."
        onChange={(event) =>
          change({ gutterWidth: event.target.value === '' ? null : Number(event.target.value) })
        }
      />
      {type === 'post' ? (
        <>
          <CheckboxField
            label="Notizia in primo piano"
            checked={values.isSticky}
            aria-describedby={stickyHelpId}
            onChange={(event) => change({ isSticky: event.target.checked })}
          />
          <p id={stickyHelpId} className="amoris-field__help">
            Come nel sito di partenza, oggi non cambia l’ordine di nessun elenco: l’«Elenco
            articoli» della pagina iniziale, gli archivi e la ricerca non mettono in testa le
            notizie in primo piano.
          </p>
        </>
      ) : null}
      <Button
        variant="primary"
        permitted={!disabled}
        disabled={busy || unchanged}
        loading={busy}
        onClick={() => void save()}
      >
        Salva titolo e colonne
      </Button>
    </FieldGroup>
  );
}
