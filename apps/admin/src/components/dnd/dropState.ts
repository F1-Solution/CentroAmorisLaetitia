/**
 * Lo stato di un trascinamento a due esiti (DR-082, DR-084) e le parole che lo
 * descrivono. Funzioni pure: il componente le usa, le prove le verificano senza
 * dover simulare il puntatore.
 */
import type { DropZone } from '@amoris/ui';

export interface DropState {
  readonly activeId: string | null;
  readonly overId: string | null;
  readonly zone: DropZone;
  /** Motivo del rifiuto, o `null` se il rilascio è ammesso. */
  readonly refusal: string | null;
}

export const IDLE: DropState = { activeId: null, overId: null, zone: 'after', refusal: null };

/** Vero se `id` è l'elemento di arrivo di un trascinamento in corso, diverso da quello preso. */
export function isDropTarget(state: DropState, id: string): boolean {
  return state.activeId !== null && state.overId === id && state.activeId !== id;
}

/** Le classi dell'indicatore sulla riga `id` (DR-084). */
export function dropClassNames(state: DropState, id: string, dragging: boolean): string {
  const target = isDropTarget(state, id);
  return [
    'amoris-tree-drop',
    dragging ? 'amoris-tree-drop--dragging' : '',
    target ? `amoris-tree-drop--${state.zone}` : '',
    target && state.refusal ? 'amoris-tree-drop--refused' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** La frase che dice, prima del rilascio, dove finirà l'elemento. */
export function dropStatusText(state: DropState, describe: (id: string) => string): string {
  if (state.activeId === null) return '';
  const active = `«${describe(state.activeId)}»`;
  if (state.overId === null || state.overId === state.activeId) {
    return `${active}: scegli dove lasciarlo.`;
  }
  const target = `«${describe(state.overId)}»`;
  if (state.refusal) return `${active} non può andare qui: ${state.refusal}`;
  if (state.zone === 'inside') return `${active} andrà dentro ${target}.`;
  if (state.zone === 'before') return `${active} andrà prima di ${target}, allo stesso livello.`;
  return `${active} andrà dopo ${target}, allo stesso livello.`;
}
