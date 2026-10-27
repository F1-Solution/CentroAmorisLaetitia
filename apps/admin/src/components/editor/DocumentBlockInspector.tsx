'use client';

import type { DocBlockNode } from '@amoris/blocks';
import { Alert, SelectField, TextField } from '@amoris/ui';
import { usePublicDocuments } from '../documents/usePublicDocuments';

export interface DocumentBlockInspectorProps {
  readonly block: DocBlockNode;
  readonly onChange: (next: DocBlockNode) => void;
  readonly disabled: boolean;
}

/** Documento ed etichetta di un blocco «Documento», solo fra i pubblici; `display` non ha effetto sul sito e si conserva com'è (DR-279). */
export function DocumentBlockInspector({
  block,
  onChange,
  disabled,
}: DocumentBlockInspectorProps): React.JSX.Element {
  const { documents, error } = usePublicDocuments();
  const { documentId, label } = block.props;

  const setProps = (props: Partial<DocBlockNode['props']>) =>
    onChange({ ...block, props: { ...block.props, ...props } });
  const known = documents?.some((document) => document.id === documentId) ?? false;
  const options = [
    ...(!known
      ? [
          {
            value: documentId,
            label: documents ? 'Documento non disponibile' : 'Caricamento in corso…',
          },
        ]
      : []),
    ...(documents ?? []).map((document) => ({ value: document.id, label: document.title })),
  ];

  return (
    <div className="amoris-inspector">
      {error ? (
        <Alert variant="error" title="I documenti non si sono caricati">
          {error}
        </Alert>
      ) : null}
      {documents && !known ? (
        <Alert variant="warning" title="Il documento di questo blocco non è fra quelli pubblici">
          Scegliere un documento pubblico, o eliminare il blocco.
        </Alert>
      ) : null}
      <SelectField
        label="Documento"
        value={documentId}
        options={options}
        disabled={disabled}
        onChange={(event) => {
          if (documents?.some((document) => document.id === event.target.value))
            setProps({ documentId: event.target.value });
        }}
      />
      <TextField
        label="Etichetta"
        value={label ?? ''}
        disabled={disabled}
        helpText="Il testo del collegamento sul sito; vuota, si usa il titolo del documento."
        onChange={(event) =>
          setProps({ label: event.target.value === '' ? null : event.target.value })
        }
      />
    </div>
  );
}
