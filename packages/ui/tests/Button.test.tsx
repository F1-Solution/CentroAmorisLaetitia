import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../src/primitives/Button.js';

describe('Button — componente 14', () => {
  it('rende lo stato R (riposo) con il testo', () => {
    render(<Button>Salva</Button>);
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDefined();
  });

  it('rende lo stato D (disabilitato)', () => {
    render(<Button disabled>Salva</Button>);
    expect(screen.getByRole('button', { name: 'Salva' })).toHaveProperty('disabled', true);
  });

  it('rende lo stato L (in caricamento) come occupato e disabilitato', () => {
    render(<Button loading>Salva</Button>);
    const button = screen.getByRole('button', { name: 'Salva' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button).toHaveProperty('disabled', true);
  });

  it.each(['primary', 'secondary', 'tertiary', 'destructive'] as const)('rende la variante %s', (variant) => {
    render(<Button variant={variant}>Azione</Button>);
    expect(screen.getByRole('button').className).toContain(`amoris-button--${variant}`);
  });

  it('DR-057: un\'azione non permessa non si mostra, non si mostra disabilitata', () => {
    const { container } = render(<Button permitted={false}>Elimina</Button>);
    expect(container.querySelector('button')).toBeNull();
    expect(screen.queryByText('Elimina')).toBeNull();
  });
});
