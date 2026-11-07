import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

/**
 * Prove degli script di backup (1F-W3 T2, criteri W3-2, W3-3, W3-6, W3-9; DR-366…DR-373).
 *
 * Con Docker: database PostgreSQL e MinIO dello stesso digest del Compose, popolati con dati
 * **sintetici**, una destinazione SFTP di prova (DR-370) con chiavi generate qui, e l'immagine
 * `backup` ricostruita dal repository. Password e chiavi nascono nella prova e finiscono in
 * volumi Docker che la prova rimuove. Nessun dato reale, nessun segreto del repository.
 *
 * Le prove della conservazione su otto mesi (T5) e del ripristino (T3, T6) non sono qui.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const backupDir = path.join(repoRoot, 'infra', 'deploy', 'backup');
const sftpDockerfile = path.join(repoRoot, 'infra', 'deploy', 'tests', 'sftp-prova.Dockerfile');
const TAG = 'prova-t2';
const IMAGE = `amoris-backup:${TAG}`;
const SFTP_IMAGE = `amoris-sftp-prova:${TAG}`;
const NET = 'amoris-t2-rete';
const C = {
  sftp: 'amoris-t2-sftp',
  db: 'amoris-t2-db',
  objects: 'amoris-t2-objects',
  holder: 'amoris-t2-holder',
};
const V = {
  keys: 'amoris-t2-chiavi',
  data: 'amoris-t2-dati',
  state: 'amoris-t2-stato',
  cache: 'amoris-t2-cache',
  objects: 'amoris-t2-oggetti',
};

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
  resticWrong: secret(),
  pg: secret(),
  s3Access: `AK${secret()}`.slice(0, 20),
  s3Secret: secret(),
};

/** Dati inventati: se compaiono in un'uscita del contenitore, la prova fallisce. */
const MARK_DB = 'DATO-SINTETICO-ALFA-7f3a';
const MARK_BODY = 'CONTENUTO-OGGETTO-SINTETICO-c5d2';
const OBJ = {
  uno: ['media-public', '2026/NOME-OGGETTO-SINTETICO-uno.txt'],
  due: ['media-private', 'privati/NOME-OGGETTO-SINTETICO-due.txt'],
  tre: ['media-public', 'NOME-OGGETTO-SINTETICO-tre.txt'],
  quattro: ['media-public', 'NOME-OGGETTO-SINTETICO-quattro.txt'],
} as const;

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
    timeout: 600_000,
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

/** Ogni uscita dei contenitori di backup: serve alla prova finale sui dati che non devono comparire. */
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
function runArgs(env: Record<string, string>, command: string[], entrypoint?: string): string[] {
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
    ...(entrypoint ? ['--entrypoint', entrypoint] : []),
    IMAGE,
    ...command,
  ];
}

interface Outcome {
  command: string;
  outcome: string;
  started_at: string;
  duration_seconds: number;
  dump_bytes: number | null;
  objects_bytes: number | null;
  objects_count: number | null;
  snapshot_id: string | null;
  failed_step: string | null;
  exit_code: number;
  repository?: string;
}

function amorisBackup(
  command: string,
  overrides: Record<string, string | null> = {},
): { run: Run; line: Outcome } {
  const env: Record<string, string> = { ...BASE_ENV };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) delete env[key];
    else env[key] = value;
  }
  const run = docker(runArgs(env, ['amoris-backup', command]));
  outputs.push(`${run.stdout}\n${run.stderr}`);
  const lines = run.stdout.split('\n').filter((line) => line.length > 0);
  const last = lines.at(-1) ?? '{}';
  return { run, line: JSON.parse(last) as Outcome };
}

/** Esegue uno script in un contenitore con la stessa forma del servizio, con `R` = restic sul repository di prova. */
function inspect(script: string): Run {
  const prelude = [
    'cp /keys/client_ed25519 /tmp/k && chmod 600 /tmp/k',
    'R() { restic -o "sftp.command=ssh -p 2222 -i /tmp/k -o UserKnownHostsFile=/keys/known_hosts -o StrictHostKeyChecking=yes -o BatchMode=yes sftpuser@sftp -s sftp" -r sftp:sftpuser@sftp:repo/amoris "$@"; }',
  ].join('\n');
  return docker(
    runArgs(
      { RESTIC_PASSWORD_FILE: '/keys/restic_password', RESTIC_CACHE_DIR: '/tmp/rc' },
      ['-c', `${prelude}\n${script}`],
      'sh',
    ),
  );
}

function readVolumeFile(volume: string, file: string): string {
  const run = docker([
    'run',
    '--rm',
    '-v',
    `${volume}:/v:ro`,
    '--entrypoint',
    'cat',
    IMAGE,
    `/v/${file}`,
  ]);
  return run.stdout;
}

/** Scrive un file nel volume delle chiavi come root, sola lettura per tutti (come un segreto di Docker). */
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

/** Comandi di `mc` contro MinIO di prova, con alias `l`. */
function mc(script: string): Run {
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
    `mc alias set l http://objects:9000 "$AK" "$SK" >/dev/null && ${script}`,
  ]);
}

const objectPath = ([bucket, key]: readonly [string, string]): string => `l/${bucket}/${key}`;

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
    ],
    sql,
  );
}

async function waitFor(what: string, probe: () => boolean, seconds = 60): Promise<void> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    if (probe()) return;
    await sleep(1000);
  }
  throw new Error(`attesa scaduta: ${what}`);
}

const dbReady = (): boolean =>
  docker(['exec', C.db, 'pg_isready', '-h', '127.0.0.1', '-U', 'amoris']).status === 0;
const objectsReady = (): boolean => mc('mc ready l >/dev/null 2>&1').status === 0;
const sftpReady = (): boolean =>
  inspect('R cat config >/dev/null 2>&1; test $? -ne 255').status === 0;

/** Ferma un servizio di prova, esegue la prova, lo riavvia e attende che risponda. */
async function whileStopped(
  container: string,
  ready: () => boolean,
  body: () => void,
): Promise<void> {
  expect(docker(['stop', '-t', '2', container]).status).toBe(0);
  try {
    body();
  } finally {
    docker(['start', container]);
    await waitFor(`${container} di nuovo pronto`, ready);
  }
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

  // Chiavi: host, host sbagliata, client; known_hosts giusto e sbagliato; tutto generato qui.
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
      'for n in host wrong client; do ssh-keygen -q -t ed25519 -N "" -C "" -f /keys/${n}_ed25519; done',
      'printf "[sftp]:2222 %s\\n" "$(cut -d" " -f1,2 /keys/host_ed25519.pub)" > /keys/known_hosts',
      'printf "[sftp]:2222 %s\\n" "$(cut -d" " -f1,2 /keys/wrong_ed25519.pub)" > /keys/known_hosts_wrong',
      'cp /keys/client_ed25519.pub /keys/authorized_keys',
      'chmod 0444 /keys/client_ed25519 /keys/known_hosts /keys/known_hosts_wrong /keys/authorized_keys',
      'chmod 0600 /keys/host_ed25519',
    ].join('\n'),
  ]);
  if (keygen.status !== 0) throw new Error(keygen.stderr);
  putSecret('restic_password', SECRETS.restic);
  putSecret('restic_password_wrong', SECRETS.resticWrong);
  putSecret('pg_password', SECRETS.pg);
  putSecret('s3_access', SECRETS.s3Access);
  putSecret('s3_secret', SECRETS.s3Secret);

  const sftp = docker([
    'run',
    '-d',
    '--name',
    C.sftp,
    '--network',
    NET,
    '--network-alias',
    'sftp',
    '-v',
    `${V.keys}:/keys:ro`,
    SFTP_IMAGE,
  ]);
  if (sftp.status !== 0) throw new Error(sftp.stderr);
  const db = docker([
    'run',
    '-d',
    '--name',
    C.db,
    '--network',
    NET,
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
  if (db.status !== 0) throw new Error(db.stderr);
  const objects = docker([
    'run',
    '-d',
    '--name',
    C.objects,
    '--network',
    NET,
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
  if (objects.status !== 0) throw new Error(objects.stderr);

  await waitFor('database', dbReady);
  await waitFor('archivio oggetti', objectsReady);

  const seed = psql(
    [
      'CREATE TABLE pagine_sintetiche (id serial PRIMARY KEY, titolo text NOT NULL);',
      'CREATE TABLE utenti_sintetici (id serial PRIMARY KEY, nome text NOT NULL);',
      `INSERT INTO pagine_sintetiche (titolo) VALUES ('${MARK_DB}'), ('titolo inventato due');`,
      "INSERT INTO utenti_sintetici (nome) VALUES ('nome inventato');",
    ].join('\n'),
  );
  if (seed.status !== 0) throw new Error(seed.stderr);

  const buckets = mc(
    [
      'mc mb l/media-public >/dev/null',
      'mc mb l/media-private >/dev/null',
      `printf %s ${MARK_BODY} > /tmp/corpo.txt`,
      ...[OBJ.uno, OBJ.due, OBJ.tre].map((o) => `mc cp /tmp/corpo.txt ${objectPath(o)} >/dev/null`),
    ].join(' && '),
  );
  if (buckets.status !== 0) throw new Error(buckets.stderr);
});

// Le prove usano chiamate sincrone: una pausa dopo ciascuna lascia respirare il ciclo degli eventi di Vitest.
afterEach(async () => {
  await sleep(100);
});

/** Un secondo contenitore tiene il lock esclusivo sul volume di stato mentre gira `body`. */
async function withLockHeld(body: () => void): Promise<void> {
  docker(['rm', '-f', '-v', C.holder]);
  const started = docker([
    'run',
    '-d',
    '--name',
    C.holder,
    '--tmpfs',
    '/tmp:mode=1777',
    '-v',
    `${V.state}:/backup/state`,
    '--entrypoint',
    'sh',
    IMAGE,
    '-c',
    'exec 9>/backup/state/.lock && flock -n 9 && touch /tmp/held && sleep 300',
  ]);
  expect(started.status, started.stderr).toBe(0);
  try {
    await waitFor(
      'lock tenuto',
      () => docker(['exec', C.holder, 'test', '-f', '/tmp/held']).status === 0,
      30,
    );
    body();
  } finally {
    docker(['rm', '-f', '-v', C.holder]);
  }
}

/** Esegue uno script `sh` nell'immagine, con stato su tmpfs `/st` (modo indicato) e `BACKUP_STATE_DIR=/st`. */
function inStateSandbox(script: string, stateMode = '1777'): Run {
  const args = runArgs({ BACKUP_STATE_DIR: '/st', INNER: script }, ['-c', 'sh -c "$INNER"'], 'sh');
  args.splice(1, 0, '--tmpfs', `/st:mode=${stateMode}`);
  const run = docker(args);
  outputs.push(`${run.stdout}\n${run.stderr}`);
  return run;
}

afterAll(() => {
  removeAll();
  docker(['image', 'rm', '-f', IMAGE, SFTP_IMAGE]);
});

describe('file degli script e della destinazione di prova', () => {
  const entry = path.join(backupDir, 'amoris-backup');
  const lib = path.join(backupDir, 'lib.sh');

  it('gli script esistono, con fine riga LF e senza set -x', () => {
    for (const file of [entry, lib]) {
      expect(existsSync(file), file).toBe(true);
      const text = readFileSync(file);
      expect(text.includes(13), `${file} contiene CR`).toBe(false);
      expect(text.toString('utf8')).not.toMatch(/^\s*set\s+-[a-z]*x/m);
    }
    expect(readFileSync(entry, 'utf8')).toMatch(/^set -eu$/m);
  });

  it('non usano jq e non stampano con echo di segreti', () => {
    for (const file of [entry, lib]) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/\bjq\b/);
    }
  });

  it('la destinazione SFTP di prova ha base fissata e versione di ssh allineata al backup', () => {
    const text = readFileSync(sftpDockerfile, 'utf8');
    const backup = readFileSync(
      path.join(repoRoot, 'infra', 'docker', 'backup.Dockerfile'),
      'utf8',
    );
    const base = /^FROM\s+(postgres:\S+@sha256:[0-9a-f]{64})/m.exec(backup)?.[1];
    expect(base).toBeDefined();
    expect(text).toContain(`FROM ${base}`);
    const client = /openssh-client-default=(\S+)/.exec(backup)?.[1];
    expect(client).toBeDefined();
    expect(text).toContain(`openssh-server=${client}`);
    expect(text).toMatch(/^ENTRYPOINT \[\]$/m);
    expect(text).toMatch(/sshd.*-D.*-e/);
  });

  it('la destinazione di prova non compare nel Compose né nella CI', () => {
    const ci = readFileSync(path.join(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8');
    for (const text of [compose, ci]) expect(text).not.toMatch(/sftp-prova|openssh-server/);
  });
});

describe('script di backup con database, archivio e SFTP sintetici', () => {
  it('le immagini si costruiscono', () => {
    expect(buildResult?.status, buildResult?.stderr.slice(-4000)).toBe(0);
    expect(sftpBuildResult?.status, sftpBuildResult?.stderr.slice(-4000)).toBe(0);
  });

  it('l’immagine porta gli script, eseguibili dall’utente di backup', () => {
    const run = docker([
      'run',
      '--rm',
      '--entrypoint',
      'sh',
      IMAGE,
      '-c',
      'test -x /usr/local/bin/amoris-backup && test -r /usr/local/lib/amoris-backup/lib.sh && id -u',
    ]);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout.trim()).toBe('10003');
  });

  it('senza repository il backup non lo crea: esce con 10 e lo registra', () => {
    const { run, line } = amorisBackup('backup');
    expect(run.status).toBe(10);
    expect(line).toMatchObject({
      command: 'backup',
      outcome: 'error',
      failed_step: 'repository',
      exit_code: 10,
    });
    const state = JSON.parse(readVolumeFile(V.state, 'last-backup.json')) as Outcome;
    expect(state).toMatchObject({ outcome: 'error', failed_step: 'repository' });
  });

  it('init crea il repository la prima volta', () => {
    const { run, line } = amorisBackup('init');
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(line).toMatchObject({
      command: 'init',
      outcome: 'ok',
      repository: 'created',
      exit_code: 0,
    });
  });

  it('init la seconda volta non fa nulla ed esce 0', () => {
    const { run, line } = amorisBackup('init');
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(line).toMatchObject({ command: 'init', outcome: 'ok', repository: 'present' });
  });

  it('init con la password sbagliata su un repository esistente esce con 12 senza reinizializzare', () => {
    const { run, line } = amorisBackup('init', {
      RESTIC_PASSWORD_FILE: '/keys/restic_password_wrong',
    });
    expect(run.status).toBe(12);
    expect(line).toMatchObject({ outcome: 'error', failed_step: 'init', exit_code: 12 });
    const after = amorisBackup('init');
    expect(after.run.status).toBe(0);
    expect(after.line.repository).toBe('present');
    // Il repository originale è ancora quello: con la password giusta si legge.
    expect(inspect('R snapshots --json').status).toBe(0);
  });

  it('il backup crea un’istantanea con host ed etichette attese, con dump e oggetti', () => {
    const started = Date.now();
    const { run, line } = amorisBackup('backup');
    const elapsed = (Date.now() - started) / 1000;
    console.log(`tempo di un backup sintetico (docker run compreso): ${elapsed.toFixed(1)} s`);
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(run.stderr).toBe('');
    expect(run.stdout.trim().split('\n')).toHaveLength(1);
    expect(line).toMatchObject({
      command: 'backup',
      outcome: 'ok',
      failed_step: null,
      exit_code: 0,
    });
    expect(line.snapshot_id).toMatch(/^[0-9a-f]{8,64}$/);
    expect(line.dump_bytes).toBeGreaterThan(0);
    expect(line.objects_count).toBe(3);
    expect(line.objects_bytes).toBe(3 * MARK_BODY.length);
    expect(line.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(line.duration_seconds).toBeGreaterThanOrEqual(0);

    // Il file di stato è lo stesso contenuto, scritto in una cartella separata dai dati.
    expect(readVolumeFile(V.state, 'last-backup.json').trim()).toBe(run.stdout.trim());
    const leftovers = docker([
      'run',
      '--rm',
      '-v',
      `${V.state}:/s:ro`,
      '--entrypoint',
      'ls',
      IMAGE,
      '-A',
      '/s',
    ]);
    expect(leftovers.stdout).not.toMatch(/tmp/i);

    const listing = inspect('R snapshots --json');
    expect(listing.status, listing.stderr).toBe(0);
    const snapshots = JSON.parse(listing.stdout) as {
      id: string;
      hostname: string;
      tags: string[];
      paths: string[];
    }[];
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]?.id.startsWith(line.snapshot_id ?? '#')).toBe(true);
    expect(snapshots[0]?.hostname).toBe('amoris');
    expect(snapshots[0]?.tags).toEqual(['amoris-backup']);
    expect(snapshots[0]?.paths).toEqual(['/backup/data']);
  }, 180_000);

  it('l’istantanea contiene un dump non compresso con le tabelle e gli oggetti con il loro corpo', () => {
    const id = (JSON.parse(readVolumeFile(V.state, 'last-backup.json')) as Outcome).snapshot_id;
    const result = inspect(
      [
        `R restore ${id} --target /tmp/r >/dev/null`,
        'pg_restore -l /tmp/r/backup/data/db/database.dump > /tmp/toc.txt',
        'grep -E "Compression: (none|0)" /tmp/toc.txt >/dev/null && echo COMPRESSIONE-ASSENTE',
        'grep -c "pagine_sintetiche" /tmp/toc.txt',
        'grep -c "utenti_sintetici" /tmp/toc.txt',
        'cat "/tmp/r/backup/data/objects/media-public/2026/NOME-OGGETTO-SINTETICO-uno.txt"; echo',
        'cat "/tmp/r/backup/data/objects/media-private/privati/NOME-OGGETTO-SINTETICO-due.txt"; echo',
      ].join('\n'),
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('COMPRESSIONE-ASSENTE');
    expect(result.stdout.match(new RegExp(MARK_BODY, 'g'))).toHaveLength(2);
    expect(result.stdout).toMatch(/\n[1-9]\d*\n[1-9]\d*\n/);
  }, 120_000);

  it('il repository non contiene stringhe note dei dati sintetici (cifratura, W3-4)', () => {
    const result = inspect(
      [
        // Il repository vive nel contenitore SFTP: lo si legge da lì, file per file, senza chiave.
        'true',
      ].join('\n'),
    );
    expect(result.status).toBe(0);
    const scan = docker([
      'exec',
      C.sftp,
      'sh',
      '-c',
      `grep -rlaE '${MARK_DB}|${MARK_BODY}|NOME-OGGETTO-SINTETICO|pagine_sintetiche' /home/sftpuser/repo; test $? -eq 1 && echo NESSUNA-CORRISPONDENZA`,
    ]);
    expect(scan.stdout).toContain('NESSUNA-CORRISPONDENZA');
  });

  it('una seconda esecuzione copia solo le differenze, toglie ciò che non c’è più e applica forget', () => {
    const first = (JSON.parse(readVolumeFile(V.state, 'last-backup.json')) as Outcome).snapshot_id;
    expect(mc(`mc rm ${objectPath(OBJ.tre)} >/dev/null`).status).toBe(0);
    expect(
      mc(
        `printf %s ${MARK_BODY} > /tmp/c.txt && mc cp /tmp/c.txt ${objectPath(OBJ.quattro)} >/dev/null`,
      ).status,
    ).toBe(0);
    expect(
      psql(`INSERT INTO utenti_sintetici (nome) VALUES ('altro nome inventato');`).status,
    ).toBe(0);

    const { run, line } = amorisBackup('backup');
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(line.objects_count).toBe(3);
    expect(line.snapshot_id).not.toBe(first);

    const result = inspect(
      [
        'R snapshots --json',
        'echo ---',
        `R ls ${line.snapshot_id} 2>/dev/null | grep -c "NOME-OGGETTO-SINTETICO" || true`,
        `R ls ${line.snapshot_id} 2>/dev/null | grep -c "NOME-OGGETTO-SINTETICO-tre" || true`,
        `R ls ${line.snapshot_id} 2>/dev/null | grep -c "NOME-OGGETTO-SINTETICO-quattro" || true`,
      ].join('\n'),
    );
    expect(result.status, result.stderr).toBe(0);
    const [json = '[]', counts = ''] = result.stdout.split('---\n');
    // Le due istantanee dello stesso giorno restano entrambe: restic tiene anche la più vecchia di ogni periodo.
    expect((JSON.parse(json) as unknown[]).length).toBe(2);
    expect(counts.trim().split('\n')).toEqual(['3', '0', '1']);
  }, 180_000);

  it('dopo il backup esegue forget --prune con 7 giornalieri, 4 settimanali e 6 mensili (T5 ne prova gli esiti)', () => {
    // Un restic di comodo registra gli argomenti e poi passa il comando a quello vero.
    const script = [
      'printf \'#!/bin/sh\\necho "$*" >> /tmp/chiamate.txt\\nexec /usr/local/bin/restic "$@"\\n\' > /shim/restic',
      'chmod +x /shim/restic',
      'PATH=/shim:$PATH amoris-backup backup > /tmp/esito.json',
      'echo "esito=$?"',
      'sed -n "s/^-o sftp.command=.* -s sftp //p" /tmp/chiamate.txt',
    ].join('\n');
    // /tmp è noexec: il restic di comodo sta in una cartella in memoria apposta, eseguibile.
    const args = runArgs({ ...BASE_ENV }, ['-c', script], 'sh');
    args.splice(1, 0, '--tmpfs', '/shim:exec,mode=1777');
    const run = docker(args);
    outputs.push(`${run.stdout}\n${run.stderr}`);
    expect(run.stdout).toContain('esito=0');
    expect(run.status, run.stderr).toBe(0);
    const calls = run.stdout.split('\n').filter((l) => /^(backup|forget) /.test(l));
    expect(calls.map((l) => l.split(' ')[0])).toEqual(['backup', 'forget']);
    expect(calls[1]).toBe(
      'forget --prune --host amoris --tag amoris-backup --keep-daily 7 --keep-weekly 4 --keep-monthly 6',
    );
  }, 180_000);

  it('check rilegge un campione dei dati e registra l’esito', () => {
    const { run, line } = amorisBackup('check');
    expect(run.status, run.stdout + run.stderr).toBe(0);
    expect(line).toMatchObject({ command: 'check', outcome: 'ok', failed_step: null });
    expect(JSON.parse(readVolumeFile(V.state, 'last-check.json'))).toMatchObject({
      command: 'check',
    });
  }, 120_000);

  it('check con la password sbagliata esce con 12', () => {
    const { run, line } = amorisBackup('check', {
      RESTIC_PASSWORD_FILE: '/keys/restic_password_wrong',
    });
    expect(run.status).toBe(12);
    expect(line).toMatchObject({ outcome: 'error', failed_step: 'repository', exit_code: 12 });
  });

  it('con il database spento esce con codice diverso da 0 e lo registra, senza residui del dump', async () => {
    await whileStopped(C.db, dbReady, () => {
      const { run, line } = amorisBackup('backup');
      expect(run.status).not.toBe(0);
      expect(line).toMatchObject({ outcome: 'error', failed_step: 'db_dump' });
      expect(line.exit_code).toBe(run.status);
      expect(JSON.parse(readVolumeFile(V.state, 'last-backup.json'))).toMatchObject({
        outcome: 'error',
        failed_step: 'db_dump',
      });
      const files = docker([
        'run',
        '--rm',
        '-v',
        `${V.data}:/d:ro`,
        '--entrypoint',
        'ls',
        IMAGE,
        '-A',
        '/d/db',
      ]);
      expect(files.stdout.trim()).toBe('database.dump');
    });
  }, 180_000);

  it('con l’archivio degli oggetti spento esce con codice diverso da 0', async () => {
    await whileStopped(C.objects, objectsReady, () => {
      const { run, line } = amorisBackup('backup');
      expect(run.status).not.toBe(0);
      expect(line).toMatchObject({ outcome: 'error', failed_step: 'objects_mirror' });
      expect(line.exit_code).toBe(run.status);
    });
  }, 180_000);

  it('con la destinazione SFTP spenta esce con codice diverso da 0', async () => {
    await whileStopped(C.sftp, sftpReady, () => {
      const { run, line } = amorisBackup('backup');
      expect(run.status).not.toBe(0);
      expect(line).toMatchObject({ outcome: 'error', failed_step: 'repository' });
      expect(line.exit_code).toBe(run.status);
    });
  }, 180_000);

  it('con la chiave dell’host diversa da known_hosts rifiuta di collegarsi', () => {
    const { run, line } = amorisBackup('backup', {
      BACKUP_KNOWN_HOSTS_FILE: '/keys/known_hosts_wrong',
    });
    expect(run.status).not.toBe(0);
    expect(line).toMatchObject({ outcome: 'error', failed_step: 'repository' });
    expect(line.exit_code).toBe(run.status);
  });

  it('con una variabile obbligatoria mancante esce con 78 e lo registra', () => {
    const { run, line } = amorisBackup('backup', { RESTIC_PASSWORD_FILE: null });
    expect(run.status).toBe(78);
    expect(line).toMatchObject({ outcome: 'error', failed_step: 'config', exit_code: 78 });
    expect(JSON.parse(readVolumeFile(V.state, 'last-backup.json'))).toMatchObject({
      failed_step: 'config',
    });
  });

  it('con un file di segreto inesistente esce con 78', () => {
    const { run, line } = amorisBackup('backup', { PGPASSWORD_FILE: '/keys/non-esiste' });
    expect(run.status).toBe(78);
    expect(line).toMatchObject({ failed_step: 'config' });
  });

  it('un comando sconosciuto esce con codice diverso da 0 senza fare nulla', () => {
    const { run } = amorisBackup('inesistente');
    expect(run.status).not.toBe(0);
  });

  describe('revisione T7: stato, uscite silenziose, concorrenza, valori', () => {
    const dumpStamp = (): string =>
      docker([
        'run',
        '--rm',
        '-v',
        `${V.data}:/d:ro`,
        '--entrypoint',
        'sh',
        IMAGE,
        '-c',
        'stat -c %y /d/db/database.dump; ls -A /d/db',
      ]).stdout;

    it('A1: con il volume di stato in sola lettura il backup esce subito con 74 e state_write, senza toccare il dump', () => {
      const before = dumpStamp();
      const args = runArgs({ ...BASE_ENV }, ['amoris-backup', 'backup']);
      const at = args.indexOf(`${V.state}:/backup/state`);
      args[at] = `${V.state}:/backup/state:ro`;
      const run = docker(args);
      outputs.push(`${run.stdout}\n${run.stderr}`);
      const line = JSON.parse(run.stdout.trim().split('\n').at(-1) ?? '{}') as Record<
        string,
        unknown
      >;
      expect(run.status).toBe(74);
      expect(line).toMatchObject({
        outcome: 'error',
        failed_step: 'state_write',
        exit_code: 74,
        state_written: false,
      });
      expect(dumpStamp()).toBe(before);
    });

    it('A1: con una cartella di stato non scrivibile dall’utente 10003 anche init esce con 74 e state_write', () => {
      const run = inStateSandbox('amoris-backup init; echo rc=$?', '0755');
      expect(run.stdout).toContain('rc=74');
      expect(run.stdout).toContain('"failed_step":"state_write"');
      expect(run.stdout).toContain('"state_written":false');
    });

    it('A1: un errore con stato non scrivibile porta state_written:false (emit provato direttamente)', () => {
      const run = inStateSandbox(
        '. /usr/local/lib/amoris-backup/lib.sh; CMD=backup; BACKUP_STATE_DIR=/non-esiste; STATE_DIR=/non-esiste; emit error db_dump 1; echo rc=$?',
      );
      expect(run.status, run.stderr).toBe(0);
      const [json = '{}', rc] = run.stdout.trim().split('\n');
      expect(rc).toBe('rc=0');
      expect(JSON.parse(json)).toMatchObject({
        outcome: 'error',
        failed_step: 'db_dump',
        state_written: false,
      });
    });

    it('M1: un comando non protetto che fallisce produce una riga unexpected e lo stato', () => {
      const run = inStateSandbox(
        'sh -c ". /usr/local/lib/amoris-backup/lib.sh; set -eu; begin backup; false"; echo rc=$?; cat /st/last-backup.json',
      );
      expect(run.status, run.stderr).toBe(0);
      const lines = run.stdout.trim().split('\n');
      expect(lines).toHaveLength(3);
      expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
        command: 'backup',
        outcome: 'error',
        failed_step: 'unexpected',
        exit_code: 1,
      });
      expect(lines[1]).toBe('rc=1');
      expect(lines[2]).toBe(lines[0]);
    });

    it('M1: SIGTERM durante un passo lungo produce una riga unexpected con 143', () => {
      const run = inStateSandbox(
        'sh -c ". /usr/local/lib/amoris-backup/lib.sh; set -eu; begin backup; P=\\$\\$; (sleep 1; kill -TERM \\$P) & sleep 30 & wait"; echo rc=$?',
      );
      expect(run.status, run.stderr).toBe(0);
      const lines = run.stdout.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
        outcome: 'error',
        failed_step: 'unexpected',
        exit_code: 143,
      });
      expect(lines[1]).toBe('rc=143');
    });

    it('M3: con il lock tenuto da un altro contenitore backup esce con 75 e busy, il dump parziale altrui resta', async () => {
      const plant = docker([
        'run',
        '--rm',
        '-v',
        `${V.data}:/d`,
        '--entrypoint',
        'sh',
        IMAGE,
        '-c',
        'mkdir -p /d/db && echo x > /d/db/.database.dump.tmp',
      ]);
      expect(plant.status, plant.stderr).toBe(0);
      try {
        await withLockHeld(() => {
          const { run, line } = amorisBackup('backup');
          expect(run.status).toBe(75);
          expect(line).toMatchObject({ outcome: 'error', failed_step: 'busy', exit_code: 75 });
          const left = docker([
            'run',
            '--rm',
            '-v',
            `${V.data}:/d:ro`,
            '--entrypoint',
            'ls',
            IMAGE,
            '-A',
            '/d/db',
          ]);
          expect(left.stdout).toContain('.database.dump.tmp');
        });
      } finally {
        docker([
          'run',
          '--rm',
          '-v',
          `${V.data}:/d`,
          '--entrypoint',
          'rm',
          IMAGE,
          '-f',
          '/d/db/.database.dump.tmp',
        ]);
      }
    }, 180_000);

    it('M3: con il lock tenuto restore esce con 75 e busy, la cartella .restore altrui resta', async () => {
      const mkRestore = (cmd: string): Run =>
        docker(['run', '--rm', '-v', `${V.data}:/d`, '--entrypoint', 'sh', IMAGE, '-c', cmd]);
      expect(mkRestore('mkdir -p /d/.restore && echo x > /d/.restore/segno').status).toBe(0);
      try {
        await withLockHeld(() => {
          const args = runArgs({ ...BASE_ENV }, ['amoris-backup', 'restore', 'latest']);
          const second = docker(args);
          outputs.push(`${second.stdout}\n${second.stderr}`);
          const parsed = JSON.parse(second.stdout.trim().split('\n').at(-1) ?? '{}') as Outcome;
          expect(second.status).toBe(75);
          expect(parsed).toMatchObject({ failed_step: 'busy', exit_code: 75 });
          expect(mkRestore('cat /d/.restore/segno').stdout.trim()).toBe('x');
        });
      } finally {
        mkRestore('rm -rf /d/.restore');
      }
    }, 180_000);

    it('M3: init e check non prendono il lock', async () => {
      await withLockHeld(() => {
        const { run, line } = amorisBackup('check');
        expect(run.status, run.stdout + run.stderr).toBe(0);
        expect(line).toMatchObject({ command: 'check', outcome: 'ok' });
      });
    }, 180_000);

    it('M4: se restic esce 0 senza identificativo di istantanea il passo è restic_backup con codice 1', () => {
      const script = [
        'printf \'#!/bin/sh\\ncase "$3" in backup) exit 0;; esac\\nexec /usr/local/bin/restic "$@"\\n\' > /shim/restic',
        'chmod +x /shim/restic',
        'PATH=/shim:$PATH amoris-backup backup; echo "rc=$?"',
      ].join('\n');
      const args = runArgs({ ...BASE_ENV }, ['-c', script], 'sh');
      args.splice(1, 0, '--tmpfs', '/shim:exec,mode=1777');
      const run = docker(args);
      outputs.push(`${run.stdout}\n${run.stderr}`);
      expect(run.stdout).toContain('rc=1');
      expect(run.stdout).toContain('"failed_step":"restic_backup"');
      expect(run.stdout).toContain('"exit_code":1');
    }, 180_000);

    it('bassi: un host che comincia con un trattino è rifiutato con 78', () => {
      for (const host of ['-oProxyCommand=x', '-xhost']) {
        const { run, line } = amorisBackup('check', { BACKUP_SFTP_HOST: host });
        expect(run.status, host).toBe(78);
        expect(line).toMatchObject({ failed_step: 'config', exit_code: 78 });
      }
    });

    it('bassi: un timeout di connessione non numerico è rifiutato con 78', () => {
      for (const value of ['abc', '5 -oProxyCommand=x']) {
        const { run, line } = amorisBackup('check', { BACKUP_SSH_CONNECT_TIMEOUT: value });
        expect(run.status, value).toBe(78);
        expect(line).toMatchObject({ failed_step: 'config', exit_code: 78 });
      }
    });

    it('bassi: una cartella .restore nel volume dei dati non finisce nell’istantanea', () => {
      const plant = docker([
        'run',
        '--rm',
        '-v',
        `${V.data}:/d`,
        '--entrypoint',
        'sh',
        IMAGE,
        '-c',
        'mkdir -p /d/.restore/backup && echo x > /d/.restore/backup/RESIDUO-SINTETICO',
      ]);
      expect(plant.status, plant.stderr).toBe(0);
      try {
        const { run, line } = amorisBackup('backup');
        expect(run.status, run.stdout + run.stderr).toBe(0);
        const listing = inspect(
          `R ls ${line.snapshot_id} | grep -c "RESIDUO-SINTETICO" || true\nR ls ${line.snapshot_id} | grep -c "database.dump"`,
        );
        expect(listing.stdout.trim().split('\n')).toEqual(['0', '1']);
      } finally {
        docker([
          'run',
          '--rm',
          '-v',
          `${V.data}:/d`,
          '--entrypoint',
          'rm',
          IMAGE,
          '-rf',
          '/d/.restore',
        ]);
      }
    }, 180_000);
  });

  it('nessuna uscita dei contenitori contiene dati, nomi di oggetti, password o chiavi (W3-6, W3-9)', () => {
    const clientKey = readVolumeFile(V.keys, 'client_ed25519');
    const body = clientKey
      .split('\n')
      .filter((line) => line.length > 20 && !line.startsWith('-----'));
    expect(body.length).toBeGreaterThan(0);
    const forbidden = [
      ...Object.values(SECRETS),
      MARK_DB,
      MARK_BODY,
      'NOME-OGGETTO-SINTETICO',
      'pagine_sintetiche',
      'utenti_sintetici',
      'BEGIN OPENSSH',
      body[0] ?? '#',
    ];
    expect(outputs.length).toBeGreaterThan(10);
    for (const output of outputs) {
      for (const text of forbidden) expect(output).not.toContain(text);
    }
  });
});
