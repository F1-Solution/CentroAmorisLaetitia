import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * ADR-006 §3.3 impone che l'anteprima dell'area amministrativa usi **gli stessi**
 * componenti di resa del sito pubblico. Perché sia possibile, `@amoris/blocks`
 * deve poter entrare nel bundle di un browser: un solo `import 'node:crypto'`
 * raggiungibile dal punto d'ingresso lo impedirebbe, e l'errore comparirebbe in
 * fase di compilazione dell'area amministrativa, lontano da qui.
 *
 * Il controllo è sul **grafo**, non sui singoli file: si parte da `index.ts` e si
 * seguono gli import relativi.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'src');

const NODE_BUILTIN = /from\s+'node:([a-z/]+)'/g;
const RELATIVE_IMPORT = /from\s+'(\.[^']*)'/g;

/**
 * Il grafo si calcola **una volta**: i due controlli lo condividono, e sotto
 * `turbo`, con più pacchetti che leggono dal disco insieme, percorrerlo due
 * volte è bastato a superare il tempo massimo predefinito.
 */
let cached: Promise<Map<string, string>> | null = null;
function graph(): Promise<Map<string, string>> {
  cached ??= reachableFrom(path.join(src, 'index.ts'));
  return cached;
}

async function reachableFrom(entry: string): Promise<Map<string, string>> {
  const seen = new Map<string, string>();
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    const source = await readFile(current, 'utf8');
    seen.set(current, source);

    for (const match of source.matchAll(RELATIVE_IMPORT)) {
      const specifier = match[1];
      if (!specifier) continue;
      // Gli specificatori interni sono senza estensione (vedi `index.ts`); la
      // rimozione di `.js` resta per non dipendere da quella convenzione.
      const base = path.resolve(path.dirname(current), specifier.replace(/\.js$/, ''));
      for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
        try {
          await readFile(candidate, 'utf8');
          queue.push(candidate);
          break;
        } catch {
          // il candidato con l'altra estensione
        }
      }
    }
  }

  return seen;
}

describe('il punto d’ingresso del pacchetto è utilizzabile in un browser', () => {
  it(
    'da `index.ts` non si raggiunge alcun modulo interno di Node',
    { timeout: 30_000 },
    async () => {
      const reachable = await graph();
      const offenders = [...reachable.entries()]
        .filter(([, source]) => [...source.matchAll(NODE_BUILTIN)].length > 0)
        .map(([file]) => path.relative(src, file));

      expect(offenders).toEqual([]);
    },
  );

  it(
    '`import-ids.ts` non è raggiungibile dal punto d’ingresso, ed è il solo a usare node:crypto',
    { timeout: 30_000 },
    async () => {
      const reachable = await graph();
      expect([...reachable.keys()]).not.toContain(path.join(src, 'import-ids.ts'));

      const importIds = await readFile(path.join(src, 'import-ids.ts'), 'utf8');
      expect(importIds).toContain("from 'node:crypto'");
    },
  );
});
