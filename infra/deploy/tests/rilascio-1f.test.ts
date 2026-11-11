import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Script di rilascio con comando forzato (1F-W5 T3a, DR-411).
 *
 * Prova comportamentale: un contenitore Ubuntu con `sshd` vero e un utente `deploy` con la riga di
 * `authorized_keys` d'esempio (radice di prova impostata nella riga), e un `docker` finto nel PATH che
 * registra le chiamate, il digest dell'ingresso di `login` e le variabili d'ambiente dei processi.
 *
 * **Nessun dato reale**: utente, token e segreti sono sintetici, generati nella prova.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const scriptPath = path.join(repoRoot, 'infra', 'deploy', 'rilascio', 'rilascia.sh');
const keysPath = path.join(repoRoot, 'infra', 'deploy', 'rilascio', 'authorized_keys.esempio');
const dockerfilePath = path.join(repoRoot, 'infra', 'deploy', 'tests', 'rilascio-prova.Dockerfile');

const IMAGE = 'amoris-rilascio-prova:t3a';
const NAME = `amoris-rilascio-prova-${process.pid}`;

const ROOT = '/srv/prova';
const FINTO = '/srv/finto';
const HASH = 'a'.repeat(10) + 'b1c2d3e4f5'.repeat(3);
const HASH2 = '0123456789abcdef'.repeat(2) + 'fedcba98';
const GH_USER = 'utente-prova';
const TOKEN = `ghs_${randomBytes(16).toString('hex')}`;
const SECRET = `segreto-${randomBytes(8).toString('hex')}`;
const TOKEN_SHA = createHash('sha256').update(TOKEN).digest('hex');
/** Commit da cui nasce il `git archive` vero; in CI è il commit stesso. */
const ARCHIVE_REF = process.env.RILASCIO_ARCHIVIO_REF ?? 'HEAD';
const SUBNET = { production: '10.77.88.0/24', staging: '10.77.89.0/24' } as const;
const NET_CALL = (env: string): string =>
  `docker network inspect -f {{range .IPAM.Config}}{{.Subnet}} {{end}} amoris-ingresso-${env}`;
const KEY_PATH = '/etc/amoris/backup-chiavi/ssh_key';
const HOSTS_PATH = '/etc/amoris/backup-chiavi/known_hosts';
const DETAIL = 'DETAIL: Key (email)=(persona@esempio.invalid)';

/** File dei segreti sintetico e completo di un ambiente (tutte le variabili obbligatorie del Compose). */
const secretsOf = (env: 'production' | 'staging'): string =>
  [
    `AMORIS_ENV=${env}`,
    'IMAGE_PREFIX=ghcr.io/proprietario/amoris',
    'CADDY_SITE_ADDRESS=www.esempio.invalid',
    'SITE_URL=https://www.esempio.invalid',
    'POSTGRES_PASSWORD=password-sintetica-postgres',
    `DB_OWNER_PASSWORD=${SECRET}`,
    'DB_APP_PASSWORD=password-sintetica-applicativa',
    'DB_BACKUP_PASSWORD=password-sintetica-backup',
    'S3_ACCESS_KEY=chiave-sintetica-archivio',
    'S3_SECRET_KEY=segreto-sintetico-archivio-abbastanza-lungo',
    'S3_API_SECRET_KEY=segreto-sintetico-utente-api-abbastanza-lungo',
    'S3_BACKUP_SECRET_KEY=segreto-sintetico-utente-backup-abbastanza-lungo',
    'IP_HASH_SALT=sale-sintetico-per-il-compose-abbastanza-lungo',
    'CSRF_SECRET=segreto-sintetico-per-il-compose-abbastanza-lungo',
    `TOTP_ENCRYPTION_KEY=${'cd'.repeat(32)}`,
    'SCRUB_SERVICE_TOKEN=gettone-sintetico-del-servizio-di-pulizia-1f',
    `APP_SUBNET=${env === 'production' ? '10.77.84.0/24' : '10.77.85.0/24'}`,
    `INGRESS_SUBNET=${SUBNET[env]}`,
    `BACKUP_OUT_SUBNET=${env === 'production' ? '10.77.86.0/24' : '10.77.87.0/24'}`,
    `BACKUP_OUT_BRIDGE=${env === 'production' ? 'amoris-bkp-prod' : 'amoris-bkp-stag'}`,
    `BACKUP_SSH_KEY_PATH=${KEY_PATH}`,
    `BACKUP_KNOWN_HOSTS_PATH=${HOSTS_PATH}`,
  ].join('\n');

const SSH = [
  'ssh',
  '-T',
  '-i',
  '/root/.ssh/id',
  '-o',
  'StrictHostKeyChecking=no',
  '-o',
  'UserKnownHostsFile=/dev/null',
  '-o',
  'BatchMode=yes',
  '-o',
  'LogLevel=ERROR',
].join(' ');

interface Result {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

const docker = (args: readonly string[], input?: string, timeout = 120_000): Result => {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout, input });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

const bash = (script: string, args: readonly string[] = [], input?: string): Result =>
  docker(['exec', '-i', NAME, 'bash', '-c', script, 'bash', ...args], input);

/** Ingresso standard del rilascio: utente, token, poi l'archivio. */
const stdinOf = (archive = 'ok', token = TOKEN, user = GH_USER): string =>
  `{ printf '%s\\n%s\\n' '${user}' '${token}'; cat /srv/fix/${archive}.tgz; }`;

/** Lancia il comando sul server con la chiave di rilascio; `command` null = shell interattiva. */
const ssh = (command: string | null, stdin = stdinOf()): Result =>
  command === null
    ? bash(`${stdin} | ${SSH} deploy@127.0.0.1`)
    : bash(`${stdin} | ${SSH} deploy@127.0.0.1 "$1"`, [command]);

const rilascia = (env = 'staging', hash = HASH, extra = ''): string =>
  `rilascia ${env} ${hash}${extra}`;

const calls = (): string[] => {
  const r = bash(`cat ${FINTO}/chiamate.log 2>/dev/null; true`);
  return r.stdout.split('\n').filter((l) => l !== '');
};
const lastJson = (r: Result): Record<string, unknown> => {
  const lines = r.stdout.split('\n').filter((l) => l !== '');
  expect(lines, r.stdout).toHaveLength(1);
  return JSON.parse(lines[0] as string) as Record<string, unknown>;
};
const exists = (p: string): boolean => bash(`test -e ${p}`).status === 0;
const files = (): string[] =>
  bash(`find ${ROOT} \\( -type f -o -type l \\) | sort`)
    .stdout.split('\n')
    .filter((l) => l !== '');

const REL = (env: string, hash: string): string => `${ROOT}/rilasci/${env}/${hash}`;
const COMMON = (env: string, hash: string): string =>
  `-f ${REL(env, hash)}/infra/deploy/compose.yml --env-file ${ROOT}/segreti/${env}.env --env-file ${REL(env, hash)}/rilascio.env`;
/** Le chiamate registrate, con il gruppo comune di opzioni di Compose abbreviato. */
const normalized = (env: string, hash: string): string[] =>
  calls().map((l) => l.replace(`docker compose ${COMMON(env, hash)}`, 'docker compose COMMON'));

const FAKE_DOCKER = `#!/bin/sh
F=${FINTO}
TUTTI="$*"
{ printf 'docker'; for a in "$@"; do printf ' %s' "$a"; done; printf '\\n'; } >> $F/chiamate.log
printf '%s|%s|%s\\n' "$1" "\${DOCKER_CONFIG:-}" "$(stat -c %a "\${DOCKER_CONFIG:-/inesistente}" 2>/dev/null)" >> $F/config.log
/usr/local/bin/cerca-perdite
case "$1" in
  login) cat | sha256sum | cut -d' ' -f1 > $F/login-sha.txt; echo 'Login Succeeded' ;;
  logout) : > $F/logout-iniziato; if [ -e $F/logout-lento ]; then sleep 3; fi ;;
  network)
    if [ -e $F/senza-rete ]; then exit 1; fi
    if [ -e $F/sottorete ]; then cat $F/sottorete
    else case "$*" in *production) printf '%s ' ${SUBNET.production} ;; *) printf '%s ' ${SUBNET.staging} ;; esac; fi ;;
  compose)
    shift
    while [ $# -gt 0 ]; do
      case $1 in
        -f|--env-file) [ -r "$2" ] || echo "manca $2" >> $F/mancanti.log; shift 2 ;;
        --profile) shift 2 ;;
        *) break ;;
      esac
    done
    case "$1" in
      pull|run|up) echo '${DETAIL}'; echo '${DETAIL}' >&2 ;;
    esac
    case "$1" in
      version) if [ -e $F/senza-plugin ]; then exit 1; fi; echo 'Docker Compose version finta' ;;
      pull)
        echo 'pulled'
        # Il pull dello staging tiene il blocco finché la prova non crea pull-continua (al più 60 s).
        if [ -e $F/pull-lento ]; then case "$TUTTI" in */rilasci/staging/*)
          i=0; while [ ! -e $F/pull-continua ] && [ $i -lt 600 ]; do sleep 0.1; i=$((i + 1)); done ;;
        esac; fi
        if [ -e $F/pull-fallisce ]; then echo 'pull finto fallito' >&2; exit 1; fi ;;
    esac ;;
esac
exit 0
`;

const LEAK_SCAN = `#!/bin/sh
for e in /proc/[0-9]*/environ; do
  if grep -aqF -- "$(cat ${FINTO}/token)" "$e" 2>/dev/null; then echo "$e" >> ${FINTO}/perdite.log; fi
done
exit 0
`;

const TAR_SCRIPT = `
import tarfile, io
class Zeri(io.RawIOBase):
    def __init__(self, n): self.n = n
    def readable(self): return True
    def readinto(self, b):
        k = min(len(b), self.n); b[:k] = bytes(k); self.n -= k; return k
def mk(name, extra):
    with tarfile.open('/srv/fix/%s.tgz' % name, 'w:gz') as t:
        for n in ('infra', 'infra/deploy', 'infra/deploy/ambiente'):
            ti = tarfile.TarInfo(n); ti.type = tarfile.DIRTYPE; ti.mode = 0o755; t.addfile(ti)
        for n, data in (('infra/deploy/compose.yml', b'servizi\\n'), ('infra/deploy/ambiente/staging.env', b'A=1\\n')):
            if name == 'senza-compose' and n.endswith('compose.yml'): continue
            ti = tarfile.TarInfo(n); ti.size = len(data); t.addfile(ti, io.BytesIO(data))
        for kind, n, extra_data in extra:
            ti = tarfile.TarInfo(n)
            if kind == 'zeri':
                ti.size = extra_data; t.addfile(ti, Zeri(extra_data))
            elif kind == 'file':
                ti.size = len(extra_data); t.addfile(ti, io.BytesIO(extra_data))
            else:
                ti.type = {'sym': tarfile.SYMTYPE, 'hard': tarfile.LNKTYPE, 'dev': tarfile.CHRTYPE}[kind]
                ti.linkname = extra_data
                t.addfile(ti)
mk('ok', [])
mk('vecchio', [('file', 'infra/deploy/solo-vecchio', b'v\\n')])
mk('traversal', [('file', '../x', b'x\\n')])
mk('traversal-infra', [('file', 'infra/../x', b'x\\n')])
mk('assoluto', [('file', '/srv/prova/pwned', b'x\\n')])
mk('simbolico', [('sym', 'infra/deploy/ln', '/etc')])
mk('fisico', [('hard', 'infra/deploy/hl', 'infra/deploy/compose.yml')])
mk('dispositivo', [('dev', 'infra/deploy/dev', '')])
mk('fuori', [('file', 'altro/file', b'x\\n')])
mk('senza-compose', [])
mk('grande-decompresso', [('zeri', 'infra/deploy/zeri.bin', 210 * 1024 * 1024)])
mk('troppe-voci', [('file', 'infra/deploy/v/%d' % i, b'') for i in range(20001)])
`;

/** Riporta il «server» allo stato iniziale: radice di prova con i due file dei segreti, registri vuoti. */
const reset = (): void => {
  const r = bash(`set -e
rm -rf ${ROOT} ${FINTO}
mkdir -p ${ROOT}/segreti ${FINTO}
cat > ${ROOT}/segreti/staging.env <<'FINE'
${secretsOf('staging')}
FINE
cat > ${ROOT}/segreti/production.env <<'FINE'
${secretsOf('production')}
FINE
printf '%s' '${TOKEN}' > ${FINTO}/token
chown -R deploy:deploy ${ROOT} ${FINTO}
rm -rf /tmp/amoris-docker.* /tmp/amoris-docker-*`);
  expect(r.status, r.stderr).toBe(0);
};

beforeAll(() => {
  const build = docker(
    ['build', '-q', '-t', IMAGE, '-'],
    readFileSync(dockerfilePath, 'utf8'),
    900_000,
  );
  expect(build.status, build.stderr).toBe(0);
  const start = docker(['run', '-d', '--name', NAME, IMAGE]);
  expect(start.status, start.stderr).toBe(0);
  // Chiavi, script, `docker` finto, archivi e sshd.
  const pre = bash(`set -e
ssh-keygen -A >/dev/null
mkdir -p /root/.ssh && ssh-keygen -q -t ed25519 -N '' -f /root/.ssh/id
mkdir -p /home/deploy/.ssh /opt/amoris/rilascio`);
  expect(pre.status, pre.stderr).toBe(0);
  expect(docker(['cp', scriptPath, `${NAME}:/opt/amoris/rilascio/rilascia.sh`]).status).toBe(0);
  const keyLine = readFileSync(keysPath, 'utf8')
    .split('\n')
    .find((l) => l.startsWith('restrict'));
  expect(keyLine).toBeDefined();
  const pub = bash('cut -d" " -f1,2 /root/.ssh/id.pub').stdout.trim();
  const line = (keyLine as string)
    .replace('command="', 'command="AMORIS_RADICE=/srv/prova AMORIS_ATTESA_LETTURE=15 ')
    .replace(/ssh-ed25519 \S+/, pub);
  const install = bash(
    `set -e
cat > /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh; chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 755 /opt/amoris/rilascio/rilascia.sh`,
    [],
    `${line}\n`,
  );
  expect(install.status, install.stderr).toBe(0);
  const fake = bash(
    'cat > /usr/local/bin/docker; chmod 755 /usr/local/bin/docker',
    [],
    FAKE_DOCKER,
  );
  expect(fake.status, fake.stderr).toBe(0);
  const scan = bash(
    'cat > /usr/local/bin/cerca-perdite; chmod 755 /usr/local/bin/cerca-perdite',
    [],
    LEAK_SCAN,
  );
  expect(scan.status, scan.stderr).toBe(0);
  const tars = docker(['exec', '-i', NAME, 'python3', '-'], TAR_SCRIPT);
  expect(tars.status, tars.stderr).toBe(0);
  // Archivio vero del repository: ha l'intestazione pax globale, che gli archivi di tarfile non hanno.
  const git = spawnSync('git', ['archive', '--format=tar.gz', ARCHIVE_REF, 'infra'], {
    cwd: repoRoot,
    maxBuffer: 64 * 1024 * 1024,
  });
  expect(git.status, String(git.stderr)).toBe(0);
  const put = spawnSync('docker', ['exec', '-i', NAME, 'sh', '-c', 'cat > /srv/fix/git.tgz'], {
    input: git.stdout,
  });
  expect(put.status, String(put.stderr)).toBe(0);
  const sshd = docker(['exec', '-d', NAME, '/usr/sbin/sshd', '-D', '-e']);
  expect(sshd.status, sshd.stderr).toBe(0);
  // sshd pronto quando risponde con il suo banner.
  for (let i = 0; i < 20; i += 1) {
    if (bash('head -c 4 < /dev/tcp/127.0.0.1/22').stdout === 'SSH-') break;
    bash('sleep 0.5');
  }
}, 1_200_000);

afterAll(() => {
  docker(['rm', '-f', '-v', NAME]);
  docker(['rmi', IMAGE]);
});

describe('file del rilascio', () => {
  it('lo script ha LF, parte con #!/bin/sh e non valuta stringhe con eval', () => {
    const text = readFileSync(scriptPath, 'utf8');
    expect(text.startsWith('#!/bin/sh\n')).toBe(true);
    expect(text).not.toContain('\r');
    expect(text).not.toMatch(/\beval\b/);
  });

  it("la riga di authorized_keys d'esempio è ristretta al solo script", () => {
    const line = readFileSync(keysPath, 'utf8')
      .split('\n')
      .find((l) => !l.startsWith('#') && l.trim() !== '');
    expect(line).toBe(
      'restrict,command="/opt/amoris/rilascio/rilascia.sh" ssh-ed25519 AAAA... rilascio-github',
    );
  });

  it("il rilevatore delle perdite di token nell'ambiente dei processi funziona", () => {
    reset();
    const r = bash(
      `runuser -u deploy -- sh -c 'TOK=${TOKEN} sleep 3 & sleep 0.5; /usr/local/bin/cerca-perdite; wait'; cat ${FINTO}/perdite.log`,
    );
    expect(r.stdout).toContain('/environ');
  });
});

describe('comando rifiutato (64, nessuna azione)', () => {
  const rejected: ReadonlyArray<readonly [string, string | null]> = [
    ['shell interattiva', null],
    ['altro comando', 'id'],
    ['solo il verbo', 'rilascia'],
    ['punto e virgola', `rilascia staging ${HASH}; touch ${ROOT}/pwned`],
    ['sostituzione $()', 'rilascia staging $(id)'],
    ['sostituzione nel primo argomento', `rilascia $(touch ${ROOT}/pwned) ${HASH}`],
    ['apici inversi', 'rilascia staging `id`'],
    ['pipe', `rilascia staging ${HASH} | id`],
    ['a capo', `rilascia staging ${HASH}\ntouch ${ROOT}/pwned`],
    ['ambiente sconosciuto', `rilascia test ${HASH}`],
    ['ambiente in maiuscolo', `rilascia STAGING ${HASH}`],
    ['verbo in maiuscolo', `Rilascia staging ${HASH}`],
    ['hash maiuscolo', `rilascia staging ${HASH.toUpperCase()}`],
    ['hash di 39 caratteri', `rilascia staging ${HASH.slice(1)}`],
    ['hash di 41 caratteri', `rilascia staging ${HASH}0`],
    ['hash non esadecimale', `rilascia staging ${'g'.repeat(40)}`],
    ['argomento in più', `rilascia staging ${HASH} extra`],
    ['opzione in più', `rilascia staging ${HASH} --migrazioni extra`],
    ['opzione sconosciuta', `rilascia staging ${HASH} --altro`],
    ['--migrazioni fuori posto', `rilascia --migrazioni staging ${HASH}`],
    ["--migrazioni prima dell'hash", `rilascia staging --migrazioni ${HASH}`],
    ['spazio doppio', `rilascia  staging ${HASH}`],
    ['spazio finale', `rilascia staging ${HASH} `],
    ['tabulazione', `rilascia\tstaging ${HASH}`],
  ];

  it.each(rejected)('%s', (_name, command) => {
    reset();
    const r = ssh(command);
    expect(r.status, r.stderr).toBe(64);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('rilascia');
    expect(calls()).toEqual([]);
    expect(exists(`${ROOT}/pwned`)).toBe(false);
    expect(exists(`${ROOT}/rilasci`)).toBe(false);
  });

  it('sottosistema sftp', () => {
    reset();
    const r = bash(`${SSH} -s deploy@127.0.0.1 sftp </dev/null`);
    expect(r.status, r.stderr).toBe(64);
    expect(calls()).toEqual([]);
    expect(exists(`${ROOT}/rilasci`)).toBe(false);
  });

  it('scp, anche nella forma storica', () => {
    reset();
    const opts =
      '-i /root/.ssh/id -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes -o LogLevel=ERROR';
    for (const flag of ['-O', '']) {
      const r = bash(`echo x > /tmp/f; scp ${flag} ${opts} /tmp/f deploy@127.0.0.1:/tmp/g`);
      expect(r.status).not.toBe(0);
    }
    expect(calls()).toEqual([]);
    expect(exists('/tmp/g')).toBe(false);
    expect(exists(`${ROOT}/rilasci`)).toBe(false);
  });

  it('inoltro di porta rifiutato', () => {
    reset();
    const r = bash(
      `${SSH} -f -N -L 127.0.0.1:9999:127.0.0.1:22 -o ControlMaster=yes -o ControlPath=/tmp/cm.sock deploy@127.0.0.1
sleep 0.5
out=$(exec 3<>/dev/tcp/127.0.0.1/9999 && timeout 3 head -c 4 <&3; true)
${SSH} -O exit -o ControlPath=/tmp/cm.sock deploy@127.0.0.1 2>/dev/null
printf '%s' "$out"`,
    );
    expect(r.stdout).not.toContain('SSH-');
    expect(calls()).toEqual([]);
  });
});

describe('rilascio valido', () => {
  it('chiama docker nell\'ordine atteso, con gli stessi -f ed --env-file, e aggiorna "corrente"', () => {
    reset();
    const r = ssh(rilascia());
    expect(r.status, r.stderr).toBe(0);
    const out = lastJson(r);
    expect(out).toMatchObject({ esito: 'ok', ambiente: 'staging', hash: HASH, migrazioni: false });
    expect(typeof out.durata_s).toBe('number');
    expect(normalized('staging', HASH)).toEqual([
      NET_CALL('staging'),
      'docker compose version',
      `docker login ghcr.io -u ${GH_USER} --password-stdin`,
      'docker compose COMMON --profile backup --profile release pull',
      'docker logout ghcr.io',
      'docker compose COMMON up -d --wait --wait-timeout 600 --pull never',
    ]);
    expect(exists(`${FINTO}/mancanti.log`)).toBe(false);
    expect(bash(`readlink ${ROOT}/rilasci/staging/corrente`).stdout.trim()).toBe(HASH);
    expect(bash(`cat ${REL('staging', HASH)}/rilascio.env`).stdout).toBe(
      `AMORIS_ENV=staging\nIMAGE_TAG=${HASH}\n`,
    );
    expect(exists(`${REL('staging', HASH)}/infra/deploy/compose.yml`)).toBe(true);
  });

  it('passa anche con un git archive vero del repository (intestazione pax globale)', () => {
    reset();
    const pax = bash('gunzip -c /srv/fix/git.tgz | head -c 512 | grep -c pax_global_header');
    expect(pax.stdout.trim()).toBe('1');
    const r = ssh(rilascia(), stdinOf('git'));
    expect(r.status, r.stderr).toBe(0);
    expect(lastJson(r)).toMatchObject({ esito: 'ok', hash: HASH });
    expect(exists(`${REL('staging', HASH)}/infra/deploy/compose.yml`)).toBe(true);
    expect(bash(`readlink ${ROOT}/rilasci/staging/corrente`).stdout.trim()).toBe(HASH);
  });

  it('con --migrazioni lancia migrate dopo il pull e prima di up; senza non lo lancia', () => {
    reset();
    const r = ssh(rilascia('staging', HASH, ' --migrazioni'));
    expect(r.status, r.stderr).toBe(0);
    expect(lastJson(r)).toMatchObject({ esito: 'ok', migrazioni: true });
    const seq = normalized('staging', HASH);
    const pull = seq.findIndex((l) => l.endsWith(' pull'));
    const migrate = seq.findIndex((l) => l.endsWith('--profile release run --rm migrate'));
    const up = seq.findIndex((l) => l.includes(' up '));
    expect(pull).toBeGreaterThan(-1);
    expect(migrate).toBeGreaterThan(pull);
    expect(up).toBeGreaterThan(migrate);
    expect(seq.filter((l) => l.includes('migrate'))).toHaveLength(1);

    reset();
    expect(ssh(rilascia()).status).toBe(0);
    expect(calls().filter((l) => l.includes('migrate'))).toEqual([]);
  });

  it("usa la rete e i segreti dell'ambiente richiesto", () => {
    reset();
    const r = ssh(rilascia('production', HASH));
    expect(r.status, r.stderr).toBe(0);
    expect(lastJson(r)).toMatchObject({ ambiente: 'production' });
    expect(calls()[0]).toBe(NET_CALL('production'));
    expect(normalized('production', HASH)).toContain(
      'docker compose COMMON up -d --wait --wait-timeout 600 --pull never',
    );
    expect(exists(`${ROOT}/rilasci/staging`)).toBe(false);
  });

  it('un secondo rilascio tiene il primo, sostituisce una cartella già presente e sposta "corrente"', () => {
    reset();
    expect(ssh(rilascia('staging', HASH), stdinOf('vecchio')).status).toBe(0);
    expect(exists(`${REL('staging', HASH)}/infra/deploy/solo-vecchio`)).toBe(true);
    expect(ssh(rilascia('staging', HASH2)).status).toBe(0);
    expect(bash(`readlink ${ROOT}/rilasci/staging/corrente`).stdout.trim()).toBe(HASH2);
    expect(exists(`${REL('staging', HASH)}/infra/deploy/compose.yml`)).toBe(true);
    expect(ssh(rilascia('staging', HASH)).status).toBe(0);
    expect(exists(`${REL('staging', HASH)}/infra/deploy/solo-vecchio`)).toBe(false);
    expect(bash(`readlink ${ROOT}/rilasci/staging/corrente`).stdout.trim()).toBe(HASH);
    expect(files().filter((f) => f.includes('/.tmp.'))).toEqual([]);
  });

  it("non scrive nulla fuori dai segreti e dalla cartella dell'ambiente", () => {
    reset();
    expect(ssh(rilascia()).status).toBe(0);
    const outside = files().filter(
      (f) => !f.startsWith(`${ROOT}/segreti/`) && !f.startsWith(`${ROOT}/rilasci/staging/`),
    );
    expect(outside).toEqual([]);
  });
});

describe('token del registro', () => {
  it("arriva a docker login solo sull'ingresso standard e non compare altrove", () => {
    reset();
    const r = ssh(rilascia('staging', HASH, ' --migrazioni'));
    expect(r.status, r.stderr).toBe(0);
    expect(bash(`cat ${FINTO}/login-sha.txt`).stdout.trim()).toBe(TOKEN_SHA);
    expect(calls().join('\n')).not.toContain(TOKEN);
    expect(r.stdout + r.stderr).not.toContain(TOKEN);
    expect(r.stdout + r.stderr).not.toContain(SECRET);
    const grep = bash(`grep -rlF -- '${TOKEN}' ${ROOT} /tmp /home/deploy 2>/dev/null; true`);
    expect(grep.stdout.trim()).toBe('');
    // Nessun processo dello script ha mai avuto il token nell'ambiente, a ogni chiamata a docker.
    expect(exists(`${FINTO}/perdite.log`)).toBe(false);
  });

  it('la configurazione di docker è in una cartella 700 che non esiste più a fine esecuzione', () => {
    reset();
    expect(ssh(rilascia()).status).toBe(0);
    const rows = bash(`cat ${FINTO}/config.log`)
      .stdout.split('\n')
      .filter((l) => l !== '')
      .map((l) => l.split('|'));
    const login = rows.find((c) => c[0] === 'login');
    expect(login?.[1]).toMatch(/^\/tmp\/amoris-docker-staging\.[A-Za-z0-9]+$/);
    expect(login?.[2]).toBe('700');
    expect(exists(login?.[1] ?? '/tmp')).toBe(false);
    // Dopo il logout le chiamate non usano più quella configurazione.
    const afterLogout = rows.slice(rows.findIndex((x) => x[0] === 'logout') + 1);
    expect(afterLogout.length).toBeGreaterThan(0);
    expect(afterLogout.every((c) => c[1] === '')).toBe(true);
  });

  it('se il pull fallisce: errore, logout fatto, configurazione cancellata, niente up né "corrente"', () => {
    reset();
    bash(`touch ${FINTO}/pull-fallisce`);
    const r = ssh(rilascia());
    expect(r.status).not.toBe(0);
    expect(r.status).not.toBe(64);
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'pull' });
    const seq = calls();
    expect(seq.filter((l) => l === 'docker logout ghcr.io')).toHaveLength(1);
    expect(seq.some((l) => l.includes(' up '))).toBe(false);
    const login = bash(`grep '^login|' ${FINTO}/config.log`).stdout.trim().split('|');
    expect(exists(login[1] ?? '/tmp')).toBe(false);
    expect(exists(`${ROOT}/rilasci/staging/corrente`)).toBe(false);
    expect(r.stdout + r.stderr).not.toContain(TOKEN);
  });

  it('token vuoto o utente non valido: errore prima di qualunque azione', () => {
    reset();
    const noToken = ssh(rilascia(), stdinOf('ok', ''));
    expect(noToken.status).not.toBe(0);
    expect(lastJson(noToken)).toMatchObject({ esito: 'errore', fase: 'credenziali' });
    for (const user of ['-utente', 'ut ente', 'a'.repeat(40), 'u;id']) {
      const r = ssh(rilascia(), stdinOf('ok', TOKEN, user));
      expect(r.status, user).not.toBe(0);
      expect(lastJson(r)).toMatchObject({ fase: 'credenziali' });
    }
    expect(calls()).toEqual([]);
  });
});

describe('archivio', () => {
  const bad = [
    'traversal',
    'traversal-infra',
    'assoluto',
    'simbolico',
    'fisico',
    'dispositivo',
    'fuori',
  ];
  it.each(bad)('archivio %s rifiutato senza scrivere fuori dal rilascio', (name) => {
    reset();
    const r = ssh(rilascia(), stdinOf(name));
    expect(r.status, r.stderr).not.toBe(0);
    expect(r.status).not.toBe(64);
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'archivio' });
    expect(calls()).toEqual([]);
    const stray = bash(
      `find ${ROOT} /srv \\( -name x -o -name pwned -o -name ln -o -name hl -o -name dev -o -name file \\) -not -path '/srv/fix/*'`,
    );
    expect(stray.stdout.trim()).toBe('');
    expect(exists(REL('staging', HASH))).toBe(false);
    expect(exists(`${ROOT}/rilasci/staging/corrente`)).toBe(false);
  });

  it('un archivio senza il Compose o non valido è un errore', () => {
    reset();
    const r = ssh(rilascia(), stdinOf('senza-compose'));
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'archivio' });
    expect(r.status).not.toBe(0);
    const junk = ssh(
      rilascia(),
      `{ printf '%s\\n%s\\n' ${GH_USER} ${TOKEN}; echo non-un-archivio; }`,
    );
    expect(junk.status).not.toBe(0);
    expect(lastJson(junk)).toMatchObject({ fase: 'archivio' });
    expect(calls()).toEqual([]);
  });
});

describe('prerequisiti del server', () => {
  it("rete d'ingresso assente: errore con la fase e nessun up", () => {
    reset();
    bash(`touch ${FINTO}/senza-rete`);
    const r = ssh(rilascia());
    expect(r.status).not.toBe(0);
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'rete' });
    const seq = calls();
    expect(seq.some((l) => l.startsWith('docker login'))).toBe(false);
    expect(seq.some((l) => l.includes(' up '))).toBe(false);
  });

  it('segreti con altro ambiente, prefisso non ghcr.io o file assente: errore, nessuna azione', () => {
    reset();
    bash(`sed -i 's/^AMORIS_ENV=.*/AMORIS_ENV=production/' ${ROOT}/segreti/staging.env`);
    let r = ssh(rilascia());
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'configurazione' });
    expect(r.status).not.toBe(0);

    reset();
    bash(
      `sed -i 's#^IMAGE_PREFIX=.*#IMAGE_PREFIX=docker.io/altro/amoris#' ${ROOT}/segreti/staging.env`,
    );
    r = ssh(rilascia());
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'configurazione' });

    reset();
    bash(`rm ${ROOT}/segreti/staging.env`);
    r = ssh(rilascia());
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'configurazione' });
    expect(calls()).toEqual([]);
    expect(r.stdout + r.stderr).not.toContain(SECRET);
  });
});

describe('blocco per ambiente', () => {
  it('due rilasci contemporanei dello stesso ambiente: il secondo fallisce sul blocco', async () => {
    reset();
    bash(`touch ${FINTO}/pull-lento`);
    const first = spawn(
      'docker',
      [
        'exec',
        '-i',
        NAME,
        'bash',
        '-c',
        `${stdinOf()} | ${SSH} deploy@127.0.0.1 "$1"`,
        'bash',
        rilascia(),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let firstOut = '';
    first.stdout.on('data', (d: Buffer) => (firstOut += d.toString()));
    const done = new Promise<number | null>((resolve) => first.on('close', resolve));
    for (let i = 0; i < 60 && !calls().some((l) => l.endsWith(' pull')); i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(calls().some((l) => l.endsWith(' pull'))).toBe(true);

    const second = ssh(rilascia('staging', HASH2));
    expect(second.status).not.toBe(0);
    expect(lastJson(second)).toMatchObject({ esito: 'errore', fase: 'blocco' });
    expect(calls().filter((l) => l.startsWith('docker login'))).toHaveLength(1);

    // Un altro ambiente non è bloccato dal primo.
    const other = ssh(rilascia('production', HASH2));
    expect(other.status, other.stderr).toBe(0);

    bash(`touch ${FINTO}/pull-continua`);
    expect(await done).toBe(0);
    expect(JSON.parse(firstOut.trim())).toMatchObject({ esito: 'ok', hash: HASH });
    expect(bash(`readlink ${ROOT}/rilasci/staging/corrente`).stdout.trim()).toBe(HASH);
    // A blocco liberato un nuovo rilascio passa.
    expect(ssh(rilascia('staging', HASH2)).status).toBe(0);
  }, 120_000);
});

/** Riscrive (o toglie, con null) una riga del file dei segreti di un ambiente. */
const setSecret = (env: string, key: string, value: string | null): void => {
  const add = value === null ? '' : `printf '%s\\n' '${key}=${value}' >> $f.n;`;
  const r = bash(
    `f=${ROOT}/segreti/${env}.env; grep -v '^${key}=' $f > $f.n; ${add} mv $f.n $f; chown deploy:deploy $f`,
  );
  expect(r.status, r.stderr).toBe(0);
};
const listing = (dir: string): string[] =>
  bash(`ls -A ${dir} 2>/dev/null; true`)
    .stdout.split('\n')
    .filter((l) => l !== '');
const corrente = (env = 'staging'): string =>
  bash(`readlink ${ROOT}/rilasci/${env}/corrente 2>/dev/null; true`).stdout.trim();

describe('archivio: tetto sul decompresso (N2)', () => {
  it.each(['grande-decompresso', 'troppe-voci'])(
    'archivio %s rifiutato in fase archivio, senza estrazione né cartella del rilascio',
    (name) => {
      reset();
      const r = ssh(rilascia(), stdinOf(name));
      expect(r.status, r.stderr).not.toBe(0);
      expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'archivio' });
      expect(calls()).toEqual([]);
      expect(exists(REL('staging', HASH))).toBe(false);
      expect(exists(`${ROOT}/rilasci/staging/corrente`)).toBe(false);
      expect(files().filter((f) => f.includes('/.tmp.'))).toEqual([]);
    },
  );
});

describe('rete e sottorete dell’ingresso (N4)', () => {
  it.each([
    ['diversa', '10.99.0.0/24 '],
    ['assente', ''],
    ['multipla', `${SUBNET.staging} 10.99.0.0/24 `],
  ])(
    'sottorete %s: errore in fase rete, nessun up, corrente e cartella invariati',
    (_n, subnet) => {
      reset();
      expect(ssh(rilascia('staging', HASH), stdinOf('vecchio')).status).toBe(0);
      bash(`printf '%s' '${subnet}' > ${FINTO}/sottorete; : > ${FINTO}/chiamate.log`);
      const r = ssh(rilascia('staging', HASH));
      expect(r.status).not.toBe(0);
      expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'rete' });
      const seq = calls();
      expect(seq.some((l) => l.startsWith('docker login'))).toBe(false);
      expect(seq.some((l) => l.includes(' up '))).toBe(false);
      expect(corrente()).toBe(HASH);
      expect(exists(`${REL('staging', HASH)}/infra/deploy/solo-vecchio`)).toBe(true);
    },
  );

  it('INGRESS_SUBNET assente dal file dei segreti: errore in fase configurazione', () => {
    reset();
    setSecret('staging', 'INGRESS_SUBNET', null);
    const r = ssh(rilascia());
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'configurazione' });
    expect(calls()).toEqual([]);
  });
});

describe('chiavi del backup (N6)', () => {
  const bad: ReadonlyArray<readonly [string, string, string | null]> = [
    ['chiave vuota', 'BACKUP_SSH_KEY_PATH', ''],
    ['chiave assente', 'BACKUP_SSH_KEY_PATH', null],
    ['chiave relativa', 'BACKUP_SSH_KEY_PATH', './backup-chiavi/ssh_key'],
    ['known_hosts vuoto', 'BACKUP_KNOWN_HOSTS_PATH', ''],
    ['known_hosts assente', 'BACKUP_KNOWN_HOSTS_PATH', null],
    ['known_hosts relativo', 'BACKUP_KNOWN_HOSTS_PATH', 'known_hosts'],
    [
      'chiave sotto i rilasci',
      'BACKUP_SSH_KEY_PATH',
      `${ROOT}/rilasci/staging/${HASH}/infra/deploy/backup-chiavi/ssh_key`,
    ],
    ['known_hosts sotto i rilasci', 'BACKUP_KNOWN_HOSTS_PATH', `${ROOT}/rilasci/known_hosts`],
    ['percorso con ..', 'BACKUP_SSH_KEY_PATH', `/etc/../${ROOT.slice(1)}/rilasci/x/ssh_key`],
    ['componente . in mezzo', 'BACKUP_SSH_KEY_PATH', '/etc/amoris/./ssh_key'],
    ['componente . finale', 'BACKUP_SSH_KEY_PATH', '/etc/amoris/.'],
    ['componente .. finale', 'BACKUP_SSH_KEY_PATH', '/etc/amoris/ssh_key/..'],
    ['known_hosts con componente .', 'BACKUP_KNOWN_HOSTS_PATH', '/etc/amoris/./known_hosts'],
    ['carattere $', 'BACKUP_SSH_KEY_PATH', '/etc/amoris/$HOME/ssh_key'],
    ['cancelletto in coda', 'BACKUP_SSH_KEY_PATH', '/etc/amoris/ssh_key#nota'],
    ['spazio', 'BACKUP_SSH_KEY_PATH', '/etc/amoris/chiavi backup/ssh_key'],
    ['carattere di controllo', 'BACKUP_SSH_KEY_PATH', '/etc/amoris/ssh\u0001key'],
  ];
  it.each(bad)('%s: errore in fase configurazione, nessuna azione', (_n, key, value) => {
    reset();
    setSecret('staging', key, value);
    const r = ssh(rilascia());
    expect(r.status).not.toBe(0);
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'configurazione' });
    expect(calls()).toEqual([]);
    expect(exists(REL('staging', HASH))).toBe(false);
  });

  it('percorsi assoluti fuori dai rilasci: accettati anche se i file non esistono', () => {
    reset();
    expect(exists(KEY_PATH)).toBe(false);
    expect(ssh(rilascia()).status).toBe(0);
  });
});

describe('ordine dei controlli e cartella dello stesso hash (N13)', () => {
  it('secondo rilascio dello stesso hash con il pull che fallisce: cartella di prima e corrente intatti', () => {
    reset();
    expect(ssh(rilascia('staging', HASH), stdinOf('vecchio')).status).toBe(0);
    expect(ssh(rilascia('staging', HASH2)).status).toBe(0);
    expect(corrente()).toBe(HASH2);
    bash(`touch ${FINTO}/pull-fallisce`);
    const r = ssh(rilascia('staging', HASH), stdinOf('ok'));
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'pull' });
    expect(exists(`${REL('staging', HASH)}/infra/deploy/solo-vecchio`)).toBe(true);
    expect(exists(`${REL('staging', HASH)}/rilascio.env`)).toBe(true);
    expect(corrente()).toBe(HASH2);
    expect(files().filter((f) => f.includes('/.tmp.'))).toEqual([]);
  });

  it('a rilascio riuscito la cartella nuova sostituisce la vecchia e non resta nulla da parte', () => {
    reset();
    expect(ssh(rilascia('staging', HASH), stdinOf('vecchio')).status).toBe(0);
    expect(ssh(rilascia('staging', HASH), stdinOf('ok')).status).toBe(0);
    expect(exists(`${REL('staging', HASH)}/infra/deploy/solo-vecchio`)).toBe(false);
    expect(corrente()).toBe(HASH);
    expect(files().filter((f) => f.includes('/.tmp.'))).toEqual([]);
  });
});

describe('residui del solo ambiente bloccato (N12)', () => {
  it('cancella .tmp.* e la configurazione di docker dello staging e lascia quelli della produzione', () => {
    reset();
    const r0 = bash(`set -e
mkdir -p ${ROOT}/rilasci/staging/.tmp.vecchio/x ${ROOT}/rilasci/production/.tmp.altro/x
mkdir -p /tmp/amoris-docker-staging.residuo /tmp/amoris-docker-production.residuo
chown -R deploy:deploy ${ROOT} /tmp/amoris-docker-staging.residuo /tmp/amoris-docker-production.residuo`);
    expect(r0.status, r0.stderr).toBe(0);
    expect(ssh(rilascia()).status).toBe(0);
    expect(exists(`${ROOT}/rilasci/staging/.tmp.vecchio`)).toBe(false);
    expect(exists('/tmp/amoris-docker-staging.residuo')).toBe(false);
    expect(exists(`${ROOT}/rilasci/production/.tmp.altro`)).toBe(true);
    expect(exists('/tmp/amoris-docker-production.residuo')).toBe(true);
  });
});

/** Manda TERM al solo script di rilascio (riconosciuto dalla riga di comando esatta). */
const termScript = (): Result =>
  bash(`for p in /proc/[0-9]*; do
  if [ "$(tr '\\0' ' ' < $p/cmdline 2>/dev/null)" = '/bin/sh /opt/amoris/rilascio/rilascia.sh ' ]; then kill -TERM \${p#/proc/}; fi
done; true`);
const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('finestra fra i due mv (M2)', () => {
  const B = `${ROOT}/rilasci/staging`;
  const afterKill = (hash: string): void => {
    const r = bash(`set -e
mkdir -p ${B}/.tmp.kill
mv ${B}/${hash} ${B}/.tmp.kill/vecchio
printf '%s\\n' ${hash} > ${B}/.tmp.kill/hash
ln -s ${hash} ${B}/.corrente.4242
chown -R deploy:deploy ${ROOT}`);
    expect(r.status, r.stderr).toBe(0);
  };

  it('dopo un SIGKILL fra i due mv, il rilascio successivo rimette la cartella e toglie .corrente.*', () => {
    reset();
    expect(ssh(rilascia('staging', HASH), stdinOf('vecchio')).status).toBe(0);
    afterKill(HASH);
    expect(exists(REL('staging', HASH))).toBe(false);
    bash(`touch ${FINTO}/pull-fallisce`);
    const r = ssh(rilascia('staging', HASH2));
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'pull' });
    expect(exists(`${REL('staging', HASH)}/infra/deploy/solo-vecchio`)).toBe(true);
    expect(corrente()).toBe(HASH);
    expect(listing(B).filter((n) => n.startsWith('.tmp.') || n.startsWith('.corrente.'))).toEqual(
      [],
    );
    bash(`rm ${FINTO}/pull-fallisce`);
    expect(ssh(rilascia('staging', HASH2)).status).toBe(0);
    expect(exists(`${REL('staging', HASH)}/infra/deploy/solo-vecchio`)).toBe(true);
  });

  it('se la cartella dell’hash esiste già, il residuo non la sovrascrive', () => {
    reset();
    expect(ssh(rilascia('staging', HASH), stdinOf('vecchio')).status).toBe(0);
    bash(`mkdir -p ${B}/.tmp.kill/vecchio; printf '%s\\n' ${HASH} > ${B}/.tmp.kill/hash
printf 'altro' > ${B}/.tmp.kill/vecchio/altro; chown -R deploy:deploy ${B}`);
    expect(ssh(rilascia('staging', HASH2)).status).toBe(0);
    expect(exists(`${REL('staging', HASH)}/infra/deploy/solo-vecchio`)).toBe(true);
    expect(exists(`${REL('staging', HASH)}/altro`)).toBe(false);
    expect(listing(B).filter((n) => n.startsWith('.tmp.'))).toEqual([]);
  });
});

describe('letture con scadenza (M1)', () => {
  it('stdin aperto senza dati: esce entro il limite in fase credenziali e rilascia il blocco', () => {
    reset();
    const r = ssh(rilascia(), `{ printf '%s\\n' '${GH_USER}'; sleep 45; }`);
    const out = lastJson(r);
    expect(out).toMatchObject({ esito: 'errore', fase: 'credenziali' });
    expect(Number(out.durata_s)).toBeLessThanOrEqual(30);
    expect(calls()).toEqual([]);
    const next = ssh(rilascia('staging', HASH2));
    expect(next.status, next.stderr).toBe(0);
  }, 180_000);
});

describe('segnali durante la pulizia (B1)', () => {
  it('due TERM ravvicinati: la configurazione temporanea di docker non resta', async () => {
    reset();
    bash(`touch ${FINTO}/pull-lento ${FINTO}/logout-lento`);
    const first = spawn(
      'docker',
      [
        'exec',
        '-i',
        NAME,
        'bash',
        '-c',
        `${stdinOf()} | ${SSH} deploy@127.0.0.1 "$1"`,
        'bash',
        rilascia(),
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let firstOut = '';
    first.stdout.on('data', (d: Buffer) => (firstOut += d.toString()));
    first.stderr.on('data', (d: Buffer) => (firstOut += d.toString()));
    const done = new Promise<number | null>((resolve) => first.on('close', resolve));
    for (let i = 0; i < 240 && !calls().some((l) => l.endsWith(' pull')); i += 1) {
      await pause(250);
    }
    expect(
      calls().some((l) => l.endsWith(' pull')),
      `${firstOut} ${calls().join('|')}`,
    ).toBe(true);
    expect(listing('/tmp').filter((n) => n.startsWith('amoris-docker-'))).toHaveLength(1);
    termScript();
    bash(`touch ${FINTO}/pull-continua`);
    // Il primo TERM avvia la pulizia (logout lento di 3 s); il secondo la raggiunge a metà.
    for (let i = 0; i < 120 && !exists(`${FINTO}/logout-iniziato`); i += 1) {
      await pause(250);
    }
    expect(exists(`${FINTO}/logout-iniziato`)).toBe(true);
    termScript();
    expect(await done).toBe(143);
    expect(listing('/tmp').filter((n) => n.startsWith('amoris-docker-'))).toEqual([]);
  }, 400_000);
});

describe('permessi dei file estratti (B4)', () => {
  it('con umask 077 i file estratti restano leggibili e le cartelle attraversabili, i registri no', () => {
    reset();
    const r = bash(
      `{ printf '%s\\n%s\\n' '${GH_USER}' '${TOKEN}'; cat /srv/fix/ok.tgz; } | runuser -u deploy -- sh -c 'umask 077; exec env AMORIS_RADICE=${ROOT} SSH_ORIGINAL_COMMAND="rilascia staging ${HASH}" /opt/amoris/rilascio/rilascia.sh'`,
    );
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const bad = bash(
      `find ${REL('staging', HASH)} \\( -type f ! -perm -o=r \\) -o \\( -type d ! -perm -o=x \\)`,
    );
    expect(bad.stdout.trim()).toBe('');
    expect(bash(`stat -c %a ${ROOT}/rilasci/staging/registri`).stdout.trim()).toBe('700');
    const log = listing(`${ROOT}/rilasci/staging/registri`)[0] ?? '';
    expect(bash(`stat -c %a ${ROOT}/rilasci/staging/registri/${log}`).stdout.trim()).toBe('600');
  });
});

describe('uscita di docker solo nel registro sul server (DR-422)', () => {
  const registro = (out: Record<string, unknown>): string => String(out.registro ?? '');

  it('il client riceve una sola riga JSON e stderr vuoto; il registro è 600 nella cartella 700', () => {
    reset();
    const r = ssh(rilascia('staging', HASH, ' --migrazioni'));
    expect(r.status, r.stderr).toBe(0);
    expect(r.stderr).toBe('');
    const out = lastJson(r);
    expect(out).toMatchObject({ esito: 'ok' });
    expect(registro(out)).toMatch(new RegExp(`^\\d{8}T\\d{6}Z-${HASH}\\.log$`));
    expect(r.stdout + r.stderr).not.toContain('persona@esempio.invalid');
    const file = `${ROOT}/rilasci/staging/registri/${registro(out)}`;
    expect(bash(`stat -c %a ${file}`).stdout.trim()).toBe('600');
    expect(bash(`stat -c %a ${ROOT}/rilasci/staging/registri`).stdout.trim()).toBe('700');
    const content = bash(`cat ${file}`).stdout;
    expect(content.split(DETAIL).length - 1).toBeGreaterThanOrEqual(4);
    expect(content).not.toContain(TOKEN);
  });

  it('anche un rilascio fallito dà una sola riga con fase e registro, e stderr vuoto', () => {
    reset();
    bash(`touch ${FINTO}/pull-fallisce`);
    const r = ssh(rilascia());
    expect(r.status).not.toBe(0);
    expect(r.stderr).toBe('');
    const out = lastJson(r);
    expect(out).toMatchObject({ esito: 'errore', fase: 'pull' });
    const file = `${ROOT}/rilasci/staging/registri/${registro(out)}`;
    const content = bash(`cat ${file}`).stdout;
    expect(content).toContain('pull finto fallito');
    expect(content).toContain('rilascia: pull delle immagini fallito');
    expect(r.stdout).not.toContain('pull finto fallito');
  });

  it('un errore di archivio non scrive nulla sul client e finisce nel registro', () => {
    reset();
    const r = ssh(rilascia(), stdinOf('traversal'));
    expect(r.stderr).toBe('');
    const out = lastJson(r);
    expect(out).toMatchObject({ fase: 'archivio' });
    const file = `${ROOT}/rilasci/staging/registri/${registro(out)}`;
    expect(bash(`cat ${file}`).stdout).toContain('rilascia: percorso non ammesso');
  });
});

describe('plugin compose con la configurazione temporanea (D3)', () => {
  it('se `docker compose version` fallisce: errore in fase login, nessun login e configurazione cancellata', () => {
    reset();
    bash(`touch ${FINTO}/senza-plugin`);
    const r = ssh(rilascia());
    expect(r.status).not.toBe(0);
    expect(lastJson(r)).toMatchObject({ esito: 'errore', fase: 'login' });
    const seq = calls();
    expect(seq).toContain('docker compose version');
    expect(seq.some((l) => l.startsWith('docker login'))).toBe(false);
    expect(listing('/tmp').filter((n) => n.startsWith('amoris-docker-'))).toEqual([]);
    expect(corrente()).toBe('');
  });
});

describe('Compose vero con un git archive vero (N7c)', () => {
  const host = mkdtempSync(path.join(tmpdir(), 'amoris-rilascio-'));
  afterAll(() => rmSync(host, { recursive: true, force: true }));

  const cleanEnv = (): Record<string, string> =>
    Object.fromEntries(
      Object.entries(process.env).filter(
        (e): e is [string, string] =>
          !/^(AMORIS_|IMAGE_|CADDY_|SITE_URL|POSTGRES_|DB_|S3_|BACKUP_|IP_HASH_SALT|CSRF_SECRET|SCRUB_|MEDIA_|LOG_LEVEL|COMPOSE_|APP_SUBNET|INGRESS_|TOTP_)/i.test(
            e[0],
          ) && e[1] !== undefined,
      ),
    );
  const config = (args: readonly string[]) =>
    spawnSync('docker', ['compose', ...args, 'config', '--quiet'], {
      cwd: host,
      env: cleanEnv(),
      encoding: 'utf8',
      timeout: 120_000,
    });

  it('gli argomenti passati dallo script al docker finto fanno riuscire `config`, e senza INGRESS_SUBNET no', () => {
    reset();
    const r = ssh(rilascia(), stdinOf('git'));
    expect(r.status, r.stderr).toBe(0);
    // Gli argomenti sono quelli registrati dal docker finto, con la radice di prova portata sull'host.
    const pull = calls().find((l) => l.endsWith(' pull')) as string;
    const up = calls().find((l) => l.includes(' up ')) as string;
    expect(pull).toBeDefined();
    const prefix = (line: string, stop: string): string[] => {
      const words = line.split(' ');
      return words
        .slice(words.indexOf('compose') + 1, words.indexOf(stop))
        .map((w) => w.replace(ROOT, host));
    };
    const args = prefix(pull, 'pull');
    expect(args).toContain('--profile');
    expect(args.filter((w) => w === '--env-file')).toHaveLength(2);
    const noProfiles = (list: string[]): string[] =>
      list.filter((w) => w !== '--profile' && w !== 'backup' && w !== 'release');
    expect(noProfiles(prefix(up, 'up'))).toEqual(noProfiles(args));
    const cp = docker(['cp', `${NAME}:${ROOT}/.`, host]);
    expect(cp.status, cp.stderr).toBe(0);

    const ok = config(args);
    expect(ok.status, ok.stderr).toBe(0);

    const segreti = path.join(host, 'segreti', 'staging.env');
    const text = readFileSync(segreti, 'utf8');
    expect(text).toContain('INGRESS_SUBNET=');
    writeFileSync(
      segreti,
      text
        .split('\n')
        .filter((l) => !l.startsWith('INGRESS_SUBNET='))
        .join('\n'),
    );
    const ko = config(args);
    expect(ko.status).not.toBe(0);
    expect(ko.stderr).toContain('INGRESS_SUBNET');
  }, 180_000);
});
