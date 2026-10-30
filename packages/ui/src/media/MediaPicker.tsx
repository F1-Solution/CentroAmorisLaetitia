import { useState } from 'react';
import { SidePanel } from '../layout/SidePanel';
import { TextField } from '../primitives/TextField';
import { CheckboxField } from '../primitives/CheckboxField';
import { Button } from '../primitives/Button';
import { Spinner } from '../primitives/Spinner';
import './MediaPicker.css';

export interface MediaPickerItem {
  id: string;
  thumbnailUrl: string;
  title: string;
  /** Testo alternativo scritto nel media: si propone, senza copiarlo nel contenuto se non cambia. */
  altText?: string | null;
}

export interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  items: MediaPickerItem[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelect: (item: MediaPickerItem, alt: string, decorative: boolean) => void;
  loading?: boolean;
  errorText?: string;
  emptyText?: string;
  /** Falso quando il testo alternativo appartiene al media e non si chiede qui (immagine in evidenza). */
  requireAlt?: boolean;
}

/**
 * Componente 38: selettore di media. Apre in `SidePanel`, non in `Dialog`
 * (§6, componente 38). Il testo alternativo è obbligatorio nel momento in cui
 * il media entra nel contenuto (§9.5); l'immagine decorativa si dichiara con
 * una spunta esplicita, che produce `alt=""`.
 */
export function MediaPicker({
  open,
  onClose,
  items,
  searchValue,
  onSearchChange,
  onSelect,
  loading = false,
  errorText,
  emptyText = 'Nessun media trovato.',
  requireAlt = true,
}: MediaPickerProps): React.JSX.Element | null {
  const [selected, setSelected] = useState<MediaPickerItem | null>(null);
  const [alt, setAlt] = useState('');
  const [decorative, setDecorative] = useState(false);

  if (!open) return null;

  function selectItem(item: MediaPickerItem) {
    setSelected(item);
    setAlt(item.altText ?? '');
    setDecorative(false);
  }

  function confirm() {
    if (!selected) return;
    // Il testo del media non cambiato resta nel media: il sito lo legge a ogni resa (DR-305).
    const own = alt.trim() === (selected.altText ?? '').trim() ? '' : alt;
    onSelect(selected, requireAlt && !decorative ? own : '', requireAlt && decorative);
  }

  const canConfirm = Boolean(selected) && (!requireAlt || decorative || alt.trim().length > 0);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Scegli un media"
      loading={loading}
      {...(errorText !== undefined ? { errorText } : {})}
    >
      <div className="amoris-media-picker__search">
        <TextField
          label="Cerca media"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      {loading ? (
        <div className="amoris-media-picker__status">
          <Spinner label="Caricamento dei media in corso…" />
        </div>
      ) : items.length === 0 ? (
        // Con un errore vale solo quello: «nessun media» sarebbe falso.
        errorText ? null : (
          <p className="amoris-media-picker__status">{emptyText}</p>
        )
      ) : (
        <div className="amoris-media-picker__grid" role="listbox" aria-label="Media disponibili">
          {items.map((item) => {
            const isSelected = selected?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={[
                  'amoris-focusable',
                  'amoris-media-picker__item',
                  isSelected ? 'amoris-media-picker__item--selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => selectItem(item)}
              >
                <img className="amoris-media-picker__thumb" src={item.thumbnailUrl} alt="" />
                <span className="amoris-media-picker__item-title">{item.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <div className="amoris-media-picker__detail">
          {requireAlt ? (
            <>
              <TextField
                label="Testo alternativo"
                helpText={
                  selected.altText
                    ? 'Proposto dal media: se non lo cambi, il sito userà sempre quello del media.'
                    : "Obbligatorio, a meno che l'immagine non sia dichiarata decorativa."
                }
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                disabled={decorative}
              />
              <CheckboxField
                label="Immagine puramente decorativa (nessun testo alternativo)"
                checked={decorative}
                onChange={(event) => setDecorative(event.target.checked)}
              />
            </>
          ) : null}
          <div className="amoris-media-picker__confirm">
            <Button variant="primary" onClick={confirm} disabled={!canConfirm}>
              Usa questo media
            </Button>
          </div>
        </div>
      ) : null}
    </SidePanel>
  );
}
