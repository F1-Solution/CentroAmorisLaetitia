import { describe, expect, it } from 'vitest';
import { blockDocumentSchema } from '../../src/schema/document.js';
import { testBlockId, makeRichText } from '../helpers.js';

function section(children: unknown[]) {
  return {
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
      padding: { base: null, tablet: null, phone: null },
      classes: [],
    },
    children,
  };
}

function row(columnStructure: string, children: unknown[]) {
  return {
    type: 'row',
    id: testBlockId(),
    props: {
      columnStructure,
      fullWidth: false,
      customWidth: { mode: 'default', value: null },
      gutter: { custom: false, width: null },
      backgroundColor: null,
      backgroundMediaId: null,
      padding: { base: null, tablet: null, phone: null },
      classes: [],
    },
    children,
  };
}

function column(width: string, children: unknown[] = []) {
  return {
    type: 'column',
    id: testBlockId(),
    props: { width, padding: { base: null, tablet: null, phone: null }, classes: [] },
    children,
  };
}

describe('blockDocumentSchema — contenimento (§3.15)', () => {
  it('accetta un documento valido: section > row > column > rich_text', () => {
    const doc = {
      schema: 1,
      blocks: [
        section([row('1_2,1_2', [column('1_2', [makeRichText('<p>ciao</p>')]), column('1_2')])]),
      ],
    };
    expect(blockDocumentSchema.parse(doc).blocks).toHaveLength(1);
  });

  it('accetta un blocco di contenuto direttamente alla radice', () => {
    const doc = { schema: 1, blocks: [makeRichText('<p>ciao</p>')] };
    expect(() => blockDocumentSchema.parse(doc)).not.toThrow();
  });

  it('rifiuta una column alla radice (§1, regola 5)', () => {
    const doc = { schema: 1, blocks: [column('1_2')] };
    expect(() => blockDocumentSchema.parse(doc)).toThrow();
  });

  it('rifiuta un rich_text dentro una section direttamente (section contiene solo row)', () => {
    const doc = { schema: 1, blocks: [section([makeRichText('<p>x</p>')])] };
    expect(() => blockDocumentSchema.parse(doc)).toThrow();
  });

  it('rifiuta una row dentro una column (annidamento non ammesso)', () => {
    const doc = {
      schema: 1,
      blocks: [section([row('1_1', [column('1_1', [row('1_1', [column('1_1')])])])])],
    };
    expect(() => blockDocumentSchema.parse(doc)).toThrow();
  });

  it('rifiuta una column dentro una column', () => {
    const doc = { schema: 1, blocks: [section([row('1_1', [column('1_1', [column('1_1')])])])] };
    expect(() => blockDocumentSchema.parse(doc)).toThrow();
  });

  it('accetta media_text con figli di contenuto, esclude media_text annidato', () => {
    const mediaText = (children: unknown[]) => ({
      type: 'media_text',
      id: testBlockId(),
      props: {
        mediaId: null,
        mediaAlt: '',
        mediaVariant: null,
        mediaPosition: 'left',
        mediaWidthPercent: null,
        verticalAlignment: 'center',
        linkUrl: null,
        classes: [],
      },
      children,
    });
    const ok = { schema: 1, blocks: [mediaText([makeRichText('<p>x</p>')])] };
    expect(() => blockDocumentSchema.parse(ok)).not.toThrow();

    const notOk = { schema: 1, blocks: [mediaText([mediaText([])])] };
    expect(() => blockDocumentSchema.parse(notOk)).toThrow();
  });
});

describe('blockDocumentSchema — invariante di row (§3.2)', () => {
  it("rifiuta quando columnStructure non è l'unione ordinata delle colonne figlie", () => {
    const doc = { schema: 1, blocks: [section([row('1_2,1_2', [column('1_3'), column('2_3')])])] };
    expect(() => blockDocumentSchema.parse(doc)).toThrow();
  });

  it('accetta quando columnStructure corrisponde esattamente', () => {
    const doc = { schema: 1, blocks: [section([row('1_3,2_3', [column('1_3'), column('2_3')])])] };
    expect(() => blockDocumentSchema.parse(doc)).not.toThrow();
  });
});

describe('blockDocumentSchema — coerenza classe/proprietà (§7.2)', () => {
  it('rifiuta fullWidth=true senza la classe "is-fullwidth"', () => {
    const s = section([]);
    (s.props as { fullWidth: boolean }).fullWidth = true;
    const doc = { schema: 1, blocks: [s] };
    expect(() => blockDocumentSchema.parse(doc)).toThrow();
  });

  it('rifiuta la classe "is-fullwidth" senza fullWidth=true (contraddizione)', () => {
    const s = section([]);
    (s.props as { classes: string[] }).classes = ['is-fullwidth'];
    const doc = { schema: 1, blocks: [s] };
    expect(() => blockDocumentSchema.parse(doc)).toThrow();
  });

  it('accetta fullWidth=true con la classe coerente', () => {
    const s = section([]);
    (s.props as { fullWidth: boolean; classes: string[] }).fullWidth = true;
    (s.props as { fullWidth: boolean; classes: string[] }).classes = ['is-fullwidth'];
    const doc = { schema: 1, blocks: [s] };
    expect(() => blockDocumentSchema.parse(doc)).not.toThrow();
  });

  it('rifiuta textAlign="center" senza la classe "align-center" su rich_text', () => {
    const rt = makeRichText('<p>x</p>', { textAlign: 'center' });
    const doc = { schema: 1, blocks: [rt] };
    expect(() => blockDocumentSchema.parse(doc)).toThrow();
  });

  it('accetta textAlign="center" con la classe "align-center"', () => {
    const rt = makeRichText('<p>x</p>', { textAlign: 'center', classes: ['align-center'] });
    const doc = { schema: 1, blocks: [rt] };
    expect(() => blockDocumentSchema.parse(doc)).not.toThrow();
  });
});

describe('blockDocumentSchema — involucro (§1)', () => {
  it('rifiuta un documento senza "schema"', () => {
    expect(() => blockDocumentSchema.parse({ blocks: [] })).toThrow();
  });

  it('rifiuta uno "schema" diverso da 1', () => {
    expect(() => blockDocumentSchema.parse({ schema: 2, blocks: [] })).toThrow();
  });

  it('accetta un documento vuoto', () => {
    expect(blockDocumentSchema.parse({ schema: 1, blocks: [] }).blocks).toEqual([]);
  });

  it('rifiuta un blocco senza "children" (deve essere sempre presente, anche vuoto)', () => {
    const rt = makeRichText('<p>x</p>') as unknown as Record<string, unknown>;
    const { children: _children, ...withoutChildren } = rt;
    void _children;
    expect(() => blockDocumentSchema.parse({ schema: 1, blocks: [withoutChildren] })).toThrow();
  });
});
