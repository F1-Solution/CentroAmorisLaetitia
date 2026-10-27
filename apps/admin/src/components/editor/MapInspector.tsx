'use client';

import { latLngPattern, type MapBlock, type MapPin } from '@amoris/blocks';
import { Button, CheckboxField, FieldGroup, TextField } from '@amoris/ui';
import { CheckedTextField } from './embedInspectorParts';

export interface MapInspectorProps {
  readonly block: MapBlock;
  readonly onChange: (next: MapBlock) => void;
  readonly disabled: boolean;
}

/** La scala di grigi è anche una classe dichiarata (§7.2): le due cose cambiano insieme. */
const GRAYSCALE_CLASS = 'map-grayscale';

const coordinateProblem = (name: string) => (text: string) =>
  latLngPattern.test(text) ? null : `${name} è un numero con il punto decimale, per esempio 41.9.`;

/** Un intero fra `min` e `max`, o vuoto: `undefined` se il testo non è ammesso. */
function optionalInteger(text: string, min: number, max: number): number | null | undefined {
  if (text.trim() === '') return null;
  if (!/^\d+$/.test(text.trim())) return undefined;
  const value = Number(text);
  return value >= min && value <= max ? value : undefined;
}

/** Indirizzo, coordinate, zoom, interruttori e segnaposto di un blocco «Mappa» (DR-279). */
export function MapInspector({ block, onChange, disabled }: MapInspectorProps): React.JSX.Element {
  const { props } = block;
  const setProps = (next: Partial<MapBlock['props']>) =>
    onChange({ ...block, props: { ...props, ...next } });
  const setPin = (index: number, next: Partial<MapPin>) =>
    setProps({ pins: props.pins.map((pin, i) => (i === index ? { ...pin, ...next } : pin)) });

  return (
    <div className="amoris-inspector">
      <CheckedTextField
        label="Indirizzo"
        value={props.address}
        disabled={disabled}
        validate={(text) => (text.trim() === '' ? 'L’indirizzo non può restare vuoto.' : null)}
        onCommit={(address) => setProps({ address })}
      />
      <CheckedTextField
        label="Latitudine"
        value={props.lat}
        disabled={disabled}
        inputMode="decimal"
        validate={coordinateProblem('La latitudine')}
        onCommit={(lat) => setProps({ lat })}
      />
      <CheckedTextField
        label="Longitudine"
        value={props.lng}
        disabled={disabled}
        inputMode="decimal"
        validate={coordinateProblem('La longitudine')}
        onCommit={(lng) => setProps({ lng })}
      />
      <CheckedTextField
        label="Zoom"
        type="number"
        min={1}
        max={21}
        value={props.zoom === null ? '' : String(props.zoom)}
        disabled={disabled}
        helpText="Da 1 (il mondo) a 21 (la strada); vuoto per quello predefinito, 18."
        validate={(text) =>
          optionalInteger(text, 1, 21) === undefined
            ? 'Lo zoom è un numero intero da 1 a 21, o vuoto.'
            : null
        }
        onCommit={(text) => setProps({ zoom: optionalInteger(text, 1, 21) ?? null })}
      />
      <CheckboxField
        label="Rotella del mouse per lo zoom"
        checked={props.mouseWheel}
        disabled={disabled}
        onChange={(event) => setProps({ mouseWheel: event.target.checked })}
      />
      <CheckboxField
        label="Trascinamento sui telefoni"
        checked={props.mobileDragging}
        disabled={disabled}
        onChange={(event) => setProps({ mobileDragging: event.target.checked })}
      />
      <CheckboxField
        label="Scala di grigi"
        checked={props.grayscale}
        disabled={disabled}
        onChange={(event) => {
          const others = props.classes.filter((name) => name !== GRAYSCALE_CLASS);
          setProps({
            grayscale: event.target.checked,
            classes: event.target.checked ? [...others, GRAYSCALE_CLASS] : others,
          });
        }}
      />
      <CheckedTextField
        label="Quantità di grigio (%)"
        type="number"
        min={0}
        max={100}
        value={props.grayscaleAmount === null ? '' : String(props.grayscaleAmount)}
        disabled={disabled || !props.grayscale}
        validate={(text) =>
          optionalInteger(text, 0, 100) === undefined
            ? 'La quantità di grigio è un numero intero da 0 a 100, o vuoto.'
            : null
        }
        onCommit={(text) => setProps({ grayscaleAmount: optionalInteger(text, 0, 100) ?? null })}
      />
      {props.pins.map((pin, index) => (
        // La chiave cambia quando si aggiunge o si toglie: i campi ripartono dai valori del segnaposto.
        <FieldGroup
          key={`${index}-${props.pins.length}`}
          title={`Segnaposto ${index + 1}`}
          disabled={disabled}
        >
          <TextField
            label="Titolo"
            value={pin.title ?? ''}
            onChange={(event) =>
              setPin(index, { title: event.target.value === '' ? null : event.target.value })
            }
          />
          <CheckedTextField
            label="Latitudine del segnaposto"
            value={pin.lat}
            inputMode="decimal"
            validate={coordinateProblem('La latitudine')}
            onCommit={(lat) => setPin(index, { lat })}
          />
          <CheckedTextField
            label="Longitudine del segnaposto"
            value={pin.lng}
            inputMode="decimal"
            validate={coordinateProblem('La longitudine')}
            onCommit={(lng) => setPin(index, { lng })}
          />
          {pin.html !== null ? (
            <p className="amoris-inspector__note">
              Il testo del fumetto di questo segnaposto viene dal sito di partenza e non si modifica
              qui.
            </p>
          ) : null}
          <Button
            variant="tertiary"
            onClick={() => setProps({ pins: props.pins.filter((_, i) => i !== index) })}
          >
            Togli il segnaposto
          </Button>
        </FieldGroup>
      ))}
      <div>
        <Button
          variant="secondary"
          disabled={disabled}
          onClick={() =>
            setProps({
              pins: [...props.pins, { title: null, lat: props.lat, lng: props.lng, html: null }],
            })
          }
        >
          Aggiungi un segnaposto
        </Button>
      </div>
    </div>
  );
}
