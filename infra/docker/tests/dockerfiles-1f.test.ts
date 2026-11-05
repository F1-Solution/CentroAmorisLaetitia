import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regole dei Dockerfile delle applicazioni (1F-W2 T4, criterio W2-1), lette dal testo.
 *
 * Non serve Docker: controlla che ogni immagine di base sia fissata per versione e digest,
 * che l'ultimo stadio giri con un utente non `root` e `NODE_ENV=production`, e che le
 * dipendenze si installino dal lockfile. Il comportamento vero lo prova
 * `immagini-1f.test.ts`.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const dockerDir = path.join(repoRoot, 'infra', 'docker');
const APPS = ['web', 'admin', 'api'] as const;

interface Stage {
  from: string;
  alias: string | undefined;
  lines: string[];
}

/** Istruzioni del Dockerfile, con le righe continuate unite e i commenti tolti. */
function instructions(text: string): string[] {
  const joined = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line))
    .join('\n')
    .replace(/\\\n/g, ' ');
  return joined
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function stages(text: string): Stage[] {
  const result: Stage[] = [];
  for (const line of instructions(text)) {
    const from = /^FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i.exec(line);
    if (from) {
      result.push({ from: from[1] ?? '', alias: from[2]?.toLowerCase(), lines: [] });
      continue;
    }
    result.at(-1)?.lines.push(line);
  }
  return result;
}

function read(app: string): string {
  return readFileSync(path.join(dockerDir, `${app}.Dockerfile`), 'utf8');
}

describe.each(APPS)('%s.Dockerfile', (app) => {
  it('esiste', () => {
    expect(existsSync(path.join(dockerDir, `${app}.Dockerfile`))).toBe(true);
  });

  it('fissa ogni immagine di base per versione e digest, senza latest', () => {
    const all = stages(read(app));
    expect(all.length).toBeGreaterThan(1);
    const aliases = new Set<string>();
    for (const stage of all) {
      if (!aliases.has(stage.from.toLowerCase())) {
        expect(stage.from, stage.from).toMatch(/^[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/);
        expect(stage.from).not.toMatch(/:latest@/);
      }
      if (stage.alias) aliases.add(stage.alias);
    }
  });

  it('installa le dipendenze dal lockfile', () => {
    expect(read(app)).toMatch(/pnpm install[^\n]*--frozen-lockfile/);
  });

  it("nell'ultimo stadio gira con un utente non root e NODE_ENV=production", () => {
    const last = stages(read(app)).at(-1);
    const users = (last?.lines ?? []).filter((line) => /^USER\s/i.test(line));
    const user = users
      .at(-1)
      ?.replace(/^USER\s+/i, '')
      .split(':')[0];
    expect(user).toBeDefined();
    expect(['root', '0']).not.toContain(user);
    expect(last?.lines.some((line) => /^ENV\s.*\bNODE_ENV=production\b/.test(line))).toBe(true);
  });

  it("nell'ultimo stadio dichiara un health check", () => {
    const last = stages(read(app)).at(-1);
    expect(last?.lines.some((line) => /^HEALTHCHECK\s/i.test(line))).toBe(true);
  });
});

describe('.dockerignore', () => {
  const file = path.join(repoRoot, '.dockerignore');

  it('esiste alla radice', () => {
    expect(existsSync(file)).toBe(true);
  });

  it('esclude segreti, sorgenti private, documenti di lavoro e cartelle generate', () => {
    const rules = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
    for (const rule of [
      '.env*',
      '!.env.example',
      'source-private',
      'source-readonly',
      '.reference',
      '.superpowers',
      '.planning',
      'coverage',
      'test-results',
      '**/node_modules',
      '.git',
    ]) {
      expect(rules, rule).toContain(rule);
    }
  });
});
