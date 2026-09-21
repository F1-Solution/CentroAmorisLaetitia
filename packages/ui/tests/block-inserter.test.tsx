import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockInserter } from '../src/editor/BlockInserter.js';

describe('BlockInserter — componente 42', () => {
  it('stato R: elenca i tipi di blocco inseribili', () => {
    render(<BlockInserter open onClose={vi.fn()} onInsert={vi.fn()} searchValue="" onSearchChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Testo' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Video' })).toBeDefined();
  });

  it('la ricerca filtra l\'elenco chiuso dei 14 tipi', () => {
    render(<BlockInserter open onClose={vi.fn()} onInsert={vi.fn()} searchValue="video" onSearchChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Video' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Testo' })).toBeNull();
  });

  it('stato V: nessun blocco trovato', () => {
    render(<BlockInserter open onClose={vi.fn()} onInsert={vi.fn()} searchValue="xyz" onSearchChange={vi.fn()} />);
    expect(screen.getByText('Nessun blocco trovato con «xyz».')).toBeDefined();
  });

  it('i tipi non creabili restano in elenco, spenti e con il motivo scritto', () => {
    const onInsert = vi.fn();
    render(
      <BlockInserter
        open
        onClose={vi.fn()}
        onInsert={onInsert}
        searchValue=""
        onSearchChange={vi.fn()}
        unavailableTypes={['form', 'slider']}
        unavailableReason="Modulo, documento e presentazione rimandano a una riga che qui non si può scegliere."
      />,
    );
    const form = screen.getByRole('button', { name: 'Modulo' });
    expect(form).toHaveProperty('disabled', true);
    fireEvent.click(form);
    expect(onInsert).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Modulo, documento e presentazione rimandano a una riga che qui non si può scegliere.',
      ),
    ).toBeDefined();
    // Restano visibili: nasconderli farebbe credere che non esistano.
    expect(screen.getByRole('button', { name: 'Presentazione a scorrimento' })).toBeDefined();
  });

  it('inserisce il tipo scelto', () => {
    const onInsert = vi.fn();
    render(<BlockInserter open onClose={vi.fn()} onInsert={onInsert} searchValue="" onSearchChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Video' }));
    expect(onInsert).toHaveBeenCalledWith('video');
  });
});
