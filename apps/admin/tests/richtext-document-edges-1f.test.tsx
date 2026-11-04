import type { Editor } from '@tiptap/react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '../src/components/editor/RichTextEditor';

/*
 * W9-N8 (DR-336, DR-351): nel collaudo «Ctrl+Home» premuto pochi millisecondi
 * dopo il clic a volte non spostava il cursore, e i «Canc» seguenti cadevano in
 * fondo al paragrafo senza togliere nulla. Nell'ambiente e2e non si è
 * riprodotto (0 su 100 prove strumentate, CPU rallentata 4 e 16 volte).
 *
 * DR-351 B: «Ctrl+Home» e «Ctrl+Fine» li gestisce l'editor, senza dipendere
 * dal browser. Qui il browser è jsdom, che a quei tasti non sposta nulla:
 * è il caso osservato del browser che non sposta il cursore in tempo.
 * Dati sintetici.
 */

function editorOf(container: HTMLElement): Editor {
  const surface = container.querySelector('.ProseMirror') as
    (HTMLElement & { editor?: Editor }) | null;
  if (!surface?.editor) throw new Error('editor non ancora pronto');
  return surface.editor;
}

async function mount(value: string) {
  const onChange = vi.fn<(html: string) => void>();
  const view = render(<RichTextEditor value={value} onChange={onChange} />);
  const editor = await waitFor(() => editorOf(view.container));
  return { editor, onChange };
}

function press(editor: Editor, key: string, modifiers: KeyboardEventInit = {}): void {
  act(() => {
    fireEvent.keyDown(editor.view.dom, { key, ...modifiers });
  });
}

const TWO_PARAGRAPHS = '<p>Primo paragrafo sintetico</p><p>Secondo paragrafo sintetico</p>';

describe('W9-N8: «Ctrl+Home» e «Ctrl+Fine» gestiti dall’editor', () => {
  it('«Ctrl+Home» porta il cursore all’inizio del testo, e ciò che segue lavora da lì', async () => {
    const { editor } = await mount(TWO_PARAGRAPHS);
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    });

    press(editor, 'Home', { ctrlKey: true });

    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.from).toBe(1);
    // In jsdom «Canc» non toglie caratteri (lo fa il browser): si scrive al cursore.
    act(() => {
      editor.commands.insertContent('Nuovo ');
    });
    expect(editor.getHTML()).toBe(
      '<p>Nuovo Primo paragrafo sintetico</p><p>Secondo paragrafo sintetico</p>',
    );
  });

  it('«Ctrl+Fine» porta il cursore alla fine del testo', async () => {
    const { editor } = await mount(TWO_PARAGRAPHS);
    act(() => {
      editor.commands.setTextSelection(1);
    });

    press(editor, 'End', { ctrlKey: true });

    expect(editor.state.selection.empty).toBe(true);
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
  });

  it('con «Maiusc» estende la selezione dal punto di partenza', async () => {
    const { editor } = await mount(TWO_PARAGRAPHS);
    act(() => {
      editor.commands.setTextSelection(6);
    });

    press(editor, 'End', { ctrlKey: true, shiftKey: true });

    expect(editor.state.selection.anchor).toBe(6);
    expect(editor.state.selection.head).toBe(editor.state.doc.content.size - 1);
  });

  it('«Home» senza «Ctrl» resta al browser', async () => {
    const { editor } = await mount(TWO_PARAGRAPHS);
    act(() => {
      editor.commands.setTextSelection(10);
    });

    press(editor, 'Home');

    expect(editor.state.selection.from).toBe(10);
  });
});
