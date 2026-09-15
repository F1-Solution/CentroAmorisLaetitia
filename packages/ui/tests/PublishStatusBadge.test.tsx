import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublishStatusBadge } from '../src/primitives/PublishStatusBadge.js';

describe('PublishStatusBadge — componente 35', () => {
  it.each([
    ['published', 'Pubblicata'],
    ['draft', 'Bozza'],
    ['scheduled', 'Programmata'],
    ['retired', 'Ritirata'],
  ] as const)('%s rende la parola intera "%s", non solo il colore', (status, label) => {
    render(<PublishStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeDefined();
  });
});
