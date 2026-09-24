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
});
