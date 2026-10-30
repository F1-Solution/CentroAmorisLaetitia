import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HtmlFallbackEditor } from '../src/editor/HtmlFallbackEditor.js';

describe('HtmlFallbackEditor — componente 45', () => {
  it("mostra sempre l'avviso, in parole semplici (W8-21)", () => {
    render(<HtmlFallbackEditor value="<div>ciao</div>" onChange={vi.fn()} />);
    expect(
      screen.getByText(
        'Questo è codice del vecchio sito, non trasformato in blocchi. Se lo cambi, la pagina può apparire diversa; alcune parti, come i commenti, possono non vedersi sul sito.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/resa/)).toBeNull();
  });

  it("non è un editor di testo ricco: nessun comando di formattazione, solo un'area di testo", () => {
    render(<HtmlFallbackEditor value="<div>ciao</div>" onChange={vi.fn()} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.queryByRole('button', { name: /grassetto/i })).toBeNull();
    expect(
      screen.getByRole('textbox', { name: 'Codice HTML del blocco di riserva' }),
    ).toBeDefined();
  });

  it('modificare il testo richiama onChange con il valore grezzo', () => {
    const onChange = vi.fn();
    render(<HtmlFallbackEditor value="<p>x</p>" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Codice HTML del blocco di riserva' }), {
      target: { value: '<p>y</p>' },
    });
    expect(onChange).toHaveBeenCalledWith('<p>y</p>');
  });

  it('stato D: disabilitato', () => {
    render(<HtmlFallbackEditor value="" onChange={vi.fn()} disabled />);
    expect(
      screen.getByRole('textbox', { name: 'Codice HTML del blocco di riserva' }),
    ).toHaveProperty('disabled', true);
  });

  it('stato E: errore', () => {
    render(<HtmlFallbackEditor value="" onChange={vi.fn()} errorText="HTML non valido." />);
    expect(screen.getByRole('alert').textContent).toBe('HTML non valido.');
  });
});
