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

export function fakeObjectStore(): FakeObjectStore {
  const puts: RecordedPut[] = [];
  return {
    puts,
    async put(bucket, key, absoluteFilePath, contentType, byteSize) {
      puts.push({ bucket, key, absoluteFilePath, contentType, byteSize });
    },
  };
}
