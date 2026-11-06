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
const APPS = ['web', 'admin', 'api', 'scrub'] as const;

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

describe('backup.Dockerfile: servizio di backup (1F-W3 T1, DR-366)', () => {
  const text = (): string => read('backup');
  const all = (): Stage[] => stages(text());
  const compose = (): string =>
    readFileSync(path.join(repoRoot, 'infra', 'deploy', 'compose.yml'), 'utf8');

  it('esiste', () => {
    expect(existsSync(path.join(dockerDir, 'backup.Dockerfile'))).toBe(true);
  });

  it('fissa ogni immagine di base per versione e digest, senza latest', () => {
    const aliases = new Set<string>();
    expect(all().length).toBeGreaterThan(0);
    for (const stage of all()) {
      if (!aliases.has(stage.from.toLowerCase())) {
        expect(stage.from, stage.from).toMatch(/^[\w./-]+:[\w.-]+@sha256:[0-9a-f]{64}$/);
        expect(stage.from).not.toMatch(/:latest@/);
      }
      if (stage.alias) aliases.add(stage.alias);
    }
  });

  it('parte dalla stessa immagine del database del Compose, così il client ha la stessa versione', () => {
    const db = /^\s*image:\s*(postgres:\S+@sha256:[0-9a-f]{64})\s*$/m.exec(compose())?.[1];
    expect(db).toBeDefined();
    expect(all().at(-1)?.from).toBe(db);
  });

  it("nell'ultimo stadio gira con un utente non root e senza health check", () => {
    const last = all().at(-1);
    const user = (last?.lines ?? [])
      .filter((line) => /^USER\s/i.test(line))
      .at(-1)
      ?.replace(/^USER\s+/i, '')
      .split(':')[0];
    expect(user).toBeDefined();
    expect(['root', '0']).not.toContain(user);
    expect(last?.lines.some((line) => /^HEALTHCHECK\s+(?!NONE)/i.test(line))).toBe(false);
  });

  it('scarica ogni file da Internet con impronta dichiarata', () => {
    const adds = instructions(text()).filter((line) => /^ADD\s.*https?:\/\//i.test(line));
    expect(adds.length).toBeGreaterThan(0);
    for (const line of adds) expect(line).toMatch(/--checksum=sha256:[0-9a-f]{64}\s/);
  });

  it('porta restic 0.19.1 e mc copiato dall’immagine del Compose, fissata per digest', () => {
    expect(text()).toContain('/v0.19.1/restic_0.19.1_linux_amd64.bz2');
    const mc = /image:\s*(cgr\.dev\/chainguard\/minio-client@sha256:[0-9a-f]{64})/.exec(
      compose(),
    )?.[1];
    expect(mc).toBeDefined();
    expect(text()).toContain(`COPY --from=${mc} /usr/bin/mc`);
  });

  it('installa il client ssh con la versione del pacchetto fissata', () => {
    expect(text()).toMatch(/apk add[^\n]*openssh-client-default=\S+/);
  });

  it('copia dal repository solo gli script di infra/deploy/backup, senza segreti nelle variabili d’ambiente', () => {
    const lines = instructions(text());
    const copies = lines.filter((line) => /^COPY\s+(?!--from)/i.test(line));
    expect(copies.length).toBe(2);
    for (const line of copies)
      expect(line).toMatch(/^COPY\s+(?:--chmod=\d+\s+)?infra\/deploy\/backup\/[\w.-]+\s/);
    expect(lines.some((line) => /^ENV\s.*(PASSWORD|SECRET|KEY|TOKEN)/i.test(line))).toBe(false);
  });
});

describe('scrub.Dockerfile: programmi della pulizia come la CI (DR-268, DR-359)', () => {
  const ci = readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
  const ciValue = (name: string): string => {
    const match = new RegExp(`^\\s*${name}:\\s*'?([^'\\s]+)'?\\s*$`, 'm').exec(ci);
    if (!match?.[1]) throw new Error(`${name} non trovato in ci.yml`);
    return match[1];
  };

  it('scarica ogni file da Internet con impronta dichiarata', () => {
    const adds = instructions(read('scrub')).filter((line) => /^ADD\s.*https?:\/\//i.test(line));
    expect(adds.length).toBe(2);
    for (const line of adds) expect(line).toMatch(/--checksum=sha256:[0-9a-f]{64}\s/);
  });

  it('usa le stesse versioni e le stesse impronte di ci.yml', () => {
    const text = read('scrub');
    for (const name of [
      'QPDF_VERSION',
      'QPDF_SHA256',
      'FFMPEG_RELEASE',
      'FFMPEG_ARCHIVE',
      'FFMPEG_SHA256',
    ]) {
      expect(text, name).toContain(ciValue(name));
    }
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
