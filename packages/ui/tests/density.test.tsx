import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DensityProvider } from '../src/density/DensityContext.js';
import { DensityToggle } from '../src/density/DensityToggle.js';

describe('DensityToggle — componente 49', () => {
  it('stato R: parte dalla densità comoda predefinita (DR-054, §5.1)', () => {
    render(
      <DensityProvider>
        <DensityToggle />
      </DensityProvider>,
    );
    const toggle = screen.getByRole('switch', { name: 'Densità' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(document.documentElement.hasAttribute('data-density')).toBe(false);
  });

  it('cambia la densità e applica data-density su <html> senza ricaricare la pagina', () => {
    render(
      <DensityProvider>
        <DensityToggle />
      </DensityProvider>,
    );
    const toggle = screen.getByRole('switch', { name: 'Densità' });
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
  });

  it('la scelta di densità sopravvive a un rimontaggio quando la si passa come valore iniziale (§5.2)', () => {
    const first = render(
      <DensityProvider>
        <DensityToggle />
      </DensityProvider>,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Densità' }));
    expect(document.documentElement.getAttribute('data-density')).toBe('compact');
    first.unmount();

    // La persistenza reale è un'API lato server (§5.2 punto 3, non ancora
    // disponibile in questa wave): qui si verifica che il componente onori un
    // valore iniziale ricevuto da chi lo usa, sopravvivendo al rimontaggio.
    render(
      <DensityProvider initialDensity="compact">
        <DensityToggle />
      </DensityProvider>,
    );
    expect(screen.getByRole('switch', { name: 'Densità' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it("avvisa onDensityChange, punto d'innesto per la persistenza con l'account", () => {
    let saved: string | null = null;
    render(
      <DensityProvider onDensityChange={(next) => (saved = next)}>
        <DensityToggle />
      </DensityProvider>,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Densità' }));
    expect(saved).toBe('compact');
  });
});
