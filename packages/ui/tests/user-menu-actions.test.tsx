import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserMenu } from '../src/shell/UserMenu.js';

/**
 * Wave 1G-W9, T7, W8-27: il menu della persona offre altri comandi oltre a «Disconnetti»,
 * per esempio «Cambia la password». Il comando chiude il menu e chiama chi l'ha passato.
 * Nome e indirizzo sono inventati.
 */
describe('UserMenu — comandi aggiuntivi (W8-27)', () => {
  it('mostra i comandi passati prima di «Disconnetti» e li esegue chiudendo il menu', () => {
    const onChangePassword = vi.fn();
    const onSignOut = vi.fn();
    render(
      <UserMenu
        name="Persona Sintetica"
        email="persona.sintetica@esempio.invalid"
        actions={[{ id: 'password', label: 'Cambia la password', onSelect: onChangePassword }]}
        onSignOut={onSignOut}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Persona Sintetica' }));
    const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(items).toEqual(['Cambia la password', 'Disconnetti']);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Cambia la password' }));
    expect(onChangePassword).toHaveBeenCalledOnce();
    expect(onSignOut).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('senza comandi aggiuntivi resta il solo «Disconnetti»', () => {
    render(<UserMenu name="Persona Sintetica" email="p@esempio.invalid" onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Persona Sintetica' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Disconnetti',
    ]);
  });
});
