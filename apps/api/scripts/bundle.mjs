/**
 * Bundle di produzione dell'API (DR-358): servizio, migrazioni e creazione
 * dell'account diventano file ESM eseguibili con `node`, senza tsx.
 *
 * Restano fuori solo i moduli nativi, installati con `pnpm deploy --prod`.
 * Le migrazioni SQL si copiano in `dist/drizzle`, dove `bin/migrate.js` le cerca.
 */
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(apiDir, 'dist');
const dbDir = path.resolve(apiDir, '..', '..', 'packages', 'db');

/** Moduli con binari nativi: non si impacchettano. */
const NATIVE_EXTERNALS = ['sharp', '@node-rs/argon2'];

// I pacchetti CommonJS dentro un bundle ESM chiedono `require` e `__dirname`.
const banner = [
  "import { createRequire as __bundleCreateRequire } from 'node:module';",
  "import { fileURLToPath as __bundleFileURLToPath } from 'node:url';",
  "import { dirname as __bundleDirname } from 'node:path';",
  'const require = __bundleCreateRequire(import.meta.url);',
  'const __filename = __bundleFileURLToPath(import.meta.url);',
  'const __dirname = __bundleDirname(__filename);',
].join('\n');

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

const result = await build({
  absWorkingDir: apiDir,
  entryPoints: {
    server: 'src/server.ts',
    'bin/migrate': path.join(dbDir, 'scripts', 'migrate.ts'),
    'bin/account-create': 'tools/createLocalAccount.ts',
  },
  outdir: distDir,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  sourcemap: true,
  external: NATIVE_EXTERNALS,
  banner: { js: banner },
  metafile: true,
  logLevel: 'warning',
});

await writeFile(path.join(distDir, 'bundle-meta.json'), JSON.stringify(result.metafile));
await cp(path.join(dbDir, 'drizzle'), path.join(distDir, 'drizzle'), { recursive: true });
