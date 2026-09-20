import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Button } from '../primitives/Button';
import './MediaUploader.css';

export interface UploadingFile {
  id: string;
  name: string;
  /** 0-100. */
  progress: number;
  status: 'uploading' | 'done' | 'error';
  errorText?: string;
}

export interface MediaUploaderProps {
  files: UploadingFile[];
  onFilesSelected: (files: FileList) => void;
  disabled?: boolean;
}

/**
 * Componente 39: caricamento con trascinamento e da pulsante, avanzamento e
 * errori per file. Il trascinamento usa i soli eventi nativi del browser
 * (`dragover`/`drop`), non una libreria: la scelta senza trascinamento del
 * vincolo di prodotto riguarda il riordino dei blocchi (`BlockTreeEditor`),
 * non il caricamento di file, che è un'interazione diversa e comune nel web.
 */
export function MediaUploader({ files, onFilesSelected, disabled = false }: MediaUploaderProps): React.JSX.Element {
  const [isOver, setIsOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsOver(false);
    if (disabled) return;
    if (event.dataTransfer.files.length > 0) onFilesSelected(event.dataTransfer.files);
  }

  return (
    <div>
      <div
        className={['amoris-media-uploader__dropzone', isOver ? 'amoris-media-uploader__dropzone--over' : '']
          .filter(Boolean)
          .join(' ')}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
      >
        <p className="amoris-media-uploader__hint">Trascina qui i file, oppure</p>
        <Button variant="secondary" disabled={disabled} onClick={() => inputRef.current?.click()}>
          Scegli i file
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          aria-label="Scegli i file da caricare"
          className="amoris-media-uploader__input"
          disabled={disabled}
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) onFilesSelected(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="amoris-media-uploader__list">
          {files.map((file) => (
            <li
              key={file.id}
              className={[
                'amoris-media-uploader__file',
                file.status === 'error' ? 'amoris-media-uploader__file--error' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <span className="amoris-media-uploader__file-name">{file.name}</span>
              <div
                className="amoris-media-uploader__progress-track"
                role="progressbar"
                aria-valuenow={file.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Avanzamento di ${file.name}`}
              >
                <div className="amoris-media-uploader__progress-fill" style={{ width: `${file.progress}%` }} />
              </div>
              {file.status === 'error' && file.errorText ? (
                <p className="amoris-media-uploader__file-error" role="alert">
                  {file.errorText}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
