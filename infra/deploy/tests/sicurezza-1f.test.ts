import { spawnSync } from 'node:child_process';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Controlli di autenticazione di ADR-007 §3.1/§8 **attraverso Caddy**, sullo stack di
 * produzione avviato dalle immagini già costruite (1F-W4 T3), con seme sintetico.
 *
 * Le prove unitarie di `apps/api/tests/adr007Controls.test.ts` passano da `app.inject`: qui si
 * prova il percorso vero (Caddy, `X-Forwarded-For`, cookie `Secure` su HTTPS, CSRF su ogni rotta
 * che modifica) con i valori **predefiniti** dell'API (5 per account, 20 per indirizzo, ritardo
 * progressivo, 350 ms uniformi): per questo non si usa `compose.e2e.yml`, che li alza.
 *
 * Il progetto Compose è effimero (`amoris-prova-sicurezza-<pid>`), con segreti generati qui e mai
 * scritti nel repository; `afterAll` lo toglie con `down -v`. Non si toccano altri progetti.
 *
 * **Conteggio dei tentativi.** Dopo 20 fallimenti l'indirizzo del client resta bloccato per la
 * finestra (15 minuti), e dopo 5 l'account. L'API li legge dal registro delle operazioni: fra un
 * gruppo e l'altro (e fra un campione e l'altro dei tempi) la prova cancella dal database le righe
 * `auth.login` e `auth.password_changed` di fallimento, così che ogni gruppo parta da zero.
 *
 * **Prova rossa.** `SICUREZZA_MUTAZIONE=<nome>` introduce un guasto temporaneo e deve far fallire
 * il gruppo corrispondente: `limiti`, `xff`, `revoca`, `cookie`, `csrf`, `enumerazione`, `dati`.
 * Le mutazioni stanno nei file temporanei di questa prova, mai nel prodotto.
 *
 * **Nessun dato reale, nessun segreto né indirizzo IP nei log**: si stampano solo conteggi.
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const deployDir = path.join(repoRoot, 'infra', 'deploy');
const composeFile = path.join(deployDir, 'compose.yml');
const overrideFile = path.join(import.meta.dirname, 'compose.sicurezza.yml');
const snapshotFile = path.join(repoRoot, 'apps', 'api', 'tests', 'openapi.snapshot.json');

const MUTAZIONE = process.env.SICUREZZA_MUTAZIONE ?? '';
const IMAGE_TAG = process.env.SICUREZZA_IMAGE_TAG ?? 'w4-t7a';
const PROJECT = `amoris-prova-sicurezza-${process.pid}`;

/** Persone del seme sintetico (`apps/api/tools/seedSintetico.ts`), tutte con `SEED_PASSWORD`. */
const REDAZIONE = 'redazione@esempio.invalid';
const AMMINISTRAZIONE = 'amministrazione@esempio.invalid';
const ENTRAMBI = 'entrambi@esempio.invalid';
const SESSION_COOKIE = 'amoris_sessione';
const CSRF_COOKIE = 'amoris_csrf';
const FORM_SLUG = 'prova-sicurezza';

const workDir = mkdtempSync(path.join(tmpdir(), 'amoris-sicurezza-'));
const secrets = {
  postgres: randomBytes(18).toString('hex'),
  dbOwner: randomBytes(18).toString('hex'),
  dbApp: randomBytes(18).toString('hex'),
  dbBackup: randomBytes(18).toString('hex'),
  s3Access: randomBytes(10).toString('hex'),
  s3Secret: randomBytes(20).toString('hex'),
  s3Api: randomBytes(20).toString('hex'),
  s3Backup: randomBytes(20).toString('hex'),
  ipSalt: randomBytes(24).toString('hex'),
  csrf: randomBytes(24).toString('hex'),
  scrub: randomBytes(24).toString('hex'),
  /** Password del seme: vale solo per questo stack usa e getta. */
  seed: `sintetica-${randomBytes(12).toString('hex')}`,
};

let httpPort = 0;
let httpsPort = 0;
let dbPort = 0;
let objectsPort = 0;
let rootCa = '';
let sql: postgres.Sql;
let composeFiles: string[] = [];
let envFile = '';
let volumesBefore = 0;

// ---------------------------------------------------------------------------------------------
// Docker e Compose
// ---------------------------------------------------------------------------------------------

/** L'ambiente della macchina senza le chiavi che il Compose interpola: valgono solo quelle della prova. */
function cleanProcessEnv(): Record<string, string> {
  const drop =
    /^(AMORIS_|IMAGE_|CADDY_|SITE_URL|POSTGRES_|DB_|S3_|BACKUP_|IP_HASH_SALT|CSRF_SECRET|SCRUB_|MEDIA_|LOG_LEVEL|COMPOSE_|SIC_)/i;
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => !drop.test(entry[0]) && entry[1] !== undefined,
    ),
  );
}

function compose(args: string[], timeout = 600_000) {
  return spawnSync(
    'docker',
    [
      'compose',
      '-p',
      PROJECT,
      ...composeFiles.flatMap((file) => ['-f', file]),
      '--env-file',
      envFile,
      ...args,
    ],
    { cwd: deployDir, env: cleanProcessEnv(), encoding: 'utf8', timeout },
  );
}

function mustCompose(args: string[], timeout?: number): string {
  const result = compose(args, timeout);
  if (result.status !== 0) {
    throw new Error(`docker compose ${args.join(' ')}: ${result.stderr.slice(-1500)}`);
  }
  return result.stdout;
}

function countVolumes(): number {
  const result = spawnSync('docker', ['volume', 'ls', '-q'], { encoding: 'utf8', timeout: 60_000 });
  return result.stdout.split('\n').filter((line) => line.trim() !== '').length;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

// ---------------------------------------------------------------------------------------------
// Mutazioni temporanee (prova rossa): solo in file temporanei, mai nel prodotto.
// ---------------------------------------------------------------------------------------------

/** Compose di prova che sostituisce una parte del servizio, in un file temporaneo. */
function writeMutationCompose(yaml: string): string {
  const file = path.join(workDir, `mutazione-${MUTAZIONE}.yml`);
  writeFileSync(file, yaml);
  return file;
}

/** Copia della cartella di Caddy con il `Caddyfile` guastato, montata al posto dell'originale. */
function mutatedCaddy(edit: (caddyfile: string) => string): string {
  const dir = path.join(workDir, 'caddy-mutato');
  cpSync(path.join(deployDir, 'caddy'), dir, { recursive: true });
  const file = path.join(dir, 'Caddyfile');
  const original = readFileSync(file, 'utf8');
  const edited = edit(original);
  if (edited === original) throw new Error('la mutazione di Caddy non ha cambiato il Caddyfile');
  writeFileSync(file, edited);
  return writeMutationCompose(
    `services:\n  caddy:\n    volumes:\n      - ${dir.replaceAll('\\', '/')}:/etc/caddy:ro\n`,
  );
}

const AFTER_IMPORT = 'import {$AMORIS_ENV}.caddy\n';

function mutationFiles(): string[] {
  switch (MUTAZIONE) {
    case 'limiti':
      return [
        writeMutationCompose(
          [
            'services:',
            '  api:',
            '    environment:',
            "      LOGIN_MAX_PER_ACCOUNT: '1000'",
            "      LOGIN_MAX_PER_IP: '1000'",
            "      LOGIN_DELAY_STEP_MS: '0'",
            "      LOGIN_UNIFORM_MS: '0'",
            '',
          ].join('\n'),
        ),
      ];
    case 'xff':
      // Caddy si fida di ogni client: l'XFF del client arriva all'API e vince.
      return [
        mutatedCaddy((text) =>
          text.replace(
            'admin off',
            'admin off\n\tservers {\n\t\ttrusted_proxies static 0.0.0.0/0 ::/0\n\t}',
          ),
        ),
      ];
    case 'cookie':
      // Toglie `Secure` dai cookie che escono da Caddy.
      return [
        mutatedCaddy((text) =>
          text.replace(
            AFTER_IMPORT,
            `${AFTER_IMPORT}\theader {\n\t\tdefer\n\t\tSet-Cookie "; Secure" ""\n\t}\n`,
          ),
        ),
      ];
    case 'csrf':
      // Una rotta che modifica risponde senza controllare nulla, come se il controllo mancasse.
      return [
        mutatedCaddy((text) =>
          text.replace(
            AFTER_IMPORT,
            `${AFTER_IMPORT}\t@csrfaperto {\n\t\tmethod POST\n\t\tpath /api/terms\n\t}\n\thandle @csrfaperto {\n\t\trespond 204\n\t}\n`,
          ),
        ),
      ];
    default:
      return [];
  }
}

/** Mutazioni sul database, applicate dopo il seme. */
async function applyDatabaseMutation(): Promise<void> {
  if (MUTAZIONE === 'revoca') {
    // Nessun UPDATE sulle sessioni ha effetto: la revoca non revoca.
    await sql.unsafe('CREATE RULE sic_nessuna_revoca AS ON UPDATE TO sessions DO INSTEAD NOTHING');
  }
  if (MUTAZIONE === 'enumerazione') {
    // L'account esistente costa molto più del lavoro finto: il tempo dice che esiste.
    const apiRequire = createRequire(path.join(repoRoot, 'apps', 'api', 'package.json'));
    const argon = apiRequire('@node-rs/argon2') as {
      hash: (password: string, options: object) => Promise<string>;
    };
    const costly = await argon.hash(randomBytes(12).toString('hex'), {
      algorithm: 2,
      memoryCost: 131072,
      timeCost: 12,
      parallelism: 1,
    });
    await sql`UPDATE users SET password_hash = ${costly} WHERE email = ${REDAZIONE}`;
  }
}

// ---------------------------------------------------------------------------------------------
// Client HTTPS verso Caddy
// ---------------------------------------------------------------------------------------------

interface Reply {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  setCookies: string[];
  text: string;
  ms: number;
}

interface CallOptions {
  headers?: Record<string, string>;
  body?: unknown;
}

function call(method: string, pathname: string, options: CallOptions = {}): Promise<Reply> {
  const started = Date.now();
  const hasBody = options.body !== undefined;
  const payload = hasBody ? JSON.stringify(options.body) : undefined;
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        host: '127.0.0.1',
        port: httpsPort,
        method,
        path: pathname,
        servername: 'localhost',
        ca: rootCa,
        agent: false,
        headers: {
          Host: `localhost:${httpsPort}`,
          'User-Agent': 'prova-sicurezza-1f',
          ...(payload !== undefined
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...options.headers,
        },
        timeout: 60_000,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            setCookies: response.headers['set-cookie'] ?? [],
            text: Buffer.concat(chunks).toString('utf8'),
            ms: Date.now() - started,
          });
        });
      },
    );
    request.on('timeout', () => request.destroy(new Error('timeout della richiesta')));
    request.on('error', reject);
    if (payload !== undefined) request.write(payload);
    request.end();
  });
}

function json(reply: Reply): Record<string, unknown> {
  try {
    return JSON.parse(reply.text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorCode(reply: Reply): string | undefined {
  return (json(reply).error as { code?: string } | undefined)?.code;
}

interface ParsedCookie {
  name: string;
  value: string;
  attributes: Map<string, string>;
}

function parseSetCookie(raw: string): ParsedCookie {
  const [pair = '', ...rest] = raw.split(';').map((part) => part.trim());
  const eq = pair.indexOf('=');
  return {
    name: pair.slice(0, eq),
    value: pair.slice(eq + 1),
    attributes: new Map(
      rest.map((part) => {
        const i = part.indexOf('=');
        return i < 0
          ? ([part.toLowerCase(), ''] as const)
          : ([part.slice(0, i).toLowerCase(), part.slice(i + 1)] as const);
      }),
    ),
  };
}

function cookieNamed(reply: Reply, name: string): ParsedCookie | undefined {
  return reply.setCookies.map(parseSetCookie).find((cookie) => cookie.name === name);
}

interface Session {
  reply: Reply;
  token: string;
  csrf: string;
  /** Cookie di sessione e anti-CSRF insieme. */
  cookie: string;
  /** Solo il cookie di sessione. */
  sessionOnly: string;
  /** Cookie completi e intestazione del token: una scrittura valida. */
  writeHeaders: Record<string, string>;
}

function sessionFrom(reply: Reply): Session {
  const session = cookieNamed(reply, SESSION_COOKIE);
  const csrf = cookieNamed(reply, CSRF_COOKIE);
  if (!session || !csrf) throw new Error(`cookie di sessione assenti (stato ${reply.status})`);
  const sessionOnly = `${SESSION_COOKIE}=${session.value}`;
  const cookie = `${sessionOnly}; ${CSRF_COOKIE}=${csrf.value}`;
  return {
    reply,
    token: session.value,
    csrf: csrf.value,
    cookie,
    sessionOnly,
    writeHeaders: { Cookie: cookie, 'X-CSRF-Token': csrf.value },
  };
}

async function login(
  email: string,
  password: string = secrets.seed,
  headers: Record<string, string> = {},
): Promise<Reply> {
  return call('POST', '/api/auth/login', { headers, body: { email, password } });
}

/**
 * Segna verificata e confermata ora, a database, la sola sessione del token dato: come l'harness
 * dell'API, le prove che non riguardano il secondo fattore non lo ripetono (DR-384). Il rifiuto
 * delle sessioni non verificate è provato a parte, attraverso Caddy.
 */
async function verifySecondFactor(token: string): Promise<void> {
  const digest = createHash('sha256').update(token, 'utf8').digest();
  const marked = await sql`
    UPDATE sessions SET second_factor_verified_at = now(), last_confirmed_at = now()
    WHERE token_digest = ${digest} AND revoked_at IS NULL`;
  if (marked.count !== 1) throw new Error('sessione di prova non trovata a database');
}

/** Accesso riuscito, secondo fattore verificato e scelta della veste di redazione, come fa l'area. */
async function signIn(email: string = REDAZIONE): Promise<Session> {
  const reply = await login(email);
  if (reply.status !== 200) throw new Error(`accesso di prova fallito (${reply.status})`);
  const session = sessionFrom(reply);
  await verifySecondFactor(session.token);
  const roles = (json(reply).rolesHeld ?? []) as { roleId: string; areas: string[] }[];
  const role = roles.find((held) => held.areas.includes('redazione'));
  if (role) {
    const chosen = await call('POST', '/api/auth/context', {
      headers: session.writeHeaders,
      body: { roleId: role.roleId, area: 'redazione' },
    });
    if (chosen.status !== 200) throw new Error(`scelta della veste fallita (${chosen.status})`);
  }
  return session;
}

/** Una sessione revocata: `/auth/me` dice 204 e una lettura protetta è rifiutata con 401. */
async function expectRejected(cookie: string): Promise<void> {
  const me = await call('GET', '/api/auth/me', { headers: { Cookie: cookie } });
  expect(me.status).toBe(204);
  const protectedRead = await call('GET', '/api/contents', { headers: { Cookie: cookie } });
  expect(protectedRead.status).toBe(401);
}

async function expectAccepted(cookie: string): Promise<void> {
  const me = await call('GET', '/api/auth/me', { headers: { Cookie: cookie } });
  expect(me.status).toBe(200);
}

/** Azzera i fallimenti contati dall'API: i gruppi non si influenzano fra loro. */
async function clearAttempts(): Promise<void> {
  await sql`DELETE FROM audit_log WHERE outcome = 'failure' AND action IN ('auth.login', 'auth.password_changed')`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function unknownEmail(label: string, index: number): string {
  return `${label}-${index}-${randomBytes(3).toString('hex')}@esempio.invalid`;
}

function ipDigest(address: string): string {
  return createHmac('sha256', secrets.ipSalt).update(address, 'utf8').digest('hex');
}

/** Indirizzi di documentazione (RFC 5737): inventati, mai quelli della macchina. */
function spoofedAddress(index: number): string {
  return `198.51.100.${(index % 250) + 1}`;
}

/** Messaggi d'errore (livello 50 o più) dei registri dell'API: solo testo dell'errore, mai l'indirizzo. */
function apiErrorMessages(): string {
  const logs = compose(['logs', '--no-log-prefix', '--tail', '200', 'api'], 60_000).stdout;
  return logs
    .split(String.fromCharCode(10))
    .flatMap((line) => {
      try {
        const entry = JSON.parse(line) as {
          level?: number;
          msg?: string;
          err?: { message?: string };
        };
        return (entry.level ?? 0) >= 50
          ? [`${entry.msg ?? ''} ${entry.err?.message ?? ''}`.slice(0, 300)]
          : [];
      } catch {
        return [];
      }
    })
    .slice(-5)
    .join(' | ');
}

function info(message: string): void {
  console.info(`[sicurezza-1f] ${message}`);
}

// ---------------------------------------------------------------------------------------------
// Stack
// ---------------------------------------------------------------------------------------------

beforeAll(async () => {
  volumesBefore = countVolumes();
  info(`volumi Docker prima: ${volumesBefore}; mutazione: ${MUTAZIONE || 'nessuna'}`);

  [httpPort, httpsPort, dbPort, objectsPort] = await Promise.all([
    freePort(),
    freePort(),
    freePort(),
    freePort(),
  ]);

  envFile = path.join(workDir, 'ambiente.env');
  const env: Record<string, string> = {
    AMORIS_ENV: 'production',
    IMAGE_PREFIX: 'amoris',
    IMAGE_TAG,
    CADDY_SITE_ADDRESS: 'localhost',
    CADDY_HTTP_PORT: String(httpPort),
    CADDY_HTTPS_PORT: String(httpsPort),
    SITE_URL: `https://localhost:${httpsPort}`,
    POSTGRES_PASSWORD: secrets.postgres,
    DB_OWNER_PASSWORD: secrets.dbOwner,
    DB_APP_PASSWORD: secrets.dbApp,
    DB_BACKUP_PASSWORD: secrets.dbBackup,
    S3_ACCESS_KEY: secrets.s3Access,
    S3_SECRET_KEY: secrets.s3Secret,
    S3_API_SECRET_KEY: secrets.s3Api,
    S3_BACKUP_SECRET_KEY: secrets.s3Backup,
    IP_HASH_SALT: secrets.ipSalt,
    CSRF_SECRET: secrets.csrf,
    TOTP_ENCRYPTION_KEY: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
    SCRUB_SERVICE_TOKEN: secrets.scrub,
    // Obbligatoria dal riesame della T7 (DR-402).
    APP_SUBNET: '10.77.84.0/24',
    SIC_DB_PORT: String(dbPort),
    SIC_OBJECTS_PORT: String(objectsPort),
  };
  writeFileSync(
    envFile,
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
  composeFiles = [composeFile, overrideFile, ...mutationFiles()];

  mustCompose(['up', '-d', '--wait', 'db', 'objects']);
  mustCompose(['run', '--rm', 'objects-init']);
  mustCompose(['--profile', 'release', 'run', '--rm', 'migrate']);
  // `objects-init` è a termine: se esce prima che `--wait` lo guardi, Compose lo segnala come errore
  // pur avendo finito bene (exit 0). Si tollera solo quel caso e si controlla poi lo stato dei servizi.
  const started = compose(['up', '-d', '--wait']);
  if (started.status !== 0 && !/exited \(0\)/.test(started.stderr)) {
    throw new Error(`docker compose up --wait: ${started.stderr.slice(-1500)}`);
  }

  // Radice interna di Caddy: emette da sé il certificato per `localhost`.
  const deadline = Date.now() + 60_000;
  for (;;) {
    const result = compose(
      ['exec', '-T', 'caddy', 'cat', '/data/caddy/pki/authorities/local/root.crt'],
      30_000,
    );
    if (result.status === 0 && result.stdout.includes('BEGIN CERTIFICATE')) {
      rootCa = result.stdout;
      break;
    }
    if (Date.now() > deadline) throw new Error('certificato radice interno di Caddy non creato');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Seme sintetico, scritto da fuori sul database dello stack (README §6).
  const databaseUrl = `postgres://amoris:${secrets.postgres}@127.0.0.1:${dbPort}/amoris`;
  const seed = spawnSync(
    'pnpm',
    ['--filter', '@amoris/api', 'exec', 'tsx', 'tools/seedSintetico.ts'],
    {
      cwd: repoRoot,
      env: {
        ...cleanProcessEnv(),
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        DATABASE_URL: databaseUrl,
        S3_ENDPOINT: `http://127.0.0.1:${objectsPort}`,
        S3_ACCESS_KEY: secrets.s3Access,
        S3_SECRET_KEY: secrets.s3Secret,
        IP_HASH_SALT: secrets.ipSalt,
        CSRF_SECRET: secrets.csrf,
        TOTP_ENCRYPTION_KEY: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
        SEED_PASSWORD: secrets.seed,
      },
      encoding: 'utf8',
      shell: process.platform === 'win32',
      timeout: 300_000,
    },
  );
  if (seed.status !== 0) throw new Error(`seme sintetico fallito: ${seed.stderr.slice(-800)}`);

  sql = postgres(databaseUrl, { max: 2, onnotice: () => undefined });
  // Un form pubblico sintetico per la compilazione che passa da Caddy.
  await sql`INSERT INTO forms (slug, title, definition, confirmation_message, is_active)
    VALUES (${FORM_SLUG}, 'Form di prova della sicurezza',
      ${sql.json({ fields: [{ id: 'messaggio', type: 'text', label: 'Messaggio', required: false, options: {} }] })},
      'Ricevuto', true)`;

  await applyDatabaseMutation();
}, 1_500_000);

afterAll(async () => {
  try {
    await sql?.end({ timeout: 5 });
  } catch {
    // La connessione può essere già chiusa.
  }
  // Solo il progetto effimero, con i suoi dati sintetici.
  if (composeFiles.length > 0) compose(['down', '-v', '--remove-orphans'], 300_000);
  const leftovers = spawnSync(
    'docker',
    ['ps', '-a', '-q', '--filter', `label=com.docker.compose.project=${PROJECT}`],
    { encoding: 'utf8', timeout: 60_000 },
  );
  const left = leftovers.stdout.split('\n').filter((line) => line.trim() !== '').length;
  info(
    `contenitori rimasti del progetto effimero: ${left}; volumi Docker prima: ${volumesBefore}, dopo: ${countVolumes()}`,
  );
  rmSync(workDir, { recursive: true, force: true });
}, 600_000);

// ---------------------------------------------------------------------------------------------
// 1. Limitazione dei tentativi, con i valori predefiniti dell'API
// ---------------------------------------------------------------------------------------------

describe('limitazione dei tentativi (controllo 8) con i valori predefiniti', () => {
  it('per account: dopo 5 fallimenti l’account è bloccato anche con la password giusta, gli altri no', async () => {
    await clearAttempts();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await login(AMMINISTRAZIONE, 'password-sbagliata');
      expect(failed.status, `tentativo ${attempt + 1}`).toBe(401);
    }
    const blocked = await login(AMMINISTRAZIONE);
    expect(blocked.status).toBe(429);
    expect(errorCode(blocked)).toBe('TOO_MANY_ATTEMPTS');

    // Il tetto è per account: un'altra persona dallo stesso indirizzo entra ancora.
    const other = await login(REDAZIONE);
    expect(other.status).toBe(200);
    await clearAttempts();
  }, 120_000);

  it('il ritardo cresce con i tentativi falliti dello stesso account', async () => {
    await clearAttempts();
    const email = unknownEmail('ritardo', 0);
    const durations: number[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failed = await login(email, 'password-sbagliata');
      expect(failed.status).toBe(401);
      durations.push(failed.ms);
    }
    info(`durate dei 5 tentativi falliti (ms): ${durations.join(', ')}`);
    // Passo 250 ms: il quinto tentativo aspetta ~1000 ms, il primo solo il minimo uniforme di 350 ms.
    expect(durations[4] ?? 0).toBeGreaterThan((durations[0] ?? 0) + 400);
    expect(durations[3] ?? 0).toBeGreaterThan((durations[1] ?? 0) + 200);
    await clearAttempts();
  }, 120_000);

  it('per indirizzo: dopo 20 fallimenti su account diversi blocca anche una persona che non ha sbagliato', async () => {
    await clearAttempts();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const failed = await login(unknownEmail('ip', attempt), 'qualunque');
      expect(failed.status, `tentativo ${attempt + 1}`).toBe(401);
    }
    const blocked = await login(REDAZIONE);
    expect(blocked.status).toBe(429);
    expect(errorCode(blocked)).toBe('TOO_MANY_ATTEMPTS');
    const another = await login(ENTRAMBI);
    expect(another.status).toBe(429);
    await clearAttempts();
  }, 300_000);
});

// ---------------------------------------------------------------------------------------------
// 2. L'indirizzo che conta è quello visto da Caddy
// ---------------------------------------------------------------------------------------------

describe('l’indirizzo del client è quello visto da Caddy, non un X-Forwarded-For falsificato', () => {
  it('cambiare X-Forwarded-For a ogni richiesta non elude il tetto per indirizzo né sposta il conteggio', async () => {
    await clearAttempts();
    const spoofed: string[] = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const fake = spoofedAddress(attempt);
      spoofed.push(fake);
      // Tre forme di falsificazione: catena con un secondo indirizzo, X-Real-IP e Forwarded.
      const headers: Record<string, string> =
        attempt % 3 === 0
          ? { 'X-Forwarded-For': fake }
          : attempt % 3 === 1
            ? { 'X-Forwarded-For': `${fake}, 203.0.113.9` }
            : { 'X-Forwarded-For': fake, 'X-Real-IP': fake, Forwarded: `for=${fake}` };
      const failed = await login(unknownEmail('xff', attempt), 'qualunque', headers);
      expect(failed.status, `tentativo ${attempt + 1}`).toBe(401);
    }

    const fakeNew = '198.51.100.250';
    spoofed.push(fakeNew);
    const blocked = await login(REDAZIONE, secrets.seed, { 'X-Forwarded-For': fakeNew });
    expect(blocked.status, 'un nuovo indirizzo falsificato non deve poter entrare').toBe(429);

    // Anche senza l'intestazione l'indirizzo è lo stesso, quindi è ancora bloccato.
    const plain = await login(REDAZIONE);
    expect(plain.status).toBe(429);

    // Attribuzione: tutti i fallimenti portano un solo digest d'indirizzo, e non è uno falsificato.
    const rows = await sql<{ h: string }[]>`
      SELECT DISTINCT encode(ip_hash, 'hex') AS h FROM audit_log
      WHERE action = 'auth.login' AND ip_hash IS NOT NULL`;
    const digests = rows.map((row) => row.h);
    info(`digest d'indirizzo distinti a registro dopo la falsificazione: ${digests.length}`);
    expect(digests).toHaveLength(1);
    const fakeDigests = new Set(spoofed.map(ipDigest));
    expect(digests.some((digest) => fakeDigests.has(digest))).toBe(false);
    await clearAttempts();
  }, 300_000);
});

// ---------------------------------------------------------------------------------------------
// 3. Revoca e rotazione
// ---------------------------------------------------------------------------------------------

describe('revoca e rotazione del token (controlli 5 e 6)', () => {
  it('la disconnessione invalida la sessione alla richiesta successiva', async () => {
    const session = await signIn(REDAZIONE);
    await expectAccepted(session.cookie);
    const out = await call('POST', '/api/auth/logout', { headers: session.writeHeaders });
    expect(out.status).toBe(200);
    await expectRejected(session.cookie);
  });

  it('la revoca di tutte le sessioni lascia viva solo quella che l’ha chiesta', async () => {
    const first = await signIn(REDAZIONE);
    const second = await signIn(REDAZIONE);
    const current = await signIn(REDAZIONE);

    const revoked = await call('POST', '/api/auth/sessions/revoke-all', {
      headers: current.writeHeaders,
    });
    expect(revoked.status).toBe(200);
    expect(Number(json(revoked).revoked)).toBeGreaterThanOrEqual(2);

    await expectRejected(first.cookie);
    await expectRejected(second.cookie);
    await expectAccepted(current.cookie);
  });

  it('ogni accesso rilascia un token nuovo, anche se il client ne presenta uno già scelto', async () => {
    const first = await signIn(REDAZIONE);
    const second = await signIn(REDAZIONE);
    expect(first.token).not.toBe(second.token);

    const fixed = randomBytes(32).toString('base64url');
    const reply = await login(REDAZIONE, secrets.seed, {
      Cookie: `${SESSION_COOKIE}=${fixed}; ${CSRF_COOKIE}=${fixed}`,
    });
    expect(reply.status).toBe(200);
    const issued = sessionFrom(reply);
    expect(issued.token).not.toBe(fixed);
    // Il token scelto dal client non è mai diventato una sessione.
    await expectRejected(`${SESSION_COOKIE}=${fixed}`);
  });

  it('il cambio di password rilascia un token nuovo e il precedente non vale più', async () => {
    const session = await signIn(ENTRAMBI);
    const next = `nuova-${randomBytes(10).toString('hex')}`;
    const changed = await call('POST', '/api/auth/password', {
      headers: session.writeHeaders,
      body: { currentPassword: secrets.seed, newPassword: next },
    });
    expect(changed.status).toBe(200);

    const renewed = cookieNamed(changed, SESSION_COOKIE);
    expect(renewed?.value).toBeTruthy();
    expect(renewed?.value).not.toBe(session.token);
    const renewedSession = sessionFrom(changed);

    await expectRejected(session.cookie);
    await expectAccepted(renewedSession.cookie);

    // La vecchia password non apre più, la nuova sì.
    expect((await login(ENTRAMBI, secrets.seed)).status).toBe(401);
    expect((await login(ENTRAMBI, next)).status).toBe(200);
    await clearAttempts();
  }, 120_000);
});

// ---------------------------------------------------------------------------------------------
// 4. Cookie in produzione e CSRF
// ---------------------------------------------------------------------------------------------

/** Rotte della specifica che modificano dati, dal file dell'API versionato in Git. */
function mutatingRoutes(spec: { paths: Record<string, Record<string, unknown>> }): string[] {
  return Object.entries(spec.paths).flatMap(([route, operations]) =>
    Object.keys(operations)
      .filter((method) => ['post', 'put', 'patch', 'delete'].includes(method))
      .map((method) => `${method.toUpperCase()} ${route}`),
  );
}

/** Rotte dichiarate senza controllo CSRF: l'accesso e la compilazione anonima dei form. */
const CSRF_EXEMPT = ['POST /auth/login', 'POST /forms/{slug}/submissions'];

const snapshotSpec = JSON.parse(readFileSync(snapshotFile, 'utf8')) as {
  paths: Record<string, Record<string, unknown>>;
};
const SNAPSHOT_MUTATING = mutatingRoutes(snapshotSpec);
const PROTECTED_ROUTES = SNAPSHOT_MUTATING.filter((route) => !CSRF_EXEMPT.includes(route));

function concretePath(route: string): string {
  return route
    .split(' ')[1]!
    .replace(/\{id\}/g, randomUUID())
    .replace(/\{[a-z]+\}/g, 'prova');
}

/** File sorgente dell'API che dichiarano `csrf: false`, per accorgersi di un'esenzione nuova. */
function csrfExemptionsInSource(): number {
  const base = path.join(repoRoot, 'apps', 'api', 'src');
  let found = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) {
        found += (readFileSync(full, 'utf8').match(/csrf:\s*false\s+as\s+const/g) ?? []).length;
      }
    }
  };
  walk(base);
  return found;
}

describe('cookie in produzione (controllo 3)', () => {
  it('il cookie di sessione ha HttpOnly, Secure, SameSite=Lax, Path=/ e nessun Domain', async () => {
    const reply = await login(REDAZIONE);
    expect(reply.status).toBe(200);
    const cookie = cookieNamed(reply, SESSION_COOKIE);
    expect(cookie, 'cookie di sessione assente').toBeDefined();
    const attributes = cookie!.attributes;
    expect(attributes.has('httponly')).toBe(true);
    expect(attributes.has('secure')).toBe(true);
    expect(attributes.get('samesite')?.toLowerCase()).toBe('lax');
    expect(attributes.get('path')).toBe('/');
    expect(attributes.has('domain')).toBe(false);
    // DR-391: cookie di sessione del browser, senza scadenza propria; i limiti li applica il server.
    expect(attributes.has('max-age')).toBe(false);
    expect(attributes.has('expires')).toBe(false);
  });

  it('il cookie anti-CSRF è Secure, SameSite=Lax, Path=/, senza Domain e leggibile dal client', async () => {
    const reply = await login(REDAZIONE);
    const cookie = cookieNamed(reply, CSRF_COOKIE);
    expect(cookie, 'cookie anti-CSRF assente').toBeDefined();
    const attributes = cookie!.attributes;
    expect(attributes.has('secure')).toBe(true);
    expect(attributes.get('samesite')?.toLowerCase()).toBe('lax');
    expect(attributes.get('path')).toBe('/');
    expect(attributes.has('domain')).toBe(false);
    expect(attributes.has('httponly')).toBe(false);
  });

  it('i cookie non viaggiano mai in chiaro: HTTP va a HTTPS con un redirect, senza cookie', async () => {
    const reply = await new Promise<{ status: number; location: string; cookies: number }>(
      (resolve, reject) => {
        const request = http.request(
          {
            host: '127.0.0.1',
            port: httpPort,
            method: 'POST',
            path: '/api/auth/login',
            headers: { Host: `localhost:${httpPort}` },
            agent: false,
          },
          (response) => {
            response.resume();
            resolve({
              status: response.statusCode ?? 0,
              location: String(response.headers.location ?? ''),
              cookies: (response.headers['set-cookie'] ?? []).length,
            });
          },
        );
        request.on('error', reject);
        request.end();
      },
    );
    expect([307, 308]).toContain(reply.status);
    expect(reply.location.startsWith('https://')).toBe(true);
    expect(reply.cookies).toBe(0);
  });
});

describe('CSRF a doppio invio su ogni rotta che modifica dati (controllo 7)', () => {
  it('l’elenco delle rotte esentate è quello dichiarato nel codice', () => {
    info(`rotte che modificano dati: ${SNAPSHOT_MUTATING.length}`);
    info(`rotte provate per il CSRF: ${PROTECTED_ROUTES.length}`);
    info(`rotte escluse (csrf: false): ${CSRF_EXEMPT.join('; ')}`);
    expect(csrfExemptionsInSource()).toBe(CSRF_EXEMPT.length);
    expect(PROTECTED_ROUTES.length).toBeGreaterThan(30);
  });

  it('la specifica servita da Caddy non ha rotte che modificano oltre a quelle provate', async () => {
    const reply = await call('GET', '/api/openapi.json');
    if (reply.status !== 200) {
      info('specifica non servita in produzione: elenco dalla copia versionata');
      return;
    }
    const live = mutatingRoutes(JSON.parse(reply.text) as typeof snapshotSpec);
    expect(live.filter((route) => !SNAPSHOT_MUTATING.includes(route))).toEqual([]);
    expect(SNAPSHOT_MUTATING.filter((route) => !live.includes(route))).toEqual([]);
  });

  it.each(PROTECTED_ROUTES)(
    '%s è respinta senza il token a doppio invio, con una sessione valida',
    async (route) => {
      const [method = ''] = route.split(' ');
      const target = `/api${concretePath(route)}`;
      const session = await signIn(REDAZIONE);
      const body = method === 'DELETE' ? undefined : {};

      // Solo cookie di sessione, nessun token.
      const bare = await call(method, target, { headers: { Cookie: session.sessionOnly }, body });
      // Entrambi i cookie, ma nessuna intestazione: manca la seconda metà del doppio invio.
      const noHeader = await call(method, target, { headers: { Cookie: session.cookie }, body });
      // Intestazione giusta, ma senza il cookie anti-CSRF: manca la prima metà.
      const noCookie = await call(method, target, {
        headers: { Cookie: session.sessionOnly, 'X-CSRF-Token': session.csrf },
        body,
      });
      for (const [label, reply] of [
        ['solo sessione', bare],
        ['senza intestazione', noHeader],
        ['senza cookie anti-CSRF', noCookie],
      ] as const) {
        expect(reply.status, `${route}: ${label}`).toBe(403);
        expect(errorCode(reply), `${route}: ${label}`).toBe('CSRF_TOKEN_INVALID');
      }

      // Controllo di raggiungibilità: con il token la richiesta supera il CSRF (l'esito
      // dipende da area e corpo, non dal token). Le rotte di sessione non si ripetono qui.
      if (!route.includes(' /auth/')) {
        const open = await call(method, target, { headers: session.writeHeaders, body });
        expect(errorCode(open), `${route}: con il token`).not.toBe('CSRF_TOKEN_INVALID');
      }
    },
    60_000,
  );

  it('l’accesso non pretende il token, perché non c’è ancora una sessione', async () => {
    const reply = await login(REDAZIONE);
    expect(reply.status).toBe(200);
  });
});

describe('secondo fattore attraverso Caddy (DR-384)', () => {
  it('dopo la sola password la sessione non ottiene nulla, nemmeno la scelta della veste', async () => {
    const reply = await login(REDAZIONE);
    expect(reply.status).toBe(200);
    expect(json(reply).secondFactor).toMatch(/^(activation|verification)_required$/);
    expect(json(reply).permissions).toEqual([]);
    const session = sessionFrom(reply);

    const read = await call('GET', '/api/contents', { headers: { Cookie: session.cookie } });
    expect(read.status).toBe(403);
    expect(errorCode(read)).toBe('SECOND_FACTOR_REQUIRED');

    const roles = (json(reply).rolesHeld ?? []) as { roleId: string; areas: string[] }[];
    const context = await call('POST', '/api/auth/context', {
      headers: session.writeHeaders,
      body: { roleId: roles[0]?.roleId ?? randomUUID(), area: 'redazione' },
    });
    expect(context.status).toBe(403);
    expect(errorCode(context)).toBe('SECOND_FACTOR_REQUIRED');

    // `/auth/me` resta leggibile: è da lì che l'area sa di dover chiedere il codice.
    const me = await call('GET', '/api/auth/me', { headers: { Cookie: session.cookie } });
    expect(me.status).toBe(200);
    expect(json(me).secondFactor).toBe(json(reply).secondFactor);
  });
});

// ---------------------------------------------------------------------------------------------
// 5. Nessuna enumerazione degli account
// ---------------------------------------------------------------------------------------------

describe('nessuna enumerazione degli account (controllo 9)', () => {
  const stripRequestId = (reply: Reply): unknown => {
    const body = json(reply);
    const error = { ...(body.error as Record<string, unknown> | undefined) };
    delete error.requestId;
    return { ...body, error };
  };

  it('utente inesistente e password errata: stesso stato, stesso corpo, stesse intestazioni', async () => {
    await clearAttempts();
    const ghost = await login(unknownEmail('fantasma', 0), 'password-sbagliata');
    const wrong = await login(REDAZIONE, 'password-sbagliata');
    expect(ghost.status).toBe(401);
    expect(wrong.status).toBe(ghost.status);
    expect(stripRequestId(wrong)).toEqual(stripRequestId(ghost));
    expect(wrong.setCookies).toEqual([]);
    expect(ghost.setCookies).toEqual([]);

    const names = (reply: Reply) =>
      Object.keys(reply.headers)
        .filter((name) => !['date', 'content-length', 'x-request-id'].includes(name))
        .sort();
    expect(names(wrong)).toEqual(names(ghost));
    await clearAttempts();
  });

  it('i tempi di risposta non distinguono i due casi (mediane su 9 campioni)', async () => {
    const samples = 9;
    const existing: number[] = [];
    const missing: number[] = [];
    // Scarto iniziale: la prima richiesta costruisce l'hash finto e apre la connessione al database.
    await clearAttempts();
    await login(unknownEmail('scarto', 0), 'password-sbagliata');
    await login(REDAZIONE, 'password-sbagliata');
    for (let index = 0; index < samples; index += 1) {
      // Senza fallimenti a registro il ritardo progressivo è zero e i campioni sono confrontabili.
      await clearAttempts();
      missing.push((await login(unknownEmail('tempi', index), 'password-sbagliata')).ms);
      await clearAttempts();
      existing.push((await login(REDAZIONE, 'password-sbagliata')).ms);
    }
    await clearAttempts();
    const diff = Math.abs(median(existing) - median(missing));
    info(
      `mediane (ms): inesistente ${median(missing)}, esistente ${median(existing)}, differenza ${diff}`,
    );
    // Ogni tentativo occupa almeno 350 ms uniformi, che dominano il lavoro di Argon2id (decine di
    // ms): una differenza sopra 120 ms (un terzo del minimo, più del doppio del rumore osservato
    // attraverso Docker) direbbe quale indirizzo è registrato.
    expect(diff).toBeLessThan(120);
    expect(median(missing)).toBeGreaterThanOrEqual(340);
    expect(median(existing)).toBeGreaterThanOrEqual(340);
  }, 180_000);
});

// ---------------------------------------------------------------------------------------------
// 6. Nessun indirizzo IP in chiaro a database
// ---------------------------------------------------------------------------------------------

/** Indirizzo IPv4 puntato o IPv6 (completo o compresso con «::»). */
const IPV4 = String.raw`(^|[^0-9.])([0-9]{1,3}\.){3}[0-9]{1,3}($|[^0-9.])`;
const IPV6 = String.raw`[0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}|[0-9a-f:]*::[0-9a-f:]*`;
const IP_PATTERN = `(${IPV4})|(${IPV6})`;

async function ipMatches(table: string): Promise<number> {
  const rows = await sql.unsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM ${table} t WHERE t::text ~* $1`,
    [IP_PATTERN],
  );
  return rows[0]?.n ?? 0;
}

describe('nessun indirizzo IP in chiaro nei dati dello stack', () => {
  it('l’espressione riconosce indirizzi veri e non scambia per indirizzi i campi di una riga', async () => {
    const check = async (text: string) =>
      (await sql.unsafe<{ m: boolean }[]>('SELECT $1::text ~* $2 AS m', [text, IP_PATTERN]))[0]?.m;
    for (const positive of [
      'a 203.0.113.7 b',
      '(1,"x",192.0.2.1)',
      '2001:db8::1',
      'fe80::1',
      '::ffff:10.0.0.1',
      '2001:0db8:0000:0000:0000:0000:0000:0001',
    ]) {
      expect(await check(positive), positive).toBe(true);
    }
    for (const negative of [
      '(a1b2c3d4-0000-4000-8000-000000000000,2026-11-08 10:00:00.123+00,"\\x9f8e7d6c")',
      '{"reason": "invalid_credentials"}',
      'prova-sicurezza-1f',
      '1.2.3',
    ]) {
      expect(await check(negative), negative).toBe(false);
    }
  });

  it('dopo accessi riusciti e falliti e una compilazione di form, sessions, audit_log e form_submissions non hanno IP', async () => {
    await clearAttempts();
    // Traffico: accessi riusciti, fallimenti (anche con indirizzi falsificati) e un form pubblico.
    await signIn(REDAZIONE);
    await login(REDAZIONE, 'password-sbagliata');
    await login(unknownEmail('dati', 0), 'qualunque', { 'X-Forwarded-For': '203.0.113.77' });
    const submitted = await call('POST', `/forms/${FORM_SLUG}/submissions`, {
      headers: { 'X-Forwarded-For': '203.0.113.78' },
      body: {
        values: { messaggio: 'compilazione sintetica' },
        honeypot: '',
        startedAt: Date.now() - 10_000,
      },
    });
    expect(
      submitted.status,
      `la compilazione del form deve riuscire senza token CSRF; errori dell'API: ${submitted.status === 200 ? '' : apiErrorMessages()}`,
    ).toBe(200);

    if (MUTAZIONE === 'dati') {
      await sql`UPDATE audit_log SET detail = ${sql.json({ ip: '203.0.113.7' })}
        WHERE id = (SELECT max(id) FROM audit_log)`;
    }

    const counts: Record<string, { rows: number; matches: number }> = {};
    for (const table of ['sessions', 'audit_log', 'form_submissions']) {
      const total = await sql.unsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${table}`);
      counts[table] = { rows: total[0]?.n ?? 0, matches: await ipMatches(table) };
    }
    info(`corrispondenze IP (righe esaminate / righe con un indirizzo): ${JSON.stringify(counts)}`);

    // Il controllo non è vuoto: le tre tabelle hanno righe, e gli indirizzi sono digest.
    for (const [table, count] of Object.entries(counts)) {
      expect(count.rows, `${table} senza righe: la prova non proverebbe nulla`).toBeGreaterThan(0);
      expect(count.matches, `${table}: righe con un indirizzo IP in chiaro`).toBe(0);
    }
    const hashed = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM form_submissions WHERE ip_hash IS NOT NULL`;
    expect(hashed[0]?.n).toBeGreaterThan(0);

    // Diagnostica: le altre tabelle, solo conteggi, senza valori. Non è una prova.
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('sessions', 'audit_log', 'form_submissions')
      ORDER BY table_name`;
    const others: Record<string, number> = {};
    for (const { table_name } of tables) {
      const n = await ipMatches(`"${table_name}"`);
      if (n > 0) others[table_name] = n;
    }
    info(`altre tabelle con corrispondenze (solo conteggi): ${JSON.stringify(others)}`);
    const equivalent = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name ILIKE '%attempt%'`;
    info(`tabelle dei tentativi di accesso: ${equivalent.length} (il conteggio sta in audit_log)`);
  }, 120_000);
});
