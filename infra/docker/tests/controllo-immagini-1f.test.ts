import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Controllo dei file delle immagini (1F-W2 T9, criterio W2-8): `infra/docker/check-image.mjs`.
 *
 * Costruisce immagini minime `FROM scratch` con file sintetici e controlla che lo script
 * accetti quella pulita e rifiuti, nominando il file, ogni immagine con un file d'ambiente,
 * una chiave o un certificato dell'applicazione, una cartella di sorgenti private o un
 * indirizzo `localhost` nel codice che va al browser. Nessun dato reale: i file sono vuoti o
 * contengono testo inventato.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const script = path.join(repoRoot, 'infra', 'docker', 'check-image.mjs');
const workDir = mkdtempSync(path.join(tmpdir(), 'amoris-controllo-'));
const PREFIX = 'amoris-controllo-prova';

/** Percorso lungo oltre i 100 caratteri dell'intestazione tar: passa dalle estensioni PAX. */
const LONG_DIR = `app/node_modules/${'cartella-molto-lunga/'.repeat(6)}`;

const CLEAN: Record<string, string> = {
  'app/server.js': 'console.info("pronto");\n',
  'app/.env.example': 'CHIAVE=\n',
  // Come le librerie di URL e di link: la parola, non un indirizzo.
  'app/apps/web/.next/static/chunks/main.js':
    'fetch("/api/health/live");if("localhost"===s.host)s.host="";\n',
  'etc/ssl/certs/ca-certificates.crt': 'certificati sintetici\n',
  'etc/ssl/certs/autorita-sintetica.pem': 'certificato sintetico\n',
  [`${LONG_DIR}index.js`]: 'module.exports = 1;\n',
};

const CASES: Record<string, { files: Record<string, string>; expected: string }> = {
  env: { files: { 'app/.env.production': 'X=1\n' }, expected: 'app/.env.production' },
  envlungo: { files: { [`${LONG_DIR}.env`]: 'X=1\n' }, expected: `${LONG_DIR}.env` },
  ambiente: {
    files: { 'app/config/production.env': 'X=1\n' },
    expected: 'app/config/production.env',
  },
  pem: { files: { 'app/certs/server.pem': 'finto\n' }, expected: 'app/certs/server.pem' },
  chiave: { files: { 'root/.ssh/id_ed25519': 'finto\n' }, expected: 'root/.ssh/id_ed25519' },
  privata: {
    files: { 'repo/source-private/nota.txt': 'testo inventato\n' },
    expected: 'repo/source-private/nota.txt',
  },
  porta: {
    files: { 'app/apps/web/.next/static/chunks/b.js': 'const a="127.0.0.1:3002";\n' },
    expected: 'app/apps/web/.next/static/chunks/b.js',
  },
  localhost: {
    files: { 'app/apps/admin/.next/static/chunks/app.js': 'fetch("http://localhost:3002/x");\n' },
    expected: 'app/apps/admin/.next/static/chunks/app.js',
  },
};

function build(name: string, files: Record<string, string>): string {
  const dir = path.join(workDir, name);
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, 'root', file)), { recursive: true });
    writeFileSync(path.join(dir, 'root', file), content);
  }
  writeFileSync(path.join(dir, 'Dockerfile'), 'FROM scratch\nCOPY root/ /\n');
  const tag = `${PREFIX}:${name}`;
  const result = spawnSync('docker', ['build', '-q', '-t', tag, dir], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`docker build ${name}: ${result.stderr}`);
  return tag;
}

function check(image: string) {
  return spawnSync(process.execPath, [script, image], { encoding: 'utf8' });
}

const images: Record<string, string> = {};

beforeAll(() => {
  images.pulita = build('pulita', CLEAN);
  for (const [name, spec] of Object.entries(CASES)) {
    images[name] = build(name, { ...CLEAN, ...spec.files });
  }
});

afterAll(() => {
  spawnSync('docker', ['image', 'rm', '-f', ...Object.values(images)], { encoding: 'utf8' });
  rmSync(workDir, { recursive: true, force: true });
});

describe('check-image.mjs', () => {
  it('accetta un’immagine pulita, con i certificati di sistema e .env.example', () => {
    const result = check(images.pulita ?? '');
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/nessun file vietato/);
  });

  it.each(Object.entries(CASES))('rifiuta l’immagine «%s» e nomina il file', (name, spec) => {
    const result = check(images[name] ?? '');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(spec.expected);
  });

  it('senza immagine o con un’immagine inesistente esce con 2', () => {
    expect(check('').status).toBe(2);
    expect(check(`${PREFIX}:inesistente`).status).toBe(2);
  });
});
