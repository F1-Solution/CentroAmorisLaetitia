import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlocksDocument } from '../../src/render/BlocksDocument.js';
import { SPACING_VARIABLES, spacingVariables } from '../../src/render/spacing.js';
import { testBlockId, makeRichText } from '../helpers.js';
import type { BlockDocument } from '../../src/schema/document.js';

/**
 * Le spaziature di Divi come proprietà personalizzate CSS (DR-071, ADR-005 §3.3
 * regola 2 riformulata il 2026-10-09) e il criterio 1E-15: nell'HTML reso,
 * l'attributo `style` porta **solo** valori di un elenco chiuso di proprietà
 * personalizzate, mai una regola CSS ordinaria.
 */

const box = (top: string | null, bottom: string | null) => ({
  top,
  right: null,
  bottom,
  left: null,
});

describe('spaziature come proprietà personalizzate (DR-071)', () => {
  it('ogni lato valorizzato diventa una variabile, con il suffisso del punto di rottura', () => {
    expect(
      spacingVariables({
        base: box('27px', '0px'),
        tablet: box('50px', null),
        phone: { top: null, right: '4%', bottom: null, left: '1.5em' },
      }),
    ).toEqual({
      '--blk-pad-top': '27px',
      '--blk-pad-bottom': '0px',
      '--blk-pad-top-t': '50px',
      '--blk-pad-right-p': '4%',
      '--blk-pad-left-p': '1.5em',
    });
  });

  it('senza valori non produce alcun attributo', () => {
    expect(spacingVariables({ base: null, tablet: null, phone: null })).toBeUndefined();
  });

  it('un valore che non è una lunghezza si scarta, anche se lo schema lo avesse lasciato passare', () => {
    expect(
      spacingVariables({ base: box('10px;color:red', null), tablet: null, phone: null }),
    ).toBeUndefined();
  });

  it('l’elenco chiuso ha ventiquattro nomi: padding e margini, quattro lati per tre punti di rottura (R)', () => {
    expect(SPACING_VARIABLES).toHaveLength(24);
    expect(SPACING_VARIABLES).toContain('--blk-mar-top-t');
  });

  it('i margini personalizzati diventano variabili `--blk-mar-*` accanto al padding (R)', () => {
    expect(
      spacingVariables(
        { base: box('0px', null), tablet: null, phone: null },
        { base: box('-23px', null), tablet: null, phone: box(null, '10px') },
      ),
    ).toEqual({
      '--blk-pad-top': '0px',
      '--blk-mar-top': '-23px',
      '--blk-mar-bottom-p': '10px',
    });
  });
});

describe('criterio 1E-15: nessuna regola CSS ordinaria in linea', () => {
  const padding = { base: box('54px', '0px'), tablet: box('50px', '50px'), phone: null };
  const document: BlockDocument = {
    schema: 1,
    blocks: [
      {
        type: 'section',
        id: testBlockId(),
        props: {
          fullWidth: false,
          transparentBackground: false,
          backgroundColor: null,
          backgroundMediaId: null,
          parallax: false,
          innerShadow: false,
          customWidth: { mode: 'default', value: null },
          padding,
          classes: [],
        },
        children: [
          {
            type: 'row',
            id: testBlockId(),
            props: {
              structure: '4_4',
              backgroundColor: null,
              backgroundMediaId: null,
              customWidth: { mode: 'default', value: null },
              gutterWidth: null,
              equalizeColumnHeights: false,
              padding,
              classes: [],
            },
            children: [
              {
                type: 'column',
                id: testBlockId(),
                props: { width: '4_4', padding, classes: [] },
                children: [makeRichText('<p>Testo sintetico.</p>', { padding })],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as BlockDocument;

  it('i quattro tipi con spaziature le portano come variabili', () => {
    const { container } = render(<BlocksDocument document={document} />);
    const styled = container.querySelectorAll('[style]');
    expect(styled).toHaveLength(4);
    for (const element of styled) {
      expect((element as HTMLElement).style.getPropertyValue('--blk-pad-top')).toBe('54px');
      expect((element as HTMLElement).style.getPropertyValue('--blk-pad-top-t')).toBe('50px');
    }
  });

  it('ogni dichiarazione in linea è una variabile dell’elenco chiuso', () => {
    const { container } = render(<BlocksDocument document={document} />);
    for (const element of container.querySelectorAll('[style]')) {
      const style = (element as HTMLElement).style;
      for (let i = 0; i < style.length; i += 1) {
        expect(SPACING_VARIABLES).toContain(style.item(i));
      }
    }
  });
});
