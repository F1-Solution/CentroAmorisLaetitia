import { schema } from '@amoris/db';
import { eq, sql } from 'drizzle-orm';
import { createServer, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createObjectStore } from '../src/lib/objectStore.js';
import {
  createHarness,
  signIn,
  testConfig,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * 1G-W9 T9, residui: mappa del sito e archivi dei download con il modello «category» a
 * `noindex` (W8-36); descrizione OpenAPI del 503 dei media (DR-261, N5);
 * oggetti orfani nell'archivio quando la transazione fallisce al `COMMIT` (DR-261, N4);
 * tempo scaduto dell'archivio reso come rifiuto 503 in italiano (DR-261, W6-6).
 * Dati e file sintetici.
 */

let h: Harness;
let signed: Signed;
const get = (url: string) => h.app.inject({ method: 'GET', url });

beforeAll(async () => {
  h = await createHarness('amoris_api_residui_w9');
  signed = await signIn(h, { area: 'redazione' });
}, 180_000);

afterAll(async () => {
  await h?.teardown();
});

describe('W8-36: archivi dei download nella mappa del sito', () => {
  it('con noindex nel modello «category» gli archivi dei download escono dalla mappa', async () => {
    const [file] = await h.db
      .insert(schema.media)
      .values({
        storageKey: '2026/01/modulo-sintetico.pdf',
        publicPath: '/media/2026/01/modulo-sintetico.pdf',
        fileName: 'modulo-sintetico.pdf',
        mimeType: 'application/pdf',
        byteSize: 4,
        checksum: Buffer.from('modulo-sintetico'.padEnd(32, '0')),
        uploadedAt: new Date('2026-01-01T00:00:00Z'),
      })
      .returning({ id: schema.media.id });
    const [document] = await h.db
      .insert(schema.documents)
      .values({ slug: 'modulo-sintetico', title: 'Modulo sintetico', mediaId: file!.id })
      .returning({ id: schema.documents.id });
    const [archive] = await h.db
      .insert(schema.terms)
      .values({
        taxonomy: 'wpdmcategory',
        slug: 'moduli-sintetici',
        name: 'Moduli sintetici',
        path: '/download-category/moduli-sintetici/',
      })
      .returning({ id: schema.terms.id });
    await h.db
      .insert(schema.documentTerms)
      .values({ documentId: document!.id, termId: archive!.id });
    const paths = async () =>
      (await get('/public/sitemap')).json().entries.map((e: { path: string }) => e.path);
    expect(await paths()).toContain('/download-category/moduli-sintetici/');

    await h.db.insert(schema.seoTemplates).values({
      scope: 'category',
      titleTemplate: '{term_title} - {site_title}',
      robotsDirectives: ['noindex'],
    });
    try {
      // Le meta robots dell'archivio dicono già `noindex`: la mappa deve dire lo stesso.
      const robots = (
        await get('/public/terms?path=%2Fdownload-category%2Fmoduli-sintetici%2F')
      ).json().seo?.robots as string | undefined;
      expect(robots).toMatch(/noindex/);
      const listed = await paths();
      expect(listed).not.toContain('/download-category/moduli-sintetici/');
      // La scheda del documento non dipende dal modello delle categorie.
      expect(listed).toContain('/download/modulo-sintetico/');
    } finally {
      await h.db.delete(schema.seoTemplates).where(eq(schema.seoTemplates.scope, 'category'));
    }
  });
});

describe('N5: descrizione OpenAPI del 503 dei media', () => {
  it('descrive i 503 che i media danno davvero, compreso l’archivio che non risponde in tempo', async () => {
    const spec = (await get('/openapi.json')).json() as {
      paths: Record<string, Record<string, { responses: Record<string, { description: string }> }>>;
    };
    const descriptions = [
      spec.paths['/media']?.post?.responses['503']?.description,
      spec.paths['/media/{id}/file']?.put?.responses['503']?.description,
      spec.paths['/media/{id}']?.delete?.responses['503']?.description,
    ];
    for (const description of descriptions) {
      expect(description).toBeDefined();
      expect(description).toMatch(/occupato/i);
      expect(description).toMatch(/non risponde in tempo/i);
      expect(description).toMatch(/PDF e video/i);
    }
  });
});

/** Fa fallire al `COMMIT` ogni transazione che inserisce in `table`, come un guasto dopo il lavoro. */
async function failAtCommit(table: 'media' | 'media_variants'): Promise<() => Promise<void>> {
  await h.db.execute(sql`
    create or replace function prova_commit_rifiutato() returns trigger language plpgsql as $$
    begin raise exception 'commit rifiutato (prova sintetica)'; end $$`);
  await h.db.execute(
    sql.raw(
      `create constraint trigger prova_commit_rifiutato after insert on ${table}
       deferrable initially deferred for each row execute function prova_commit_rifiutato()`,
    ),
  );
  return async () => {
    await h.db.execute(sql.raw(`drop trigger if exists prova_commit_rifiutato on ${table}`));
    await h.db.execute(sql`drop function if exists prova_commit_rifiutato()`);
  };
}

function multipartOf(fileName: string, body: Buffer) {
  const boundary = '----prova-sintetica-t9';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `content-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `content-type: application/octet-stream\r\n\r\n`,
  );
  return {
    payload: Buffer.concat([head, body, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    headers: {
      ...signed.writeHeaders,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
  };
}

const jpeg = (width: number, height: number): Promise<Buffer> =>
  sharp({ create: { width, height, channels: 3, background: '#2840c8' } })
    .jpeg()
    .toBuffer();

describe('N4: errore al COMMIT senza oggetti orfani', () => {
  it('un caricamento che fallisce al COMMIT toglie dall’archivio originale e derivate', async () => {
    const before = new Set(h.store.objects.keys());
    const putsBefore = h.store.puts.length;
    const restore = await failAtCommit('media');
    try {
      const response = await h.app.inject({
        method: 'POST',
        url: '/media',
        ...multipartOf('commit-rifiutato.jpg', await jpeg(1500, 1000)),
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await restore();
    }
    // Il caricamento ha scritto originale e derivate prima del COMMIT.
    expect(h.store.puts.length - putsBefore).toBeGreaterThan(1);
    const orphans = [...h.store.objects.keys()].filter((key) => !before.has(key));
    expect(orphans).toEqual([]);
    const rows = await h.db
      .select({ id: schema.media.id })
      .from(schema.media)
      .where(sql`${schema.media.fileName} like 'commit-rifiutato%'`);
    expect(rows).toEqual([]);
  });

  it('una sostituzione che fallisce al COMMIT toglie le derivate nuove', async () => {
    const created = await h.app.inject({
      method: 'POST',
      url: '/media',
      ...multipartOf('piccola-sostituita.jpg', await jpeg(60, 40)),
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: string };
    const before = new Set(h.store.objects.keys());
    const putsBefore = h.store.puts.length;

    const restore = await failAtCommit('media_variants');
    try {
      const response = await h.app.inject({
        method: 'PUT',
        url: `/media/${id}/file`,
        ...multipartOf('piccola-sostituita.jpg', await jpeg(1500, 1000)),
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await restore();
    }
    // La sostituzione ha scritto derivate nuove prima del COMMIT.
    expect(h.store.puts.length - putsBefore).toBeGreaterThan(1);
    const orphans = [...h.store.objects.keys()].filter((key) => !before.has(key));
    expect(orphans).toEqual([]);
  });
});

/** Un archivio che accetta la connessione e non risponde mai. */
async function silentStore(): Promise<{ endpoint: string; close: () => Promise<void> }> {
  const sockets = new Set<Socket>();
  const server: Server = createServer(() => undefined);
  server.on('connection', (socket) => sockets.add(socket));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${port}`,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

describe('W6-6: tempo scaduto dell’archivio', () => {
  it('caricamento e sostituzione rispondono 503 in italiano, mai 500', async () => {
    // Un media già caricato con l'archivio finto, da sostituire con quello che tace.
    const created = await h.app.inject({
      method: 'POST',
      url: '/media',
      ...multipartOf('prima-del-silenzio.jpg', await jpeg(60, 40)),
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: string };

    const silent = await silentStore();
    const config = testConfig(h.config.DATABASE_URL, {
      S3_ENDPOINT: silent.endpoint,
      S3_ACCESS_KEY: 'chiave-sintetica',
      S3_SECRET_KEY: 'segreto-sintetico',
      S3_REQUEST_TIMEOUT_MS: '200',
      S3_CONNECT_TIMEOUT_MS: '200',
    });
    const app = await buildApp(config, { objectStore: createObjectStore(config) });
    try {
      await app.ready();
      const upload = await app.inject({
        method: 'POST',
        url: '/media',
        ...multipartOf('archivio-muto.jpg', await jpeg(60, 40)),
      });
      const replace = await app.inject({
        method: 'PUT',
        url: `/media/${id}/file`,
        ...multipartOf('prima-del-silenzio.jpg', await jpeg(60, 40)),
      });
      for (const response of [upload, replace]) {
        expect(response.statusCode).toBe(503);
        const { error } = response.json() as { error: { code: string; message: string } };
        expect(error.code).toBe('MEDIA_STORE_TIMEOUT');
        expect(error.message).toMatch(/non ha risposto in tempo/);
        expect(error.message).not.toMatch(/timeout|S3|\d+ ?ms/i);
      }
      const rows = await h.db
        .select({ id: schema.media.id })
        .from(schema.media)
        .where(sql`${schema.media.fileName} like 'archivio-muto%'`);
      expect(rows).toEqual([]);
    } finally {
      await app.close();
      await silent.close();
    }
  }, 60_000);
});
