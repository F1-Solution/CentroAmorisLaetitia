'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { dropZoneFor, type DropZone } from '@amoris/ui';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { IDLE, dropClassNames, dropStatusText, type DropState } from './dropState';
import './TreeDragArea.css';

/**
 * Trascinamento a due esiti, comune al menu e ai blocchi (DR-082, DR-084,
 * DR-085). La riga di arrivo si divide in fasce — sopra e sotto «accanto», al
 * centro «dentro» — e l'indicatore rientra a destra quando l'esito è «dentro».
 * Un rilascio non ammesso si vede durante il movimento e non cambia nulla.
 *
 * **Tastiera** (`design-system.md` §9.3): barra spaziatrice per prendere,
 * frecce su e giù per cambiare destinazione, destra per «dentro», sinistra per
 * «accanto», barra spaziatrice per lasciare, Esc per annullare. I bottoni delle
 * righe restano comunque.
 */

export interface TreeDragAreaProps {
  readonly canNest: (id: string) => boolean;
  readonly canDrop: (activeId: string, targetId: string, zone: DropZone) => string | null;
  readonly onDrop: (activeId: string, targetId: string, zone: DropZone) => void;
  readonly describe: (id: string) => string;
  readonly children: ReactNode;
}

interface DragContextValue {
  readonly state: DropState;
  readonly describe: (id: string) => string;
}

const DragContext = createContext<DragContextValue>({ state: IDLE, describe: (id) => id });

/** Su e giù portano alla riga precedente o successiva; destra e sinistra non muovono. */
const rowByRow: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (event.code !== 'ArrowDown' && event.code !== 'ArrowUp') return undefined;
  const tops = [...context.droppableRects.values()]
    .map((rect) => ({ x: rect.left, y: rect.top }))
    .sort((a, b) => a.y - b.y);
  const next =
    event.code === 'ArrowDown'
      ? tops.find((point) => point.y > currentCoordinates.y + 1)
      : [...tops].reverse().find((point) => point.y < currentCoordinates.y - 1);
  return next ?? currentCoordinates;
};

/** Il puntatore decide quando è sopra una riga; la tastiera usa il centro più vicino. */
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

export function TreeDragArea({
  canNest,
  canDrop,
  onDrop,
  describe,
  children,
}: TreeDragAreaProps): React.JSX.Element {
  const [state, setState] = useState<DropState>(IDLE);
  const byKeyboard = useRef(false);
  // Posizione vera del puntatore: `delta` di dnd-kit include lo scorrimento della pagina.
  const pointerY = useRef<number | null>(null);
  const stopPointer = useRef<(() => void) | null>(null);
  // Le funzioni più recenti, lette dagli ascoltatori senza doverli registrare di nuovo.
  const latest = useRef({ canNest, canDrop });
  latest.current = { canNest, canDrop };
  const stateRef = useRef(state);
  stateRef.current = state;
  const sensors = useSensors(
    // Otto pixel prima di considerarlo un trascinamento: senza, un clic su un
    // bottone della riga diventerebbe un trascinamento di un pixel.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: rowByRow }),
  );

  function evaluate(activeId: string, overId: string | null, zone: DropZone): DropState {
    if (overId === null || overId === activeId) return { activeId, overId, zone, refusal: null };
    return { activeId, overId, zone, refusal: latest.current.canDrop(activeId, overId, zone) };
  }

  // Da tastiera la fascia si sceglie con destra e sinistra.
  useEffect(() => {
    if (!byKeyboard.current || state.activeId === null) return undefined;
    function onKey(event: KeyboardEvent): void {
      setState((current) => {
        if (current.activeId === null || current.overId === null) return current;
        if (event.code === 'ArrowRight' && latest.current.canNest(current.overId)) {
          return evaluate(current.activeId, current.overId, 'inside');
        }
        if (event.code === 'ArrowLeft') return evaluate(current.activeId, current.overId, 'after');
        return current;
      });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Una registrazione per trascinamento: le funzioni si leggono da `latest`.
  }, [state.activeId]);

  // Nessun ascoltatore resta appeso se l'area sparisce durante un trascinamento.
  useEffect(() => () => stopPointer.current?.(), []);

  function finish(): void {
    stopPointer.current?.();
    stopPointer.current = null;
    setState(IDLE);
  }

  function handleStart(event: DragStartEvent): void {
    byKeyboard.current = event.activatorEvent instanceof KeyboardEvent;
    pointerY.current = byKeyboard.current ? null : (event.activatorEvent as PointerEvent).clientY;
    if (!byKeyboard.current) {
      // Registrato subito, e in cattura: è aggiornato prima che dnd-kit chiami `onDragMove`.
      const onPointer = (pointer: PointerEvent): void => {
        pointerY.current = pointer.clientY;
      };
      window.addEventListener('pointermove', onPointer, { capture: true });
      stopPointer.current = () =>
        window.removeEventListener('pointermove', onPointer, { capture: true });
    }
    setState({ ...IDLE, activeId: String(event.active.id) });
  }

  function handleMove(event: DragMoveEvent | DragOverEvent): void {
    const activeId = String(event.active.id);
    const over = event.over;
    if (!over) {
      setState((current) => ({ ...current, activeId, overId: null, refusal: null }));
      return;
    }
    const overId = String(over.id);
    if (byKeyboard.current) {
      setState((current) =>
        current.overId === overId ? current : evaluate(activeId, overId, 'after'),
      );
      return;
    }
    // Riga e puntatore misurati adesso, entrambi nella finestra.
    const row = document.querySelector(`[data-drop-id="${CSS.escape(overId)}"]`);
    const rect = row?.getBoundingClientRect() ?? over.rect;
    const y = pointerY.current ?? rect.top + rect.height / 2;
    const zone = dropZoneFor(y - rect.top, rect.height, latest.current.canNest(overId));
    setState(evaluate(activeId, overId, zone));
  }

  function handleEnd(event: DragEndEvent): void {
    // Lo stato dell'ultimo rendering, non quello di quando il gestore è nato.
    const final = stateRef.current;
    finish();
    if (!event.over || final.activeId === null || final.overId === null) return;
    if (final.overId === final.activeId || final.refusal !== null) return;
    onDrop(final.activeId, final.overId, final.zone);
  }

  return (
    <DragContext.Provider value={{ state, describe }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={handleStart}
        onDragMove={handleMove}
        // Da tastiera il passo è uno solo, e la nuova destinazione arriva qui, non in `onDragMove`.
        onDragOver={handleMove}
        onDragEnd={handleEnd}
        onDragCancel={finish}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Per spostare: barra spaziatrice, poi frecce su e giù per scegliere la destinazione, freccia destra per metterlo dentro, sinistra per metterlo accanto, barra spaziatrice per lasciarlo, Esc per annullare.',
          },
          announcements: {
            onDragStart: ({ active }) => `Preso «${describe(String(active.id))}».`,
            onDragOver: () => undefined,
            onDragMove: () => undefined,
            onDragEnd: () => 'Spostamento concluso.',
            onDragCancel: () => 'Spostamento annullato: nulla è cambiato.',
          },
        }}
      >
        {children}
        <DragOverlay>
          {state.activeId ? (
            <div className="amoris-tree-drop__overlay">{describe(state.activeId)}</div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <p className="amoris-tree-drop__status" role="status" aria-live="polite">
        {dropStatusText(state, describe)}
      </p>
    </DragContext.Provider>
  );
}

export interface DraggableTreeRowProps {
  readonly id: string;
  readonly children: ReactNode;
}

/** Una riga che si prende per la maniglia e su cui si può lasciare un'altra riga. */
export function DraggableTreeRow({ id, children }: DraggableTreeRowProps): React.JSX.Element {
  const { state, describe } = useContext(DragContext);
  const drag = useDraggable({ id });
  const drop = useDroppable({ id });

  function setRef(node: HTMLElement | null): void {
    drag.setNodeRef(node);
    drop.setNodeRef(node);
  }

  return (
    <div ref={setRef} data-drop-id={id} className={dropClassNames(state, id, drag.isDragging)}>
      <button
        type="button"
        ref={drag.setActivatorNodeRef}
        className="amoris-focusable amoris-tree-drop__handle"
        aria-label={`Prendi «${describe(id)}» per spostarlo`}
        {...drag.attributes}
        {...drag.listeners}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <div className="amoris-tree-drop__body">{children}</div>
    </div>
  );
}
