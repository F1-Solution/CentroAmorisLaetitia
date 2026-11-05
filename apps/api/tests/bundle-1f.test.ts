import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Prova di fumo dell'impacchettamento di produzione (1F-W2 T3, DR-358).
 *
 * Il servizio, le migrazioni e la creazione dell'account si eseguono con `node`
 * dal bundle `esbuild`, senza tsx. La prova costruisce il bundle, controlla che
 * gli unici moduli lasciati fuori siano i nativi installati con
 * `pnpm deploy --prod` e poi avvia davvero i tre programmi come processi a sé.
 *
 * **Nessun dato reale.** Indirizzo, nome e password sono sintetici e vivono solo
 * nel database temporaneo, distrutto alla fine.
 */

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(apiDir, 'dist');

/** I soli moduli che il bundle può lasciare fuori: binari nativi, installati con il deploy. */
const ALLOWED_EXTERNALS = new Set(['sharp', '@node-rs/argon2']);

const baseUrl =
  process.env.DATABASE_URL ?? 'postgres://amoris:sviluppo-locale@localhost:5432/amoris';

function urlForDatabase(name: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** Ambiente minimo per i processi figli: niente `.env`, niente variabili del chiamante. */
function childEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
  const keep = ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE'];
  const base: Record<string, string> = {};
  for (const key of keep) {
    const value = process.env[key];
    if (value !== undefined) base[key] = value;
  }
  return { ...base, ...extra };
}

const SYNTHETIC_SECRETS = {
  IP_HASH_SALT: 'sale-sintetico-per-i-test-abbastanza-lungo',
  CSRF_SECRET: 'segreto-sintetico-per-i-test-abbastanza-lungo',
};

function runNode(script: string, env: Record<string, string>) {
  return spawnSync(process.execPath, [path.join(distDir, script)], {
    cwd: apiDir,
    env: childEnv(env),
    encoding: 'utf8',
    timeout: 60_000,
  });
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === 'object') resolve(address.port);
        else reject(new Error('porta non assegnata'));
      });
    });
  });
}

/** Nome del pacchetto da uno specificatore: `sharp/lib/x` → `sharp`, `@a/b/c` → `@a/b`. */
function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

interface Metafile {
  outputs: Record<string, { imports: { path: string; external?: boolean }[] }>;
}

let bundleResult: ReturnType<typeof spawnSync>;

beforeAll(() => {
  bundleResult = spawnSync(process.execPath, [path.join(apiDir, 'scripts', 'bundle.mjs')], {
    cwd: apiDir,
    encoding: 'utf8',
    timeout: 120_000,
  });
});

describe('bundle di produzione dell API (DR-358)', () => {
  it('lo script di impacchettamento termina senza errori', () => {
    expect(bundleResult.status, String(bundleResult.stderr)).toBe(0);
    for (const file of [
      'server.js',
      'bin/migrate.js',
      'bin/account-create.js',
      'bin/scrub-server.js',
    ]) {
      expect(existsSync(path.join(distDir, file)), file).toBe(true);
    }
  });

  it('lascia fuori solo i moduli nativi', () => {
    const metafile = JSON.parse(
      readFileSync(path.join(distDir, 'bundle-meta.json'), 'utf8'),
    ) as Metafile;
    const builtins = new Set(builtinModules);
    const externals = new Set<string>();
    for (const output of Object.values(metafile.outputs)) {
      for (const entry of output.imports) {
        if (!entry.external) continue;
        const name = entry.path.replace(/^node:/, '');
        if (entry.path.startsWith('node:') || builtins.has(name.split('/')[0] ?? name)) continue;
        externals.add(packageName(entry.path));
      }
    }
    expect([...externals].filter((name) => !ALLOWED_EXTERNALS.has(name))).toEqual([]);
  });

  it('porta con sé le migrazioni', () => {
    expect(existsSync(path.join(distDir, 'drizzle', 'meta', '_journal.json'))).toBe(true);
  });

  it('il servizio parte con node e risponde a /health/live con il database spento', async () => {
    const port = await freePort();
    const child = spawn(process.execPath, [path.join(distDir, 'server.js')], {
      cwd: apiDir,
      env: childEnv({
        ...SYNTHETIC_SECRETS,
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
        API_HOST: '127.0.0.1',
        API_PORT: String(port),
        DATABASE_URL: 'postgres://nessuno:nessuno@127.0.0.1:59999/inesistente',
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    try {
      let response: Response | undefined;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline && child.exitCode === null) {
        try {
          response = await fetch(`http://127.0.0.1:${port}/health/live`);
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      expect(response?.status, stderr).toBe(200);
      expect(await response?.json()).toMatchObject({ status: 'ok' });
    } finally {
      child.kill('SIGTERM');
    }
  });

  it('il servizio di pulizia non carica moduli esterni: la sua immagine non ha node_modules (DR-361)', () => {
    const metafile = JSON.parse(
      readFileSync(path.join(distDir, 'bundle-meta.json'), 'utf8'),
    ) as Metafile;
    const builtins = new Set(builtinModules);
    const seen = new Set<string>();
    const externals = new Set<string>();
    const visit = (output: string) => {
      if (seen.has(output)) return;
      seen.add(output);
      for (const entry of metafile.outputs[output]?.imports ?? []) {
        if (!entry.external) {
          visit(entry.path);
          continue;
        }
        const name = entry.path.replace(/^node:/, '');
        if (!builtins.has(name.split('/')[0] ?? name)) externals.add(packageName(entry.path));
      }
    };
    visit('dist/bin/scrub-server.js');
    expect(seen.size).toBeGreaterThan(0);
    expect(metafile.outputs['dist/bin/scrub-server.js']).toBeDefined();
    expect([...externals]).toEqual([]);
  });

  it('il servizio di pulizia parte con node, risponde a /health/live e rifiuta chi non ha il gettone', async () => {
    const port = await freePort();
    const child = spawn(process.execPath, [path.join(distDir, 'bin', 'scrub-server.js')], {
      cwd: apiDir,
      env: childEnv({
        SCRUB_HOST: '127.0.0.1',
        SCRUB_PORT: String(port),
        SCRUB_SERVICE_TOKEN: 'gettone-sintetico-del-servizio-di-pulizia-1f',
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    try {
      let response: Response | undefined;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline && child.exitCode === null) {
        try {
          response = await fetch(`http://127.0.0.1:${port}/health/live`);
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      expect(response?.status, stderr).toBe(200);
      const denied = await fetch(`http://127.0.0.1:${port}/scrub`, {
        method: 'POST',
        headers: { 'content-type': 'application/pdf' },
        body: '%PDF-1.7',
      });
      expect(denied.status).toBe(401);
    } finally {
      child.kill('SIGTERM');
    }
  });

  it('il servizio di pulizia senza gettone non parte e dice quale variabile manca', () => {
    const result = runNode('bin/scrub-server.js', { SCRUB_PORT: '0' });
    expect(result.status).toBe(78);
    expect(String(result.stderr)).toContain('SCRUB_SERVICE_TOKEN');
  });

  describe('con un database temporaneo', () => {
    const name = `bundle_1f_${process.pid}_${Date.now()}`;
    const admin = postgres(urlForDatabase('postgres'), { max: 1, onnotice: () => {} });

    beforeAll(async () => {
      await admin.unsafe(`drop database if exists "${name}" with (force)`);
      await admin.unsafe(`create database "${name}"`);
    });

    afterAll(async () => {
      await admin.unsafe(`drop database if exists "${name}" with (force)`);
      await admin.end({ timeout: 5 });
    });

    it('le migrazioni si applicano con node dal bundle', async () => {
      const result = runNode('bin/migrate.js', { DATABASE_URL: urlForDatabase(name) });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain('Migrazioni applicate');

      const journal = JSON.parse(
        readFileSync(path.join(distDir, 'drizzle', 'meta', '_journal.json'), 'utf8'),
      ) as { entries: unknown[] };
      const client = postgres(urlForDatabase(name), { max: 1, onnotice: () => {} });
      try {
        const [row] = await client<
          { count: string }[]
        >`select count(*)::text as count from drizzle.__drizzle_migrations`;
        expect(Number(row?.count)).toBe(journal.entries.length);
      } finally {
        await client.end({ timeout: 5 });
      }
    });

    it('account:create crea l account con node dal bundle, senza stampare la password', async () => {
      const password = 'password-sintetica-del-bundle';
      const result = runNode('bin/account-create.js', {
        ...SYNTHETIC_SECRETS,
        DATABASE_URL: urlForDatabase(name),
        ACCOUNT_EMAIL: 'bundle.sintetico@esempio.invalid',
        ACCOUNT_NAME: 'Bundle Sintetico',
        ACCOUNT_PASSWORD: password,
        ACCOUNT_ROLE: 'amministrazione',
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).toContain('Account creato');
      expect(result.stdout + result.stderr).not.toContain(password);

      const client = postgres(urlForDatabase(name), { max: 1, onnotice: () => {} });
      try {
        const [row] = await client<{ hash: string }[]>`
          select password_hash as hash from users where email = 'bundle.sintetico@esempio.invalid'`;
        expect(row?.hash.startsWith('$argon2id$')).toBe(true);
      } finally {
        await client.end({ timeout: 5 });
      }
    });
  });
});
