import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveBar } from '../src/primitives/SaveBar.js';

describe('SaveBar — componente 29', () => {
  it('stato R: dichiara sempre lo stato in parole compiute', () => {
    render(<SaveBar statusText="Salvato 2 minuti fa" onSave={vi.fn()} />);
    expect(screen.getByText('Salvato 2 minuti fa')).toBeDefined();
  });

  it('"Modifiche non salvate" è visibile come testo, non solo colore', () => {
    render(<SaveBar statusText="Modifiche non salvate" onSave={vi.fn()} />);
    expect(screen.getByText('Modifiche non salvate')).toBeDefined();
  });

  it('DR-057: senza onPublish il bottone "Pubblica" non compare', () => {
    render(<SaveBar statusText="Salvato" onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Pubblica' })).toBeNull();
  });

  it('saveLabel cambia il testo del pulsante e saveNote lo descrive', () => {
    render(
      <SaveBar
        statusText="Salvato"
        onSave={vi.fn()}
        saveLabel="Salva e aggiorna il sito"
        saveNote="Le modifiche compaiono subito sul sito."
      />,
    );
    const button = screen.getByRole('button', { name: 'Salva e aggiorna il sito' });
    expect(screen.queryByRole('button', { name: 'Salva' })).toBeNull();
    const noteId = button.getAttribute('aria-describedby');
    expect(noteId).toBeTruthy();
    expect(document.getElementById(noteId ?? '')?.textContent).toBe(
      'Le modifiche compaiono subito sul sito.',
    );
  });

  it('senza saveLabel il pulsante è «Salva» e senza avviso', () => {
    render(<SaveBar statusText="Salvato" onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDefined();
  });

  it('con onPublish il bottone compare', () => {
    render(<SaveBar statusText="Salvato" onSave={vi.fn()} onPublish={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Pubblica' })).toBeDefined();
  });

  it('stato E: errore sostituisce lo stato ed è annunciato', () => {
    render(<SaveBar statusText="Salvato" onSave={vi.fn()} errorText="Salvataggio non riuscito." />);
    expect(screen.getByRole('alert').textContent).toBe('Salvataggio non riuscito.');
  });

  it('stato L: salva è occupato', () => {
    render(<SaveBar statusText="Salvataggio…" onSave={vi.fn()} saving />);
    expect(screen.getByRole('button', { name: 'Salva' }).getAttribute('aria-busy')).toBe('true');
  });
});
