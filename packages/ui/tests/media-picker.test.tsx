import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MediaPicker } from '../src/media/MediaPicker.js';

const items = [
  { id: '1', thumbnailUrl: '/a.jpg', title: 'Facciata del centro' },
  { id: '2', thumbnailUrl: '/b.jpg', title: 'Sala colloqui' },
];

describe('MediaPicker — componente 38', () => {
  it('stato R: rende la griglia', () => {
    render(
      <MediaPicker
        open
        items={items}
        searchValue=""
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Facciata del centro')).toBeDefined();
  });

  it('stato V: nessun media trovato', () => {
    render(
      <MediaPicker
        open
        items={[]}
        searchValue=""
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Nessun media trovato.')).toBeDefined();
  });

  it('con un errore mostra l’errore e non dice «nessun media trovato»', () => {
    render(
      <MediaPicker
        open
        items={[]}
        errorText="L’elenco dei media non si è caricato."
        searchValue=""
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('L’elenco dei media non si è caricato.');
    expect(screen.queryByText('Nessun media trovato.')).toBeNull();
  });

  it('stato L: caricamento', () => {
    render(
      <MediaPicker
        open
        items={items}
        loading
        searchValue=""
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Caricamento dei media in corso…')).toBeDefined();
  });

  it('il testo alternativo è obbligatorio prima di confermare la scelta (§9.5)', () => {
    render(
      <MediaPicker
        open
        items={items}
        searchValue=""
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Facciata del centro'));
    expect(screen.getByRole('button', { name: 'Usa questo media' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('spuntare "decorativa" sblocca la conferma senza testo alternativo e produce alt=""', () => {
    const onSelect = vi.fn();
    render(
      <MediaPicker
        open
        items={items}
        searchValue=""
        onSearchChange={vi.fn()}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Facciata del centro'));
    fireEvent.click(
      screen.getByLabelText('Immagine puramente decorativa (nessun testo alternativo)'),
    );
    const confirmButton = screen.getByRole('button', { name: 'Usa questo media' });
    expect(confirmButton).toHaveProperty('disabled', false);
    fireEvent.click(confirmButton);
    expect(onSelect).toHaveBeenCalledWith(items[0], '', true);
  });

  it('con requireAlt=false non chiede il testo alternativo e conferma subito', () => {
    const onSelect = vi.fn();
    render(
      <MediaPicker
        open
        requireAlt={false}
        items={items}
        searchValue=""
        onSearchChange={vi.fn()}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Facciata del centro'));
    expect(screen.queryByLabelText('Testo alternativo')).toBeNull();
    expect(
      screen.queryByLabelText('Immagine puramente decorativa (nessun testo alternativo)'),
    ).toBeNull();
    const confirmButton = screen.getByRole('button', { name: 'Usa questo media' });
    expect(confirmButton).toHaveProperty('disabled', false);
    fireEvent.click(confirmButton);
    expect(onSelect).toHaveBeenCalledWith(items[0], '', false);
  });

  describe('testo alternativo proposto dal media (W8-10, DR-305)', () => {
    const withAlt = [
      { id: '1', thumbnailUrl: '/a.jpg', title: 'Facciata del centro', altText: 'La facciata' },
    ];
    function open(onSelect = vi.fn()) {
      render(
        <MediaPicker
          open
          items={withAlt}
          searchValue=""
          onSearchChange={vi.fn()}
          onSelect={onSelect}
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByText('Facciata del centro'));
      return onSelect;
    }

    it('propone il testo del media e consente di confermare subito', () => {
      open();
      expect(screen.getByLabelText('Testo alternativo')).toHaveProperty('value', 'La facciata');
      expect(screen.getByRole('button', { name: 'Usa questo media' })).toHaveProperty(
        'disabled',
        false,
      );
    });

    it('se il testo proposto non si cambia, il blocco non lo riceve (resta vuoto)', () => {
      const onSelect = open();
      fireEvent.click(screen.getByRole('button', { name: 'Usa questo media' }));
      expect(onSelect).toHaveBeenCalledWith(withAlt[0], '', false);
    });

    it('se il testo proposto si cambia, il blocco riceve il nuovo testo', () => {
      const onSelect = open();
      fireEvent.change(screen.getByLabelText('Testo alternativo'), {
        target: { value: 'Un altro testo' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Usa questo media' }));
      expect(onSelect).toHaveBeenCalledWith(withAlt[0], 'Un altro testo', false);
    });
  });

  it('chiuso non rende nulla', () => {
    const { container } = render(
      <MediaPicker
        open={false}
        items={items}
        searchValue=""
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
