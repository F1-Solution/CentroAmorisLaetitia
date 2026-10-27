import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocBlock } from '../../src/render/DocBlock.js';
import { BlocksDocument } from '../../src/render/BlocksDocument.js';
import type { DocumentsMap } from '../../src/render/data-maps.js';
import type { DocBlockNode } from '../../src/schema/block.js';
import { blockDocumentSchema } from '../../src/schema/document.js';
import { testBlockId } from '../helpers.js';

/**
 * Wave 1G-W7, T2k (DR-287): il blocco «Documento» rende sul sito un collegamento alla scheda
 * pubblica `/download/<slug>/`. Il testo è l'etichetta del blocco, o il titolo del documento.
 * Ruling del controller (privacy): se il documento non è fra quelli pubblici che la lettura
 * pubblica restituisce (riservato o eliminato), il blocco non rende nulla — né titolo, né
 * etichetta, né identificativo. Il segnaposto con l'etichetta resta solo per l'anteprima
 * dell'area, che lo chiede con la prop esplicita `preview`; senza, anche una mappa mancante vale
 * «nessun documento pubblico» (giro 1: il default sicuro). Titoli e slug sono inventati.
 */

const PUBLIC_ID = '11111111-1111-4111-8111-111111111111';
const HIDDEN_ID = '22222222-2222-4222-8222-222222222222';

const documents: DocumentsMap = {
  [PUBLIC_ID]: { slug: 'modulo-sintetico', title: 'Modulo sintetico di prova' },
};

function block(documentId: string, label: string | null, classes: string[] = []): DocBlockNode {
  return {
    type: 'document',
    id: testBlockId(),
    props: { documentId, label, display: 'link', classes },
    children: [],
  };
}

describe('DocBlock — collegamento alla scheda del documento (DR-287)', () => {
  it('con l’etichetta: un collegamento a /download/<slug>/ con il testo dell’etichetta', () => {
    const { container } = render(
      <DocBlock block={block(PUBLIC_ID, 'Scarica il modulo')} documents={documents} />,
    );
    const link = container.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/download/modulo-sintetico/');
    expect(link?.textContent).toBe('Scarica il modulo');
    expect(container.textContent).not.toContain('Modulo sintetico di prova');
  });

  it('senza etichetta: il testo è il titolo del documento', () => {
    const { container } = render(<DocBlock block={block(PUBLIC_ID, null)} documents={documents} />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/download/modulo-sintetico/');
    expect(link?.textContent).toBe('Modulo sintetico di prova');
  });

  it('conserva le classi del blocco sul contenitore', () => {
    const { container } = render(
      <DocBlock block={block(PUBLIC_ID, null, ['extra'])} documents={documents} />,
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.classList.contains('blk-document')).toBe(true);
    expect(wrapper?.classList.contains('extra')).toBe(true);
  });

  it('documento riservato o assente: non rende nulla, nemmeno etichetta o identificativo', () => {
    const { container } = render(
      <DocBlock block={block(HIDDEN_ID, 'Etichetta che non deve uscire')} documents={documents} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('anteprima dell’area (`preview`): resta il segnaposto con l’etichetta', () => {
    const { container } = render(
      <DocBlock block={block(PUBLIC_ID, 'Scarica il modulo')} preview />,
    );
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('Scarica il modulo');
  });

  it('senza mappa e senza `preview` (un percorso del sito che la dimentica): nulla', () => {
    const { container } = render(<DocBlock block={block(PUBLIC_ID, 'Scarica il modulo')} />);
    expect(container.innerHTML).toBe('');
  });

  it('etichetta vuota o di soli spazi: il testo è il titolo del documento', () => {
    for (const label of ['', '   ']) {
      const { container, unmount } = render(
        <DocBlock block={block(PUBLIC_ID, label)} documents={documents} />,
      );
      expect(container.querySelector('a')?.textContent).toBe('Modulo sintetico di prova');
      unmount();
    }
  });

  it('dentro «media e testo»: collegamento per il pubblico, nulla per il riservato', () => {
    const doc = blockDocumentSchema.parse({
      schema: 1,
      blocks: [
        {
          type: 'media_text',
          id: testBlockId(),
          props: {},
          children: [block(PUBLIC_ID, null), block(HIDDEN_ID, 'Etichetta riservata')],
        },
      ],
    });
    const { container } = render(<BlocksDocument document={doc} documents={documents} />);
    const links = container.querySelectorAll('.blk-media-text-content a');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('/download/modulo-sintetico/');
    expect(container.innerHTML).not.toContain(HIDDEN_ID);
    expect(container.textContent).not.toContain('Etichetta riservata');
  });

  it('dentro «media e testo» l’anteprima dell’area riceve il segnaposto', () => {
    const doc = blockDocumentSchema.parse({
      schema: 1,
      blocks: [
        {
          type: 'media_text',
          id: testBlockId(),
          props: {},
          children: [block(PUBLIC_ID, 'Etichetta in anteprima')],
        },
      ],
    });
    const { container } = render(<BlocksDocument document={doc} preview />);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('Etichetta in anteprima');
  });

  it('BlocksDocument passa la mappa dei documenti anche dentro sezione, riga e colonna', () => {
    const doc = blockDocumentSchema.parse({
      schema: 1,
      blocks: [
        {
          type: 'section',
          id: testBlockId(),
          props: {},
          children: [
            {
              type: 'row',
              id: testBlockId(),
              props: { columnStructure: '1_1' },
              children: [
                {
                  type: 'column',
                  id: testBlockId(),
                  props: { width: '1_1' },
                  children: [block(PUBLIC_ID, null), block(HIDDEN_ID, 'Non deve uscire')],
                },
              ],
            },
          ],
        },
      ],
    });
    const { container } = render(<BlocksDocument document={doc} documents={documents} />);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe('/download/modulo-sintetico/');
    expect(container.innerHTML).not.toContain(HIDDEN_ID);
    expect(container.textContent).not.toContain('Non deve uscire');
  });
});
