import type { Editor } from '@tiptap/react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '../src/components/editor/RichTextEditor';

/*
 * W9-N2 (collaudo della 1G-W9): scrivendo velocemente nel blocco «Testo» una
 * parte dei tasti andava persa, e il testo pubblicato era diverso da quello
 * voluto, senza avviso.
 *
 * Il contenitore riceve ogni battuta con `onChange` e la ripassa come `value`
 * al render successivo. Fra il render e il suo effetto passa però un istante
 * in cui il browser può consegnare un altro tasto: l'effetto vede allora un
 * `value` che l'editor ha già superato, diverso dall'ultimo emesso, e lo
 * ricarica con `setContent`, cancellando la battuta e spostando il cursore.
 *
 * Qui il ritardo si riproduce senza browser: due battute escono prima che il
 * contenitore ripassi la prima. Dati sintetici.
 */

function editorOf(container: HTMLElement): Editor {
  const surface = container.querySelector('.ProseMirror') as
    (HTMLElement & { editor?: Editor }) | null;
  if (!surface?.editor) throw new Error('editor non ancora pronto');
  return surface.editor;
}

async function mount(value: string, onChange: (html: string) => void) {
  const view = render(<RichTextEditor value={value} onChange={onChange} />);
  const editor = await waitFor(() => editorOf(view.container));
  return { ...view, editor };
}

function typeAtEnd(editor: Editor, text: string): void {
  act(() => {
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, text);
  });
}

describe('W9-N2: battute che arrivano prima che il contenitore ripassi il testo', () => {
  it('un valore già superato dall’editor non cancella le battute successive', async () => {
    const onChange = vi.fn<(html: string) => void>();
    const { editor, rerender } = await mount('<p>Testo sintetico</p>', onChange);

    typeAtEnd(editor, 'a');
    typeAtEnd(editor, 'b');
    const [first, second] = onChange.mock.calls.map(([html]) => html);
    expect(first).toBe('<p>Testo sinteticoa</p>');
    expect(second).toBe('<p>Testo sinteticoab</p>');

    // Il contenitore ripassa la prima battuta quando l'editor ha già la seconda.
    rerender(<RichTextEditor value={first!} onChange={onChange} />);
    expect(editor.getHTML()).toBe('<p>Testo sinteticoab</p>');

    // Poi arriva la seconda: nulla cambia, e la battuta dopo si somma alle altre.
    rerender(<RichTextEditor value={second!} onChange={onChange} />);
    typeAtEnd(editor, 'c');
    expect(editor.getHTML()).toBe('<p>Testo sinteticoabc</p>');
    expect(onChange).toHaveBeenLastCalledWith('<p>Testo sinteticoabc</p>');
  });

  it('il cursore resta dove si sta scrivendo', async () => {
    const onChange = vi.fn<(html: string) => void>();
    const { editor, rerender } = await mount('<p>Testo sintetico</p>', onChange);

    typeAtEnd(editor, 'a');
    typeAtEnd(editor, 'b');
    const cursor = editor.state.selection.from;
    rerender(<RichTextEditor value={onChange.mock.calls[0]![0]} onChange={onChange} />);
    expect(editor.state.selection.from).toBe(cursor);
  });

  it('un testo che l’editor non ha prodotto lo sostituisce ancora, come quando si sceglie un altro blocco', async () => {
    const onChange = vi.fn<(html: string) => void>();
    const { editor, rerender } = await mount('<p>Testo sintetico</p>', onChange);

    typeAtEnd(editor, 'a');
    rerender(<RichTextEditor value="<p>Altro blocco sintetico</p>" onChange={onChange} />);
    expect(editor.getHTML()).toBe('<p>Altro blocco sintetico</p>');

    // Anche dopo un valore superato: «Scarta la copia di lavoro» rimette il testo pubblicato.
    typeAtEnd(editor, 'x');
    typeAtEnd(editor, 'y');
    rerender(<RichTextEditor value={onChange.mock.calls.at(-2)![0]} onChange={onChange} />);
    rerender(<RichTextEditor value="<p>Testo pubblicato sintetico</p>" onChange={onChange} />);
    expect(editor.getHTML()).toBe('<p>Testo pubblicato sintetico</p>');
    expect(onChange).toHaveBeenCalledTimes(3);
  });
});

/*
 * W9-N2, la causa vista nel collaudo (T11b, DR-326): frecce, Inizio e Fine li
 * gestisce il browser, che sposta il cursore nella pagina; ProseMirror lo legge
 * solo all'evento `selectionchange`, che arriva dopo. Un tasto premuto in
 * quell'istante trovava l'editor col cursore vecchio: i «Canc» subito dopo
 * Ctrl+Home, con l'editor ancora convinto di essere in fondo, venivano ignorati
 * (54 su 528 nel collaudo), e un «Backspace» con l'editor convinto di essere a
 * inizio paragrafo avrebbe unito due paragrafi.
 *
 * Qui il cursore del browser si sposta senza `selectionchange`, come in
 * quell'istante. In jsdom il browser non cancella nulla da sé: si controlla che
 * l'editor non blocchi il tasto e che lavori dal cursore giusto.
 */
describe('W9-N2: tasti premuti prima che l’editor legga il cursore spostato dal browser', () => {
  function moveBrowserCaret(editor: Editor, paragraph: number, offset: number): void {
    const text = editor.view.dom.querySelectorAll('p')[paragraph]!.firstChild!;
    editor.view.dom.ownerDocument.getSelection()!.collapse(text, offset);
  }

  it('un «Canc» lavora dove il browser ha portato il cursore', async () => {
    const { editor } = await mount('<p>Testo sintetico</p>', vi.fn());
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    });
    moveBrowserCaret(editor, 0, 0);

    const notBlocked = fireEvent.keyDown(editor.view.dom, { key: 'Delete', keyCode: 46 });
    expect(editor.state.selection.from).toBe(1);
    expect(notBlocked).toBe(true);
  });

  it('durante la composizione (IME) il cursore resta quello dell’editor', async () => {
    const { editor } = await mount('<p>Testo sintetico</p>', vi.fn());
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    });
    moveBrowserCaret(editor, 0, 0);

    fireEvent.keyDown(editor.view.dom, { key: 'Process', keyCode: 229 });
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
  });

  it('un «Backspace» a metà del secondo paragrafo non lo unisce al primo', async () => {
    const onChange = vi.fn<(html: string) => void>();
    const html = '<p>Primo paragrafo sintetico</p><p>Secondo paragrafo sintetico</p>';
    const { editor } = await mount(html, onChange);
    // L'editor crede il cursore all'inizio del secondo paragrafo; il browser l'ha già portato 7 lettere avanti.
    const startOfSecond = 'Primo paragrafo sintetico'.length + 3;
    act(() => {
      editor.commands.setTextSelection(startOfSecond);
    });
    moveBrowserCaret(editor, 1, 7);

    act(() => {
      fireEvent.keyDown(editor.view.dom, { key: 'Backspace', keyCode: 8 });
    });
    expect(editor.getHTML()).toBe(html);
    expect(onChange).not.toHaveBeenCalled();
    expect(editor.state.selection.from).toBe(startOfSecond + 7);
  });
});
