/**
 * Lo schema dell'editor di testo ricco: ADR-006 §3.1.
 *
 * «Lo schema di TipTap ammette esattamente gli elementi del §3.5 di ADR-005.
 * `h1` è escluso: il titolo appartiene al template. Lo stile in linea è escluso.
 * Ciò che non è ammesso viene **rifiutato all'incollaggio**, non silenziosamente
 * riscritto.»
 *
 * Le due metà della frase si realizzano in due punti diversi, e vale la pena
 * dirlo perché la seconda è quella che di solito si dimentica:
 *
 * 1. **Lo schema**: le estensioni qui sotto sono esattamente quelle che
 *    producono gli elementi dell'elenco chiuso, e le altre di `StarterKit` —
 *    citazione, codice, blocco di codice — sono spente una per una. `heading`
 *    parte dal livello 2.
 * 2. **L'incollaggio**: `analysePastedHtml` passa il frammento incollato dallo
 *    **stesso** sanificatore che l'API applica in scrittura, e quando qualcosa
 *    viene tolto lo dichiara. Un ripulimento silenzioso è ciò che il redattore
 *    scopre mesi dopo.
 *
 * `trailingNode` è spento di proposito: aggiunge un paragrafo vuoto in coda al
 * documento, e un paragrafo che compare da solo appena si apre un blocco è
 * esattamente ciò che il criterio 1D-36 vieta.
 */
import { sanitizeRichText, type SanitizeIssue } from '@amoris/blocks';
import { mergeAttributes } from '@tiptap/core';
import { Image } from '@tiptap/extension-image';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { StarterKit } from '@tiptap/starter-kit';
import type { Extensions } from '@tiptap/react';

/** I livelli di titolo ammessi: `h1` appartiene al template (ADR-006 §3.1). */
export const HEADING_LEVELS = [2, 3, 4, 5, 6] as const;

/**
 * La tabella, riportata dentro l'elenco chiuso.
 *
 * La resa predefinita di `@tiptap/extension-table` emette `<colgroup>`, `<col>`
 * e un attributo `style` con la larghezza minima. Nessuno dei tre è nei 28
 * elementi di ADR-005 §3.5, e `colgroup` non essendovi farebbe **rifiutare
 * l'intero blocco** dal sanificatore: una tabella modificata non si potrebbe
 * più salvare.
 *
 * Si riscrive quindi la resa, non l'elenco. ADR-006 §3.1 dice che lo schema
 * dell'editor ammette **esattamente** gli elementi del §3.5: adeguare la
 * libreria a quella regola è attuarla, allargare l'elenco per far posto alla
 * libreria sarebbe modificare una ADR approvata senza chiederlo.
 */
const PlainTable = Table.extend({
  renderHTML({ HTMLAttributes }) {
    return ['table', mergeAttributes(HTMLAttributes), ['tbody', 0]];
  },
});

/**
 * `colspan` e `rowspan` sono ammessi su `th` e `td`, ma la libreria li scrive
 * **sempre**, anche quando valgono 1: su una tabella importata che non li aveva
 * comparirebbero alla prima modifica. `colwidth` e `align` non sono ammessi
 * affatto.
 */
function cellRenderer(tag: 'th' | 'td') {
  return function renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const kept: Record<string, unknown> = {};
    for (const name of ['colspan', 'rowspan'] as const) {
      const value = HTMLAttributes[name];
      if (typeof value === 'number' && value > 1) kept[name] = value;
    }
    return [tag, mergeAttributes(kept), 0] as const;
  };
}

const PlainTableHeader = TableHeader.extend({ renderHTML: cellRenderer('th') });
const PlainTableCell = TableCell.extend({ renderHTML: cellRenderer('td') });

export function richTextExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      // Fuori dall'elenco chiuso di ADR-005 §3.5: `blockquote`, `code` e `pre`
      // non vi compaiono, quindi non devono poter nascere.
      blockquote: false,
      code: false,
      codeBlock: false,
      // Vedi la nota in testa al file: nessun paragrafo aggiunto da solo.
      trailingNode: false,
      // `target` e `rel` esplicitamente a `null`: la predefinita li aggiunge a
      // **ogni** collegamento, e `configure` fonde in profondità, quindi un
      // oggetto vuoto non basta a toglierli. Senza questo, aprire e modificare
      // un blocco riscriverebbe collegamenti che nessuno ha toccato.
      link: {
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { target: null, rel: null, class: null },
      },
    }),
    Image.configure({ allowBase64: false, inline: false }),
    PlainTable,
    TableRow,
    PlainTableHeader,
    PlainTableCell,
    Subscript,
    Superscript,
  ];
}

export interface PasteOutcome {
  /** Il frammento che entra davvero nell'editor. */
  readonly html: string;
  /** Presente quando qualcosa è stato tolto: si mostra, non si tace. */
  readonly notice: string | null;
}

/**
 * Descrive che cosa è stato rimosso. **Solo nomi** di elementi e attributi: il
 * valore rimosso può essere un indirizzo, un testo o un dato di una persona, e
 * un avviso non è il posto dove farlo comparire.
 */
function describe(issues: readonly SanitizeIssue[]): string {
  const names = new Set(
    issues.map((issue) =>
      issue.attribute ? `attributo ${issue.attribute} su ${issue.element}` : `elemento ${issue.element}`,
    ),
  );
  return [...names].join(', ');
}

/**
 * Passa il frammento incollato dal sanificatore a elenco chiuso di
 * `packages/blocks`, che è lo stesso che l'API applica in scrittura: ciò che
 * non entrerebbe nel database non deve entrare nemmeno nell'editor, altrimenti
 * il redattore lo vede sullo schermo e lo perde al salvataggio.
 */
export function analysePastedHtml(html: string): PasteOutcome {
  const outcome = sanitizeRichText(html);

  if (!outcome.ok) {
    return {
      html: '',
      notice: `L’elemento «${outcome.element}» non è ammesso nel testo: il frammento incollato non è stato inserito. Per conservarlo così com’è serve un blocco HTML di riserva.`,
    };
  }

  if (outcome.issues.length === 0) {
    return { html: outcome.html, notice: null };
  }

  return {
    html: outcome.html,
    notice: `Dall’incollaggio è stato tolto ciò che il modello non ammette: ${describe(outcome.issues)}.`,
  };
}

export interface NormalisedHtml {
  readonly ok: boolean;
  readonly html: string;
  readonly notice: string | null;
}

/**
 * Ciò che esce dall'editor prima di finire in `props.html`. Lo schema di
 * `rich_text` pretende un **punto fisso** della sanificazione
 * (`BLOCK-MODEL.md` §3.4): passarlo di qui è ciò che lo rende tale, e farlo
 * qui invece che al salvataggio permette di dirlo subito.
 */
export function normaliseEditorHtml(html: string): NormalisedHtml {
  const outcome = sanitizeRichText(html);
  if (!outcome.ok) {
    return {
      ok: false,
      html,
      notice: `Il testo contiene l’elemento «${outcome.element}», che il modello non ammette: la modifica non si può salvare.`,
    };
  }
  return {
    ok: true,
    html: outcome.html,
    notice:
      outcome.issues.length > 0
        ? `È stato tolto ciò che il modello non ammette: ${describe(outcome.issues)}.`
        : null,
  };
}
