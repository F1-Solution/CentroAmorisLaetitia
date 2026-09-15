import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormLayout } from '../src/primitives/FormLayout.js';

describe('FormLayout — componente 28', () => {
  it('rende entrambe le colonne', () => {
    render(<FormLayout main={<p>Contenuto</p>} aside={<p>Attributi</p>} />);
    expect(screen.getByText('Contenuto')).toBeDefined();
    expect(screen.getByText('Attributi')).toBeDefined();
  });
});
