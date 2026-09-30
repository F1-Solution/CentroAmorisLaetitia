/**
 * Calcolo dei percorsi con le due anomalie della sorgente decise nel Round 10:
 * DR-063 (slug condiviso fra una pagina e un articolo) e DR-064 (bozza senza
 * slug). Dati sintetici: gli identificatori imitano la forma dei casi reali,
 * non il loro contenuto.
 */
import { describe, expect, it } from 'vitest';
import {
  provisionalPath,
  resolvePaths,
  type PathNode,
} from '../../../src/stages/relations/paths.js';

function node(partial: Partial<PathNode> & Pick<PathNode, 'legacyId' | 'slug'>): PathNode {
  return {
    dbId: `db-${partial.legacyId}`,
    type: 'page',
    parentLegacyId: 0,
    ...partial,
  };
}

describe('resolvePaths', () => {
  it('senza anomalie nessun percorso è provvisorio', () => {
    const resolved = resolvePaths([
      node({ legacyId: 1, slug: 'radice' }),
      node({ legacyId: 2, slug: 'figlio', parentLegacyId: 1 }),
    ]);
    expect(resolved.get(1)).toEqual({ parentDbId: null, path: '/radice/', provisional: null });
    expect(resolved.get(2)).toEqual({
      parentDbId: 'db-1',
      path: '/radice/figlio/',
      provisional: null,
    });
  });

  it('DR-063: la pagina conserva l’indirizzo, l’articolo con lo stesso slug riceve il percorso provvisorio', () => {
    // L'articolo ha l'identificatore più alto e più basso della pagina in due
    // prove distinte: vince il tipo, non l'ordine.
    for (const [pageId, postId] of [
      [28, 32],
      [32, 28],
    ] as const) {
      const resolved = resolvePaths([
        node({ legacyId: postId, slug: 'omonimo', type: 'post' }),
        node({ legacyId: pageId, slug: 'omonimo', type: 'page' }),
      ]);
      expect(resolved.get(pageId)?.path).toBe('/omonimo/');
      expect(resolved.get(pageId)?.provisional).toBeNull();
      expect(resolved.get(postId)?.path).toBe(provisionalPath('omonimo', postId));
      expect(resolved.get(postId)?.provisional).toBe('path-collision');
    }
  });

  it('DR-063: fra due contenuti dello stesso tipo conserva l’indirizzo il più vecchio', () => {
    const resolved = resolvePaths([
      node({ legacyId: 9, slug: 'b', parentLegacyId: 1 }),
      node({ legacyId: 1, slug: 'a' }),
      node({ legacyId: 7, slug: 'b', parentLegacyId: 1 }),
    ]);
    expect(resolved.get(7)?.path).toBe('/a/b/');
    expect(resolved.get(9)?.path).toBe(provisionalPath('b', 9));
    expect(resolved.get(9)?.provisional).toBe('path-collision');
  });

  it('DR-064: uno slug vuoto riceve il percorso provvisorio derivato dall’identificatore', () => {
    const resolved = resolvePaths([node({ legacyId: 81, slug: '', type: 'post' })]);
    expect(resolved.get(81)).toEqual({
      parentDbId: null,
      path: '/senza-slug-81/',
      provisional: 'empty-slug',
    });
  });

  it('i figli di un contenuto provvisorio stanno sotto il percorso provvisorio, non sotto quello del vincitore', () => {
    const resolved = resolvePaths([
      node({ legacyId: 1, slug: 'doppio' }),
      node({ legacyId: 2, slug: 'doppio' }),
      node({ legacyId: 3, slug: 'sotto', parentLegacyId: 2 }),
      node({ legacyId: 4, slug: 'sotto', parentLegacyId: 1 }),
    ]);
    expect(resolved.get(2)?.path).toBe('/doppio-2/');
    expect(resolved.get(3)?.path).toBe('/doppio-2/sotto/');
    expect(resolved.get(3)?.provisional).toBeNull();
    expect(resolved.get(4)?.path).toBe('/doppio/sotto/');
  });

  it('tutti i percorsi restituiti sono unici', () => {
    const resolved = resolvePaths([
      node({ legacyId: 1, slug: 'x' }),
      node({ legacyId: 2, slug: 'x', type: 'post' }),
      node({ legacyId: 3, slug: '', type: 'post' }),
      node({ legacyId: 4, slug: '' }),
    ]);
    const paths = [...resolved.values()].map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('resolvePaths con percorsi riservati', () => {
  it('un contenuto protetto tiene il percorso che ha, e chi lo vincerebbe riceve il provvisorio', () => {
    // La pagina 10 è protetta e sta a `/omonimo/`; la pagina 5, più vecchia,
    // lo vincerebbe, ma quel percorso non si libera perché 10 non si riscrive.
    const resolved = resolvePaths(
      [
        node({ legacyId: 10, slug: 'omonimo' }),
        node({ legacyId: 5, slug: 'omonimo' }),
        node({ legacyId: 11, slug: 'figlio', parentLegacyId: 10 }),
      ],
      new Map([[10, '/omonimo/']]),
    );
    expect(resolved.get(10)).toEqual({ parentDbId: null, path: '/omonimo/', provisional: null });
    expect(resolved.get(5)?.path).toBe('/omonimo-5/');
    expect(resolved.get(5)?.provisional).toBe('path-collision');
    expect(resolved.get(11)?.path).toBe('/omonimo/figlio/');
  });
});
