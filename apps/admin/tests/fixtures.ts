import { serializeBlockDocument, type BlockDocument } from '@amoris/blocks';
import type { ContentDetail } from '../src/lib/editor/roundtrip';

/**
 * Un documento **sintetico**. Nessun contenuto reale del Centro entra nei test:
 * `CLAUDE.md` lo vieta, e un documento inventato prova esattamente le stesse
 * proprietà.
 *
 * La forma imita quella che l'importer produce: albero completo
 * sezione → riga → colonna, proprietà scritte per esteso invece che lasciate ai
 * valori predefiniti dello schema. È quello che serve al criterio 1D-36, perché
 * un documento «minimo» verrebbe completato da Zod alla prima validazione e il
 * confronto risulterebbe uguale per il motivo sbagliato.
 */

const emptySpacing = { base: null, tablet: null, phone: null };
const defaultWidth = { mode: 'default' as const, value: null };

export const syntheticDocument: BlockDocument = {
  schema: 1,
  blocks: [
    {
      type: 'section',
      id: 'b_0000000000a1',
      props: {
        fullWidth: false,
        transparentBackground: false,
        backgroundColor: null,
        backgroundMediaId: null,
        parallax: false,
        innerShadow: false,
        customWidth: defaultWidth,
        padding: emptySpacing,
        classes: [],
      },
      children: [
        {
          type: 'row',
          id: 'b_0000000000a2',
          props: {
            columnStructure: '4_4',
            fullWidth: false,
            customWidth: defaultWidth,
            gutter: { custom: false, width: null },
            backgroundColor: null,
            backgroundMediaId: null,
            padding: emptySpacing,
            margin: emptySpacing,
            classes: [],
          },
          children: [
            {
              type: 'column',
              id: 'b_0000000000a3',
              props: { width: '4_4', padding: emptySpacing, classes: [] },
              children: [
                {
                  type: 'rich_text',
                  id: 'b_0000000000a4',
                  props: {
                    html: '<p>Primo paragrafo di prova.</p>',
                    textAlign: null,
                    backgroundLayout: null,
                    border: null,
                    padding: emptySpacing,
                    margin: emptySpacing,
                    classes: [],
                  },
                  children: [],
                },
                {
                  type: 'separator',
                  id: 'b_0000000000a5',
                  props: { style: 'default', classes: [] },
                  children: [],
                },
                {
                  type: 'rich_text',
                  id: 'b_0000000000a6',
                  props: {
                    html: '<p>Secondo paragrafo di prova.</p>',
                    textAlign: null,
                    backgroundLayout: null,
                    border: null,
                    padding: emptySpacing,
                    margin: emptySpacing,
                    classes: [],
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'html',
      id: 'b_0000000000b1',
      props: {
        html: '<div class="legacy">frammento conservato</div>',
        reason: 'divi_unmapped_module',
        detail: 'et_pb_finto',
        classes: [],
      },
      children: [],
    },
  ],
};

export const syntheticContent: ContentDetail = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'page',
  status: 'published',
  slug: 'pagina-di-prova',
  path: '/pagina-di-prova/',
  parentId: null,
  title: 'Pagina di prova',
  excerpt: null,
  showTitle: true,
  pageLayout: 'right_sidebar',
  blocks: syntheticDocument,
  contentHtml: serializeBlockDocument(syntheticDocument),
  updatedAt: '2026-09-21T10:00:00.000Z',
  publishedAt: '2026-09-20T10:00:00.000Z',
};
