import { useState, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockTreeEditor } from '../src/editor/BlockTreeEditor.js';
import type { BlockNode } from '../src/editor/BlockTreeEditor.js';

const blocks: BlockNode[] = [
  { id: 'b1', type: 'rich_text', label: 'Introduzione' },
  { id: 'b2', type: 'image', label: 'Facciata del centro' },
];

describe('BlockTreeEditor — componente 41', () => {
  it('stato R: rende i blocchi', () => {
    render(
      <BlockTreeEditor
        blocks={blocks}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={vi.fn()}
        onAddRequest={vi.fn()}
      />,
    );
    expect(screen.getByText(/Introduzione/)).toBeDefined();
    expect(screen.getByText(/Facciata del centro/)).toBeDefined();
  });

  it('stato V: colonna vuota', () => {
    render(
      <BlockTreeEditor
        blocks={[]}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={vi.fn()}
        onAddRequest={vi.fn()}
      />,
    );
    expect(screen.getByText('Questa colonna non contiene ancora blocchi.')).toBeDefined();
  });

  // Riscritto il 2026-09-21. Diceva «non con il trascinamento» e verificava
  // l'assenza di `draggable`: DR-069 ha scelto il trascinamento, quindi quella
  // attesa non descrive più il prodotto. Ciò che resta vero, e che il §9.3 del
  // sistema di design impone, è che lo stesso spostamento si faccia **anche**
  // da tastiera: è questo che il test verifica adesso.
  it('sposta un blocco con un comando raggiungibile da tastiera', () => {
    const onMoveDown = vi.fn();
    render(
      <BlockTreeEditor
        blocks={blocks}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={onMoveDown}
        onDelete={vi.fn()}
        onAddRequest={vi.fn()}
      />,
    );
    const moveDownButton = screen.getByRole('button', { name: 'Sposta giù: Introduzione' });
    expect(moveDownButton.tagName).toBe('BUTTON');
    moveDownButton.click();
    expect(onMoveDown).toHaveBeenCalledWith('b1');
  });

  it('senza involucri di trascinamento l’albero resta un elenco semplice', () => {
    const { container } = render(
      <BlockTreeEditor
        blocks={blocks}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={vi.fn()}
        onAddRequest={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('ul.amoris-block-tree').length).toBe(1);
    expect(container.querySelector('[data-drag-wrapper]')).toBeNull();
  });

  it('con `renderRow` il trascinamento avvolge la sola riga, dall’esterno (DR-085)', () => {
    const { container } = render(
      <BlockTreeEditor
        blocks={blocks}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={vi.fn()}
        onAddRequest={vi.fn()}
        renderRow={({ id, children }) => (
          <div data-drag-wrapper="riga" data-id={id}>
            {children}
          </div>
        )}
      />,
    );
    // Ogni riga passa dall'involucro, che è ciò che permette a `apps/admin` di
    // montarvi la libreria senza che `packages/ui` la conosca; l'elemento
    // dell'elenco resta del componente, e l'involucro misura la sola riga.
    const wrappers = container.querySelectorAll('[data-drag-wrapper="riga"]');
    expect(wrappers.length).toBe(2);
    expect(wrappers[0]?.parentElement?.tagName).toBe('LI');
    expect(wrappers[0]?.querySelector('ul')).toBeNull();
  });

  it("il primo blocco non può salire, l'ultimo non può scendere", () => {
    render(
      <BlockTreeEditor
        blocks={blocks}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={vi.fn()}
        onAddRequest={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sposta su: Introduzione' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Sposta giù: Facciata del centro' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('eliminare un blocco richiama il gestore', () => {
    const onDelete = vi.fn();
    render(
      <BlockTreeEditor
        blocks={blocks}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={onDelete}
        onAddRequest={vi.fn()}
      />,
    );
    screen.getByRole('button', { name: 'Elimina: Introduzione' }).click();
    expect(onDelete).toHaveBeenCalledWith('b1');
  });

  it('stato E: errore', () => {
    render(
      <BlockTreeEditor
        blocks={blocks}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={vi.fn()}
        onAddRequest={vi.fn()}
        errorText="Impossibile caricare i blocchi."
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Impossibile caricare i blocchi.');
  });

  it("annida un blocco chiedendo l'inserimento dentro un contenitore", () => {
    const onAddRequest = vi.fn();
    const nested: BlockNode[] = [
      { id: 'c1', type: 'media_text', label: 'Media e testo', children: [] },
    ];
    render(
      <BlockTreeEditor
        blocks={nested}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={vi.fn()}
        onAddRequest={onAddRequest}
      />,
    );
    screen.getByRole('button', { name: 'Aggiungi blocco in «Media e testo»' }).click();
    expect(onAddRequest).toHaveBeenCalledWith('c1');
  });
});

describe('BlockTreeEditor — un involucro con hook si rende come componente', () => {
  it('aggiungere un blocco non rompe l’ordine degli hook (React #310)', () => {
    function RigaConHook({ id, children }: { id: string; children: ReactNode }) {
      const [visto] = useState(id);
      return <div data-riga={visto}>{children}</div>;
    }
    const props = {
      onSelect: vi.fn(),
      onMoveUp: vi.fn(),
      onMoveDown: vi.fn(),
      onDelete: vi.fn(),
      onAddRequest: vi.fn(),
      renderRow: RigaConHook,
    };
    const uno: BlockNode = { id: 'x1', type: 'rich_text', label: 'Uno' };
    const due: BlockNode = { id: 'x2', type: 'separator', label: 'Due' };
    const { rerender, container } = render(<BlockTreeEditor {...props} blocks={[uno]} />);
    rerender(<BlockTreeEditor {...props} blocks={[uno, due]} />);
    expect(container.querySelectorAll('[data-riga]').length).toBe(2);
  });
});
