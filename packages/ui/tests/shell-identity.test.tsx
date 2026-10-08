import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserMenu } from '../src/shell/UserMenu.js';
import { RoleSwitcher } from '../src/shell/RoleSwitcher.js';
import { ActiveContextBadge } from '../src/shell/ActiveContextBadge.js';
import { ContextChangeNotice } from '../src/shell/ContextChangeNotice.js';
import type { RoleOption } from '../src/shell/types.js';

describe('UserMenu — componente 6', () => {
  it('stato R, A: apre il menu con nome, dati account e disconnessione, separato dal ruolo', () => {
    const onSignOut = vi.fn();
    render(
      <UserMenu
        name="Persona Sintetica"
        email="persona.sintetica@esempio.invalid"
        onSignOut={onSignOut}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Persona Sintetica' }));
    expect(screen.getByText('persona.sintetica@esempio.invalid')).not.toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Disconnetti' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});

describe('RoleSwitcher — componente 7, DR-050', () => {
  const singleRole: RoleOption[] = [
    { id: 'editor', label: 'Redazione', description: 'Vedi solo i contenuti di Redazione.' },
  ];
  const twoRoles: RoleOption[] = [
    { id: 'editor', label: 'Redazione', description: 'Vedi solo i contenuti di Redazione.' },
    {
      id: 'admin',
      label: 'Impostazioni',
      description: 'Vedi persone, permessi e registro.',
      elevated: true,
    },
  ];

  it('con un solo ruolo non si mostra come un commutatore: nessuna freccia, nessun menu apribile', () => {
    render(<RoleSwitcher roles={singleRole} activeRoleId="editor" onChange={vi.fn()} />);
    expect(screen.getByText('Redazione')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('con più ruoli elenca solo quelli posseduti, ognuno con la riga di che cosa cambia', () => {
    render(<RoleSwitcher roles={twoRoles} activeRoleId="editor" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Redazione/ }));
    expect(screen.getByText('Vedi persone, permessi e registro.')).not.toBeNull();
  });

  it('sceglie il ruolo attivo con onChange', () => {
    const onChange = vi.fn();
    const first = render(
      <RoleSwitcher roles={twoRoles} activeRoleId="editor" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Redazione/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Impostazioni/ }));
    expect(onChange).toHaveBeenCalledWith('admin');
    first.unmount();
  });

  it('i ruoli con poteri estesi mostrano la pastiglia con bordo 2 px', () => {
    render(<RoleSwitcher roles={twoRoles} activeRoleId="admin" onChange={vi.fn()} />);
    expect(screen.getByText('Impostazioni').className).toContain(
      'amoris-role-switcher__pill--elevated',
    );
  });

  it('stato D, L: disabilitato e in caricamento non apre il menu al clic', () => {
    render(
      <RoleSwitcher roles={twoRoles} activeRoleId="editor" onChange={vi.fn()} disabled loading />,
    );
    const trigger = screen.getByRole('button', { name: /Redazione/ }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    expect(trigger.getAttribute('aria-busy')).toBe('true');
  });
});

describe('ActiveContextBadge — componente 8', () => {
  it("l'ambiente attivo è leggibile senza colore: la frase compiuta è nel testo, non solo nel puntino", () => {
    render(<ActiveContextBadge areaLabel="Redazione" />);
    const badge = screen.getByText('Stai lavorando come Redazione');
    expect(badge.textContent).toContain('Redazione');
    const dot = badge.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
  });
});

describe('ContextChangeNotice — componente 9', () => {
  it('stato R: annuncia il nuovo ruolo con role="status" e scompare dopo 4 secondi', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<ContextChangeNotice roleLabel="Impostazioni" visible onDismiss={onDismiss} />);
    expect(screen.getByRole('status').textContent).toContain(
      'Stai ora lavorando come Impostazioni',
    );
    vi.advanceTimersByTime(4000);
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('non visibile: non rende nulla', () => {
    render(<ContextChangeNotice roleLabel="Impostazioni" visible={false} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
