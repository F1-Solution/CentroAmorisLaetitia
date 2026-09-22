import { describe, expect, it } from 'vitest';
import {
  buildTree,
  flatten,
  indent,
  moveDown,
  moveUp,
  outdent,
  patchesFor,
} from '../src/lib/menu/tree';

/**
 * Annidare e spostare, che è metà del criterio 1D-32.
 *
 * Le voci sono inventate e hanno identificativi leggibili di proposito: un test
 * che fallisce deve dire quale voce è finita nel posto sbagliato, non stampare
 * quattro identificativi casuali.
 */

interface Voce {
  readonly id: string;
  readonly parentId: string | null;
  readonly position: number;
}

const voce = (id: string, parentId: string | null, position: number): Voce => ({
  id,
  parentId,
  position,
});

/** Tre voci di primo livello: a, b, c. */
const piatto: Voce[] = [voce('a', null, 0), voce('b', null, 1), voce('c', null, 2)];

/** a con due figli, poi b. */
const annidato: Voce[] = [
  voce('a', null, 0),
  voce('a1', 'a', 0),
  voce('a2', 'a', 1),
  voce('b', null, 1),
];

const etichette = (nodes: ReturnType<typeof buildTree<Voce>>): string =>
  nodes
    .map((node) =>
      node.children.length > 0
        ? `${node.item.id}(${etichette([...node.children])})`
        : node.item.id,
    )
    .join(' ');

describe('costruzione dell’albero', () => {
  it('raggruppa per genitore e ordina per posizione', () => {
    expect(etichette(buildTree(annidato))).toBe('a(a1 a2) b');
  });

  it('una voce il cui genitore non esiste risale alla radice invece di sparire', () => {
    const orfana = [voce('a', null, 0), voce('x', 'mai-esistito', 1)];
    expect(etichette(buildTree(orfana))).toBe('a x');
  });
});

describe('spostamenti', () => {
  it('sposta su scambia con la sorella precedente', () => {
    expect(etichette(moveUp(buildTree(piatto), 'b'))).toBe('b a c');
  });

  it('sposta su sulla prima voce non cambia nulla', () => {
    expect(etichette(moveUp(buildTree(piatto), 'a'))).toBe('a b c');
  });

  it('sposta giù scambia con la sorella successiva', () => {
    expect(etichette(moveDown(buildTree(piatto), 'b'))).toBe('a c b');
  });

  it('sposta giù sull’ultima voce non cambia nulla', () => {
    expect(etichette(moveDown(buildTree(piatto), 'c'))).toBe('a b c');
  });

  it('annida la voce sotto la sorella che la precede', () => {
    expect(etichette(indent(buildTree(piatto), 'b'))).toBe('a(b) c');
  });

  it('annidare la prima voce non è possibile: non ha una sorella prima di sé', () => {
    expect(etichette(indent(buildTree(piatto), 'a'))).toBe('a b c');
  });

  it('annidare porta con sé i figli', () => {
    const albero = indent(buildTree(annidato), 'b');
    expect(etichette(albero)).toBe('a(a1 a2 b)');
  });

  it('riporta al livello superiore, subito dopo il genitore', () => {
    expect(etichette(outdent(buildTree(annidato), 'a1'))).toBe('a(a2) a1 b');
  });

  it('riportare al livello superiore una voce di radice non cambia nulla', () => {
    expect(etichette(outdent(buildTree(annidato), 'a'))).toBe('a(a1 a2) b');
  });
});

describe('che cosa si manda al servizio', () => {
  it('rinumera i fratelli da zero', () => {
    const patches = flatten(buildTree(annidato));
    expect(patches).toEqual([
      { id: 'a', parentId: null, position: 0 },
      { id: 'a1', parentId: 'a', position: 0 },
      { id: 'a2', parentId: 'a', position: 1 },
      { id: 'b', parentId: null, position: 1 },
    ]);
  });

  it('manda solo le voci che si sono davvero spostate', () => {
    const patches = patchesFor(piatto, moveUp(buildTree(piatto), 'b'));
    expect(patches.map((patch) => patch.id).sort()).toEqual(['a', 'b']);
  });

  it('un albero identico non produce alcuna scrittura', () => {
    expect(patchesFor(annidato, buildTree(annidato))).toEqual([]);
  });
});
