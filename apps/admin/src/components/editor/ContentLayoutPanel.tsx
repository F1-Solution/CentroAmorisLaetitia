'use client';

import { Alert, Button, SelectField } from '@amoris/ui';
import { useEffect, useState } from 'react';
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
  readonly onSaved: (layout: PageLayout) => void;
}

export function ContentLayoutPanel({
  contentId,
  initial,
  disabled,
  onSaved,
}: ContentLayoutPanelProps): React.JSX.Element {
  const [layout, setLayout] = useState<PageLayout>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => setLayout(initial), [initial]);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/contents/${contentId}`, { method: 'PATCH', body: { pageLayout: layout } });
      onSaved(layout);
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
      <Button
        variant="primary"
        disabled={disabled || busy || layout === initial}
        onClick={() => void save()}
      >
        Salva il layout
      </Button>
    </div>
  );
}
