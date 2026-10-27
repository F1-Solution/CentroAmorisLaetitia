import { schema } from '@amoris/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './_support/harness.js';

/**
 * Giro 1 della T2k (1G-W7, DR-287, ruling del controller sulla privacy): la lettura pubblica di
 * un contenuto non restituisce i blocchi «Documento» il cui documento è riservato, ha il file
 * riservato o non esiste più, a qualunque profondità (radice, sezione/riga/colonna, «media e
 * testo»). Così né l'identificativo né l'etichetta di un documento non pubblico escono dal JSON
 * pubblico, come già non escono dall'HTML del sito. I blocchi dei documenti pubblici e tutti gli
 * altri blocchi restano com'erano. Tutti i dati sono sintetici.
 */

let h: Harness;
const ids: Record<string, string> = {};
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const ABSENT = '00000000-0000-4000-8000-0000000000aa';

async function media(key: string, isPrivate: boolean): Promise<string> {
  const storageKey = `2026/01/${key}.png`;
  const [row] = await h.db
    .insert(schema.media)
    .values({
      storageKey,
      publicPath: `/media/${storageKey}`,
      fileName: `${key}.png`,
      mimeType: 'image/png',
      byteSize: PNG.length,
      width: 10,
      height: 5,
      checksum: Buffer.from(key.padEnd(32, '0')),
      isPrivate,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media non creato');
  return row.id;
}

const doc = (id: string, documentId: string, label: string | null = null) => ({
  type: 'document',
  id,
  props: { documentId, label, display: 'link', classes: [] },
  children: [],
});

beforeAll(async () => {
  h = await createHarness('amoris_api_public_docblocks');
  const filePubblico = await media('file-pubblico', false);
  const fileRiservato = await media('file-riservato', true);
  const rows = await h.db
    .insert(schema.documents)
    .values([
      { slug: 'modulo-pubblico', title: 'Modulo pubblico', mediaId: filePubblico },
      {
        slug: 'modulo-riservato',
        title: 'Modulo riservato',
        mediaId: filePubblico,
        isPrivate: true,
      },
      { slug: 'modulo-file-riservato', title: 'File riservato', mediaId: fileRiservato },
    ])
    .returning({ id: schema.documents.id, slug: schema.documents.slug });
  for (const row of rows) ids[row.slug] = row.id;

  const pubblico = ids['modulo-pubblico'] ?? '';
  const nascosti = [ids['modulo-riservato'] ?? '', ids['modulo-file-riservato'] ?? '', ABSENT];
  await h.db.insert(schema.contents).values({
    type: 'page',
    status: 'published',
    slug: 'pagina-con-documenti',
    path: '/pagina-con-documenti/',
    title: 'Pagina con documenti',
    contentText: 'Testo sintetico.',
    publishedAt: new Date('2026-02-01T10:00:00Z'),
    blocks: {
      schema: 1,
      blocks: [
        {
          type: 'rich_text',
          id: 'b_00000000f001',
          props: { html: '<p>Testo sintetico.</p>' },
          children: [],
        },
        doc('b_00000000f002', pubblico, 'Etichetta pubblica'),
        ...nascosti.map((id, n) => doc(`b_00000000f01${n}`, id, `Etichetta nascosta ${n}`)),
        {
          type: 'section',
          id: 'b_00000000f020',
          props: {},
          children: [
            {
              type: 'row',
              id: 'b_00000000f021',
              props: { columnStructure: '1_1' },
              children: [
                {
                  type: 'column',
                  id: 'b_00000000f022',
                  props: { width: '1_1' },
                  children: [
                    doc('b_00000000f023', pubblico),
                    ...nascosti.map((id, n) => doc(`b_00000000f03${n}`, id, `Colonna ${n}`)),
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'media_text',
          id: 'b_00000000f040',
          props: {},
          children: [
            doc('b_00000000f041', pubblico),
            ...nascosti.map((id, n) => doc(`b_00000000f05${n}`, id, `Media e testo ${n}`)),
          ],
        },
      ],
    },
  });
});

afterAll(async () => {
  await h?.teardown();
});

const read = async () => {
  const response = await h.app.inject({
    method: 'GET',
    url: '/public/content?path=/pagina-con-documenti/',
  });
  expect(response.statusCode).toBe(200);
  return { body: response.json(), text: response.body };
};

describe('blocchi «Documento» nella lettura pubblica (DR-287, giro 1 della T2k)', () => {
  it('prova negativa: id ed etichetta dei documenti non pubblici non escono, a nessuna profondità', async () => {
    const { text } = await read();
    for (const id of [ids['modulo-riservato'], ids['modulo-file-riservato'], ABSENT]) {
      expect(text).not.toContain(id);
    }
    expect(text).not.toContain('Etichetta nascosta');
    expect(text).not.toContain('Colonna ');
    expect(text).not.toContain('Media e testo ');
    for (const blockId of ['b_00000000f010', 'b_00000000f030', 'b_00000000f050']) {
      expect(text).not.toContain(blockId);
    }
  });

  it('i blocchi dei documenti pubblici e gli altri blocchi restano dove sono', async () => {
    const { body } = await read();
    const blocks = body.content.blocks.blocks;
    expect(blocks.map((b: { id: string }) => b.id)).toEqual([
      'b_00000000f001',
      'b_00000000f002',
      'b_00000000f020',
      'b_00000000f040',
    ]);
    expect(blocks[1].props.label).toBe('Etichetta pubblica');
    const column = blocks[2].children[0].children[0];
    expect(column.children.map((b: { id: string }) => b.id)).toEqual(['b_00000000f023']);
    expect(blocks[3].children.map((b: { id: string }) => b.id)).toEqual(['b_00000000f041']);
    expect(Object.keys(body.documents)).toEqual([ids['modulo-pubblico']]);
  });
});
