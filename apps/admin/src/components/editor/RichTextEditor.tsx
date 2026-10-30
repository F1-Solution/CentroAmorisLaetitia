'use client';

import {
  Alert,
  Button,
  Dialog,
  RichTextToolbar,
  TextField,
  type RichTextCommand,
} from '@amoris/ui';
import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import {
  analysePastedHtml,
  normaliseEditorHtml,
  richTextExtensions,
  syncSelectionFromDom,
} from '../../lib/editor/richtext';
import './RichTextEditor.css';

/** Tutti i comandi della barra, per spegnerla per intero quando non si può scrivere. */
const ALL_COMMANDS: RichTextCommand[] = [
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'bold',
  'italic',
  'underline',
  'strike',
  'bulletList',
  'orderedList',
  'link',
  'image',
  'table',
];

export interface RichTextEditorProps {
  /** L'HTML del blocco `rich_text`, già punto fisso della sanificazione. */
  readonly value: string;
  /** Chiamato **solo** quando la persona modifica davvero il testo. */
  readonly onChange: (html: string) => void;
  readonly disabled?: boolean;
}

/**
 * TipTap dentro un blocco `rich_text`, con lo schema di ADR-006 §3.1.
 *
 * Due comportamenti sono la ragione per cui questo componente esiste invece di
 * essere tre righe dentro l'editor del contenuto.
 *
 * **Non riscrive ciò che nessuno ha toccato.** `onChange` parte solo da una
 * transazione che cambia il documento (`docChanged`): aprire un contenuto,
 * guardarlo e chiuderlo non produce alcuna modifica. È il criterio 1D-36, e
 * senza questo l'editor lo romperebbe da solo appena montato.
 *
 * **Quando l'editor non sa rappresentare il testo salvato, lo dice.** Lo schema
 * ammette l'elenco chiuso di ADR-005 §3.5, ma la sorgente può contenere
 * marcatura che vi rientra e che ProseMirror non ricostruisce identica. In quel
 * caso compare un avviso: il testo resta quello salvato finché non lo si
 * modifica, e modificarlo lo riscriverebbe nella forma che l'editor sa
 * produrre. Silenzio qui significherebbe perdere fedeltà senza accorgersene.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled = false,
}: RichTextEditorProps): React.JSX.Element {
  const [notice, setNotice] = useState<string | null>(null);
  const [representationWarning, setRepresentationWarning] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  /** I valori prodotti qui e non ancora ripassati: tornando sono un'eco e non ricaricano il testo (W9-N2). */
  const pendingEchoes = useRef<string[]>([]);

  const editor = useEditor({
    extensions: richTextExtensions(),
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      transformPastedHTML(html) {
        const outcome = analysePastedHtml(html);
        setNotice(outcome.notice);
        return outcome.html;
      },
      handleKeyDown(view, event) {
        syncSelectionFromDom(view, event);
        return false;
      },
    },
    onUpdate({ editor: instance, transaction }) {
      if (!transaction.docChanged) return;
      const normalised = normaliseEditorHtml(instance.getHTML());
      setNotice(normalised.notice);
      if (!normalised.ok) return;
      pendingEchoes.current = [...pendingEchoes.current, normalised.html];
      onChange(normalised.html);
    },
  });

  // Il confronto si fa quando il blocco viene **aperto**, non a ogni battuta:
  // è una diagnosi sul testo salvato, non un controllo sulla digitazione.
  useEffect(() => {
    if (!editor) return;
    const echo = pendingEchoes.current.lastIndexOf(value);
    if (echo >= 0) {
      // Questo valore e quelli prima sono tornati o superati.
      pendingEchoes.current = pendingEchoes.current.slice(echo + 1);
      return;
    }
    pendingEchoes.current = [];
    editor.commands.setContent(value, { emitUpdate: false });
    setNotice(null);
    setRepresentationWarning(
      editor.getHTML() === value
        ? null
        : 'L’editor non rappresenta questo testo esattamente come è salvato: finché non lo si modifica resta com’è, ma la prima modifica lo riscriverebbe nella forma qui sopra.',
    );
  }, [editor, value]);

  if (!editor) {
    return <p className="amoris-rich-text__status">Preparazione dell’editor…</p>;
  }

  const activeCommands: RichTextCommand[] = (
    [
      ['h2', editor.isActive('heading', { level: 2 })],
      ['h3', editor.isActive('heading', { level: 3 })],
      ['h4', editor.isActive('heading', { level: 4 })],
      ['h5', editor.isActive('heading', { level: 5 })],
      ['h6', editor.isActive('heading', { level: 6 })],
      ['bold', editor.isActive('bold')],
      ['italic', editor.isActive('italic')],
      ['underline', editor.isActive('underline')],
      ['strike', editor.isActive('strike')],
      ['bulletList', editor.isActive('bulletList')],
      ['orderedList', editor.isActive('orderedList')],
      ['link', editor.isActive('link')],
    ] as const
  )
    .filter(([, active]) => active)
    .map(([command]) => command);

  function runCommand(command: RichTextCommand): void {
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (command) {
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        chain.toggleHeading({ level: Number(command.slice(1)) as 2 | 3 | 4 | 5 | 6 }).run();
        return;
      case 'bold':
        chain.toggleBold().run();
        return;
      case 'italic':
        chain.toggleItalic().run();
        return;
      case 'underline':
        chain.toggleUnderline().run();
        return;
      case 'strike':
        chain.toggleStrike().run();
        return;
      case 'bulletList':
        chain.toggleBulletList().run();
        return;
      case 'orderedList':
        chain.toggleOrderedList().run();
        return;
      case 'table':
        chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        return;
      case 'link': {
        const href = editor.getAttributes('link')['href'];
        setLinkUrl(typeof href === 'string' ? href : '');
        setLinkOpen(true);
        return;
      }
      case 'image':
        // Non raggiungibile: il comando è spento, le immagini sono blocchi propri (DR-269).
        return;
    }
  }

  function applyLink(): void {
    if (!editor) return;
    const href = linkUrl.trim();
    setLinkOpen(false);
    if (href.length === 0) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }

  return (
    <div className="amoris-rich-text">
      <RichTextToolbar
        onCommand={runCommand}
        activeCommands={activeCommands}
        disabledCommands={disabled ? ALL_COMMANDS : ['image']}
        {...(notice ? { pasteRejectedText: notice } : {})}
      />
      <EditorContent editor={editor} className="amoris-rich-text__surface" />
      {representationWarning ? (
        <Alert variant="warning" title="Testo salvato in una forma diversa">
          {representationWarning}
        </Alert>
      ) : null}
      <p className="amoris-rich-text__hint">
        Il comando «Immagine» è spento: le immagini non stanno dentro il testo. Per metterne una nel
        contenuto si aggiunge un blocco «Immagine» con «Aggiungi blocco».
      </p>

      {linkOpen ? (
        <Dialog open onClose={() => setLinkOpen(false)} title="Collegamento">
          <TextField
            label="Indirizzo"
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            helpText="Lasciare vuoto per togliere il collegamento."
          />
          <div className="amoris-rich-text__dialog-actions">
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              Annulla
            </Button>
            <Button variant="primary" onClick={applyLink}>
              Applica
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
