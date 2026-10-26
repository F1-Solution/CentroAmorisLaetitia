import { api } from '../../lib/api';
import { messageOf } from '../documents/documentModel';

/** Un carosello come lo restituisce `GET /sliders`. */
export interface SliderSummary {
  readonly id: string;
  readonly title: string;
  readonly slideCount: number;
  readonly usedInCount: number;
  readonly updatedAt: string;
}

export interface SliderSlide {
  readonly id: string;
  readonly position: number;
  readonly mediaId: string | null;
  readonly heading: string | null;
  readonly body: string | null;
  readonly image: { readonly fileName: string; readonly publicPath: string } | null;
}

/** Un carosello come lo restituisce `GET /sliders/:id`. */
export interface EditorialSlider {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly slides: readonly SliderSlide[];
  readonly usedIn: readonly {
    readonly id: string;
    readonly title: string;
    readonly type: string;
  }[];
}

export { messageOf };

export function listSliders(signal?: AbortSignal): Promise<SliderSummary[]> {
  return api<SliderSummary[]>('/sliders', signal ? { signal } : undefined);
}
