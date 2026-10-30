'use client';

import { Alert, Button, SelectField } from '@amoris/ui';
import { useEffect, useId, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { PageLayout } from '../../lib/editor/roundtrip';

/**
 * Layout della pagina (DR-139): barra laterale e larghezza della colonna, come
 * `_et_pb_page_layout` della sorgente. Si salva da solo, come la SEO: non passa
 * dalla copia di lavoro né dal «Salva» dei blocchi.
 */

const OPTIONS: { value: PageLayout; label: string }[] = [
  { value: 'right_sidebar', label: 'Con barra laterale a destra' },
  { value: 'full_width', label: 'A tutta larghezza' },
  { value: 'no_sidebar', label: 'Senza barra laterale' },
];

export interface ContentLayoutPanelProps {
  readonly contentId: string;
  readonly initial: PageLayout;
  readonly disabled: boolean;
  /** Su un contenuto pubblicato il salvataggio cambia subito il sito, e il pulsante lo dice. */
  readonly published?: boolean;
  /** `updatedAt` è la data di modifica che il PATCH ha dato al contenuto. */
  readonly onSaved: (layout: PageLayout, updatedAt?: string) => void;
}

export function ContentLayoutPanel({
  contentId,
  initial,
  disabled,
  published = false,
  onSaved,
}: ContentLayoutPanelProps): React.JSX.Element {
  const [layout, setLayout] = useState<PageLayout>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noteId = useId();

  useEffect(() => setLayout(initial), [initial]);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await api<{ updatedAt?: string } | undefined>(`/contents/${contentId}`, {
        method: 'PATCH',
        body: { pageLayout: layout },
      });
      onSaved(layout, saved?.updatedAt);
      setNotice('La pagina pubblica usa il nuovo layout.');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Salvataggio del layout non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="amoris-layout-panel">
      {error ? (
        <Alert variant="error" title="Layout non salvato">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="success" title="Layout salvato">
          {notice}
        </Alert>
      ) : null}
      <SelectField
        label="Layout della pagina"
        options={OPTIONS}
        value={layout}
        disabled={disabled || busy}
        helpText="Come nel sito di partenza: la barra a destra restringe la colonna e traccia il filetto verticale."
        onChange={(event) => setLayout(event.target.value as PageLayout)}
      />
      {published ? (
        <p id={noteId}>Il nuovo layout compare subito sul sito, senza passare dall’anteprima.</p>
      ) : null}
      <Button
        variant="primary"
        disabled={disabled || busy || layout === initial}
        onClick={() => void save()}
        {...(published ? { 'aria-describedby': noteId } : {})}
      >
        {published ? 'Salva il layout e aggiorna il sito' : 'Salva il layout'}
      </Button>
    </div>
  );
}
