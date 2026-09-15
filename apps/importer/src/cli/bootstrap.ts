import { createDatabase, type Database } from '@amoris/db';
import { S3Client } from '@aws-sdk/client-s3';
import { findMonorepoRoot, loadDotEnv } from '../runtime/env.js';
import { loadConfig, resolveFromRoot, type Config } from '../runtime/config.js';
import { createLogger, type Logger } from '../runtime/logger.js';
import { createSourceReader, type SourceReader } from '../source/index.js';

export interface Runtime {
  readonly config: Config;
  readonly db: Database;
  readonly s3: S3Client;
  readonly source: SourceReader;
  readonly logger: Logger;
  readonly monorepoRoot: string;
  close(): Promise<void>;
}

export function createRuntime(options: { verbose: boolean }): Runtime {
  loadDotEnv();
  const config = loadConfig();
  const monorepoRoot = findMonorepoRoot(process.cwd()) ?? process.cwd();

  const { db, close } = createDatabase({ url: config.DATABASE_URL });
  const s3 = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
    forcePathStyle: true,
  });
  const source = createSourceReader({
    dumpPath: resolveFromRoot(monorepoRoot, config.IMPORTER_DUMP_PATH),
    uploadsPath: resolveFromRoot(monorepoRoot, config.IMPORTER_UPLOADS_PATH),
    privateStoragePath: resolveFromRoot(monorepoRoot, config.IMPORTER_PRIVATE_STORAGE_PATH),
  });
  const logger = createLogger({ verbose: options.verbose });

  return {
    config,
    db,
    s3,
    source,
    logger,
    monorepoRoot,
    close: async () => {
      await close();
      s3.destroy();
    },
  };
}

export function importerVersion(): string {
  // Tenuto qui, in un punto solo: apps/importer/package.json non è letto a runtime
  // per non introdurre un'importazione di JSON che il bundler dovrebbe risolvere;
  // il valore è duplicato in un solo punto e i test lo confrontano con package.json.
  return '0.1.0';
}
