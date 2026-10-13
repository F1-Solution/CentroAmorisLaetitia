'use client';

import { useState } from 'react';
import type { VideoBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { imageAttributes, type MediaMap } from './media';
import { isAllowedUrl } from '../sanitize';

export interface VideoComponentProps {
  readonly block: VideoBlock;
  readonly media?: MediaMap | undefined;
}

function youTubeId(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null;
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

function vimeoId(src: string): string | null {
  try {
    const url = new URL(src);
    return /^\/(\d+)/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Nessuna chiamata a terzi al caricamento (DR-107): prima dell'azione compare
 * solo una copertina equivalente; il player — e la sola chiamata esterna —
 * arrivano al clic, come approvato dall'utente per video e mappa.
 */
export function Video({ block, media }: VideoComponentProps) {
  const [loaded, setLoaded] = useState(false);
  const { src, provider, posterMediaId, posterSrc, classes } = block.props;
  const poster = posterMediaId !== null ? media?.[posterMediaId] : undefined;

  if (!loaded) {
    return (
      <div
        className={blockClassName('video', classes)}
        id={block.id}
        data-src={src}
        data-provider={provider}
      >
        <button
          type="button"
          className="blk-video-cover"
          onClick={() => setLoaded(true)}
          aria-label="Riproduci video"
        >
          {poster ? (
            <img alt="" {...imageAttributes(poster)} />
          ) : posterSrc && isAllowedUrl(posterSrc) ? (
            <img alt="" src={posterSrc} />
          ) : (
            <span className="blk-video-placeholder" data-media-id={posterMediaId ?? undefined} />
          )}
          <span className="blk-video-play" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const player =
    provider === 'youtube' && youTubeId(src) ? (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youTubeId(src)}?autoplay=1`}
        title="Video"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    ) : provider === 'vimeo' && vimeoId(src) ? (
      <iframe
        src={`https://player.vimeo.com/video/${vimeoId(src)}?autoplay=1`}
        title="Video"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    ) : provider === 'file' ? (
      // Sottotitoli non misurati sulla sorgente: nessun file ne ha mai avuti (§1.2).
      <video src={src} controls autoPlay />
    ) : isAllowedUrl(src) ? (
      <a href={src} target="_blank" rel="noopener noreferrer">
        Apri il video
      </a>
    ) : null;

  return (
    <div
      className={blockClassName('video', classes)}
      id={block.id}
      data-src={src}
      data-provider={provider}
      data-loaded="true"
    >
      {player}
    </div>
  );
}
