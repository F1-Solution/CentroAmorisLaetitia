'use client';

import type { ImageBlock } from '@amoris/blocks';
import { Alert, Button, CheckboxField, TextArea, TextField } from '@amoris/ui';
import { useState } from 'react';
import { ImageInsertPicker } from './ImageInsertPicker';

export interface ImageInspectorProps {
  readonly block: ImageBlock;
  readonly onChange: (next: ImageBlock) => void;
  readonly disabled: boolean;
}

/** Testi e file di un blocco «Immagine»: testo alternativo e didascalia vuoti si leggono da «Media» (DR-305). */
export function ImageInspector({
  block,
  onChange,
  disabled,
}: ImageInspectorProps): React.JSX.Element {
  const [picking, setPicking] = useState(false);
  const decorative = block.props.decorative === true;
  // I blocchi importati non leggono la didascalia del media (DR-312).
  const imported = block.props.useMediaCaption === false;
  const setProps = (props: Partial<ImageBlock['props']>) =>
    onChange({ ...block, props: { ...block.props, ...props } });

  return (
    <div className="amoris-inspector">
      <div>
        <Button variant="secondary" disabled={disabled} onClick={() => setPicking(true)}>
          Cambia immagine
        </Button>
      </div>
      <TextField
        label="Testo alternativo"
        value={decorative ? '' : block.props.alt}
        disabled={disabled || decorative}
        helpText="Che cosa mostra l’immagine, per chi non la vede. Se lo lasci vuoto, il sito usa quello scritto in Media."
        onChange={(event) => setProps({ alt: event.target.value })}
      />
      <CheckboxField
        label="Immagine puramente decorativa (nessun testo alternativo)"
        checked={decorative}
        disabled={disabled}
        onChange={(event) =>
          setProps(event.target.checked ? { decorative: true, alt: '' } : { decorative: false })
        }
      />
      <TextField
        label="Titolo"
        value={block.props.title ?? ''}
        disabled={disabled}
        onChange={(event) =>
          setProps({ title: event.target.value === '' ? null : event.target.value })
        }
      />
      <TextArea
        label="Didascalia"
        value={block.props.caption ?? ''}
        disabled={disabled}
        helpText={
          imported
            ? 'Se la lasci vuota, sotto l’immagine non compare nessuna didascalia, come nel sito precedente.'
            : 'Se la lasci vuota, il sito usa quella scritta in Media.'
        }
        onChange={(event) =>
          setProps({ caption: event.target.value === '' ? null : event.target.value })
        }
      />
      <Alert variant="info" title="Due modi per cambiare il file">
        «Cambia immagine» cambia il file solo di questo blocco; «Sostituisci il file» in Corredo ›
        Media lo cambia in tutte le pagine che usano l’immagine.
      </Alert>
      {/* Montato solo mentre è aperto: scelta e ricerca non passano al cambio dopo. */}
      {picking ? (
        <ImageInsertPicker
          open
          onClose={() => setPicking(false)}
          onInsert={(mediaId, alt, isDecorative) => {
            setProps({
              mediaId,
              src: null,
              variant: null,
              alt,
              decorative: isDecorative,
              title: null,
              caption: null,
              useMediaCaption: undefined,
            });
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}
