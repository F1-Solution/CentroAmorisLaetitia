import { useState, type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuTreeEditor } from '../src/editor/MenuTreeEditor.js';
import type { MenuItemNode } from '../src/editor/MenuTreeEditor.js';

const items: MenuItemNode[] = [
  { id: 'm1', label: 'Chi siamo', linkType: 'content', linkTarget: 'Chi siamo' },
  { id: 'm2', label: 'Contatti', linkType: 'url', linkTarget: '/contatti' },
];

describe('MenuTreeEditor — componente 46', () => {
  it('stato R: rende le voci con il collegamento', () => {
    render(
      <MenuTreeEditor
        items={items}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onIndent={vi.fn()}
        onOutdent={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Contenuto: Chi siamo')).toBeDefined();
    expect(screen.getByText('Indirizzo: /contatti')).toBeDefined();
  });

  it('stato V: menu vuoto', () => {
    render(
      <MenuTreeEditor
        items={[]}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onIndent={vi.fn()}
        onOutdent={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText('Il menu non contiene ancora voci.')).toBeDefined();
  });

  it('annida con un comando esplicito, non con il trascinamento', () => {
    const onIndent = vi.fn();
    render(
      <MenuTreeEditor
        items={items}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onIndent={onIndent}
        onOutdent={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const indentButton = screen.getByRole('button', { name: 'Annida: Contatti' });
    expect(indentButton.closest('[draggable="true"]')).toBeNull();
    indentButton.click();
    expect(onIndent).toHaveBeenCalledWith('m2');
  });

  it('la prima voce di primo livello non può annidarsi né uscire di livello', () => {
    render(
      <MenuTreeEditor
        items={items}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onIndent={vi.fn()}
        onOutdent={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Annida: Chi siamo' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(
      screen.getByRole('button', { name: 'Riporta al livello superiore: Chi siamo' }),
    ).toHaveProperty('disabled', true);
  });

  it('stato E: errore', () => {
    render(
      <MenuTreeEditor
        items={items}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onIndent={vi.fn()}
        onOutdent={vi.fn()}
        onDelete={vi.fn()}
        errorText="Impossibile caricare il menu."
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Impossibile caricare il menu.');
  });
});

describe('MenuTreeEditor — involucro della riga per il trascinamento (DR-082)', () => {
  it('avvolge la sola riga di ogni voce, e i bottoni restano', () => {
    const nested: MenuItemNode[] = [
      {
        id: 'm1',
        label: 'Chi siamo',
        linkType: 'content',
        linkTarget: 'Chi siamo',
        children: [{ id: 'm1a', label: 'Storia', linkType: 'url', linkTarget: '/storia' }],
      },
    ];
    render(
      <MenuTreeEditor
        items={nested}
        onSelect={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onIndent={vi.fn()}
        onOutdent={vi.fn()}
        onDelete={vi.fn()}
        renderRow={({ id, children }) => <div data-testid={`riga-${id}`}>{children}</div>}
      />,
    );
    const outer = screen.getByTestId('riga-m1');
    expect(outer.textContent).toContain('Chi siamo');
    // La riga del genitore non contiene i figli: la fascia di rilascio misura la sola riga.
    expect(outer.textContent).not.toContain('Storia');
    expect(screen.getByTestId('riga-m1a')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Annida: Storia' })).toBeDefined();
  });
});

describe('MenuTreeEditor — un involucro con hook si rende come componente', () => {
  it('aggiungere una voce non rompe l’ordine degli hook (React #310)', () => {
    function RigaConHook({ id, children }: { id: string; children: ReactNode }) {
      const [visto] = useState(id);
      return <div data-riga={visto}>{children}</div>;
    }
    const props = {
      onSelect: vi.fn(),
      onMoveUp: vi.fn(),
      onMoveDown: vi.fn(),
      onIndent: vi.fn(),
      onOutdent: vi.fn(),
      onDelete: vi.fn(),
      renderRow: RigaConHook,
    };
    const uno: MenuItemNode = { id: 'x1', label: 'Uno', linkType: 'url', linkTarget: '/uno' };
    const due: MenuItemNode = { id: 'x2', label: 'Due', linkType: 'url', linkTarget: '/due' };
    const { rerender, container } = render(<MenuTreeEditor {...props} items={[uno]} />);
    rerender(<MenuTreeEditor {...props} items={[uno, due]} />);
    expect(container.querySelectorAll('[data-riga]').length).toBe(2);
  });
});
