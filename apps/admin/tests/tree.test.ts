import { blockDocumentSchema } from '@amoris/blocks';
import { describe, expect, it } from 'vitest';
import {
  createBlock,
  creatableChildTypes,
  findBlock,
  insertBlock,
  labelOf,
  moveBlockBy,
  moveBlockOnto,
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
      const { document } = insertBlock(syntheticDocument, COLUMN, type);
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

describe('trascinamento (DR-069)', () => {
  it('sposta il blocco preso nella posizione di quello su cui è stato lasciato', () => {
    const outcome = moveBlockOnto(syntheticDocument, SECOND_TEXT, FIRST_TEXT);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(idsIn(outcome.document, COLUMN)).toEqual([SECOND_TEXT, FIRST_TEXT, SEPARATOR]);
  });

  it('rifiuta lo spostamento fra contenitori diversi, e dice perché', () => {
    // ADR-006 §3.2 limita lo spostamento a «dentro una colonna»: DR-069 ha
    // deciso il gesto, non il perimetro.
    const outcome = moveBlockOnto(syntheticDocument, FIRST_TEXT, RESERVE);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.reason).toContain('dentro il contenitore');
  });

  it('lasciare un blocco su sé stesso non cambia nulla', () => {
    const outcome = moveBlockOnto(syntheticDocument, FIRST_TEXT, FIRST_TEXT);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.document).toBe(syntheticDocument);
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
