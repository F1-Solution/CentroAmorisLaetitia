'use client';

import { Alert, Button, TextArea, TextField } from '@amoris/ui';

/** Una slide come la mostra la schermata: i campi sono quelli che si salvano. */
export interface SlideDraft {
  readonly key: string;
  readonly id?: string;
  readonly mediaId: string | null;
  readonly heading: string;
  readonly body: string;
  readonly imageUrl: string | null;
  readonly fileName: string | null;
}

export interface SlideFieldErrors {
  readonly heading?: string;
  readonly body?: string;
}

export interface SliderSlideRowProps {
  readonly slide: SlideDraft;
  readonly index: number;
  readonly total: number;
  readonly canWrite: boolean;
  readonly busy: boolean;
  readonly errors: SlideFieldErrors;
  readonly onChange: (patch: Partial<Pick<SlideDraft, 'heading' | 'body'>>) => void;
  readonly onMove: (delta: number) => void;
  readonly onPickImage: () => void;
  readonly onRemove: () => void;
  /** Riferimento alla riga, per rimettere il focus su un suo comando dopo uno spostamento o una rimozione. */
  readonly rowRef?: (element: HTMLDivElement | null) => void;
}

/** Riga di una slide: miniatura, «Titolo», «Testo» e i comandi per spostarla, cambiarla o toglierla. */
export function SliderSlideRow({
  slide,
  index,
  total,
  canWrite,
  busy,
  errors,
  onChange,
  onMove,
  onPickImage,
  onRemove,
  rowRef,
}: SliderSlideRowProps): React.JSX.Element {
  const locked = !canWrite || busy;
  return (
    <div
      ref={rowRef}
      role="group"
      aria-label={`Slide ${index + 1}`}
      className="amoris-slider__slide"
    >
      <div className="amoris-slider__media">
        {slide.imageUrl ? (
          <img
            className="amoris-slider__thumb"
            src={slide.imageUrl}
            alt={`Anteprima: ${slide.fileName ?? `slide ${index + 1}`}`}
          />
        ) : (
          <Alert variant="warning" title="Immagine mancante">
            Scegli un’immagine o togli questa slide per poter salvare.
          </Alert>
        )}
      </div>
      <div className="amoris-slider__fields">
        <TextField
          label="Titolo"
          value={slide.heading}
          disabled={locked}
          helpText="È anche la descrizione dell’immagine per chi usa un lettore di schermo."
          {...(errors.heading ? { errorText: errors.heading } : {})}
          onChange={(event) => onChange({ heading: event.target.value })}
        />
        <TextArea
          label="Testo"
          value={slide.body}
          disabled={locked}
          rows={2}
          {...(errors.body ? { errorText: errors.body } : {})}
          onChange={(event) => onChange({ body: event.target.value })}
        />
        <div className="amoris-slider__actions">
          <Button
            variant="tertiary"
            permitted={canWrite}
            disabled={busy || index === 0}
            data-command="up"
            onClick={() => onMove(-1)}
          >
            Sposta su
          </Button>
          <Button
            variant="tertiary"
            permitted={canWrite}
            disabled={busy || index === total - 1}
            data-command="down"
            onClick={() => onMove(1)}
          >
            Sposta giù
          </Button>
          <Button
            variant="secondary"
            permitted={canWrite}
            disabled={busy}
            data-command="image"
            onClick={onPickImage}
          >
            Cambia immagine
          </Button>
          <Button
            variant="tertiary"
            permitted={canWrite}
            disabled={busy || total === 1}
            data-command="remove"
            onClick={onRemove}
          >
            Togli
          </Button>
        </div>
      </div>
    </div>
  );
}
