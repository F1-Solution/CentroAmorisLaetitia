import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from '../src/primitives/Pagination.js';

describe('Pagination — componente 19', () => {
  it('prima pagina: "Pagina precedente" disabilitato', () => {
    render(<Pagination page={1} totalItems={45} pageSize={10} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText('Pagina precedente')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Pagina successiva')).toHaveProperty('disabled', false);
  });

  it('ultima pagina: "Pagina successiva" disabilitato', () => {
    render(<Pagination page={5} totalItems={45} pageSize={10} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText('Pagina successiva')).toHaveProperty('disabled', true);
  });

  it('pagina unica: entrambe le frecce disabilitate', () => {
    render(<Pagination page={1} totalItems={5} pageSize={10} onPageChange={vi.fn()} />);
    expect(screen.getByLabelText('Pagina precedente')).toHaveProperty('disabled', true);
    expect(screen.getByLabelText('Pagina successiva')).toHaveProperty('disabled', true);
  });

  it('zero risultati: nessun controllo di pagina, solo il riepilogo', () => {
    render(<Pagination page={1} totalItems={0} pageSize={10} onPageChange={vi.fn()} />);
    expect(screen.getByText('Nessun elemento.')).toBeDefined();
    expect(screen.queryByLabelText('Pagina precedente')).toBeNull();
  });

  it('cambia pagina alla pressione di un numero', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalItems={30} pageSize={10} onPageChange={onPageChange} />);
    screen.getByRole('button', { name: '2' }).click();
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('elementi per pagina: cambia con il selettore', () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination page={1} totalItems={30} pageSize={10} onPageChange={vi.fn()} onPageSizeChange={onPageSizeChange} />,
    );
    expect(screen.getByLabelText('Elementi per pagina')).toBeDefined();
  });
});
