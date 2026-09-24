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
    expect(onSelect).toHaveBeenCalledWith(items[0], '');
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
