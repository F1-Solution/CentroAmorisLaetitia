import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '../src/layout/Dialog.js';
import { SidePanel } from '../src/layout/SidePanel.js';
import { Toast } from '../src/layout/Toast.js';

describe('Dialog — componente 32', () => {
  it('stato R: rende titolo e contenuto quando aperto', () => {
    render(
      <Dialog open onClose={() => {}} title="Conferma eliminazione">
        <p>Questa azione non si può annullare.</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'Conferma eliminazione' })).toBeDefined();
  });

  it('non rende nulla quando chiuso', () => {
    const { container } = render(
      <Dialog open={false} onClose={() => {}} title="Conferma">
        <p>Corpo</p>
      </Dialog>,
    );
    expect(container.textContent).toBe('');
  });

  it('Esc chiude la finestra e il fuoco torna all\'elemento che l\'ha aperta', () => {
    function Wrapper() {
      const [open, setOpen] = useState(true);
      return (
        <div>
          <button data-testid="trigger">Apri</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Conferma">
            <p>Corpo</p>
          </Dialog>
        </div>
      );
    }
    render(<Wrapper />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('SidePanel — componente 33', () => {
  it('stato R: rende titolo e contenuto quando aperto', () => {
    render(
      <SidePanel open onClose={() => {}} title="Dettaglio media">
        <p>Anteprima</p>
      </SidePanel>,
    );
    expect(screen.getByRole('dialog', { name: 'Dettaglio media' })).toBeDefined();
  });

  it('stato E: errore mostrato nel pannello', () => {
    render(
      <SidePanel open onClose={() => {}} title="Dettaglio media" errorText="Impossibile caricare il media.">
        <p>Anteprima</p>
      </SidePanel>,
    );
    expect(screen.getByRole('alert').textContent).toBe('Impossibile caricare il media.');
  });

  it('Esc chiama onClose', () => {
    const onClose = vi.fn();
    render(
      <SidePanel open onClose={onClose} title="Dettaglio">
        <p>Corpo</p>
      </SidePanel>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('Toast — componente 31', () => {
  it('errore: role alert, non si autochiude', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast toast={{ id: '1', variant: 'error', message: 'Salvataggio non riuscito.' }} onDismiss={onDismiss} />);
    expect(screen.getByRole('alert').textContent).toContain('Salvataggio non riuscito.');
    vi.advanceTimersByTime(10000);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('successo: role status, si chiude da sola dopo 6 secondi', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast toast={{ id: '2', variant: 'success', message: 'Salvato.' }} onDismiss={onDismiss} />);
    expect(screen.getByRole('status').textContent).toContain('Salvato.');
    vi.advanceTimersByTime(6000);
    expect(onDismiss).toHaveBeenCalledWith('2');
    vi.useRealTimers();
  });
});
