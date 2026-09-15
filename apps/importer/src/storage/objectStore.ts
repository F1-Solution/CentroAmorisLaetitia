/**
 * `ObjectStore` — l'unico punto in cui l'importer scrive nei due bucket di
 * ADR-004 §3.6. `media-public` per i file serviti dal sito, `media-private`
 * per ciò che non deve essere raggiungibile da un anonimo, nemmeno
 * conoscendo il nome del file (nessuno dei due bucket ha lettura anonima:
 * `infra/compose/create-buckets.sh`, l'applicazione serve i file in streaming).
 *
 * Il caricamento avviene sempre in streaming da un percorso assoluto sul
 * disco: nessun file viene caricato per intero in memoria
 * (`IMPORTER-DESIGN.md` §3.9, stesso principio del checksum).
 *
 * In modo `plan` l'importer non deve scrivere nel bucket
 * (`importer-spec.md` §5.2): a differenza della transazione del database, un
 * `PutObjectCommand` non si annulla da solo, quindi la decisione di non
 * scrivere spetta al chiamante (le fasi), non a questo modulo — vedi
 * `stages/media/index.ts`, che chiama `put` solo quando `ctx.mode === 'apply'`.
 */
import { createReadStream } from 'node:fs';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

export type Bucket = 'public' | 'private';

export interface ObjectStoreBuckets {
  readonly public: string;
  readonly private: string;
}

export interface ObjectStore {
  /**
   * Carica `absoluteFilePath` nella chiave `key` del bucket indicato. Byte per
   * byte, senza rigenerare né convertire (ADR-004 §3.2, §3.7).
   */
  put(
    bucket: Bucket,
    key: string,
    absoluteFilePath: string,
    contentType: string,
    byteSize: number,
  ): Promise<void>;
}

export function createObjectStore(s3: S3Client, buckets: ObjectStoreBuckets): ObjectStore {
  return {
    async put(bucket, key, absoluteFilePath, contentType, byteSize) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket === 'public' ? buckets.public : buckets.private,
          Key: key,
          Body: createReadStream(absoluteFilePath),
          ContentType: contentType,
          ContentLength: byteSize,
        }),
      );
    },
  };
}
