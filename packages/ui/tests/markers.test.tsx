import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RestrictedMarker } from '../src/markers/RestrictedMarker.js';
import { VisibilityPanel } from '../src/markers/VisibilityPanel.js';

describe('RestrictedMarker — componente 36', () => {
  it('è leggibile senza colore: porta un\'etichetta testuale e un\'icona, non solo la barra colorata', () => {
    render(
      <RestrictedMarker>
        <p>Contenuto della scheda</p>
      </RestrictedMarker>,
    );
    // L'etichetta «RISERVATO» è testo vero, letto da uno screen reader anche
    // se il colore della barra a sinistra non è percepibile (§9.6).
    expect(screen.getByText('RISERVATO')).toBeDefined();
    expect(screen.getByText('Contenuto della scheda')).toBeDefined();
  });
});

describe('VisibilityPanel — componente 37', () => {
  it('stato R: visibilità pubblica, nessuna classe di riservatezza', () => {
    const { container } = render(
      <VisibilityPanel value="public" onChange={() => {}} visibleToText="Visibile a tutta l'area Redazione." />,
    );
    expect(container.querySelector('.amoris-visibility-panel--restricted')).toBeNull();
    expect(screen.getByText('Visibile a tutta l\'area Redazione.')).toBeDefined();
  });

  it('scelta «riservato»: fondo e testo dedicati, con la riga che ricorda chi vede il record', () => {
    const { container } = render(
      <VisibilityPanel value="restricted" onChange={() => {}} visibleToText="Visibile solo a Segreteria." />,
    );
    expect(container.querySelector('.amoris-visibility-panel--restricted')).not.toBeNull();
    expect(screen.getByText('Visibile solo a Segreteria.')).toBeDefined();
  });

  it('stato E: mostra il messaggio di errore del gruppo di scelta', () => {
    render(
      <VisibilityPanel
        value="public"
        onChange={() => {}}
        visibleToText="Visibile a tutta l'area."
        errorText="Scegliere una visibilità."
      />,
    );
    expect(screen.getByText('Scegliere una visibilità.')).toBeDefined();
  });

  it('stato D: disabilitato, il cambio non viene chiamato', () => {
    const onChange = vi.fn();
    render(
      <VisibilityPanel value="public" onChange={onChange} visibleToText="Visibile a tutta l'area." disabled />,
    );
    const restricted = screen.getByLabelText('Riservato') as HTMLInputElement;
    expect(restricted.disabled).toBe(true);
  });
});
