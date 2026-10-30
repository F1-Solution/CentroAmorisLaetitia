import { describe, expect, it } from 'vitest';
import {
  buildTree,
  flatten,
  indent,
  moveDown,
  moveItemTo,
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
      node.children.length > 0 ? `${node.item.id}(${etichette([...node.children])})` : node.item.id,
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

/** Tre radici, e b con un figlio. */
const conFiglio: Voce[] = [
  voce('a', null, 0),
  voce('b', null, 1),
  voce('b1', 'b', 0),
  voce('c', null, 2),
];
const alberoConFiglio = buildTree(conFiglio);

describe('moveItemTo — trascinamento a due esiti (DR-082)', () => {
  it('«dentro» annida la voce in coda ai figli della voce di arrivo', () => {
    const next = moveItemTo(alberoConFiglio, 'a', 'b', 'inside')!;
    expect(flatten(next)).toEqual([
      { id: 'b', parentId: null, position: 0 },
      { id: 'b1', parentId: 'b', position: 0 },
      { id: 'a', parentId: 'b', position: 1 },
      { id: 'c', parentId: null, position: 1 },
    ]);
  });

  it('«prima» e «dopo» la collocano accanto, allo stesso livello dell’arrivo', () => {
    expect(flatten(moveItemTo(alberoConFiglio, 'c', 'b1', 'before')!)).toContainEqual({
      id: 'c',
      parentId: 'b',
      position: 0,
    });
    expect(flatten(moveItemTo(alberoConFiglio, 'a', 'c', 'after')!).at(-1)).toEqual({
      id: 'a',
      parentId: null,
      position: 2,
    });
  });

  it('rifiuta di lasciare una voce dentro sé stessa o una propria sottovoce', () => {
    expect(moveItemTo(alberoConFiglio, 'b', 'b1', 'inside')).toBeNull();
    expect(moveItemTo(alberoConFiglio, 'b', 'b1', 'after')).toBeNull();
    expect(moveItemTo(alberoConFiglio, 'b', 'b', 'inside')).toBeNull();
  });

  it('lasciarla dove già si trova non produce scritture', () => {
    expect(patchesFor(conFiglio, moveItemTo(alberoConFiglio, 'b', 'c', 'before')!)).toEqual([]);
  });

  it('una voce sconosciuta non sposta nulla', () => {
    expect(moveItemTo(alberoConFiglio, 'z', 'b', 'inside')).toBeNull();
    expect(moveItemTo(alberoConFiglio, 'a', 'z', 'after')).toBeNull();
  });
});

describe('W8-16 — posizioni sparse come quelle importate', () => {
  const sparse: Voce[] = [
    voce('a', null, 1),
    voce('b', null, 2),
    voce('c', null, 3),
    voce('d', null, 9),
    voce('e', null, 11),
  ];

  it('scambiare due fratelli scrive solo quei due, senza rinumerare gli altri', () => {
    const patches = patchesFor(sparse, moveUp(buildTree(sparse), 'b'));
    expect(patches).toEqual([
      { id: 'b', parentId: null, position: 1 },
      { id: 'a', parentId: null, position: 2 },
    ]);
  });

  it('annidare una voce scrive solo quella voce', () => {
    const patches = patchesFor(sparse, indent(buildTree(sparse), 'c'));
    expect(patches).toEqual([{ id: 'c', parentId: 'b', position: 0 }]);
  });

  it('riportare al livello superiore sfrutta il vuoto fra le posizioni', () => {
    const conFiglio: Voce[] = [voce('a', null, 1), voce('a1', 'a', 0), voce('b', null, 9)];
    const patches = patchesFor(conFiglio, outdent(buildTree(conFiglio), 'a1'));
    expect(patches).toEqual([{ id: 'a1', parentId: null, position: 2 }]);
  });

  it('senza vuoto disponibile rinumera solo il gruppo toccato', () => {
    const patches = patchesFor(annidato, outdent(buildTree(annidato), 'a1'));
    expect(patches.map((patch) => patch.id).sort()).toEqual(['a1', 'b']);
  });
});

describe('W8-16 — giro 1: posizioni doppie e spostamenti lunghi', () => {
  it('(I1) un gruppo con posizioni doppie si rinumera da zero e «Sposta su» scrive', () => {
    const doppie: Voce[] = [voce('a', null, 0), voce('b', null, 3), voce('n', null, 3)];
    const patches = patchesFor(doppie, moveUp(buildTree(doppie), 'n'));
    expect(patches.length).toBeGreaterThan(0);
    const posizioni = new Map(patches.map((patch) => [patch.id, patch.position]));
    expect(posizioni.get('n')).toBeLessThan(posizioni.get('b') ?? 99);
  });

  it('(I1) un gruppo con posizioni doppie lasciato com’è si rinumera comunque', () => {
    const doppie: Voce[] = [voce('a', null, 3), voce('b', null, 3)];
    const ids = patchesFor(doppie, buildTree(doppie)).map((patch) => patch.id);
    expect(ids).toEqual(['a', 'b']);
  });

  it('(M4) portare l’ultima di cinque voci in cima scrive una sola voce', () => {
    const cinque: Voce[] = ['a', 'b', 'c', 'd', 'e'].map((id, index) => voce(id, null, index + 10));
    const patches = patchesFor(cinque, moveItemTo(buildTree(cinque), 'e', 'a', 'before')!);
    expect(patches).toHaveLength(1);
    expect(patches[0]?.id).toBe('e');
    expect(patches[0]?.position).toBeLessThan(10);
  });
});
