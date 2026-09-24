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

  it('con `renderList` e `renderRow` il trascinamento si innesta dall’esterno', () => {
    const { container } = render(
      <BlockTreeEditor
        blocks={blocks}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onDelete={vi.fn()}
        onAddRequest={vi.fn()}
        renderList={({ ids, children }) => (
          <div data-drag-wrapper="lista" data-ids={ids.join(',')}>
            {children}
          </div>
        )}
        renderRow={({ id, children }) => (
          <li data-drag-wrapper="riga" data-id={id}>
            {children}
          </li>
        )}
      />,
    );
    // L'elenco e ogni riga passano dagli involucri, che è ciò che permette a
    // `apps/admin` di montarvi la libreria senza che `packages/ui` la conosca.
    expect(container.querySelector('[data-drag-wrapper="lista"]')?.getAttribute('data-ids')).toBe(
      'b1,b2',
    );
    expect(container.querySelectorAll('[data-drag-wrapper="riga"]').length).toBe(2);
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
