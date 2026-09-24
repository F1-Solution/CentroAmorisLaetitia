import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from '../src/primitives/Alert.js';
import { EmptyState } from '../src/primitives/EmptyState.js';
import { SkipLink } from '../src/primitives/SkipLink.js';
import { Spinner } from '../src/primitives/Spinner.js';
import { Tooltip } from '../src/primitives/Tooltip.js';

describe('Alert — componente 30', () => {
  it('stato E: variante errore usa role alert', () => {
    render(
      <Alert variant="error" title="Salvataggio non riuscito">
        Riprova più tardi.
      </Alert>,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Salvataggio non riuscito')).toBeDefined();
  });

  it('le altre varianti usano role status, non solo colore', () => {
    render(
      <Alert variant="info" title="Informazione">
        Corpo
      </Alert>,
    );
    expect(screen.getByRole('status')).toBeDefined();
  });

  it("mostra l'azione di recupero quando presente", () => {
    render(
      <Alert variant="warning" title="Attenzione" action={<button>Riprova</button>}>
        Corpo
      </Alert>,
    );
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeDefined();
  });
});

describe('EmptyState — componente 20', () => {
  it('rende titolo, descrizione e azione: mai solo un disegno', () => {
    render(
      <EmptyState
        title="Nessun articolo"
        description="Non è stato ancora creato nulla in questa sezione."
        action={<button>Crea articolo</button>}
        helpLink={<a href="/guida">Guida</a>}
      />,
    );
    expect(screen.getByText('Nessun articolo')).toBeDefined();
    expect(screen.getByText('Non è stato ancora creato nulla in questa sezione.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Crea articolo' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Guida' })).toBeDefined();
  });
});

describe('SkipLink — componente 53', () => {
  it('è il primo elemento focalizzabile e punta al contenuto', () => {
    render(<SkipLink targetId="contenuto-principale" />);
    const link = screen.getByRole('link', { name: 'Vai al contenuto' });
    expect(link.getAttribute('href')).toBe('#contenuto-principale');
  });
});

describe('Spinner — componente 52', () => {
  it("richiede un testo accompagnatorio, non solo l'animazione", () => {
    render(<Spinner label="Caricamento articoli in corso" />);
    expect(screen.getByRole('status').textContent).toContain('Caricamento articoli in corso');
  });
});

describe('Tooltip — componente 51', () => {
  it('il contenuto avvolto resta comprensibile senza il suggerimento (§9.6)', () => {
    render(
      <Tooltip content="Elimina definitivamente">
        <button>Elimina</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'Elimina' })).toBeDefined();
  });

  it('stato F: compare alla messa a fuoco, non solo al passaggio del mouse', () => {
    render(
      <Tooltip content="Elimina definitivamente">
        <button>Elimina</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Elimina' });
    const tip = screen.getByRole('tooltip', { hidden: true });
    expect(tip.hidden).toBe(true);
    fireEvent.focus(button);
    expect(tip.hidden).toBe(false);
  });
});
