/**
 * `ObjectStore` finto per i test di fase che non riguardano il bucket
 * (`settingsStage`, `usersStage`, `termsStage`): registra le chiamate senza
 * toccare alcun bucket vero. La fase `media` usa il proprio, più ricco,
 * in `mediaStage.test.ts`.
 */
import type { Bucket, ObjectStore } from '../../../src/storage/objectStore.js';

export interface RecordedPut {
  readonly bucket: Bucket;
  readonly key: string;
  readonly absoluteFilePath: string;
  readonly contentType: string;
  readonly byteSize: number;
}

export interface FakeObjectStore extends ObjectStore {
  readonly puts: RecordedPut[];
}

export interface FakeObjectStoreOptions {
  /** Chiavi già presenti nel bucket, oltre a quelle caricate con `put`. */
  readonly extraKeys?: Partial<Record<Bucket, readonly string[]>>;
  /** Simula un'archiviazione che non risponde all'elenco. */
  readonly failList?: boolean;
}

export function fakeObjectStore(options: FakeObjectStoreOptions = {}): FakeObjectStore {
  const puts: RecordedPut[] = [];
  return {
    puts,
    async put(bucket, key, absoluteFilePath, contentType, byteSize) {
      puts.push({ bucket, key, absoluteFilePath, contentType, byteSize });
    },
    async listKeys(bucket) {
      if (options.failList) throw new Error('archiviazione non raggiungibile (finta)');
      return new Set([
        ...puts.filter((p) => p.bucket === bucket).map((p) => p.key),
        ...(options.extraKeys?.[bucket] ?? []),
      ]);
    },
  };
}
