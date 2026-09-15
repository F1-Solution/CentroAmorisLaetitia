import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TableToolbar } from '../src/primitives/TableToolbar.js';

describe('TableToolbar — componente 17', () => {
  it('stato R: rende la ricerca', () => {
    render(<TableToolbar searchLabel="Cerca" searchValue="" onSearchChange={vi.fn()} />);
    expect(screen.getByLabelText('Cerca')).toBeDefined();
  });

  it('stato V: nessun filtro configurato, nessun conteggio', () => {
    render(<TableToolbar searchLabel="Cerca" searchValue="" onSearchChange={vi.fn()} />);
    expect(screen.queryByText(/filtri attivi/)).toBeNull();
  });

  it('conta i filtri attivi e mostra "Azzera filtri"', () => {
    const onResetFilters = vi.fn();
    render(
      <TableToolbar
        searchLabel="Cerca"
        searchValue=""
        onSearchChange={vi.fn()}
        onResetFilters={onResetFilters}
        filters={[
          {
            key: 'status',
            label: 'Stato',
            value: 'draft',
            onChange: vi.fn(),
            options: [
              { value: 'all', label: 'Tutti' },
              { value: 'draft', label: 'Bozza' },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByLabelText('1 filtri attivi')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Azzera filtri' })).toBeDefined();
  });

  it('stato D: disabilita i campi', () => {
    render(<TableToolbar searchLabel="Cerca" searchValue="" onSearchChange={vi.fn()} disabled />);
    expect(screen.getByLabelText('Cerca')).toHaveProperty('disabled', true);
  });
});
