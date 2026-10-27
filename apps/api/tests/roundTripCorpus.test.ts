import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  extractContentText,
  serializeBlockDocument,
  type BlockDocument,
} from '@amoris/blocks/model';
import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * **Andata e ritorno su tutti i contenuti, al confine del servizio — `1D-W10`.**
 *
 * Il criterio 1D-36 dice che aprire un contenuto e salvarlo senza modifiche non
 * deve cambiare nulla. `apps/admin/tests/roundtrip-corpus.test.ts` lo prova
 * dentro l'editor, che è codice del browser; qui si prova **dall'altra parte**,
 * sul servizio che scrive a database: stesso corpus, stessi documenti, ma il
 * giro passa da HTTP, dalla validazione degli schemi di rotta e da PostgreSQL.
 *
 * Sono due prove diverse e servono entrambe. Un documento può sopravvivere
 * all'editor e rompersi nel viaggio: `jsonb` non conserva l'ordine delle chiavi
 * né i duplicati, e un numero che torna indietro come stringa cambierebbe
 * l'HTML senza che nessuno abbia toccato niente.
 *
 * Corpus **sintetico** (`tests/fixtures/block-corpus.json`), nessun dato reale.
 */

interface CorpusEntry {
  readonly name: string;
  readonly slug: string;
  readonly why: string;
  readonly document: unknown;
}

const corpusPath = path.resolve(import.meta.dirname, '../../../tests/fixtures/block-corpus.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as { entries: readonly CorpusEntry[] };

let harness: Harness;
let signed: Signed;
/** slug -> identificativo del contenuto creato. */
const created = new Map<string, string>();

beforeAll(async () => {
  harness = await createHarness('api_andata_e_ritorno');
  signed = await signIn(harness, { area: 'redazione' });

  for (const entry of corpus.entries) {
    const document = entry.document as BlockDocument;
    // Il corpus ha la forma dei contenuti importati, con riferimenti a media e documenti che
    // qui non esistono: si scrive come lo scrive l'importer, non passando da `POST /contents`,
    // che rifiuterebbe quei riferimenti (DR-279). Il giro sotto prova la rotta di salvataggio.
    const [creata] = await harness.db
      .insert(schema.contents)
      .values({
        type: 'page',
        status: 'draft',
        slug: entry.slug,
        path: `/${entry.slug}/`,
        title: entry.name,
        blocks: document,
      })
      .returning({ id: schema.contents.id });
    if (!creata) throw new Error(`creazione di ${entry.slug} fallita`);
    const id = creata.id;
    created.set(entry.slug, id);

    // Primo salvataggio: porta l'HTML e il testo, come fa l'editor alla prima
    // pubblicazione. Da qui in poi il contenuto è in regime, e ogni giro
    // successivo non deve più spostare niente.
    const primo = await harness.app.inject({
      method: 'PATCH',
      url: `/contents/${id}`,
      headers: signed.writeHeaders,
      payload: {
        blocks: document,
        contentHtml: serializeBlockDocument(document),
        contentText: extractContentText(serializeBlockDocument(document)),
      },
    });
    if (primo.statusCode !== 200) {
      throw new Error(`primo salvataggio di ${entry.slug} fallito: ${primo.statusCode}`);
    }
  }
}, 300_000);

afterAll(async () => {
  await harness?.teardown();
});

async function storedContent(id: string) {
  const [row] = await harness.db
    .select({
      blocks: schema.contents.blocks,
      contentHtml: schema.contents.contentHtml,
      contentText: schema.contents.contentText,
    })
    .from(schema.contents)
    .where(eq(schema.contents.id, id))
    .limit(1);
  if (!row) throw new Error('contenuto non trovato');
  return row;
}

it('il corpus è stato scritto per intero', () => {
  expect(created.size).toBe(corpus.entries.length);
  expect(created.size).toBeGreaterThan(0);
});

describe.each(corpus.entries.map((entry) => [entry.name, entry] as const))(
  'andata e ritorno dal servizio — %s',
  (_name, entry) => {
    it('rileggere il contenuto restituisce i blocchi identici a quelli scritti', async () => {
      const id = created.get(entry.slug)!;
      const letta = await harness.app.inject({
        method: 'GET',
        url: `/contents/${id}`,
        headers: { cookie: signed.cookie },
      });
      expect(letta.statusCode).toBe(200);
      const corpo = letta.json() as { blocks: unknown; contentHtml: string };
      expect(corpo.blocks).toEqual(entry.document);
      expect(corpo.contentHtml).toBe(serializeBlockDocument(entry.document as BlockDocument));
    });

    it('risalvare quello che si è appena letto non cambia blocchi, HTML né testo', async () => {
      const id = created.get(entry.slug)!;
      const prima = await storedContent(id);

      const letta = await harness.app.inject({
        method: 'GET',
        url: `/contents/${id}`,
        headers: { cookie: signed.cookie },
      });
      const corpo = letta.json() as { blocks: BlockDocument };
      const html = serializeBlockDocument(corpo.blocks);

      const salvata = await harness.app.inject({
        method: 'PATCH',
        url: `/contents/${id}`,
        headers: signed.writeHeaders,
        payload: { blocks: corpo.blocks, contentHtml: html, contentText: extractContentText(html) },
      });
      expect(salvata.statusCode).toBe(200);

      const dopo = await storedContent(id);
      expect(dopo.blocks).toEqual(prima.blocks);
      expect(dopo.contentHtml).toBe(prima.contentHtml);
      expect(dopo.contentText).toBe(prima.contentText);
    });

    it('l’HTML a database è quello che i blocchi producono, non un’altra cosa', async () => {
      const id = created.get(entry.slug)!;
      const riga = await storedContent(id);
      const dagliBlocchi = serializeBlockDocument(riga.blocks as BlockDocument);
      expect(riga.contentHtml).toBe(dagliBlocchi);
      expect(riga.contentText).toBe(extractContentText(dagliBlocchi));
    });
  },
);
