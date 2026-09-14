import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Home from '../src/app/page.js';

/**
 * Test di componente con React Testing Library (DR-007). In Fase 1C c'e' una sola
 * pagina, ed e' un segnaposto dichiarato: il test serve a tenere in piedi la
 * fondazione, non a verificare un contenuto che nascera' in Fase 1E.
 */
describe('pagina iniziale del sito pubblico', () => {
  it('dichiara di essere una fondazione e non il sito', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Centro per la Famiglia Amoris Laetitia',
    );
    expect(screen.getByText(/Fase 1E/)).toBeInTheDocument();
  });
});
