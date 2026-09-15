import type { MapBlock } from '../schema/block.js';
import { blockClassName } from './class-name.js';

export interface MapComponentProps {
  readonly block: MapBlock;
}

/** La mappa vera si integra in Fase 1E; qui restano i dati testuali (§6.2). */
export function Map({ block }: MapComponentProps) {
  const { address, pins } = block.props;
  return (
    <div className={blockClassName('map', block.props.classes)} id={block.id} data-lat={block.props.lat} data-lng={block.props.lng}>
      <p>{address}</p>
      {pins.length > 0 ? (
        <ul>
          {pins.map((pin, index) =>
            pin.title !== null ? <li key={`${pin.lat}-${pin.lng}-${index}`}>{pin.title}</li> : null,
          )}
        </ul>
      ) : null}
    </div>
  );
}
