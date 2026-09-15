import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuditTrail } from '../src/editor/AuditTrail.js';

describe('AuditTrail — componente 48', () => {
  it('stato R: frasi compiute, non righe tecniche', () => {
    render(
      <AuditTrail
        entries={[{ id: '1', sentence: 'Maria Bianchi ha pubblicato «Chi siamo» come Redazione.', timestamp: '15/09/2026 10:30' }]}
      />,
    );
    expect(screen.getByText('Maria Bianchi ha pubblicato «Chi siamo» come Redazione.')).toBeDefined();
  });

  it('stato V: nessuna operazione', () => {
    render(<AuditTrail entries={[]} />);
    expect(screen.getByText('Nessuna operazione registrata.')).toBeDefined();
  });

  it('stato L: caricamento', () => {
    render(<AuditTrail entries={[]} loading />);
    expect(screen.getByText('Caricamento del registro in corso…')).toBeDefined();
  });
});
