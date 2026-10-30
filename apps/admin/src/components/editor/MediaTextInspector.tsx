'use client';

import type { MediaTextBlock } from '@amoris/blocks';
import { Button, TextField } from '@amoris/ui';
import { useState } from 'react';
import { ImageInsertPicker } from './ImageInsertPicker';

export interface MediaTextInspectorProps {
  readonly block: MediaTextBlock;
  readonly onChange: (next: MediaTextBlock) => void;
  readonly disabled: boolean;
}

/** Immagine e testo alternativo di un blocco «Media e testo» (DR-320). */
export function MediaTextInspector({
  block,
  onChange,
  disabled,
}: MediaTextInspectorProps): React.JSX.Element {
  const [picking, setPicking] = useState(false);
  const setProps = (props: Partial<MediaTextBlock['props']>) =>
    onChange({ ...block, props: { ...block.props, ...props } });

  return (
    <div className="amoris-inspector">
      <div>
        <Button variant="secondary" disabled={disabled} onClick={() => setPicking(true)}>
          {block.props.mediaId ? 'Cambia immagine' : 'Scegli l’immagine'}
        </Button>
      </div>
      <TextField
        label="Testo alternativo"
        value={block.props.mediaAlt}
        disabled={disabled}
        helpText="Che cosa mostra l’immagine, per chi non la vede."
        onChange={(event) => setProps({ mediaAlt: event.target.value })}
      />
      <p className="amoris-inspector__note">
        Il testo accanto all’immagine si modifica scegliendo nell’albero i blocchi che contiene.
      </p>
      {/* Montato solo mentre è aperto: scelta e ricerca non passano al cambio dopo. */}
      {picking ? (
        <ImageInsertPicker
          open
          onClose={() => setPicking(false)}
          onInsert={(mediaId, alt, decorative, mediaAlt) => {
            // Il sito usa `mediaAlt` così com'è: il testo del media confermato senza cambiarlo si copia qui (DR-321).
            setProps({
              mediaId,
              mediaAlt: decorative ? '' : alt || mediaAlt,
              mediaVariant: null,
            });
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}
