import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PreviewPane } from '../src/editor/PreviewPane.js';

describe('PreviewPane — componente 40', () => {
  it('stato R: rende il contenuto ricevuto come contenitore', () => {
    render(
      <PreviewPane viewport="desktop" onViewportChange={vi.fn()}>
        <p>Contenuto del sito</p>
      </PreviewPane>,
    );
    expect(screen.getByText('Contenuto del sito')).toBeDefined();
  });

  it('commuta fra schermo e telefono', () => {
    const onViewportChange = vi.fn();
    render(
      <PreviewPane viewport="desktop" onViewportChange={onViewportChange}>
        <p>Contenuto</p>
      </PreviewPane>,
    );
    screen.getByRole('button', { name: 'Telefono' }).click();
    expect(onViewportChange).toHaveBeenCalledWith('mobile');
  });

  it('stato L: caricamento', () => {
    render(
      <PreviewPane viewport="desktop" onViewportChange={vi.fn()} loading>
        <p>Contenuto</p>
      </PreviewPane>,
    );
    expect(screen.getByText("Aggiornamento dell'anteprima in corso…")).toBeDefined();
  });

  it('stato E: errore', () => {
    render(
      <PreviewPane
        viewport="desktop"
        onViewportChange={vi.fn()}
        errorText="Non è stato possibile generare l'anteprima."
      >
        <p>Contenuto</p>
      </PreviewPane>,
    );
    expect(screen.getByText('Anteprima non disponibile')).toBeDefined();
  });
});
