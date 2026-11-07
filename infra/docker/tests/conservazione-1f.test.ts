import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Prove della conservazione e della cifratura del backup (1F-W3 T5, criteri W3-4 e W3-5; DR-366…DR-373).
 *
 * Con Docker: database, MinIO e destinazione SFTP di prova con dati **sintetici** e riconoscibili.
 * Le istantanee su 8 mesi si creano con `restic backup --time` dentro l'immagine; poi lo script vero
 * `amoris-backup backup` aggiunge quella di «ora» e applica `forget --prune`. Password e chiavi
 * nascono qui e finiscono in volumi che la prova rimuove.
 *
 * Regole di conservazione di restic, lette il 2026-11-06 su
 * https://restic.readthedocs.io/en/stable/060_forget.html («Removing backup snapshots»):
 * ogni `--keep-daily/weekly/monthly N` copre gli ultimi N periodi (giorni, settimane da lunedì a
 * domenica, mesi di calendario) che contengono istantanee e tiene la più recente di ciascuno;
 * una politica non consuma slot per i periodi vuoti; le politiche si sommano (OR); di default le
 * istantanee sono raggruppate per host e percorsi, e `--host`/`--tag` limitano quelle considerate.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const TAG = 'prova-t5';
const IMAGE = `amoris-backup:${TAG}`;
const SFTP_IMAGE = `amoris-sftp-prova:${TAG}`;
const NET = 'amoris-t5-rete';
const C = { sftp: 'amoris-t5-sftp', db: 'amoris-t5-db', objects: 'amoris-t5-objects' };
const V = {
  keys: 'amoris-t5-chiavi',
  data: 'amoris-t5-dati',
  state: 'amoris-t5-stato',
  cache: 'amoris-t5-cache',
  objects: 'amoris-t5-oggetti',
};
const REPO_IN_SFTP = '/home/sftpuser/repo/amoris';

const compose = readFileSync(path.join(repoRoot, 'infra', 'deploy', 'compose.yml'), 'utf8');
const composeImage = (pattern: RegExp): string => {
  const found = pattern.exec(compose)?.[1];
  if (!found) throw new Error(`immagine non trovata nel Compose: ${pattern}`);
  return found;
};
const DB_IMAGE = composeImage(/^\s*image:\s*(postgres:\S+@sha256:[0-9a-f]{64})\s*$/m);
const MINIO_IMAGE = composeImage(
  /^\s*image:\s*(cgr\.dev\/chainguard\/minio@sha256:[0-9a-f]{64})\s*$/m,
);

const secret = (): string => randomBytes(18).toString('hex');
const SECRETS = {
  restic: secret(),
  wrong: secret(),
  pg: secret(),
  s3Access: `AK${secret()}`.slice(0, 20),
  s3Secret: secret(),
};

/** Stringhe uniche dei dati sintetici: non devono comparire in nessun file del repository. */
const RUN_ID = randomUUID();
const MARK_DB = `amoris-t5-db-${RUN_ID}`;
const MARK_BODY = `amoris-t5-corpo-${RUN_ID}`;
const MARK_NAME = `amoris-t5-nome-${RUN_ID}`;
const MARKS = [MARK_DB, MARK_BODY, MARK_NAME];

interface Run {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function docker(args: string[], input?: string): Run {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function dockerBuild(args: string[]): Promise<{ status: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('docker', args, { cwd: repoRoot, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-16_000);
    });
    child.on('error', (error) => resolve({ status: null, stderr: String(error) }));
    child.on('close', (status) => resolve({ status, stderr }));
  });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Ogni uscita dei contenitori di backup: serve alla prova finale sui segreti che non devono comparire. */
const outputs: string[] = [];
let buildResult: { status: number | null; stderr: string } | undefined;
let sftpBuildResult: { status: number | null; stderr: string } | undefined;

const BASE_ENV: Record<string, string> = {
  PGHOST: 'db',
  PGUSER: 'amoris',
  PGDATABASE: 'amoris',
  PGPASSWORD_FILE: '/keys/pg_password',
  S3_ENDPOINT: 'http://objects:9000',
  S3_ACCESS_KEY_FILE: '/keys/s3_access',
  S3_SECRET_KEY_FILE: '/keys/s3_secret',
  S3_BUCKET_PUBLIC: 'media-public',
  S3_BUCKET_PRIVATE: 'media-private',
  RESTIC_PASSWORD_FILE: '/keys/restic_password',
  BACKUP_SFTP_HOST: 'sftp',
  BACKUP_SFTP_PORT: '2222',
  BACKUP_SFTP_USER: 'sftpuser',
  BACKUP_SFTP_PATH: 'repo/amoris',
  BACKUP_SSH_KEY_FILE: '/keys/client_ed25519',
  BACKUP_KNOWN_HOSTS_FILE: '/keys/known_hosts',
  BACKUP_SSH_CONNECT_TIMEOUT: '5',
  PGCONNECT_TIMEOUT: '5',
};

/** Come girerà in produzione: sola lettura, `/tmp` in memoria, nessuna capability, HOME inesistente. */
function runArgs(env: Record<string, string>, command: string[]): string[] {
  return [
    'run',
    '--rm',
    '--network',
    NET,
    '--read-only',
    '--tmpfs',
    '/tmp:mode=1777',
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges:true',
    '--memory',
    '512m',
    '-e',
    'HOME=/nonexistent',
    ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    '-v',
    `${V.data}:/backup/data`,
    '-v',
    `${V.state}:/backup/state`,
    '-v',
    `${V.cache}:/backup/cache`,
    '-v',
    `${V.keys}:/keys:ro`,
    IMAGE,
    ...command,
  ];
}

interface Outcome {
  command: string;
  outcome: string;
  snapshot_id: string | null;
  failed_step: string | null;
  exit_code: number;
}

function parseLine(run: Run): Outcome {
  const lines = run.stdout.split('\n').filter((line) => line.length > 0);
  return JSON.parse(lines.at(-1) ?? '{}') as Outcome;
}

function script(
  command: 'init' | 'backup' | 'check',
  overrides: Record<string, string | null> = {},
): { run: Run; line: Outcome } {
  const env: Record<string, string> = { ...BASE_ENV };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete env[key];
    else env[key] = value;
  }
  const run = docker(runArgs(env, ['amoris-backup', command]));
  outputs.push(`${run.stdout}\n${run.stderr}`);
  return { run, line: parseLine(run) };
}

/** Esegue restic con le stesse variabili e lo stesso `sftp.command` dello script, tramite `lib.sh`; senza riga di esito (`EMITTED=1`). */
function resticShell(body: string, env: Record<string, string> = {}): Run {
  const run = docker(
    runArgs({ ...BASE_ENV, ...env }, [
      'sh',
      '-c',
      `. /usr/local/lib/amoris-backup/lib.sh; begin prova; EMITTED=1; setup_restic; ${body}`,
    ]),
  );
  outputs.push(`${run.stdout}\n${run.stderr}`);
  return run;
}

function volumeShell(volume: string, command: string): Run {
  return docker([
    'run',
    '--rm',
    '-v',
    `${volume}:/v:ro`,
    '--entrypoint',
    'sh',
    IMAGE,
    '-c',
    command,
  ]);
}

function putSecret(name: string, content: string): void {
  const run = docker(
    [
      'run',
      '--rm',
      '-i',
      '--user',
      'root',
      '-v',
      `${V.keys}:/keys`,
      '--entrypoint',
      'sh',
      IMAGE,
      '-c',
      `cat > /keys/${name} && chmod 0444 /keys/${name}`,
    ],
    content,
  );
  if (run.status !== 0) throw new Error(run.stderr);
}

function mcSrc(command: string): Run {
  return docker([
    'run',
    '--rm',
    '--network',
    NET,
    '--tmpfs',
    '/tmp:mode=1777',
    '-e',
    'MC_CONFIG_DIR=/tmp/mc',
    '-e',
    `AK=${SECRETS.s3Access}`,
    '-e',
    `SK=${SECRETS.s3Secret}`,
    '--entrypoint',
    'sh',
    IMAGE,
    '-c',
    `mc alias set l http://objects:9000 "$AK" "$SK" >/dev/null && ${command}`,
  ]);
}

function psql(sql: string): Run {
  return docker(
    [
      'exec',
      '-i',
      '-e',
      `PGPASSWORD=${SECRETS.pg}`,
      C.db,
      'psql',
      '-h',
      '127.0.0.1',
      '-U',
      'amoris',
      '-d',
      'amoris',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-At',
    ],
    sql,
  );
}

const dbReady = (): boolean =>
  docker(['exec', C.db, 'pg_isready', '-h', '127.0.0.1', '-U', 'amoris']).status === 0;
const objectsReady = (): boolean => mcSrc('mc ready l >/dev/null 2>&1').status === 0;

async function waitFor(what: string, probe: () => boolean, seconds = 60): Promise<void> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (probe()) return;
    await sleep(1000);
  }
  throw new Error(`attesa scaduta: ${what}`);
}

function removeAll(): void {
  docker(['rm', '-f', '-v', ...Object.values(C)]);
  docker(['network', 'rm', NET]);
  docker(['volume', 'rm', '-f', ...Object.values(V)]);
}

beforeAll(async () => {
  const version = docker(['version', '--format', '{{.Server.Version}}']);
  if (version.status !== 0) throw new Error(`Docker non raggiungibile: ${version.stderr}`);
  removeAll();
  buildResult = await dockerBuild([
    'build',
    '-f',
    'infra/docker/backup.Dockerfile',
    '-t',
    IMAGE,
    '.',
  ]);
  sftpBuildResult = await dockerBuild([
    'build',
    '-f',
    'infra/deploy/tests/sftp-prova.Dockerfile',
    '-t',
    SFTP_IMAGE,
    '.',
  ]);
  if (buildResult.status !== 0 || sftpBuildResult.status !== 0) return;

  expect(docker(['network', 'create', '--internal', NET]).status).toBe(0);
  for (const volume of Object.values(V))
    expect(docker(['volume', 'create', volume]).status).toBe(0);

  const keygen = docker([
    'run',
    '--rm',
    '--user',
    'root',
    '-v',
    `${V.keys}:/keys`,
    '--entrypoint',
    'sh',
    SFTP_IMAGE,
    '-c',
    [
      'set -eu',
      'for n in host client; do ssh-keygen -q -t ed25519 -N "" -C "" -f /keys/${n}_ed25519; done',
      'printf "[sftp]:2222 %s\\n" "$(cut -d" " -f1,2 /keys/host_ed25519.pub)" > /keys/known_hosts',
      'cp /keys/client_ed25519.pub /keys/authorized_keys',
      'chmod 0444 /keys/client_ed25519 /keys/known_hosts /keys/authorized_keys',
      'chmod 0600 /keys/host_ed25519',
    ].join('\n'),
  ]);
  if (keygen.status !== 0) throw new Error(keygen.stderr);
  putSecret('restic_password', SECRETS.restic);
  putSecret('pg_password', SECRETS.pg);
  putSecret('s3_access', SECRETS.s3Access);
  putSecret('s3_secret', SECRETS.s3Secret);

  const start = (name: string, args: string[]): void => {
    const run = docker(['run', '-d', '--name', name, '--network', NET, ...args]);
    if (run.status !== 0) throw new Error(run.stderr);
  };
  start(C.sftp, ['--network-alias', 'sftp', '-v', `${V.keys}:/keys:ro`, SFTP_IMAGE]);
  start(C.db, [
    '--network-alias',
    'db',
    '-e',
    'POSTGRES_USER=amoris',
    '-e',
    `POSTGRES_PASSWORD=${SECRETS.pg}`,
    '-e',
    'POSTGRES_DB=amoris',
    DB_IMAGE,
  ]);
  start(C.objects, [
    '--network-alias',
    'objects',
    '-e',
    `MINIO_ROOT_USER=${SECRETS.s3Access}`,
    '-e',
    `MINIO_ROOT_PASSWORD=${SECRETS.s3Secret}`,
    '-e',
    'MINIO_BROWSER=off',
    '-v',
    `${V.objects}:/data`,
    MINIO_IMAGE,
    'server',
    '/data',
  ]);
  await waitFor('database', dbReady);
  await waitFor('archivio degli oggetti', objectsReady);

  const seed = psql(
    [
      'CREATE TABLE pagine_sintetiche (id serial PRIMARY KEY, titolo text NOT NULL);',
      `INSERT INTO pagine_sintetiche (titolo) VALUES ('${MARK_DB}'), ('titolo inventato due');`,
    ].join('\n'),
  );
  if (seed.status !== 0) throw new Error(seed.stderr);
  const objects = mcSrc(
    [
      'mc mb l/media-public >/dev/null',
      'mc mb l/media-private >/dev/null',
      `printf "${MARK_BODY} pubblico" > /tmp/uno.txt`,
      `printf "${MARK_BODY} privato" > /tmp/due.txt`,
      `mc cp /tmp/uno.txt "l/media-public/${MARK_NAME}-uno.txt" >/dev/null`,
      `mc cp /tmp/due.txt "l/media-private/${MARK_NAME}/due.txt" >/dev/null`,
    ].join(' && '),
  );
  if (objects.status !== 0) throw new Error(objects.stderr);
});

afterEach(async () => {
  await sleep(100);
});

afterAll(() => {
  removeAll();
  docker(['image', 'rm', '-f', IMAGE, SFTP_IMAGE]);
});

// ---------------------------------------------------------------------------------------------
// Modello della conservazione di restic (giorni, settimane e mesi, come lo script).
// ---------------------------------------------------------------------------------------------

interface Snap {
  readonly id: string;
  readonly time: Date;
  readonly host: string;
  readonly tags: readonly string[];
}

const pad = (n: number): string => String(n).padStart(2, '0');
const dayKey = (d: Date): string =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const monthKey = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;

/** Settimana ISO (lunedì-domenica), come `time.ISOWeek()` di Go. */
function weekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const weekday = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

interface Policy {
  readonly daily: number;
  readonly weekly: number;
  readonly monthly: number;
}

/** Per ogni politica: dalla più recente, tiene la prima istantanea di ogni periodo, fino a N periodi. */
function expectedKept(group: readonly Snap[], policy: Policy): Map<string, Set<string>> {
  const sorted = [...group].sort((a, b) => b.time.getTime() - a.time.getTime());
  const reasons = new Map<string, Set<string>>();
  const apply = (name: string, limit: number, key: (d: Date) => string): void => {
    const seen = new Set<string>();
    for (const snap of sorted) {
      const period = key(snap.time);
      if (seen.has(period)) continue;
      if (seen.size >= limit) break;
      seen.add(period);
      reasons.set(snap.id, (reasons.get(snap.id) ?? new Set<string>()).add(name));
    }
  };
  apply('daily', policy.daily, dayKey);
  apply('weekly', policy.weekly, weekKey);
  apply('monthly', policy.monthly, monthKey);
  return reasons;
}

const POLICY: Policy = { daily: 7, weekly: 4, monthly: 6 };

function listSnapshots(): Snap[] {
  const run = resticShell('restic_run snapshots --json');
  expect(run.status, run.stderr).toBe(0);
  const parsed = JSON.parse(run.stdout) as {
    id: string;
    time: string;
    hostname: string;
    tags?: string[];
  }[];
  return parsed.map((s) => ({
    id: s.id,
    time: new Date(s.time),
    host: s.hostname,
    tags: s.tags ?? [],
  }));
}

/**
 * Istanti sintetici in giorni e ore (UTC) prima di oggi: più istantanee nello stesso giorno,
 * giorni consecutivi, settimane a cavallo di mese e mesi senza istantanee, su circa 8 mesi.
 */
const AMORIS_OFFSETS: readonly (readonly [number, number])[] = [
  [1, 8],
  [1, 20],
  [2, 12],
  [3, 12],
  [4, 12],
  [5, 12],
  [6, 12],
  [7, 12],
  [8, 12],
  [9, 12],
  [10, 12],
  [12, 12],
  [14, 12],
  [15, 12],
  [17, 23],
  [21, 12],
  [24, 12],
  [28, 12],
  [35, 12],
  [42, 12],
  [49, 12],
  [56, 12],
  [63, 12],
  [70, 12],
  [75, 12],
  [80, 12],
  [95, 6],
  [95, 18],
  [130, 12],
  [131, 12],
  [160, 12],
  [190, 12],
  [192, 12],
  [225, 12],
  [240, 12],
];
/** Di un altro host o con un'altra etichetta: restic non deve toccarle. */
const FOREIGN: readonly (readonly [number, number, string, string])[] = [
  [3, 9, 'altro-host', 'amoris-backup'],
  [100, 9, 'altro-host', 'amoris-backup'],
  [200, 9, 'altro-host', 'amoris-backup'],
  [2, 9, 'amoris', 'altra-etichetta'],
  [250, 9, 'amoris', 'altra-etichetta'],
];

const dateAt = (daysAgo: number, hour: number): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, hour),
  );
};
const stamp = (daysAgo: number, hour: number): string =>
  `${dayKey(dateAt(daysAgo, hour))} ${pad(hour)}:00:00`;

const SEED_SPEC = [
  ...AMORIS_OFFSETS.map(([d, h]) => `${stamp(d, h)}|amoris|amoris-backup`),
  ...FOREIGN.map(([d, h, host, tag]) => `${stamp(d, h)}|${host}|${tag}`),
].join('\n');

let before: Snap[] = [];
let after: Snap[] = [];

describe('conservazione 7 giornalieri, 4 settimanali, 6 mensili su istantanee sintetiche', () => {
  it('le immagini si costruiscono e lo script esiste', () => {
    expect(buildResult?.status, buildResult?.stderr.slice(-4000)).toBe(0);
    expect(sftpBuildResult?.status, sftpBuildResult?.stderr.slice(-4000)).toBe(0);
    expect(existsSync(path.join(repoRoot, 'infra', 'deploy', 'backup', 'amoris-backup'))).toBe(
      true,
    );
  });

  it('crea il repository e le istantanee datate su 8 mesi, di amoris e di altri host o etichette', () => {
    const init = script('init');
    expect(init.run.status, init.run.stdout + init.run.stderr).toBe(0);
    const seeded = resticShell(
      [
        'echo "$SPEC" | while IFS="|" read -r t h g; do',
        'restic_run backup --quiet --time "$t" --host "$h" --tag "$g" /backup/data >/dev/null || exit 1; done',
      ].join(' '),
      { SPEC: SEED_SPEC },
    );
    expect(seeded.status, seeded.stdout + seeded.stderr).toBe(0);
    before = listSnapshots();
    expect(before).toHaveLength(AMORIS_OFFSETS.length + FOREIGN.length);
  }, 300_000);

  it('lo script aggiunge l’istantanea di ora e lascia esattamente quelle attese', () => {
    const run = script('backup');
    expect(run.run.status, run.run.stdout + run.run.stderr).toBe(0);
    const backupId = run.line.snapshot_id ?? '';
    expect(backupId).toMatch(/^[0-9a-f]{64}$/);

    // L'istantanea di «ora» si riconosce dal suo identificativo; la più recente non viene mai potata.
    after = listSnapshots();
    expect(after.some((s) => s.id === backupId)).toBe(true);
    const nowSnap = after.find((s) => s.id === backupId) as Snap;
    const group = [...before, nowSnap].filter(
      (s) => s.host === 'amoris' && s.tags.length === 1 && s.tags[0] === 'amoris-backup',
    );
    const reasons = expectedKept(group, POLICY);
    const untouched = before.filter((s) => !group.some((g) => g.id === s.id)).map((s) => s.id);
    const expected = [...reasons.keys(), ...untouched].sort();

    // Il modello deve esercitare davvero le tre politiche, non solo quella giornaliera.
    const only = (name: string): number =>
      [...reasons.values()].filter((r) => r.size === 1 && r.has(name)).length;
    expect(reasons.size).toBeLessThan(group.length);
    expect(only('weekly')).toBeGreaterThanOrEqual(1);
    expect(only('monthly')).toBeGreaterThanOrEqual(1);

    expect(after.map((s) => s.id).sort()).toEqual(expected);
  }, 240_000);

  it('qualunque sia il giorno e l’ora in cui gira, ogni politica tiene qualcosa di esclusivo (modello su due anni)', () => {
    const day = 86_400_000;
    const failing: string[] = [];
    for (let i = 0; i < 731; i += 1) {
      for (const hour of [0, 12, 23]) {
        const now = new Date(Date.UTC(2026, 0, 1) + i * day + hour * 3_600_000);
        const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const group: Snap[] = AMORIS_OFFSETS.map(([d, h], k) => ({
          id: `s${k}`,
          time: new Date(base - d * day + h * 3_600_000),
          host: 'amoris',
          tags: ['amoris-backup'],
        }));
        group.push({ id: 'ora', time: now, host: 'amoris', tags: ['amoris-backup'] });
        const reasons = expectedKept(group, POLICY);
        const only = (name: string): number =>
          [...reasons.values()].filter((r) => r.size === 1 && r.has(name)).length;
        if (reasons.size >= group.length || only('weekly') < 1 || only('monthly') < 1) {
          failing.push(now.toISOString());
        }
      }
    }
    expect(failing).toEqual([]);
  });

  it('di due istantanee dello stesso giorno resta la più recente', () => {
    const day = dayKey(dateAt(1, 0));
    const hours = after
      .filter((s) => s.host === 'amoris' && s.tags.includes('amoris-backup'))
      .filter((s) => dayKey(s.time) === day)
      .map((s) => s.time.getUTCHours());
    expect(hours).toEqual([20]);
  });

  it('le istantanee di un altro host o di un’altra etichetta non vengono toccate', () => {
    const foreign = (s: Snap): boolean => s.host !== 'amoris' || !s.tags.includes('amoris-backup');
    expect(
      after
        .filter(foreign)
        .map((s) => s.id)
        .sort(),
    ).toEqual(
      before
        .filter(foreign)
        .map((s) => s.id)
        .sort(),
    );
    expect(after.filter(foreign)).toHaveLength(FOREIGN.length);
  });
});

function copyRepository(): string {
  const target = mkdtempSync(path.join(os.tmpdir(), 'amoris-t5-'));
  const copy = docker(['cp', `${C.sftp}:${REPO_IN_SFTP}/.`, target]);
  if (copy.status !== 0) throw new Error(copy.stderr);
  return target;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? [full, ...walk(full)] : [full];
  });
}

describe('cifratura: il repository non contiene i dati in chiaro', () => {
  it('controllo positivo: le stringhe stanno in chiaro nei dati sottoposti a backup', () => {
    const dump = volumeShell(V.data, `grep -c '${MARK_DB}' /v/db/database.dump`);
    expect(dump.status).toBe(0);
    expect(Number(dump.stdout.trim())).toBeGreaterThanOrEqual(1);
    const body = volumeShell(V.data, `grep -rl '${MARK_BODY}' /v/objects | wc -l`);
    expect(Number(body.stdout.trim())).toBe(2);
    const names = volumeShell(V.data, `find /v/objects -name '*${MARK_NAME}*' | wc -l`);
    expect(Number(names.stdout.trim())).toBeGreaterThanOrEqual(2);
  });

  it('nessuna stringa nota, né nome di oggetto, in nessun file del repository', () => {
    const dir = copyRepository();
    try {
      const entries = walk(dir);
      const relative = entries.map((e) => path.relative(dir, e).replaceAll('\\', '/'));
      // Il repository non è vuoto: configurazione, chiavi e almeno un pacchetto dati.
      expect(relative).toContain('config');
      expect(relative.some((p) => p.startsWith('keys/') && p.length > 'keys/'.length)).toBe(true);
      expect(relative.some((p) => p.startsWith('data/') && p.length > 'data/'.length + 3)).toBe(
        true,
      );
      const files = entries.filter((e) => statSync(e).isFile());
      expect(files.length).toBeGreaterThan(5);
      for (const file of files) {
        const content = readFileSync(file);
        for (const mark of MARKS) {
          expect(
            content.includes(Buffer.from(mark)),
            `${path.relative(dir, file)} contiene ${mark.slice(0, 14)}`,
          ).toBe(false);
        }
      }
      for (const name of relative) for (const mark of MARKS) expect(name).not.toContain(mark);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each(['check', 'backup'] as const)(
    '%s con una password sbagliata fallisce e lo stato registra l’errore',
    (command) => {
      const { run, line } = script(command, {
        RESTIC_PASSWORD_FILE: null,
        RESTIC_PASSWORD: SECRETS.wrong,
      });
      expect(run.status, run.stdout + run.stderr).not.toBe(0);
      expect(line).toMatchObject({ command, outcome: 'error', failed_step: 'repository' });
      expect(line.exit_code).toBe(run.status);
      const state = volumeShell(V.state, `cat /v/last-${command}.json`).stdout.trim();
      expect(state).toBe(run.stdout.trim());
      expect(JSON.parse(state)).toMatchObject({ outcome: 'error', failed_step: 'repository' });
    },
  );

  it('nessuna password, giusta o sbagliata, compare nelle uscite né negli stati', () => {
    const states = volumeShell(V.state, 'cat /v/last-*.json').stdout;
    const all = `${outputs.join('\n')}\n${states}`;
    for (const value of [SECRETS.restic, SECRETS.wrong, SECRETS.pg, SECRETS.s3Secret]) {
      expect(all.includes(value)).toBe(false);
    }
  });
});
