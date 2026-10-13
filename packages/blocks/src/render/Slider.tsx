'use client';

import { useState } from 'react';
import type { SliderBlock } from '../schema/block';
import { blockClassName } from './class-name';
import { imageAttributes, type MediaMap } from './media';
import type { SliderData } from './data-maps';
import { isAllowedUrl } from '../sanitize';

export interface SliderComponentProps {
  readonly block: SliderBlock;
  readonly media?: MediaMap | undefined;
  /** Le slide del carosello, dalla lettura pubblica; senza, resta il segnaposto di prima. */
  readonly slider?: SliderData | undefined;
}

/**
 * Carosello scritto nel progetto, senza libreria esterna (`PLAN.md` §5: Slider
 * Revolution non si porta). Le frecce e i punti cambiano la slide attiva; senza
 * JavaScript resta visibile la prima, come un'immagine qualunque.
 */
export function Slider({ block, media, slider }: SliderComponentProps) {
  const slides = [...(slider?.slides ?? [])].sort((a, b) => a.position - b.position);
  const [index, setIndex] = useState(0);

  if (slides.length === 0) {
    return (
      <div
        className={blockClassName('slider', block.props.classes)}
        id={block.id}
        data-slider-id={block.props.sliderId}
      />
    );
  }

  const current = ((index % slides.length) + slides.length) % slides.length;
  const go = (n: number) => setIndex(n);
  const prev = () => go(current - 1);
  const next = () => go(current + 1);

  return (
    <div
      className={blockClassName('slider', block.props.classes)}
      id={block.id}
      data-slider-id={block.props.sliderId}
    >
      <div className="blk-slider-viewport">
        {slides.map((slide, i) => {
          const image = slide.mediaId ? media?.[slide.mediaId] : undefined;
          return (
            <div
              key={`${slide.position}-${i}`}
              className="blk-slider-slide"
              data-active={i === current ? 'true' : 'false'}
              aria-hidden={i === current ? undefined : 'true'}
            >
              {image ? (
                <img alt={slide.heading ?? ''} {...imageAttributes(image)} />
              ) : (
                <img alt={slide.heading ?? ''} data-media-id={slide.mediaId ?? undefined} />
              )}
              {slide.heading !== null || slide.body !== null ? (
                <div className="blk-slider-caption">
                  {slide.heading !== null ? <h3>{slide.heading}</h3> : null}
                  {slide.body !== null ? <p>{slide.body}</p> : null}
                  {slide.linkUrl !== null && isAllowedUrl(slide.linkUrl) ? (
                    <a href={slide.linkUrl}>{slide.linkLabel ?? slide.linkUrl}</a>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {slides.length > 1 ? (
        <>
          <button
            type="button"
            className="blk-slider-prev"
            onClick={prev}
            aria-label="Slide precedente"
          >
            ‹
          </button>
          <button
            type="button"
            className="blk-slider-next"
            onClick={next}
            aria-label="Slide successiva"
          >
            ›
          </button>
          <div className="blk-slider-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className="blk-slider-dot"
                data-active={i === current ? 'true' : 'false'}
                aria-label={`Vai alla slide ${i + 1}`}
                aria-current={i === current ? 'true' : undefined}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
