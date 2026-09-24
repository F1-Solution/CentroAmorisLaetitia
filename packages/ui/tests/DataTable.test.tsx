import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable } from '../src/primitives/DataTable.js';

interface Row {
  id: string;
  title: string;
  updatedAt: string;
}

const rows: Row[] = [
  { id: '1', title: 'Chi siamo', updatedAt: '2026-01-10' },
  { id: '2', title: 'Contatti', updatedAt: '2026-02-02' },
];

const columns = [
  { key: 'title', header: 'Titolo', render: (r: Row) => r.title, sortable: true },
  { key: 'updatedAt', header: 'Aggiornata', render: (r: Row) => r.updatedAt, numeric: true },
];

describe('DataTable — componente 16', () => {
  it('stato R: rende le righe', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(r) => r.id} caption="Pagine" />);
    expect(screen.getByText('Chi siamo')).toBeDefined();
    expect(screen.getByText('Contatti')).toBeDefined();
  });

  it('stato V: vuoto', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={(r) => r.id}
        caption="Pagine"
        emptyText="Nessuna pagina."
      />,
    );
    expect(screen.getByText('Nessuna pagina.')).toBeDefined();
  });

  it('stato L: caricamento', () => {
    render(
      <DataTable columns={columns} rows={rows} getRowId={(r) => r.id} caption="Pagine" loading />,
    );
    expect(screen.getByText('Caricamento in corso…')).toBeDefined();
  });

  it('stato E: errore', () => {
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        caption="Pagine"
        errorText="Impossibile caricare le pagine."
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Impossibile caricare le pagine.');
  });

  it('stato S: selezione multipla', () => {
    const onSelectedIdsChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        caption="Pagine"
        selectedIds={['1']}
        onSelectedIdsChange={onSelectedIdsChange}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    // La prima è "seleziona tutte"; le successive sono le righe.
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[2] as HTMLInputElement).checked).toBe(false);
  });

  it('ordinamento sulle intestazioni segnala la colonna via onSortChange', () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        caption="Pagine"
        onSortChange={onSortChange}
        sortKey="title"
        sortDirection="asc"
      />,
    );
    expect(
      screen.getByRole('columnheader', { name: /Titolo/ }).querySelector('[aria-sort="ascending"]'),
    ).toBeDefined();
  });
});
