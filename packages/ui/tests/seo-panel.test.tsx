import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SeoPanel } from '../src/editor/SeoPanel.js';

describe('SeoPanel — componente 47', () => {
  it('stato R: rende titolo, descrizione e anteprima', () => {
    render(
      <SeoPanel
        title="Chi siamo"
        onTitleChange={vi.fn()}
        description="Il Centro per la Famiglia."
        onDescriptionChange={vi.fn()}
        resultUrl="https://www.centroamorislaetitia.it/chi-siamo"
      />,
    );
    expect(screen.getAllByText('Chi siamo').length).toBeGreaterThan(0);
    expect(screen.getByText('https://www.centroamorislaetitia.it/chi-siamo')).toBeDefined();
  });

  it('conta i caratteri del titolo', () => {
    render(
      <SeoPanel
        title="Chi siamo"
        onTitleChange={vi.fn()}
        description=""
        onDescriptionChange={vi.fn()}
        resultUrl="https://example.it"
      />,
    );
    expect(screen.getByText('9 / 60 caratteri')).toBeDefined();
  });

  it('stato E: errore sul titolo', () => {
    render(
      <SeoPanel
        title=""
        onTitleChange={vi.fn()}
        description=""
        onDescriptionChange={vi.fn()}
        resultUrl="https://example.it"
        titleErrorText="Il titolo è obbligatorio."
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Il titolo è obbligatorio.');
  });

  it('stato D: disabilitato', () => {
    render(
      <SeoPanel
        title=""
        onTitleChange={vi.fn()}
        description=""
        onDescriptionChange={vi.fn()}
        resultUrl="https://example.it"
        disabled
      />,
    );
    expect(screen.getByLabelText('Titolo SEO')).toHaveProperty('disabled', true);
  });
});
