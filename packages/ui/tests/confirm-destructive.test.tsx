import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDestructive } from '../src/primitives/ConfirmDestructive.js';

describe('ConfirmDestructive — componente 34', () => {
  it('non si conferma per inerzia: il bottone resta disabilitato senza digitare', () => {
    render(
      <ConfirmDestructive
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Elimina pagina"
        description="L'operazione non è reversibile."
        objectName="Chi siamo"
      />,
    );
    expect(screen.getByRole('button', { name: 'Elimina definitivamente' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('un testo parziale o diverso non sblocca la conferma', () => {
    render(
      <ConfirmDestructive
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Elimina pagina"
        description="L'operazione non è reversibile."
        objectName="Chi siamo"
      />,
    );
    fireEvent.change(screen.getByLabelText('Digita «Chi siamo» per confermare'), {
      target: { value: 'Chi sia' },
    });
    expect(screen.getByRole('button', { name: 'Elimina definitivamente' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('la corrispondenza esatta sblocca la conferma, che richiama onConfirm', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDestructive
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Elimina pagina"
        description="L'operazione non è reversibile."
        objectName="Chi siamo"
      />,
    );
    fireEvent.change(screen.getByLabelText('Digita «Chi siamo» per confermare'), {
      target: { value: 'Chi siamo' },
    });
    const confirmButton = screen.getByRole('button', { name: 'Elimina definitivamente' });
    expect(confirmButton).toHaveProperty('disabled', false);
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('chiusa non rende nulla', () => {
    const { container } = render(
      <ConfirmDestructive
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Elimina pagina"
        description="L'operazione non è reversibile."
        objectName="Chi siamo"
      />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
