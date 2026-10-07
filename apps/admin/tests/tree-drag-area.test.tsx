import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DraggableTreeRow, TreeDragArea } from '../src/components/dnd/TreeDragArea';

/**
 * Il trascinamento da tastiera (DR-082, `design-system.md` §9.3), senza
 * geometria: qui si prova che prendere e annullare dicano la cosa giusta e non
 * cambino nulla. La scelta della destinazione dipende dalle misure vere delle
 * righe, e si prova nel browser (`tests/e2e/cms/trascinamento.spec.ts`).
 */

const labels: Record<string, string> = { a: 'Chi siamo', b: 'Contatti' };

function renderArea(onDrop = vi.fn()) {
  render(
    <TreeDragArea
      canNest={() => true}
      canDrop={() => null}
      onDrop={onDrop}
      describe={(id) => labels[id] ?? id}
    >
      <ul>
        {Object.keys(labels).map((id) => (
          <li key={id}>
            <DraggableTreeRow id={id}>
              <span>{labels[id]}</span>
            </DraggableTreeRow>
          </li>
        ))}
      </ul>
    </TreeDragArea>,
  );
  return onDrop;
}

function status(): HTMLElement {
  const element = document.querySelector<HTMLElement>('.amoris-tree-drop__status');
  if (!element) throw new Error('regione di stato assente');
  return element;
}

describe('TreeDragArea — tastiera', () => {
  it('ogni riga ha una maniglia con il nome della voce', () => {
    renderArea();
    expect(screen.getByRole('button', { name: 'Prendi «Chi siamo» per spostarlo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Prendi «Contatti» per spostarlo' })).toBeDefined();
    expect(status().textContent).toBe('');
  });

  it('la barra spaziatrice prende la voce, Esc annulla e nulla cambia', async () => {
    const onDrop = renderArea();
    const handle = screen.getByRole('button', { name: 'Prendi «Chi siamo» per spostarlo' });
    handle.focus();

    await act(async () => {
      fireEvent.keyDown(handle, { code: 'Space', key: ' ' });
    });
    expect(status().textContent).toContain('«Chi siamo»');
    expect(handle.closest('.amoris-tree-drop')?.className).toContain('amoris-tree-drop--dragging');

    // dnd-kit ascolta la tastiera sul documento, e comincia un istante dopo la presa.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      fireEvent.keyDown(document, { code: 'Escape', key: 'Escape' });
    });
    expect(status().textContent).toBe('');
    expect(onDrop).not.toHaveBeenCalled();
  });
});
