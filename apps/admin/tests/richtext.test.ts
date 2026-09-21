import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import {
  analysePastedHtml,
  normaliseEditorHtml,
  richTextExtensions,
} from '../src/lib/editor/richtext';

/**
 * Lo schema dell'editor contro l'elenco chiuso di ADR-005 §3.5, e l'incollaggio
 * contro ADR-006 §3.1: *ciò che non è ammesso viene rifiutato all'incollaggio,
 * non silenziosamente riscritto*.
 *
 * I frammenti sono sintetici e brevi di proposito: qui si prova una regola, non
 * si ricostruisce una pagina.
 */

function htmlOf(input: string): string {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: richTextExtensions(),
    content: input,
  });
  const output = editor.getHTML();
  editor.destroy();
  return output;
}

describe('schema dell’editor (ADR-006 §3.1)', () => {
  it('non ammette h1: il titolo appartiene al template', () => {
    // Il testo sopravvive, il livello no: `h1` non è nell'elenco chiuso.
    expect(htmlOf('<h1>Titolo</h1>')).not.toContain('<h1>');
  });

  it('ammette i titoli dal secondo al sesto livello', () => {
    for (const level of [2, 3, 4, 5, 6]) {
      expect(htmlOf(`<h${level}>Titolo</h${level}>`)).toContain(`<h${level}>`);
    }
  });

  it('non ammette citazione, codice e blocco di codice', () => {
    expect(htmlOf('<blockquote><p>Testo</p></blockquote>')).not.toContain('<blockquote>');
    expect(htmlOf('<p>Testo <code>x</code></p>')).not.toContain('<code>');
    expect(htmlOf('<pre><code>x</code></pre>')).not.toContain('<pre>');
  });

  it('ammette gli elementi di testo dell’elenco chiuso', () => {
    expect(htmlOf('<p><strong>a</strong> <em>b</em> <u>c</u> <s>d</s></p>')).toContain('<strong>');
    expect(htmlOf('<ul><li><p>voce</p></li></ul>')).toContain('<ul>');
    expect(htmlOf('<table><tbody><tr><td><p>cella</p></td></tr></tbody></table>')).toContain('<table>');
  });

  it('non aggiunge un paragrafo in coda a un documento che nessuno ha toccato', () => {
    // `trailingNode` di StarterKit lo farebbe, ed è spento: un paragrafo che
    // compare da solo all'apertura romperebbe il criterio 1D-36.
    expect(htmlOf('<p>Uno</p>')).toBe('<p>Uno</p>');
  });

  it('non riscrive i collegamenti aggiungendo target e rel', () => {
    expect(htmlOf('<p><a href="https://esempio.invalid/">link</a></p>')).toBe(
      '<p><a href="https://esempio.invalid/">link</a></p>',
    );
  });

  it('la tabella che l’editor produce è già dentro l’elenco chiuso', () => {
    // La resa predefinita della libreria emette `<colgroup>`, `<col>` e uno
    // `style`: `colgroup` non è fra i 28 elementi di ADR-005 §3.5 e farebbe
    // **rifiutare l'intero blocco**, cioè renderebbe non salvabile una tabella
    // appena modificata. La resa è riscritta, l'elenco no.
    const html = htmlOf('<table><tbody><tr><td><p>cella</p></td></tr></tbody></table>');
    expect(html).not.toContain('<colgroup>');
    expect(html).not.toContain('style=');
    expect(html).not.toContain('colspan="1"');

    const outcome = normaliseEditorHtml(html);
    expect(outcome.ok).toBe(true);
    expect(outcome.notice).toBeNull();
    expect(outcome.html).toBe(html);
  });
});

describe('incollaggio (ADR-006 §3.1: ripulire si vede)', () => {
  it('un frammento già ammesso passa senza avvisi', () => {
    const outcome = analysePastedHtml('<p>Testo <strong>in grassetto</strong></p>');
    expect(outcome.notice).toBeNull();
    expect(outcome.html).toBe('<p>Testo <strong>in grassetto</strong></p>');
  });

  it('lo stile in linea viene tolto e l’avviso lo dichiara', () => {
    const outcome = analysePastedHtml('<p style="color:red">Testo incollato da Word</p>');
    expect(outcome.html).toBe('<p>Testo incollato da Word</p>');
    expect(outcome.notice).toContain('attributo style su p');
  });

  it('l’avviso non riporta mai il valore rimosso, solo il nome', () => {
    // Un valore può essere un indirizzo o un dato di una persona: un avviso
    // non è il posto in cui farlo comparire (`privacy-safe-development`).
    const outcome = analysePastedHtml('<p style="color:#ff0000">Testo</p>');
    expect(outcome.notice).not.toContain('#ff0000');
  });

  it('un gestore di evento sparisce e viene dichiarato', () => {
    const outcome = analysePastedHtml('<p onclick="alert(1)">Testo</p>');
    expect(outcome.html).toBe('<p>Testo</p>');
    expect(outcome.notice).toContain('attributo onclick su p');
  });

  it('un elemento pericoloso sparisce con tutto il contenuto', () => {
    const outcome = analysePastedHtml('<p>Prima</p><script>alert(1)</script>');
    expect(outcome.html).toBe('<p>Prima</p>');
    expect(outcome.notice).toContain('elemento script');
  });

  it('un elemento non ammesso ma innocuo fa rifiutare il frammento intero, e lo dice', () => {
    const outcome = analysePastedHtml('<p>Prima</p><marquee>scorre</marquee>');
    expect(outcome.html).toBe('');
    expect(outcome.notice).toContain('marquee');
    expect(outcome.notice).toContain('blocco HTML di riserva');
  });
});

describe('uscita dall’editor verso il modello', () => {
  it('restituisce un punto fisso della sanificazione', () => {
    const outcome = normaliseEditorHtml('<p>Testo</p>');
    expect(outcome.ok).toBe(true);
    expect(normaliseEditorHtml(outcome.html).html).toBe(outcome.html);
  });

  it('rifiuta invece di riscrivere ciò che il modello non ammette', () => {
    const outcome = normaliseEditorHtml('<marquee>x</marquee>');
    expect(outcome.ok).toBe(false);
    expect(outcome.notice).toContain('marquee');
  });
});
