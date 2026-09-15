import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from '../src/primitives/IconButton.js';

describe('IconButton — componente 15', () => {
  it('richiede un\'etichetta accessibile testuale', () => {
    render(<IconButton icon={<span>×</span>} label="Chiudi il pannello" />);
    expect(screen.getByRole('button', { name: 'Chiudi il pannello' })).toBeDefined();
  });

  it('rende lo stato D (disabilitato)', () => {
    render(<IconButton icon={<span>×</span>} label="Chiudi" disabled />);
    expect(screen.getByRole('button', { name: 'Chiudi' })).toHaveProperty('disabled', true);
  });

  it('DR-057: non permesso, non si mostra', () => {
    render(<IconButton icon={<span>×</span>} label="Elimina" permitted={false} />);
    expect(screen.queryByRole('button', { name: 'Elimina' })).toBeNull();
  });
});
