import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateTimeField } from '../src/primitives/DateTimeField.js';

describe('DateTimeField — componente 26', () => {
  it('stato R: rende il valore', () => {
    render(<DateTimeField label="Pubblica il" value="2026-09-15T10:30" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Pubblica il') as HTMLInputElement;
    expect(input.value).toBe('2026-09-15T10:30');
    expect(input.type).toBe('datetime-local');
  });

  it('stato E: mostra il messaggio di errore', () => {
    render(
      <DateTimeField
        label="Pubblica il"
        value=""
        onChange={vi.fn()}
        errorText="Data non valida."
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Data non valida.');
  });

  it('stato D: disabilitato', () => {
    render(<DateTimeField label="Pubblica il" value="" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText('Pubblica il')).toHaveProperty('disabled', true);
  });
});
