'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { BlockTreeListRenderProps, BlockTreeRowRenderProps } from '@amoris/ui';
import type { ReactNode } from 'react';
import './BlockTreeDnd.css';

/**
 * Il trascinamento dei blocchi (DR-069).
 *
 * Sta qui e non in `packages/ui` perché `PLAN.md` §5 colloca `@dnd-kit` in
 * `apps/admin`: l'albero resta un componente senza dipendenze e riceve dal di
 * fuori due involucri, uno per l'elenco e uno per la riga.
 *
 * **Il percorso da tastiera non è un ripiego.** `design-system.md` §9.3 chiede
 * che ogni operazione sia raggiungibile da tastiera, e qui ci sono due strade,
 * non una: il `KeyboardSensor` di `@dnd-kit` — spazio per prendere il blocco,
 * frecce per spostarlo, spazio per posarlo — e i bottoni «Sposta su» e «Sposta
 * giù» che l'albero disegna comunque. Se la libreria non si monta, la seconda
 * funziona lo stesso.
 */

export interface BlockTreeDragAreaProps {
  /** Riceve il blocco preso e quello su cui è stato lasciato. */
  readonly onDrop: (activeId: string, overId: string) => void;
  readonly children: ReactNode;
}

export function BlockTreeDragArea({ onDrop, children }: BlockTreeDragAreaProps): React.JSX.Element {
  const sensors = useSensors(
    // Otto pixel prima di considerarlo un trascinamento: senza, un clic sul
    // bottone «Elimina» dentro la riga diventerebbe un trascinamento di un
    // pixel e il clic non arriverebbe mai.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event;
    if (!over) return;
    onDrop(String(active.id), String(over.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}

/**
 * Un `SortableContext` per ogni gruppo di fratelli. Sono più d'uno perché
 * l'albero è annidato, ed è anche ciò che rende naturale rifiutare uno
 * spostamento fra contenitori diversi: `moveBlockOnto` lo controlla comunque,
 * perché la decisione non può dipendere dalla libreria.
 */
export function SortableSiblings({ ids, children }: BlockTreeListRenderProps): React.JSX.Element {
  return (
    <SortableContext items={[...ids]} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

export function SortableBlockRow({ id, children }: BlockTreeRowRenderProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  // `@dnd-kit/utilities` farebbe la stessa cosa in una riga, ma è un pacchetto
  // in più che nessuna decisione autorizza: DR-069 nomina `core` e `sortable`.
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: transition ?? undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={['amoris-block-drag', isDragging ? 'amoris-block-drag--active' : ''].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className="amoris-focusable amoris-block-drag__handle"
        aria-label="Prendi il blocco per spostarlo. Con la tastiera: barra spaziatrice, poi frecce."
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <div className="amoris-block-drag__body">{children}</div>
    </li>
  );
}
