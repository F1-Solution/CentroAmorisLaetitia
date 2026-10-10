import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import type { Config } from '../config.js';

/**
 * Archivio a oggetti (ADR-004, DR-005). Il client ufficiale è compatibile con
 * MinIO, che è ciò che gira in locale; `forcePathStyle` serve proprio a quello.
 *
 * Qui non si generano miniature: ADR-004 §3.2 vieta di rigenerare le varianti,
 * perché le dimensioni derivate sono quelle che WordPress produsse a suo tempo e
 * riprodurle diverse farebbe divergere il `srcset`.
 */

/** Un oggetto letto: il contenuto come flusso, da passare alla risposta senza caricarlo in memoria. */
export interface StoredObject {
  readonly body: Readable;
  readonly contentLength?: number;
}

export interface ObjectStore {
  put(bucket: string, key: string, body: Buffer, contentType: string): Promise<void>;
  /** `null` se l'oggetto non c'è: il chiamante risponde 404, non 500. */
  get(bucket: string, key: string): Promise<StoredObject | null>;
  remove(bucket: string, key: string): Promise<void>;
  readonly publicBucket: string;
  readonly privateBucket: string;
}

export function createObjectStore(config: Config): ObjectStore {
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY,
      secretAccessKey: config.S3_SECRET_KEY,
    },
  });

  return {
    publicBucket: config.S3_BUCKET_PUBLIC,
    privateBucket: config.S3_BUCKET_PRIVATE,
    async put(bucket, key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async get(bucket, key) {
      try {
        const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!object.Body) return null;
        return {
          body: object.Body as Readable,
          ...(object.ContentLength === undefined ? {} : { contentLength: object.ContentLength }),
        };
      } catch (caught) {
        if (caught instanceof NoSuchKey) return null;
        throw caught;
      }
    },
    async remove(bucket, key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
