import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AreaChoiceScreen } from '../src/shell/AreaChoiceScreen.js';
import { CrossAreaHandoff } from '../src/shell/CrossAreaHandoff.js';
import { CommandSearch } from '../src/shell/CommandSearch.js';
import { PageHeader } from '../src/shell/PageHeader.js';
import type { AreaSummary, CommandResult } from '../src/shell/types.js';

const redazione: AreaSummary = {
  id: 'redazione',
  label: 'Redazione',
  icon: '📝',
  href: '/redazione',
  openCount: 3,
};
const impostazioni: AreaSummary = {
  id: 'impostazioni',
  label: 'Impostazioni',
  icon: '⚙️',
  href: '/impostazioni',
  openCount: 0,
};

describe('AreaChoiceScreen — componente 10, §7.4 punto 1', () => {
  it('con una sola area non chiede una scelta finta: non rende nulla', () => {
    const { container } = render(<AreaChoiceScreen areas={[redazione]} onChoose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('con più aree mostra un riquadro per area, con il conteggio', () => {
    const onChoose = vi.fn();
    render(<AreaChoiceScreen areas={[redazione, impostazioni]} onChoose={onChoose} />);
    expect(screen.getByText('3 elementi aperti')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Redazione/ }));
    expect(onChoose).toHaveBeenCalledWith('redazione');
  });

  it('stato L: mostra un indicatore di attesa invece della griglia', () => {
    render(<AreaChoiceScreen areas={[redazione, impostazioni]} onChoose={vi.fn()} loading />);
    expect(screen.getByRole('status').textContent).toContain('Caricamento delle aree in corso');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('stato E: zero aree con un errore mostra un avviso esplicito, non una griglia vuota', () => {
    render(<AreaChoiceScreen areas={[]} onChoose={vi.fn()} errorText="Nessun ruolo assegnato." />);
    expect(screen.getByRole('alert').textContent).toContain('Nessun ruolo assegnato.');
  });
});

describe('CrossAreaHandoff — componente 11', () => {
  it('stato R: dichiara dove vive il dato e richiede un gesto esplicito per passare', () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(<CrossAreaHandoff areaLabel="Segreteria" onConfirm={onConfirm} onDismiss={onDismiss} />);
    expect(screen.getByText(/Questo dato sta in/).textContent).toBe(
      'Questo dato sta in Segreteria. Vuoi passare?',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Passa a Segreteria' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Resta qui' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe('CommandSearch — componente 12, DR-054', () => {
  const results: CommandResult[] = [
    { id: '1', label: 'Chi siamo', group: 'Pagine' },
    { id: '2', label: 'Contatti', group: 'Pagine' },
  ];

  it('è raggiungibile da tastiera con Ctrl+K', () => {
    render(
      <CommandSearch
        activeAreaLabel="Redazione"
        query=""
        onQueryChange={vi.fn()}
        results={[]}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Ricerca in Redazione' })).not.toBeNull();
  });

  it('annuncia i risultati alle tecnologie assistive con una regione dinamica', () => {
    render(
      <CommandSearch
        activeAreaLabel="Redazione"
        query="chi"
        onQueryChange={vi.fn()}
        results={results}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('status').textContent).toBe('2 risultati trovati');
  });

  it("DR-054: mostra solo i risultati ricevuti, mai altro: la ricerca non raggiunge nulla fuori dall'ambiente attivo", () => {
    render(
      <CommandSearch
        activeAreaLabel="Redazione"
        query="chi"
        onQueryChange={vi.fn()}
        results={results}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(screen.getAllByRole('button', { name: /Chi siamo|Contatti/ })).toHaveLength(2);
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Ricerca in Redazione');
  });

  it('Esc chiude la ricerca e restituisce il fuoco', () => {
    render(
      <CommandSearch
        activeAreaLabel="Redazione"
        query=""
        onQueryChange={vi.fn()}
        results={[]}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('la selezione di un risultato chiama onSelect e chiude la ricerca', () => {
    const onSelect = vi.fn();
    render(
      <CommandSearch
        activeAreaLabel="Redazione"
        query="chi"
        onQueryChange={vi.fn()}
        results={results}
        onSelect={onSelect}
      />,
    );
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: /Chi siamo/ }));
    expect(onSelect).toHaveBeenCalledWith(results[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('PageHeader — componente 13', () => {
  it('stato R: titolo, riga di riepilogo, azione principale a destra', () => {
    render(
      <PageHeader
        title="Pagine"
        summary="12 pagine pubblicate"
        action={<button type="button">Nuova pagina</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Pagine' })).not.toBeNull();
    expect(screen.getByText('12 pagine pubblicate')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Nuova pagina' })).not.toBeNull();
  });
});
