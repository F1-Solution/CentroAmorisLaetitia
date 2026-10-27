import { blockDocumentSchema } from '@amoris/blocks';
import { describe, expect, it } from 'vitest';
import {
  createBlock,
  creatableChildTypes,
  findBlock,
  insertBlock,
  labelOf,
  moveBlockBy,
  moveBlockTo,
  canDropBlock,
  parentIdOf,
  removeBlock,
  setColumnStructure,
  siblingsOf,
  toTreeNodes,
} from '../src/lib/editor/tree';
import { syntheticDocument } from './fixtures';

const COLUMN = 'b_0000000000a3';
const FIRST_TEXT = 'b_0000000000a4';
const SEPARATOR = 'b_0000000000a5';
const SECOND_TEXT = 'b_0000000000a6';
const RESERVE = 'b_0000000000b1';

function idsIn(document: Parameters<typeof siblingsOf>[0], parentId: string | null): string[] {
  return siblingsOf(document, parentId).map((block) => block.id);
}

describe('operazioni sull’albero (criterio 1D-30)', () => {
  it('non modificano il documento ricevuto', () => {
    const before = JSON.stringify(syntheticDocument);
    moveBlockBy(syntheticDocument, FIRST_TEXT, 1);
    removeBlock(syntheticDocument, SEPARATOR);
    insertBlock(syntheticDocument, COLUMN, 'rich_text');
    // Senza questa proprietà il confronto del criterio 1D-36 direbbe sempre
    // «uguale», perché confronterebbe un oggetto con sé stesso.
    expect(JSON.stringify(syntheticDocument)).toBe(before);
  });

  it('sposta un blocco dentro la sua colonna', () => {
    const next = moveBlockBy(syntheticDocument, FIRST_TEXT, 1);
    expect(idsIn(next, COLUMN)).toEqual([SEPARATOR, FIRST_TEXT, SECOND_TEXT]);
  });

  it('non sposta oltre i due estremi', () => {
    expect(idsIn(moveBlockBy(syntheticDocument, FIRST_TEXT, -1), COLUMN)).toEqual(
      idsIn(syntheticDocument, COLUMN),
    );
    expect(idsIn(moveBlockBy(syntheticDocument, SECOND_TEXT, 1), COLUMN)).toEqual(
      idsIn(syntheticDocument, COLUMN),
    );
  });

  it('elimina un blocco e lascia gli altri dove sono', () => {
    const next = removeBlock(syntheticDocument, SEPARATOR);
    expect(idsIn(next, COLUMN)).toEqual([FIRST_TEXT, SECOND_TEXT]);
    expect(findBlock(next.blocks, SEPARATOR)).toBeNull();
  });

  it('aggiunge un blocco in coda al contenitore chiesto, e resta valido', () => {
    const { document, insertedId } = insertBlock(syntheticDocument, COLUMN, 'rich_text');
    expect(idsIn(document, COLUMN).at(-1)).toBe(insertedId);
    expect(blockDocumentSchema.safeParse(document).success).toBe(true);
  });

  it('ogni tipo creabile produce un blocco che lo schema accetta', () => {
    for (const type of creatableChildTypes(syntheticDocument, COLUMN)) {
      const { document } = insertBlock(syntheticDocument, COLUMN, type, {
        sliderId: '66666666-6666-4666-8666-666666666666',
        mediaId: '22222222-2222-4222-8222-222222222222',
        alt: 'Immagine sintetica',
        documentId: '77777777-7777-4777-8777-777777777777',
      });
      const outcome = blockDocumentSchema.safeParse(document);
      expect(outcome.success, `il blocco «${type}» deve essere valido`).toBe(true);
    }
  });

  it('un tipo che questa fase non sa creare non si crea per sbaglio', () => {
    expect(() => createBlock('form')).toThrow();
    expect(creatableChildTypes(syntheticDocument, COLUMN)).not.toContain('form');
  });

  it('il contenitore decide che cosa può contenere', () => {
    // La radice non accetta `column` (BLOCK-MODEL.md §1, regola 5) e una riga
    // accetta solo colonne, che non sono fra i tipi creabili.
    expect(creatableChildTypes(syntheticDocument, 'b_0000000000a2')).toEqual([]);
    expect(creatableChildTypes(syntheticDocument, null)).toContain('rich_text');
  });
});

const ROW = 'b_0000000000a2';

describe('trascinamento a due esiti (DR-085, DR-097)', () => {
  it('«dentro» una colonna porta il blocco in coda ai suoi figli, anche da un altro contenitore', () => {
    const outcome = moveBlockTo(syntheticDocument, RESERVE, COLUMN, 'inside');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(idsIn(outcome.document, COLUMN)).toEqual([FIRST_TEXT, SEPARATOR, SECOND_TEXT, RESERVE]);
    expect(idsIn(outcome.document, null)).not.toContain(RESERVE);
    expect(blockDocumentSchema.safeParse(outcome.document).success).toBe(true);
  });

  it('«accanto» colloca il blocco prima o dopo quello di arrivo, nel suo contenitore', () => {
    const after = moveBlockTo(syntheticDocument, FIRST_TEXT, RESERVE, 'after');
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(idsIn(after.document, null).at(-1)).toBe(FIRST_TEXT);
    expect(idsIn(after.document, COLUMN)).toEqual([SEPARATOR, SECOND_TEXT]);

    const before = moveBlockTo(syntheticDocument, SECOND_TEXT, FIRST_TEXT, 'before');
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(idsIn(before.document, COLUMN)).toEqual([SECOND_TEXT, FIRST_TEXT, SEPARATOR]);
  });

  it('rifiuta «dentro» un blocco che non accetta figli, e il documento non cambia', () => {
    expect(canDropBlock(syntheticDocument, FIRST_TEXT, SECOND_TEXT, 'inside')).not.toBeNull();
    const outcome = moveBlockTo(syntheticDocument, FIRST_TEXT, SECOND_TEXT, 'inside');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('rimasto dov’era');
  });

  it('rifiuta un tipo che il contenitore di arrivo non ammette: una colonna alla radice', () => {
    expect(moveBlockTo(syntheticDocument, COLUMN, RESERVE, 'after').ok).toBe(false);
  });

  it('rifiuta di portare un blocco dentro un proprio discendente', () => {
    expect(canDropBlock(syntheticDocument, ROW, COLUMN, 'inside')).not.toBeNull();
    expect(moveBlockTo(syntheticDocument, ROW, FIRST_TEXT, 'before').ok).toBe(false);
  });

  it('lasciare un blocco su sé stesso non cambia nulla', () => {
    const outcome = moveBlockTo(syntheticDocument, FIRST_TEXT, FIRST_TEXT, 'inside');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.document).toBe(syntheticDocument);
  });

  it('non modifica il documento ricevuto', () => {
    const before = JSON.stringify(syntheticDocument);
    moveBlockTo(syntheticDocument, RESERVE, COLUMN, 'inside');
    expect(JSON.stringify(syntheticDocument)).toBe(before);
  });
});

/**
 * Una riga con due colonne di larghezza diversa, e una seconda riga: il caso in
 * cui spostare una colonna potrebbe rompere `columnStructure` (`BLOCK-MODEL.md`
 * §3.2). Costruito dal documento sintetico, nessun dato reale.
 */
function documentWithTwoRows(): typeof syntheticDocument {
  const doc = structuredClone(syntheticDocument);
  const section = doc.blocks[0] as {
    children: { type: string; props: Record<string, unknown>; children: unknown[]; id: string }[];
  };
  const row = section.children[0]!;
  const first = row.children[0] as {
    id: string;
    props: Record<string, unknown>;
    children: unknown[];
  };
  first.props = { ...first.props, width: '1_3' };
  const second = { ...structuredClone(first), id: 'b_0000000000c1', children: [] as unknown[] };
  second.props = { ...second.props, width: '2_3' };
  row.children = [first, second];
  row.props = { ...row.props, columnStructure: '1_3,2_3' };
  const otherColumn = {
    ...structuredClone(first),
    id: 'b_0000000000d3',
    children: [] as unknown[],
  };
  otherColumn.props = { ...otherColumn.props, width: '1_1' };
  const otherRow = { ...structuredClone(row), id: 'b_0000000000d2', children: [otherColumn] };
  otherRow.props = { ...otherRow.props, columnStructure: '1_1' };
  section.children = [row, otherRow];
  return doc;
}

describe('colonne e `columnStructure` (BLOCK-MODEL.md §3.2)', () => {
  it('il documento di prova è valido', () => {
    expect(blockDocumentSchema.safeParse(documentWithTwoRows()).success).toBe(true);
  });

  it('riordinare le colonne di una riga col trascinamento aggiorna `columnStructure`', () => {
    const outcome = moveBlockTo(documentWithTwoRows(), 'b_0000000000c1', COLUMN, 'before');
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(blockDocumentSchema.safeParse(outcome.document).success).toBe(true);
  });

  it('riordinarle con «Sposta su» aggiorna anch’esso `columnStructure`', () => {
    const next = moveBlockBy(documentWithTwoRows(), 'b_0000000000c1', -1);
    expect(blockDocumentSchema.safeParse(next).success).toBe(true);
  });

  it('una colonna non passa in un’altra riga: cambierebbe la ripartizione di entrambe', () => {
    expect(canDropBlock(documentWithTwoRows(), COLUMN, 'b_0000000000d3', 'after')).not.toBeNull();
    expect(canDropBlock(documentWithTwoRows(), COLUMN, 'b_0000000000d2', 'inside')).not.toBeNull();
    expect(moveBlockTo(documentWithTwoRows(), COLUMN, 'b_0000000000d3', 'before').ok).toBe(false);
  });
});

describe('ripartizione delle colonne', () => {
  it('rifiuta una ripartizione con un numero di colonne diverso', () => {
    // Cambiarla sola romperebbe l'invariante di `BLOCK-MODEL.md` §3.2 fra
    // `columnStructure` e i `width` delle colonne figlie.
    const next = setColumnStructure(syntheticDocument, 'b_0000000000a2', '2_4,2_4');
    expect(next).toBe(syntheticDocument);
  });

  it('cambia insieme la riga e le larghezze delle colonne', () => {
    const one = insertBlock(syntheticDocument, COLUMN, 'separator').document;
    const next = setColumnStructure(one, 'b_0000000000a2', '4_4');
    const row = findBlock(next.blocks, 'b_0000000000a2');
    expect(row?.type === 'row' && row.props.columnStructure).toBe('4_4');
    expect(blockDocumentSchema.safeParse(next).success).toBe(true);
  });
});

describe('albero e riepiloghi', () => {
  it('il riepilogo di un testo è il suo inizio, non il markup', () => {
    const block = findBlock(syntheticDocument.blocks, FIRST_TEXT);
    expect(block && labelOf(block)).toBe('Primo paragrafo di prova.');
  });

  it('il riepilogo del blocco di riserva dice che cosa non è stato convertito', () => {
    const block = findBlock(syntheticDocument.blocks, RESERVE);
    expect(block && labelOf(block)).toBe('et_pb_finto');
  });

  it('i contenitori portano i figli, i blocchi di contenuto no', () => {
    const [section] = toTreeNodes(syntheticDocument.blocks);
    expect(section?.children?.[0]?.children?.[0]?.children?.length).toBe(3);
    const reserve = toTreeNodes(syntheticDocument.blocks)[1];
    expect(reserve?.children).toBeUndefined();
  });

  it('parentIdOf distingue «nella radice» da «non esiste»', () => {
    expect(parentIdOf(syntheticDocument.blocks, RESERVE)).toBeNull();
    expect(parentIdOf(syntheticDocument.blocks, FIRST_TEXT)).toBe(COLUMN);
    expect(parentIdOf(syntheticDocument.blocks, 'b_0000000000ff')).toBeUndefined();
  });
});
