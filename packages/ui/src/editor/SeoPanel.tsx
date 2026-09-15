import { TextField } from '../primitives/TextField.js';
import { TextArea } from '../primitives/TextArea.js';
import { Button } from '../primitives/Button.js';
import './SeoPanel.css';

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

export interface SeoPanelProps {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  /** Indirizzo mostrato nell'anteprima del risultato di ricerca. */
  resultUrl: string;
  shareImageAlt?: string;
  onPickShareImage?: () => void;
  disabled?: boolean;
  titleErrorText?: string;
  descriptionErrorText?: string;
}

/** Componente 47: titolo, descrizione, immagine di condivisione, conteggio caratteri, anteprima. */
export function SeoPanel({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  resultUrl,
  shareImageAlt,
  onPickShareImage,
  disabled = false,
  titleErrorText,
  descriptionErrorText,
}: SeoPanelProps): React.JSX.Element {
  return (
    <div className="amoris-seo-panel">
      <div>
        <TextField
          label="Titolo SEO"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={disabled}
          {...(titleErrorText !== undefined ? { errorText: titleErrorText } : {})}
        />
        <p className={['amoris-seo-panel__count', title.length > TITLE_MAX ? 'amoris-seo-panel__count--over' : ''].filter(Boolean).join(' ')}>
          {title.length} / {TITLE_MAX} caratteri
        </p>
      </div>

      <div>
        <TextArea
          label="Descrizione SEO"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          disabled={disabled}
          {...(descriptionErrorText !== undefined ? { errorText: descriptionErrorText } : {})}
        />
        <p className={['amoris-seo-panel__count', description.length > DESCRIPTION_MAX ? 'amoris-seo-panel__count--over' : ''].filter(Boolean).join(' ')}>
          {description.length} / {DESCRIPTION_MAX} caratteri
        </p>
      </div>

      {onPickShareImage ? (
        <Button variant="secondary" onClick={onPickShareImage} disabled={disabled}>
          {shareImageAlt ? 'Cambia immagine di condivisione' : 'Scegli immagine di condivisione'}
        </Button>
      ) : null}

      <div className="amoris-seo-panel__preview" aria-label="Anteprima del risultato di ricerca">
        <p className="amoris-seo-panel__preview-url">{resultUrl}</p>
        <p className="amoris-seo-panel__preview-title">{title || 'Titolo non ancora impostato'}</p>
        <p className="amoris-seo-panel__preview-description">{description || 'Descrizione non ancora impostata.'}</p>
      </div>
    </div>
  );
}
