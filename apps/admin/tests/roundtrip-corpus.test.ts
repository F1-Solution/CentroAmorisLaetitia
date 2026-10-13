import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  blockDocumentSchema,
  extractContentText,
  sanitizeRichText,
  serializeBlockDocument,
  type BlockDocument,
  type BlockNode,
} from '@amoris/blocks';
import { describe, expect, it } from 'vitest';
import { deepEqual, isUnchanged, openContent, savePayloadOf } from '../src/lib/editor/roundtrip';
import type { ContentDetail } from '../src/lib/editor/roundtrip';

/**
 * **Andata e ritorno su tutti i contenuti del corpus — wave `1D-W10`.**
 *
 * `roundtrip.test.ts` prova il criterio 1D-36 su **un** documento. Questa suite
 * lo prova su tutto il corpus di `tests/fixtures/block-corpus.json`, che copre
 * tutti e 14 i tipi di ADR-005 §3.2 e i casi che rompono un'andata e ritorno
 * scritta male: entità HTML, emoji a quattro byte, elementi vuoti, attributi da
 * riordinare, blocco di riserva.
 *
 * Il corpus è **sintetico** e vive in Git: è la suite che la CI esegue. La
 * stessa proprietà, misurata sui contenuti veri, si verifica in locale con
 * `apps/importer/tests/real/roundTripReal.real.test.ts`, che non gira in CI.
 */

interface CorpusEntry {
  readonly name: string;
  readonly slug: string;
  readonly why: string;
  readonly document: unknown;
}

const corpusPath = path.resolve(import.meta.dirname, '../../../tests/fixtures/block-corpus.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as { entries: readonly CorpusEntry[] };

function asContent(entry: CorpusEntry): ContentDetail {
  const document = entry.document as BlockDocument;
  return {
    id: `00000000-0000-4000-8000-${entry.slug.length.toString().padStart(12, '0')}`,
    type: 'page',
    status: 'published',
    slug: entry.slug,
    path: `/${entry.slug}/`,
    title: entry.name,
    excerpt: null,
    showTitle: true,
    pageLayout: 'right_sidebar',
    blocks: document,
    contentHtml: serializeBlockDocument(document),
    updatedAt: '2026-01-01T00:00:00.000Z',
    publishedAt: '2026-01-01T00:00:00.000Z',
  };
}

function walk(nodes: readonly BlockNode[], visit: (node: BlockNode) => void): void {
  for (const node of nodes) {
    visit(node);
    walk(node.children, visit);
  }
}

it('il corpus non è vuoto e copre tutti e 14 i tipi di blocco', () => {
  expect(corpus.entries.length).toBeGreaterThan(0);

  const seen = new Set<string>();
  for (const entry of corpus.entries) {
    walk((entry.document as BlockDocument).blocks, (node) => seen.add(node.type));
  }
  expect([...seen].sort()).toEqual(
    [
      'column',
      'document',
      'form',
      'html',
      'image',
      'map',
      'media_text',
      'post_list',
      'rich_text',
      'row',
      'section',
      'separator',
      'slider',
      'video',
    ].sort(),
  );
});

describe.each(corpus.entries.map((entry) => [entry.name, entry] as const))(
  'andata e ritorno — %s',
  (_name, entry) => {
    const content = asContent(entry);

    it('il documento del corpus è già in forma canonica', () => {
      // Senza questo, i confronti sotto passerebbero per il motivo sbagliato:
      // Zod completerebbe un documento incompleto e il confronto tornerebbe
      // uguale perché confronta due volte la stessa normalizzazione.
      expect(blockDocumentSchema.parse(entry.document)).toEqual(entry.document);
    });

    it('si apre senza avvisi', () => {
      const outcome = openContent(content);
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      expect(outcome.warnings).toEqual([]);
      expect(isUnchanged(content, outcome.state)).toBe(true);
    });

    it('aprire e salvare senza modifiche non cambia blocchi, HTML né testo', () => {
      const outcome = openContent(content);
      if (!outcome.ok) throw new Error(outcome.reason);
      const saved = savePayloadOf(outcome.state);
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;

      expect(deepEqual(saved.payload.blocks, content.blocks)).toBe(true);
      expect(saved.payload.contentHtml).toBe(content.contentHtml);
      expect(saved.payload.contentText).toBe(extractContentText(content.contentHtml));
    });

    it('due giri di seguito non spostano nulla', () => {
      // La proprietà che conta non è che un giro non cambi nulla, ma che non
      // cambi nulla **mai**: un errore che si stabilizza al secondo giro
      // sposterebbe comunque il contenuto approvato la prima volta.
      const primo = openContent(content);
      if (!primo.ok) throw new Error(primo.reason);
      const salvato = savePayloadOf(primo.state);
      if (!salvato.ok) throw new Error('il documento del corpus deve essere salvabile');

      const secondo = openContent({
        ...content,
        blocks: salvato.payload.blocks,
        contentHtml: salvato.payload.contentHtml,
      });
      if (!secondo.ok) throw new Error(secondo.reason);
      expect(secondo.warnings).toEqual([]);

      const risalvato = savePayloadOf(secondo.state);
      if (!risalvato.ok) throw new Error('il secondo giro deve restare salvabile');
      expect(risalvato.payload.contentHtml).toBe(salvato.payload.contentHtml);
      expect(deepEqual(risalvato.payload.blocks, salvato.payload.blocks)).toBe(true);
    });

    it('ogni `rich_text` è un punto fisso della sanificazione', () => {
      // È la proprietà su cui poggia tutto il resto (`BLOCK-MODEL.md` §5): se
      // sanificare due volte desse due risultati, ogni salvataggio sposterebbe
      // il testo di un pezzo.
      walk((entry.document as BlockDocument).blocks, (node) => {
        if (node.type !== 'rich_text') return;
        const once = sanitizeRichText(node.props.html);
        expect(once.ok, `${node.id} deve sanificarsi`).toBe(true);
        if (!once.ok) return;
        expect(once.html).toBe(node.props.html);
        const twice = sanitizeRichText(once.html);
        expect(twice.ok).toBe(true);
        if (!twice.ok) return;
        expect(twice.html).toBe(once.html);
      });
    });
  },
);
