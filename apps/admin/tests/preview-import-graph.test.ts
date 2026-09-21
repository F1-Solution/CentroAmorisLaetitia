import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as blocks from '@amoris/blocks';

/**
 * **Criterio di uscita 22.** «L'anteprima dell'area amministrativa usa gli
 * stessi componenti di resa di `packages/blocks` del sito pubblico: verificato
 * **dal grafo delle importazioni, non a occhio** (ADR-006 §3.3).»
 *
 * Guardare l'anteprima e trovarla somigliante non prova nulla: due rese diverse
 * si somigliano finché non divergono su un caso che nessuno ha guardato. Ciò
 * che si può provare è che l'area amministrativa **non abbia** una propria resa,
 * e che quella che usa venga dal pacchetto condiviso.
 *
 * Una nota sul confronto con `apps/web`: in questa fase il sito pubblico non
 * rende ancora alcun contenuto (`PLAN.md` §4 lo dichiara invariato), quindi il
 * confronto non può essere «admin contro web». È «admin contro il pacchetto
 * condiviso», che è il punto da cui il sito prenderà la resa quando la 1E la
 * userà: la stessa proprietà, verificata dove oggi esiste.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const adminSrc = path.join(here, '..', 'src');
const previewFile = path.join(adminSrc, 'components', 'editor', 'EditorPreview.tsx');

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return filesUnder(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    }),
  );
  return found.flat();
}

describe('l’anteprima usa i componenti del pacchetto condiviso', () => {
  it('importa `BlocksDocument` da `@amoris/blocks`', async () => {
    const source = await readFile(previewFile, 'utf8');
    expect(source).toMatch(/import\s*\{[^}]*\bBlocksDocument\b[^}]*\}\s*from\s*'@amoris\/blocks'/);
  });

  it('`BlocksDocument` è davvero il punto d’ingresso della resa del pacchetto', () => {
    // Se il pacchetto smettesse di esportarlo, il controllo qui sopra
    // continuerebbe a passare su una stringa che non indica più nulla.
    expect(typeof blocks.BlocksDocument).toBe('function');
    expect(typeof blocks.BlockRenderer).toBe('function');
  });

  it('la resa dei blocchi entra nell’area amministrativa da un punto solo', async () => {
    const files = await filesUnder(adminSrc);
    const importers: string[] = [];
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      const relative = path.relative(adminSrc, file).split(path.sep).join('/');

      if (/(?:BlocksDocument|BlockRenderer)/.test(source)) importers.push(relative);

      // Iniettare HTML a mano significherebbe disegnare un blocco fuori dal
      // pacchetto condiviso, che è esattamente ciò che ADR-006 §3.3 vieta.
      if (source.includes('dangerouslySetInnerHTML')) {
        offenders.push(`${relative}: inietta HTML dei blocchi per conto proprio`);
      }
      // Un percorso profondo dentro il pacchetto aggirerebbe il punto
      // d'ingresso e renderebbe questo controllo cieco.
      if (/from\s*'@amoris\/blocks\/(?!model|import-ids)/.test(source)) {
        offenders.push(`${relative}: importa dall’interno del pacchetto`);
      }
    }

    expect(offenders).toEqual([]);
    expect(importers).toEqual(['components/editor/EditorPreview.tsx']);
  });

  it('l’anteprima non disegna nulla per conto proprio', async () => {
    const source = await readFile(previewFile, 'utf8');
    // Il file è un involucro: `PreviewPane` per la cornice, `BlocksDocument`
    // per il contenuto. Nessun altro elemento HTML.
    expect(source).not.toMatch(/<(div|section|article|p|span)[\s>]/);
  });
});
