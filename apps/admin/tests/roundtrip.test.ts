import { blockDocumentSchema, serializeBlockDocument } from '@amoris/blocks';
import { describe, expect, it } from 'vitest';
import {
  deepEqual,
  isUnchanged,
  openContent,
  savePayloadOf,
} from '../src/lib/editor/roundtrip';
import { moveBlockBy, removeBlock } from '../src/lib/editor/tree';
import { syntheticContent, syntheticDocument } from './fixtures';

/**
 * **Criterio 1D-36 e requisito F-05.** Aprire un contenuto e salvarlo senza
 * modifiche non deve cambiare né i blocchi né l'HTML reso.
 *
 * Il test è scritto **contro il contenuto**, non contro la copia di lavoro, come
 * DR-068 impone: la bozza è un record distinto e ciò che il criterio protegge è
 * `contents`, cioè quello che il pubblico legge.
 */

describe('andata e ritorno sul contenuto (criterio 1D-36)', () => {
  it('aprire e salvare senza modifiche non cambia i blocchi', () => {
    const outcome = openContent(syntheticContent);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const saved = savePayloadOf(outcome.state);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.payload.blocks).toEqual(syntheticContent.blocks);
    expect(deepEqual(saved.payload.blocks, syntheticContent.blocks)).toBe(true);
  });

  it('aprire e salvare senza modifiche non cambia l’HTML reso', () => {
    const outcome = openContent(syntheticContent);
    if (!outcome.ok) throw new Error('il contenuto sintetico deve aprirsi');

    const saved = savePayloadOf(outcome.state);
    if (!saved.ok) throw new Error('il documento sintetico deve essere salvabile');
    expect(saved.payload.contentHtml).toBe(syntheticContent.contentHtml);
  });

  it('`isUnchanged` è vero appena aperto, ed è ciò che impedisce la scrittura', () => {
    const outcome = openContent(syntheticContent);
    if (!outcome.ok) throw new Error('il contenuto sintetico deve aprirsi');

    expect(isUnchanged(syntheticContent, outcome.state)).toBe(true);
  });

  it('il documento sintetico è già in forma canonica: nessun avviso all’apertura', () => {
    // Se fallisse, il test qui sopra passerebbe per il motivo sbagliato: un
    // documento incompleto verrebbe completato da Zod e il confronto tornerebbe
    // uguale perché confronta due volte la stessa normalizzazione.
    expect(blockDocumentSchema.parse(syntheticDocument)).toEqual(syntheticDocument);
    const outcome = openContent(syntheticContent);
    if (!outcome.ok) throw new Error('il contenuto sintetico deve aprirsi');
    expect(outcome.warnings).toEqual([]);
  });

  it('una modifica vera si vede: `isUnchanged` diventa falso', () => {
    const outcome = openContent(syntheticContent);
    if (!outcome.ok) throw new Error('il contenuto sintetico deve aprirsi');

    const moved = {
      ...outcome.state,
      document: moveBlockBy(outcome.state.document, 'b_0000000000a4', 1),
    };
    expect(isUnchanged(syntheticContent, moved)).toBe(false);
    const saved = savePayloadOf(moved);
    if (!saved.ok) throw new Error('lo spostamento deve restare salvabile');
    expect(saved.payload.contentHtml).not.toBe(syntheticContent.contentHtml);
  });

  it('eliminare un blocco cambia l’HTML, e l’HTML resta quello che il modello produce', () => {
    const outcome = openContent(syntheticContent);
    if (!outcome.ok) throw new Error('il contenuto sintetico deve aprirsi');

    const next = {
      ...outcome.state,
      document: removeBlock(outcome.state.document, 'b_0000000000b1'),
    };
    const saved = savePayloadOf(next);
    if (!saved.ok) throw new Error('l’eliminazione deve restare salvabile');
    expect(saved.payload.contentHtml).toBe(serializeBlockDocument(next.document));
    expect(saved.payload.contentHtml).not.toContain('frammento conservato');
  });

  it('un documento non valido non si apre: aprirlo significherebbe riscriverlo', () => {
    const broken = { ...syntheticContent, blocks: { schema: 1, blocks: [{ type: 'inesistente' }] } };
    const outcome = openContent(broken);
    expect(outcome.ok).toBe(false);
  });

  it('un documento salvato fuori forma canonica produce un avviso, non una riscrittura', () => {
    // Un blocco a cui manca una proprietà con valore predefinito: Zod la
    // aggiungerebbe, e salvare cambierebbe il documento senza che nessuno abbia
    // modificato nulla. L'editor lo dichiara e lascia il documento com'è.
    const incomplete = {
      schema: 1,
      blocks: [
        {
          type: 'separator',
          id: 'b_0000000000c1',
          props: { style: 'default' },
          children: [],
        },
      ],
    };
    const content = {
      ...syntheticContent,
      blocks: incomplete,
      contentHtml: serializeBlockDocument(blockDocumentSchema.parse(incomplete)),
    };

    const outcome = openContent(content);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.warnings.length).toBeGreaterThan(0);
    // Il documento nello stato è quello letto, non quello normalizzato.
    expect(outcome.state.document).toBe(incomplete);
  });
});

describe('deepEqual', () => {
  it('non dipende dall’ordine delle chiavi', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('distingue chiavi mancanti e valori diversi', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });
});
