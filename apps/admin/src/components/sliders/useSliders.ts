'use client';

import { useEffect, useState } from 'react';
import { listSliders, messageOf, type SliderSummary } from './sliderModel';

export interface SlidersState {
  readonly sliders: readonly SliderSummary[] | null;
  readonly error: string | null;
}

/** I caroselli esistenti, caricati una volta quando `active` è vero. */
export function useSliders(active = true): SlidersState {
  const [state, setState] = useState<SlidersState>({ sliders: null, error: null });

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const sliders = await listSliders(controller.signal);
        if (!controller.signal.aborted) setState({ sliders, error: null });
      } catch (caught) {
        if (!controller.signal.aborted) setState({ sliders: null, error: messageOf(caught) });
      }
    })();
    return () => controller.abort();
  }, [active]);

  return state;
}
