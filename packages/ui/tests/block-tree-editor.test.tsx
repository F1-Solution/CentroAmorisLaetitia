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
      <BlockTreeEditor blocks={blocks} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onDelete={vi.fn()} onAddRequest={vi.fn()} />,
    );
    expect(screen.getByText(/Introduzione/)).toBeDefined();
    expect(screen.getByText(/Facciata del centro/)).toBeDefined();
  });

  it('stato V: colonna vuota', () => {
    render(
      <BlockTreeEditor blocks={[]} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onDelete={vi.fn()} onAddRequest={vi.fn()} />,
    );
    expect(screen.getByText('Questa colonna non contiene ancora blocchi.')).toBeDefined();
  });

  it('sposta un blocco con comandi espliciti, non con il trascinamento', () => {
    const onMoveDown = vi.fn();
    render(
      <BlockTreeEditor blocks={blocks} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={onMoveDown} onDelete={vi.fn()} onAddRequest={vi.fn()} />,
    );
    const moveDownButton = screen.getByRole('button', { name: 'Sposta giù: Introduzione' });
    // Nessun trascinamento: né l'elemento né i suoi antenati sono `draggable`.
    expect(moveDownButton.closest('[draggable="true"]')).toBeNull();
    moveDownButton.click();
    expect(onMoveDown).toHaveBeenCalledWith('b1');
  });

  it('il primo blocco non può salire, l\'ultimo non può scendere', () => {
    render(
      <BlockTreeEditor blocks={blocks} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onDelete={vi.fn()} onAddRequest={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Sposta su: Introduzione' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Sposta giù: Facciata del centro' })).toHaveProperty('disabled', true);
  });

  it('eliminare un blocco richiama il gestore', () => {
    const onDelete = vi.fn();
    render(
      <BlockTreeEditor blocks={blocks} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onDelete={onDelete} onAddRequest={vi.fn()} />,
    );
    screen.getByRole('button', { name: 'Elimina: Introduzione' }).click();
    expect(onDelete).toHaveBeenCalledWith('b1');
  });

  it('stato E: errore', () => {
    render(
      <BlockTreeEditor blocks={blocks} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onDelete={vi.fn()} onAddRequest={vi.fn()} errorText="Impossibile caricare i blocchi." />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Impossibile caricare i blocchi.');
  });

  it('annida un blocco chiedendo l\'inserimento dentro un contenitore', () => {
    const onAddRequest = vi.fn();
    const nested: BlockNode[] = [{ id: 'c1', type: 'media_text', label: 'Media e testo', children: [] }];
    render(
      <BlockTreeEditor blocks={nested} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onDelete={vi.fn()} onAddRequest={onAddRequest} />,
    );
    screen.getByRole('button', { name: 'Aggiungi blocco in «Media e testo»' }).click();
    expect(onAddRequest).toHaveBeenCalledWith('c1');
  });
});
