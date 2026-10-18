import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteHeader } from '../src/components/SiteHeader';

// A5-1 (1E-W7, DR-205): il campo di ricerca della testata ha un nome accessibile
// esplicito, senza cambiare la resa (stessi attributi visibili della sorgente).
function campo(): HTMLInputElement {
  const { container } = render(
    <SiteHeader siteTitle="Sito di prova" logoPath={null} menu={[]} currentPath="/" />,
  );
  const input = container.querySelector<HTMLInputElement>('input[name="s"]');
  if (!input) throw new Error('campo di ricerca assente');
  return input;
}

describe('campo di ricerca della testata — etichetta (A5-1)', () => {
  it('ha l’etichetta accessibile «Cerca»', () => {
    expect(campo().getAttribute('aria-label')).toBe('Cerca');
  });

  it('lascia segnaposto e title come nella sorgente', () => {
    const input = campo();
    expect(input.getAttribute('placeholder')).toBe('Cerca …');
    expect(input.getAttribute('title')).toBe('Cerca:');
  });
});
