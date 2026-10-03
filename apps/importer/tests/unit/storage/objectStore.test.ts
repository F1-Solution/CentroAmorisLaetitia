/**
 * `ObjectStore` contro lo storage a oggetti **vero** (MinIO in Docker,
 * `infra/compose/docker-compose.yml`): usa e getta a livello di oggetto — una
 * chiave a sé per esecuzione, ripulita nel `afterAll`. Prova il meccanismo di
 * instradamento pubblico/riservato di ADR-004 §3.6 e la sua conseguenza più
 * importante: **nessun accesso anonimo**, nemmeno al bucket "pubblico" —
 * verificato qui con una richiesta HTTP vera, non un'asserzione sul codice.
 *
 * Dati sintetici (DR-010): il contenuto è un testo di fantasia, non un file
 * della sorgente vera.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadDotEnv } from '../../../src/runtime/env.js';
import { loadConfig } from '../../../src/runtime/config.js';
import { createObjectStore } from '../../../src/storage/objectStore.js';

loadDotEnv();
const config = loadConfig();

const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
  forcePathStyle: true,
});
const buckets = { public: config.S3_BUCKET_PUBLIC, private: config.S3_BUCKET_PRIVATE };
const store = createObjectStore(s3, buckets);

let tmpDir: string;
let filePath: string;
const testKeyPrefix = `test-usa-e-getta/${randomUUID()}`;

async function anonymousGetStatus(bucket: string, key: string): Promise<number> {
  const url = `${config.S3_ENDPOINT.replace(/\/$/, '')}/${bucket}/${key}`;
  const response = await fetch(url);
  return response.status;
}

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), 'amoris-importer-objectstore-'));
  filePath = path.join(tmpDir, 'prova.txt');
  await writeFile(filePath, 'contenuto di prova, dato sintetico', 'utf8');
});

afterAll(async () => {
  await Promise.allSettled([
    s3.send(
      new DeleteObjectCommand({ Bucket: buckets.public, Key: `${testKeyPrefix}/pubblico.txt` }),
    ),
    s3.send(
      new DeleteObjectCommand({ Bucket: buckets.private, Key: `${testKeyPrefix}/riservato.txt` }),
    ),
  ]);
  s3.destroy();
  await rm(tmpDir, { recursive: true, force: true });
});

describe('ObjectStore — storage a oggetti vero', () => {
  it('carica nel bucket pubblico configurato', async () => {
    const key = `${testKeyPrefix}/pubblico.txt`;
    await store.put('public', key, filePath, 'text/plain', 34);

    const object = await s3.send(new GetObjectCommand({ Bucket: buckets.public, Key: key }));
    expect(await object.Body?.transformToString()).toBe('contenuto di prova, dato sintetico');
  });

  it('carica nel bucket riservato configurato, distinto da quello pubblico', async () => {
    const key = `${testKeyPrefix}/riservato.txt`;
    await store.put('private', key, filePath, 'text/plain', 34);

    const object = await s3.send(new GetObjectCommand({ Bucket: buckets.private, Key: key }));
    expect(await object.Body?.transformToString()).toBe('contenuto di prova, dato sintetico');

    // Non è finito anche nel bucket pubblico.
    await expect(
      s3.send(new GetObjectCommand({ Bucket: buckets.public, Key: key })),
    ).rejects.toThrow();
  });

  it(
    'un oggetto nel bucket riservato non è raggiungibile da un anonimo, nemmeno conoscendo il nome — ' +
      'e nemmeno il bucket "pubblico" lo è: l’applicazione serve i file lei (ADR-004 §3.6)',
    async () => {
      const privateKey = `${testKeyPrefix}/riservato.txt`;
      const publicKey = `${testKeyPrefix}/pubblico.txt`;

      const privateStatus = await anonymousGetStatus(buckets.private, privateKey);
      const publicStatus = await anonymousGetStatus(buckets.public, publicKey);

      expect(privateStatus).toBeGreaterThanOrEqual(400);
      expect(publicStatus).toBeGreaterThanOrEqual(400);
    },
  );

  it('listKeys ritrova la chiave caricata nel solo bucket in cui è stata caricata (DR-088)', async () => {
    const privateKey = `${testKeyPrefix}/riservato.txt`;
    expect((await store.listKeys('private')).has(privateKey)).toBe(true);
    expect((await store.listKeys('public')).has(privateKey)).toBe(false);
  });
});
