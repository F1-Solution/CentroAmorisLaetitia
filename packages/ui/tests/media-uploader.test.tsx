import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MediaUploader } from '../src/media/MediaUploader.js';

describe('MediaUploader — componente 39', () => {
  it('stato R: bottone di caricamento', () => {
    render(<MediaUploader files={[]} onFilesSelected={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Scegli i file' })).toBeDefined();
  });

  it('stato L: avanzamento per file', () => {
    render(
      <MediaUploader
        files={[{ id: '1', name: 'locandina.pdf', progress: 40, status: 'uploading' }]}
        onFilesSelected={vi.fn()}
      />,
    );
    expect(
      screen
        .getByRole('progressbar', { name: 'Avanzamento di locandina.pdf' })
        .getAttribute('aria-valuenow'),
    ).toBe('40');
  });

  it('stato E: errore per file', () => {
    render(
      <MediaUploader
        files={[
          {
            id: '1',
            name: 'locandina.pdf',
            progress: 0,
            status: 'error',
            errorText: 'File troppo grande.',
          },
        ]}
        onFilesSelected={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('File troppo grande.');
  });

  it('stato D: disabilitato', () => {
    render(<MediaUploader files={[]} onFilesSelected={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Scegli i file' })).toHaveProperty('disabled', true);
  });

  it('scrive i tipi ammessi nel controllo di scelta e li dichiara accanto al pulsante', () => {
    render(
      <MediaUploader
        files={[]}
        onFilesSelected={vi.fn()}
        accept=".png,.pdf"
        hintText="Tipi ammessi: PNG e PDF."
      />,
    );
    expect(screen.getByLabelText('Scegli i file da caricare').getAttribute('accept')).toBe(
      '.png,.pdf',
    );
    expect(screen.getByText('Tipi ammessi: PNG e PDF.')).toBeDefined();
  });

  it('collega la riga dei tipi ammessi al controllo, per chi usa un lettore di schermo', () => {
    render(<MediaUploader files={[]} onFilesSelected={vi.fn()} hintText="Tipi ammessi: PNG." />);
    const input = screen.getByLabelText('Scegli i file da caricare');
    const hint = screen.getByText('Tipi ammessi: PNG.');
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('stato C: un file caricato può portare un avviso', () => {
    render(
      <MediaUploader
        files={[
          {
            id: '1',
            name: 'foto.png',
            progress: 100,
            status: 'done',
            noticeText: '3 dimensioni derivate generate.',
          },
        ]}
        onFilesSelected={vi.fn()}
      />,
    );
    expect(screen.getByText('3 dimensioni derivate generate.')).toBeDefined();
  });
});
