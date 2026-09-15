import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BulkActionBar } from '../src/primitives/BulkActionBar.js';

describe('BulkActionBar — componente 18', () => {
  it('stato R: conteggio e azioni', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        onClearSelection={vi.fn()}
        actions={[{ key: 'publish', label: 'Pubblica', onClick: vi.fn() }]}
      />,
    );
    expect(screen.getByText('3 selezionati')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Pubblica' })).toBeDefined();
  });

  it('annulla selezione richiama il gestore', () => {
    const onClearSelection = vi.fn();
    render(<BulkActionBar selectedCount={2} onClearSelection={onClearSelection} actions={[]} />);
    screen.getByRole('button', { name: 'Annulla selezione' }).click();
    expect(onClearSelection).toHaveBeenCalledOnce();
  });

  it('stato L: azione in caricamento', () => {
    render(
      <BulkActionBar
        selectedCount={1}
        onClearSelection={vi.fn()}
        actions={[{ key: 'delete', label: 'Elimina', onClick: vi.fn(), loading: true }]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Elimina' }).getAttribute('aria-busy')).toBe('true');
  });

  it('DR-057: un\'azione non permessa non si mostra', () => {
    render(
      <BulkActionBar
        selectedCount={1}
        onClearSelection={vi.fn()}
        actions={[{ key: 'delete', label: 'Elimina', onClick: vi.fn(), permitted: false }]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Elimina' })).toBeNull();
  });
});
