'use client';

import { useState } from 'react';
import type { MapBlock } from '../schema/block';
import { blockClassName } from './class-name';

export interface MapComponentProps {
  readonly block: MapBlock;
}

/** Zoom predefinito del modulo mappa di Divi (`Map.php`). */
const DEFAULT_ZOOM = 18;

/** L'incorporazione di Google Maps senza chiave (DR-121): la sorgente usa Google Maps. */
function googleEmbedUrl(lat: number, lng: number, zoom: number): string {
  const query = new URLSearchParams({ q: `${lat},${lng}`, z: String(zoom), output: 'embed' });
  return `https://maps.google.com/maps?${query.toString()}`;
}

/**
 * Nessuna chiamata a terzi al caricamento (DR-107): prima dell'azione la mappa
 * resta una copertina testuale; al clic si carica l'incorporazione — unica
 * chiamata esterna, e solo allora.
 */
export function Map({ block }: MapComponentProps) {
  const [loaded, setLoaded] = useState(false);
  const { address, lat, lng, zoom, pins, classes } = block.props;
  const latNum = Number.parseFloat(lat);
  const lngNum = Number.parseFloat(lng);
  const canEmbed = Number.isFinite(latNum) && Number.isFinite(lngNum);

  return (
    <div className={blockClassName('map', classes)} id={block.id} data-lat={lat} data-lng={lng}>
      {loaded && canEmbed ? (
        <iframe
          className="blk-map-frame"
          title="Mappa"
          src={googleEmbedUrl(latNum, lngNum, zoom ?? DEFAULT_ZOOM)}
        />
      ) : (
        <button
          type="button"
          className="blk-map-cover"
          onClick={() => setLoaded(true)}
          disabled={!canEmbed}
        >
          <span className="blk-map-placeholder" aria-hidden="true" />
          <span>Mostra la mappa</span>
        </button>
      )}
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
