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
      <MenuTreeEditor items={[]} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onIndent={vi.fn()} onOutdent={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText('Il menu non contiene ancora voci.')).toBeDefined();
  });

  it('annida con un comando esplicito, non con il trascinamento', () => {
    const onIndent = vi.fn();
    render(
      <MenuTreeEditor items={items} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onIndent={onIndent} onOutdent={vi.fn()} onDelete={vi.fn()} />,
    );
    const indentButton = screen.getByRole('button', { name: 'Annida: Contatti' });
    expect(indentButton.closest('[draggable="true"]')).toBeNull();
    indentButton.click();
    expect(onIndent).toHaveBeenCalledWith('m2');
  });

  it('la prima voce di primo livello non può annidarsi né uscire di livello', () => {
    render(
      <MenuTreeEditor items={items} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onIndent={vi.fn()} onOutdent={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Annida: Chi siamo' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Riporta al livello superiore: Chi siamo' })).toHaveProperty('disabled', true);
  });

  it('stato E: errore', () => {
    render(
      <MenuTreeEditor items={items} onSelect={vi.fn()} onMoveUp={vi.fn()} onMoveDown={vi.fn()} onIndent={vi.fn()} onOutdent={vi.fn()} onDelete={vi.fn()} errorText="Impossibile caricare il menu." />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Impossibile caricare il menu.');
  });
});
