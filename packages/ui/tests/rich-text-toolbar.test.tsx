import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextToolbar } from '../src/editor/RichTextToolbar.js';

describe('RichTextToolbar — componente 44', () => {
  it('non offre h1: appartiene al template (ADR-005 §3.5)', () => {
    render(<RichTextToolbar onCommand={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Titolo 1' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Titolo 2' })).toBeDefined();
  });

  it('stato S: marca i comandi attivi nel punto corrente', () => {
    render(<RichTextToolbar onCommand={vi.fn()} activeCommands={['bold']} />);
    expect(screen.getByRole('button', { name: 'Grassetto' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('stato A: richiama il comando', () => {
    const onCommand = vi.fn();
    render(<RichTextToolbar onCommand={onCommand} />);
    screen.getByRole('button', { name: 'Collegamento' }).click();
    expect(onCommand).toHaveBeenCalledWith('link');
  });

  it('un incollaggio non ammesso è rifiutato con avviso visibile, mai in silenzio', () => {
    render(<RichTextToolbar onCommand={vi.fn()} pasteRejectedText="Lo stile in linea è stato rimosso." />);
    expect(screen.getByText('Incollaggio non ammesso')).toBeDefined();
    expect(screen.getByText('Lo stile in linea è stato rimosso.')).toBeDefined();
  });
});
