import { fireEvent, render, screen, within } from '@testing-library/react';
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

/**
 * Difetto trovato nella `1D-W9` e corretto qui: l'effetto che sposta il fuoco
 * all'apertura dipendeva anche da `onClose`, che chi usa questi componenti
 * scrive quasi sempre in linea ed è quindi nuova a ogni resa. L'effetto si
 * rieseguiva a ogni resa e riportava il fuoco al **primo** campo: scrivendo nel
 * secondo, dopo una lettera si finiva a scrivere nel primo.
 */
describe('il fuoco non torna al primo campo a ogni resa', () => {
  function Secondo({ componente }: { componente: 'dialog' | 'sidepanel' }) {
    const [testo, setTesto] = useState('');
    const corpo = (
      <>
        <input aria-label="Primo" />
        <input aria-label="Secondo" value={testo} onChange={(e) => setTesto(e.target.value)} />
      </>
    );
    // `onClose` in linea, com'è nell'uso reale: è proprio ciò che scatenava il difetto.
    return componente === 'dialog' ? (
      <Dialog open onClose={() => undefined} title="Prova">
        {corpo}
      </Dialog>
    ) : (
      <SidePanel open onClose={() => undefined} title="Prova">
        {corpo}
      </SidePanel>
    );
  }

  for (const componente of ['sidepanel', 'dialog'] as const) {
    it(`${componente}: il fuoco resta sul campo in cui si sta scrivendo`, () => {
      render(<Secondo componente={componente} />);
      const campo = within(screen.getByRole('dialog')).getByLabelText('Secondo');
      campo.focus();
      fireEvent.change(campo, { target: { value: 'p' } });
      expect(document.activeElement).toBe(campo);
    });
  }
});

/**
 * Il comando di chiusura, aggiunto il 2026-09-23. Prima si usciva solo con Esc:
 * una scorciatoia, non un comando visibile, e chi non la conosce restava dentro.
 */
describe('pannello e finestra si chiudono anche con il mouse', () => {
  it('SidePanel: la X chiama onClose', () => {
    const onClose = vi.fn();
    render(
      <SidePanel open onClose={onClose} title="Dettaglio">
        <p>Corpo</p>
      </SidePanel>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi il pannello' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Dialog: la X chiama onClose', () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Conferma">
        <p>Corpo</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('Esc continua a funzionare: sono due strade, non una sostituzione', () => {
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
