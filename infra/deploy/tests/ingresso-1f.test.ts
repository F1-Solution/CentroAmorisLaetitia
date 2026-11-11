import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import http2 from 'node:http2';
import https from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Ingresso comune di produzione e staging (1F-W5 T2a, DR-409).
 *
 * Un terzo progetto Compose (`infra/deploy/ingresso/`) è l'unico a pubblicare 80, 443 e 443/udp,
 * tiene i certificati e inoltra per nome al Caddy di ciascun ambiente su due reti separate.
 * Le prove leggono il Compose con `docker compose config` e avviano Caddy sull'immagine fissata:
 * due ambienti (con il loro `Caddyfile`), ciascuno con un finto sito/area/API che riporta le
 * intestazioni ricevute, e l'ingresso davanti, con i nomi `*.localhost` (certificato interno).
 *
 * **Nessun dato reale**: nessun contenitore vede un database o un archivio, nessun ACME vero.
 */

const deployDir = path.resolve(import.meta.dirname, '..');
const ingressDir = path.join(deployDir, 'ingresso');
const composeFile = path.join(ingressDir, 'compose.yml');
const MIB = 1024 ** 2;
const GIB = 1024 ** 3;

const STAGING_NAME = 'staging.localhost';
const PRODUCTION_NAME = 'amoris.localhost';
const ACME_STAGING_URL = 'https://acme-staging-v02.api.letsencrypt.org/directory';
// Sottoreti delle prove: fuori da quelle del server (10.77.84-89).
const INGRESS_STAGING_SUBNET = '10.214.91.0/24';
const INGRESS_PRODUCTION_SUBNET = '10.214.92.0/24';

const caddyImage = (() => {
  const match = /^\s+image: (caddy:\S+)$/m.exec(
    readFileSync(path.join(deployDir, 'compose.yml'), 'utf8'),
  );
  if (!match?.[1]) throw new Error('immagine di Caddy non trovata nel Compose degli ambienti');
  return match[1];
})();

function run(args: string[]): string {
  const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 300_000 });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

const workDir = mkdtempSync(path.join(tmpdir(), 'amoris-ingresso-'));
let envFiles = 0;

/** Ambiente sintetico dell'ingresso; ogni prova ne toglie o cambia una parte. */
const INGRESS_ENV: Readonly<Record<string, string>> = {
  INGRESS_ACME_CA: ACME_STAGING_URL,
  INGRESS_PRODUCTION_SUBNET,
  INGRESS_STAGING_SUBNET,
  INGRESS_STAGING_NAME: 'prova.esempio.invalid',
  INGRESS_PRODUCTION_NAME: '',
};

function compose(env: Readonly<Record<string, string>>, args: string[]) {
  const envFile = path.join(workDir, `ingresso-${envFiles++}.env`);
  writeFileSync(
    envFile,
    Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
  const cleanEnv = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => !/^(INGRESS_|COMPOSE_)/i.test(entry[0]) && !!entry[1],
    ),
  );
  return spawnSync('docker', ['compose', '-f', composeFile, '--env-file', envFile, ...args], {
    cwd: ingressDir,
    env: cleanEnv,
    encoding: 'utf8',
    timeout: 60_000,
  });
}

interface IngressService {
  image: string;
  ports?: { target: number; published: string; protocol: string }[];
  networks?: Record<string, unknown>;
  mem_limit?: string | number;
  environment?: Record<string, string>;
  cap_drop?: string[];
  cap_add?: string[];
  security_opt?: string[];
  restart?: string;
  logging?: { driver?: string; options?: Record<string, string> };
  healthcheck?: { test?: string[] };
}

interface IngressConfig {
  name: string;
  services: Record<string, IngressService>;
  networks: Record<
    string,
    { internal?: boolean; name?: string; ipam?: { config?: { subnet?: string }[] } }
  >;
}

function config(env: Readonly<Record<string, string>> = INGRESS_ENV): IngressConfig {
  const result = compose(env, ['config', '--format', 'json']);
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout) as IngressConfig;
}

describe('Compose dell’ingresso (DR-409)', () => {
  const ingress = () => config().services.ingresso;

  it('è un progetto a parte, con un solo servizio', () => {
    const resolved = config();
    expect(resolved.name).toBe('amoris-ingresso');
    expect(Object.keys(resolved.services)).toEqual(['ingresso']);
  });

  it.each(['INGRESS_ACME_CA', 'INGRESS_PRODUCTION_SUBNET', 'INGRESS_STAGING_SUBNET'])(
    'senza %s il Compose non parte e la nomina',
    (key) => {
      const env = Object.fromEntries(Object.entries(INGRESS_ENV).filter(([name]) => name !== key));
      const result = compose(env, ['config', '--quiet']);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(key);
    },
  );

  it('pubblica 80, 443 e 443/udp, e nient’altro', () => {
    const ports = (ingress()?.ports ?? [])
      .map((port) => `${port.published}:${port.target}/${port.protocol}`)
      .sort();
    expect(ports).toEqual(['443:443/tcp', '443:443/udp', '80:80/tcp']);
  });

  it('usa la stessa immagine di Caddy fissata per digest degli ambienti', () => {
    expect(ingress()?.image).toBe(caddyImage);
    expect(ingress()?.image).toMatch(/@sha256:[0-9a-f]{64}$/);
  });

  it('è su edge (con uscita) e sulle due reti interne, una per ambiente, con sottoreti fisse diverse', () => {
    const resolved = config();
    expect(Object.keys(resolved.services.ingresso?.networks ?? {}).sort()).toEqual([
      'edge',
      'produzione',
      'staging',
    ]);
    expect(resolved.networks.edge?.internal).not.toBe(true);
    expect(resolved.networks.produzione?.internal).toBe(true);
    expect(resolved.networks.staging?.internal).toBe(true);
    expect(resolved.networks.produzione?.name).toBe('amoris-ingresso-production');
    expect(resolved.networks.staging?.name).toBe('amoris-ingresso-staging');
    expect(resolved.networks.produzione?.ipam?.config?.[0]?.subnet).toBe(INGRESS_PRODUCTION_SUBNET);
    expect(resolved.networks.staging?.ipam?.config?.[0]?.subnet).toBe(INGRESS_STAGING_SUBNET);
    expect(INGRESS_PRODUCTION_SUBNET).not.toBe(INGRESS_STAGING_SUBNET);
    expect(Object.keys(resolved.networks)).not.toContain('backup-out');
  });

  it('ha memoria limitata a 128 MiB e lascia produzione + staging + ingresso a 7168 MiB, entro 7 GiB', () => {
    const limit = ingress()?.mem_limit;
    const bytes = Number(limit);
    expect(bytes).toBe(128 * MIB);
    // 7040 MiB sono produzione (con il backup) e staging, fissati da compose-1f.
    const total = 7040 * MIB + bytes;
    expect(total).toBe(7168 * MIB);
    expect(total).toBeLessThanOrEqual(7 * GIB);
  });

  it('è indurito come il Caddy degli ambienti e ha un controllo di salute interno', () => {
    const service = ingress();
    expect(service?.cap_drop).toEqual(['ALL']);
    expect(service?.cap_add).toEqual(['NET_BIND_SERVICE']);
    expect(service?.security_opt).toEqual(['no-new-privileges:true']);
    expect(service?.restart).toBe('unless-stopped');
    expect(service?.logging?.driver).toBe('json-file');
    expect(service?.logging?.options).toEqual({ 'max-size': '10m', 'max-file': '5' });
    expect(service?.healthcheck?.test?.[0]).toBe('CMD');
  });

  it('la directory ACME viene dalla variabile, senza indirizzo e-mail', () => {
    const service = ingress();
    expect(service?.environment?.ACME_CA).toBe(ACME_STAGING_URL);
    const text =
      readFileSync(composeFile, 'utf8') + readFileSync(path.join(ingressDir, 'Caddyfile'), 'utf8');
    expect(text).not.toMatch(/^\s*email\s/m);
    expect(text).not.toMatch(/ACME_EMAIL/i);
  });

  it('con il nome della produzione vuoto il sito della produzione è disattivato, con il nome è attivo', () => {
    expect(ingress()?.environment?.INGRESS_PRODUCTION_SITE ?? '').toBe('');
    expect(ingress()?.environment?.INGRESS_STAGING_SITE).toBe('staging');
    const active = config({ ...INGRESS_ENV, INGRESS_PRODUCTION_NAME: 'www.esempio.invalid' });
    expect(active.services.ingresso?.environment?.INGRESS_PRODUCTION_SITE).toBe('produzione');
    expect(active.services.ingresso?.environment?.INGRESS_PRODUCTION_NAME).toBe(
      'www.esempio.invalid',
    );
  });
});

describe('esempio d’ambiente dell’ingresso', () => {
  const examplePath = path.join(ingressDir, 'ingresso.env.example');
  const text = () => readFileSync(examplePath, 'utf8');

  it('esiste ed è tracciato da Git', () => {
    const ignored = spawnSync('git', ['check-ignore', '-q', examplePath], { cwd: deployDir });
    expect(ignored.status, 'l’esempio è escluso da .gitignore').toBe(1);
  });

  it('contiene ogni variabile del Compose; le obbligatorie sono righe attive e vuote', () => {
    const compose = readFileSync(composeFile, 'utf8');
    const names = new Set(
      [...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)[:}]/g)].map((match) => match[1] ?? ''),
    );
    const required = new Set(
      [...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*):\?/g)].map((match) => match[1] ?? ''),
    );
    expect(required.size).toBe(3);
    const lines = text().split(/\r?\n/);
    for (const name of names) {
      const line = lines.find((candidate) => new RegExp('^#?\\s*' + name + '=').test(candidate));
      expect(line, name).toBeDefined();
      if (required.has(name)) expect(line, name).toBe(name + '=');
    }
  });

  it('documenta le due directory ACME (prova e vera) e non chiede un indirizzo e-mail', () => {
    expect(text()).toContain('https://acme-staging-v02.api.letsencrypt.org/directory');
    expect(text()).toContain('https://acme-v02.api.letsencrypt.org/directory');
    expect(text()).not.toMatch(/^[^#\r\n]*(EMAIL|@)/im);
  });

  it('non contiene valori che somiglino a segreti', () => {
    const suspicious = text()
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=[A-Za-z0-9+/=_-]{24,}$/.test(line));
    expect(suspicious).toEqual([]);
  });
});

describe('Caddyfile dell’ingresso: nomi vuoti, nessun certificato (DR-409)', () => {
  function adapt(extraEnv: Readonly<Record<string, string>>): string {
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '-e',
        `ACME_CA=${ACME_STAGING_URL}`,
        ...Object.entries(extraEnv).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
        '-v',
        `${path.join(ingressDir, 'Caddyfile')}:/etc/caddy/Caddyfile:ro`,
        '-v',
        `${path.join(ingressDir, 'siti')}:/etc/caddy/siti:ro`,
        caddyImage,
        'caddy',
        'adapt',
        '--config',
        '/etc/caddy/Caddyfile',
      ],
      { encoding: 'utf8', timeout: 120_000 },
    );
    if (result.status !== 0) throw new Error(result.stderr);
    return result.stdout;
  }

  /** Nomi dei siti pubblici della configurazione adattata (il controllo di salute su 127.0.0.1 è escluso). */
  function publicHosts(json: string): string[] {
    const hosts = [...json.matchAll(/"host":\[([^\]]*)\]/g)].flatMap((match) =>
      (match[1] ?? '').split(',').map((name) => name.replaceAll('"', '')),
    );
    return hosts.filter((name) => name !== '127.0.0.1');
  }

  it('con il nome della produzione vuoto la configurazione non ha né sito né politica per quel nome', () => {
    const json = adapt({
      INGRESS_STAGING_NAME: 'prova.esempio.invalid',
      INGRESS_STAGING_SITE: 'staging',
      INGRESS_PRODUCTION_NAME: '',
      INGRESS_PRODUCTION_SITE: '',
    });
    expect(json).toContain('prova.esempio.invalid');
    expect(json).not.toContain('produzione');
    expect(json).not.toContain('amoris-production-caddy');
    // Un solo sito pubblico: nessun host vuoto o di riserva.
    expect(publicHosts(json)).toEqual(['prova.esempio.invalid']);
  });

  it('con il nome della produzione valorizzato la configurazione ha i due siti', () => {
    const json = adapt({
      INGRESS_STAGING_NAME: 'prova.esempio.invalid',
      INGRESS_STAGING_SITE: 'staging',
      INGRESS_PRODUCTION_NAME: 'www.esempio.invalid',
      INGRESS_PRODUCTION_SITE: 'produzione',
    });
    expect(json).toContain('prova.esempio.invalid');
    expect(json).toContain('www.esempio.invalid');
    expect(json).toContain('amoris-production-caddy');
    expect(json).toContain('amoris-staging-caddy');
  });

  it('senza il nome dello staging resta solo la produzione, e senza nessun nome nessun sito', () => {
    const none = adapt({ INGRESS_STAGING_SITE: '', INGRESS_PRODUCTION_SITE: '' });
    expect(publicHosts(none)).toEqual([]);
  });

  it('senza la directory ACME Caddy non parte', () => {
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${path.join(ingressDir, 'Caddyfile')}:/etc/caddy/Caddyfile:ro`,
        '-v',
        `${path.join(ingressDir, 'siti')}:/etc/caddy/siti:ro`,
        caddyImage,
        'caddy',
        'adapt',
        '--config',
        '/etc/caddy/Caddyfile',
      ],
      { encoding: 'utf8', timeout: 120_000 },
    );
    expect(result.status).not.toBe(0);
  });
});

describe('nomi pubblici validati prima dell’avvio di Caddy', () => {
  const started: string[] = [];
  let nameRuns = 0;
  afterAll(() => {
    if (started.length > 0) spawnSync('docker', ['rm', '-f', '-v', ...started]);
  });

  /** Comando del servizio come lo risolve il Compose (controllo dei nomi, poi Caddy). */
  function ingressCommand(): string[] {
    const command = (config().services.ingresso as { command?: string[] } | undefined)?.command;
    expect(command, 'il Compose non ha un comando che valida i nomi').toBeDefined();
    // `config` lascia i `$` raddoppiati come nel file; il Compose vero li riduce a uno solo.
    return (command ?? []).map((part) => part.replaceAll('$$', '$'));
  }

  const dockerArgs = (names: { staging: string; production: string }): string[] => [
    '-e',
    `ACME_CA=${ACME_STAGING_URL}`,
    '-e',
    `INGRESS_STAGING_NAME=${names.staging}`,
    '-e',
    `INGRESS_STAGING_SITE=${names.staging ? 'staging' : ''}`,
    '-e',
    `INGRESS_PRODUCTION_NAME=${names.production}`,
    '-e',
    `INGRESS_PRODUCTION_SITE=${names.production ? 'produzione' : ''}`,
    '-v',
    `${path.join(ingressDir, 'Caddyfile')}:/etc/caddy/Caddyfile:ro`,
    '-v',
    `${path.join(ingressDir, 'siti')}:/etc/caddy/siti:ro`,
    caddyImage,
    ...ingressCommand(),
  ];

  it.each([
    ['INGRESS_STAGING_NAME', 'http://prova.esempio.invalid'],
    ['INGRESS_STAGING_NAME', 'prova.esempio.invalid:8443'],
    ['INGRESS_STAGING_NAME', 'a.esempio.invalid,b.esempio.invalid'],
    ['INGRESS_STAGING_NAME', '*.esempio.invalid'],
    ['INGRESS_STAGING_NAME', '-prova.esempio.invalid'],
    ['INGRESS_STAGING_NAME', '.esempio.invalid'],
    ['INGRESS_STAGING_NAME', 'Prova.esempio.invalid'],
    ['INGRESS_STAGING_NAME', 'prova esempio.invalid'],
    ['INGRESS_PRODUCTION_NAME', 'https://www.esempio.invalid'],
    ['INGRESS_PRODUCTION_NAME', 'www.esempio.invalid:443'],
    ['INGRESS_PRODUCTION_NAME', '*.esempio.invalid'],
    ['INGRESS_PRODUCTION_NAME', 'www.esempio.invalid/percorso'],
  ])('%s = «%s» impedisce l’avvio con un messaggio chiaro', (variable, value) => {
    const names = { staging: 'prova.esempio.invalid', production: '' };
    if (variable === 'INGRESS_STAGING_NAME') names.staging = value;
    else names.production = value;
    // Nome fisso: se l'avvio non fallisce, il contenitore si rimuove per nome e non resta in esecuzione.
    const name = `amoris-ingresso-nomi-${process.pid}-${nameRuns++}`;
    started.push(name);
    const result = spawnSync('docker', ['run', '--name', name, ...dockerArgs(names)], {
      encoding: 'utf8',
      timeout: 20_000,
    });
    spawnSync('docker', ['rm', '-f', '-v', name]);
    expect(result.status, result.stderr).toBe(64);
    expect(result.stderr).toContain(variable);
    expect(result.stderr).not.toMatch(/serving initial configuration|"level"/);
  });

  async function startsWith(names: { staging: string; production: string }): Promise<string> {
    const id = run(['run', '-d', ...dockerArgs(names)]);
    started.push(id);
    const deadline = Date.now() + 30_000;
    for (;;) {
      const logs = spawnSync('docker', ['logs', id], { encoding: 'utf8' });
      const text = `${logs.stdout}${logs.stderr}`;
      if (/serving initial configuration/.test(text)) return 'avviato';
      const state = run(['inspect', '-f', '{{.State.Running}}', id]);
      if (state !== 'true' || Date.now() > deadline) return `non avviato: ${text.slice(-400)}`;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  it('un nome valido e il nome vuoto non impediscono l’avvio', async () => {
    expect(await startsWith({ staging: 'prova.localhost', production: '' })).toBe('avviato');
    expect(await startsWith({ staging: '', production: '' })).toBe('avviato');
    expect(await startsWith({ staging: 'a-1.prova.localhost', production: 'b.localhost' })).toBe(
      'avviato',
    );
  }, 120_000);

  it('conserva il comando predefinito dell’immagine dopo il controllo', () => {
    const text = ingressCommand().join(' ');
    expect(text).toMatch(/exec caddy run --config \/etc\/caddy\/Caddyfile --adapter caddyfile/);
  });
});

/** Finto sito, area e API di un ambiente: riportano l'etichetta dell'ambiente e le intestazioni ricevute. */
function fakeUpstreams(label: string): string {
  return `{
	admin off
}
:3000 {
	header X-Robots-Tag "all"
	respond "${label} web {path} xff=[{header.X-Forwarded-For}] proto=[{header.X-Forwarded-Proto}] host=[{host}] xri=[{header.X-Real-IP}] fwd=[{header.Forwarded}] xfh=[{header.X-Forwarded-Host}]"
}
:3001 {
	respond "${label} admin {path}"
}
:3002 {
	respond "${label} api {path}"
}
`;
}

describe('attraverso l’ingresso', () => {
  const started: string[] = [];
  const networks: string[] = [];
  const tag = `amoris-ingresso-t2a-${process.pid}`;
  const net = (name: string) => `${tag}-${name}`;
  const USER = 'redattore-prova';
  const PASSWORD = 'password-sintetica-di-prova';
  let httpPort = 0;
  let httpsPort = 0;
  let ingressId = '';
  let rootCa = '';
  let envStaging = '';
  let envProduction = '';

  const basic = (user: string, password: string) => ({
    authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
  });
  const STAGING_AUTH = basic(USER, PASSWORD);

  function hostPort(id: string, containerPort: string): number {
    const match = /:(\d+)\s*$/m.exec(run(['port', id, containerPort]));
    if (!match?.[1]) throw new Error(`porta ${containerPort} non trovata`);
    return Number(match[1]);
  }

  function startEnvCaddy(
    label: string,
    appNet: string,
    ingressNet: string,
    ingressSubnet: string,
    siteAddress: string,
    extra: string[] = [],
  ): string {
    const id = run([
      'run',
      '-d',
      '--network',
      appNet,
      '--network-alias',
      `env-${label}`,
      '-e',
      `AMORIS_ENV=${label}`,
      '-e',
      `CADDY_SITE_ADDRESS=${siteAddress}`,
      '-e',
      `INGRESS_SUBNET=${ingressSubnet}`,
      ...extra,
      '-v',
      `${path.join(deployDir, 'caddy')}:/etc/caddy:ro`,
      caddyImage,
    ]);
    started.push(id);
    run(['network', 'connect', '--alias', `amoris-${label}-caddy`, ingressNet, id]);
    return id;
  }

  function startFake(label: string, appNet: string, dir: string): void {
    const fake = path.join(dir, label);
    run(['network', 'inspect', appNet]);
    writeFileSync(`${fake}.caddy`, fakeUpstreams(label));
    started.push(
      run([
        'run',
        '-d',
        '--network',
        appNet,
        '--network-alias',
        'web',
        '--network-alias',
        'admin',
        '--network-alias',
        'api',
        '-v',
        `${fake}.caddy:/etc/caddy/Caddyfile:ro`,
        caddyImage,
      ]),
    );
  }

  beforeAll(async () => {
    const hash = run([
      'run',
      '--rm',
      caddyImage,
      'caddy',
      'hash-password',
      '--plaintext',
      PASSWORD,
    ]);
    for (const [name, subnet] of [
      ['edge', ''],
      ['app-staging', ''],
      ['app-production', ''],
      ['ingresso-staging', INGRESS_STAGING_SUBNET],
      ['ingresso-production', INGRESS_PRODUCTION_SUBNET],
    ] as const) {
      spawnSync('docker', ['network', 'rm', net(name)]);
      // Le reti dell'ingresso sono `internal` come nel Compose: senza, l'isolamento provato non sarebbe quello vero.
      run(['network', 'create', ...(subnet ? ['--internal', '--subnet', subnet] : []), net(name)]);
      networks.push(net(name));
    }
    startFake('staging', net('app-staging'), workDir);
    startFake('production', net('app-production'), workDir);
    envStaging = startEnvCaddy(
      'staging',
      net('app-staging'),
      net('ingresso-staging'),
      INGRESS_STAGING_SUBNET,
      STAGING_NAME,
      ['-e', `STAGING_BASIC_AUTH_USER=${USER}`, '-e', `STAGING_BASIC_AUTH_HASH=${hash}`],
    );
    envProduction = startEnvCaddy(
      'production',
      net('app-production'),
      net('ingresso-production'),
      INGRESS_PRODUCTION_SUBNET,
      PRODUCTION_NAME,
    );
    // `edge` per prima: la rete delle porte pubblicate, da cui arriva l'indirizzo del client.
    ingressId = run([
      'run',
      '-d',
      '--network',
      net('edge'),
      '--network-alias',
      STAGING_NAME,
      '--network-alias',
      PRODUCTION_NAME,
      '-p',
      '127.0.0.1::80',
      '-p',
      '127.0.0.1::443',
      '-e',
      `ACME_CA=${ACME_STAGING_URL}`,
      '-e',
      `INGRESS_STAGING_NAME=${STAGING_NAME}`,
      '-e',
      'INGRESS_STAGING_SITE=staging',
      '-e',
      `INGRESS_PRODUCTION_NAME=${PRODUCTION_NAME}`,
      '-e',
      'INGRESS_PRODUCTION_SITE=produzione',
      '-v',
      `${path.join(ingressDir, 'Caddyfile')}:/etc/caddy/Caddyfile:ro`,
      '-v',
      `${path.join(ingressDir, 'siti')}:/etc/caddy/siti:ro`,
      caddyImage,
    ]);
    started.push(ingressId);
    run(['network', 'connect', net('ingresso-staging'), ingressId]);
    run(['network', 'connect', net('ingresso-production'), ingressId]);
    httpPort = hostPort(ingressId, '80/tcp');
    httpsPort = hostPort(ingressId, '443/tcp');
    const deadline = Date.now() + 40_000;
    for (;;) {
      const result = spawnSync(
        'docker',
        ['exec', ingressId, 'cat', '/data/caddy/pki/authorities/local/root.crt'],
        { encoding: 'utf8' },
      );
      if (result.status === 0 && result.stdout.includes('BEGIN CERTIFICATE')) {
        rootCa = result.stdout;
        break;
      }
      if (Date.now() > deadline) throw new Error('certificato radice interno non creato');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }, 180_000);

  afterAll(() => {
    if (started.length > 0) spawnSync('docker', ['rm', '-f', '-v', ...started]);
    for (const name of networks) spawnSync('docker', ['network', 'rm', name]);
  });

  interface Answer {
    status: number;
    headers: http2.IncomingHttpHeaders;
    body: string;
  }

  /** Richiesta HTTP/2 al nome indicato (SNI), con la radice interna dell'ingresso come fiducia. */
  async function h2(
    host: string,
    pathname: string,
    headers: Record<string, string> = {},
  ): Promise<Answer> {
    const deadline = Date.now() + 20_000;
    for (;;) {
      try {
        const result = await new Promise<Answer>((resolve, reject) => {
          const client = http2.connect(`https://${host}:${httpsPort}`, {
            ca: rootCa,
            servername: host,
            lookup: (_host, options, callback) => {
              if ((options as { all?: boolean }).all)
                callback(null, [{ address: '127.0.0.1', family: 4 }]);
              else callback(null, '127.0.0.1', 4);
            },
          });
          client.on('error', reject);
          const request = client.request({ ':path': pathname, ...headers });
          let body = '';
          let responseHeaders: http2.IncomingHttpHeaders = {};
          request.setEncoding('utf8');
          request.on('response', (h) => (responseHeaders = h));
          request.on('data', (chunk: string) => (body += chunk));
          request.on('end', () => {
            client.close();
            resolve({ status: Number(responseHeaders[':status']), headers: responseHeaders, body });
          });
          request.on('error', reject);
          request.end();
        });
        // All'avvio i Caddy degli ambienti possono non essere ancora pronti.
        if (result.status !== 502 || Date.now() > deadline) return result;
      } catch (error) {
        if (Date.now() > deadline) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  it('instrada per nome: ogni nome arriva solo al proprio ambiente', async () => {
    expect((await h2(STAGING_NAME, '/chi-siamo/', STAGING_AUTH)).body).toMatch(
      /^staging web \/chi-siamo\//,
    );
    expect((await h2(PRODUCTION_NAME, '/chi-siamo/')).body).toMatch(
      /^production web \/chi-siamo\//,
    );
    expect((await h2(PRODUCTION_NAME, '/admin/contenuti')).body).toBe(
      'production admin /admin/contenuti',
    );
    expect((await h2(PRODUCTION_NAME, '/api/auth/me')).body).toBe('production api /auth/me');
    expect((await h2(PRODUCTION_NAME, '/media/a.jpg')).body).toBe('production api /media/a.jpg');
    expect((await h2(PRODUCTION_NAME, '/forms/c/submissions')).body).toBe(
      'production api /forms/c/submissions',
    );
  });

  it('HTTP/2 con un certificato valido per il nome e intestazioni di sicurezza di entrambi gli ambienti', async () => {
    for (const [host, headers] of [
      [PRODUCTION_NAME, {}],
      [STAGING_NAME, STAGING_AUTH],
    ] as const) {
      const answer = await h2(host, '/', headers);
      expect(answer.status, host).toBe(200);
      expect(answer.headers['x-content-type-options'], host).toBe('nosniff');
      expect(answer.headers['x-frame-options'], host).toBe('SAMEORIGIN');
      expect(answer.headers['referrer-policy'], host).toBe('strict-origin-when-cross-origin');
      expect(answer.headers['content-security-policy-report-only'], host).toContain(
        "default-src 'self'",
      );
      expect(String(answer.headers['permissions-policy']), host).toContain('camera=()');
      expect(answer.headers.server, host).toBeUndefined();
      const hsts = String(answer.headers['strict-transport-security'] ?? '');
      const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1]);
      expect(maxAge, host).toBeGreaterThan(0);
      expect(maxAge, host).toBeLessThanOrEqual(86_400);
      expect(hsts, host).not.toMatch(/preload|includeSubDomains/i);
    }
    expect((await h2(PRODUCTION_NAME, '/admin/')).headers['x-robots-tag']).toBe(
      'noindex, nofollow',
    );
  });

  it('HTTP risponde con un redirect permanente a HTTPS', async () => {
    for (const host of [PRODUCTION_NAME, STAGING_NAME]) {
      // `fetch` ignora l'intestazione Host: serve node:http.
      const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
        http
          .get(
            { host: '127.0.0.1', port: httpPort, path: '/chi-siamo/?a=1', headers: { Host: host } },
            resolve,
          )
          .on('error', reject);
      });
      response.resume();
      expect(response.statusCode, host).toBe(308);
      expect(response.headers.location, host).toBe(`https://${host}/chi-siamo/?a=1`);
    }
  });

  it('staging: senza password ogni percorso risponde 401, anche attraverso l’ingresso', async () => {
    for (const pathname of [
      '/',
      '/chi-siamo/',
      '/admin',
      '/admin/contenuti',
      '/api/openapi.json',
      '/api/health/live',
      '/api/auth/me',
      '/media/x',
      '/forms/contatti/submissions',
      '/robots.txt',
    ]) {
      const answer = await h2(STAGING_NAME, pathname);
      expect(answer.status, pathname).toBe(401);
      expect(String(answer.headers['www-authenticate']), pathname).toMatch(/^Basic/i);
      expect(answer.body, pathname).not.toMatch(/^(staging|production) /);
    }
    for (const headers of [basic(USER, 'sbagliata'), basic('altro', PASSWORD)]) {
      expect((await h2(STAGING_NAME, '/', headers)).status).toBe(401);
    }
  });

  it('staging: robots.txt rifiuta, X-Robots-Tag noindex, specifica e salute 404', async () => {
    const robots = await h2(STAGING_NAME, '/robots.txt', STAGING_AUTH);
    expect(robots.status).toBe(200);
    expect(robots.body).toMatch(/Disallow: \//);
    expect(robots.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect((await h2(STAGING_NAME, '/', STAGING_AUTH)).headers['x-robots-tag']).toBe(
      'noindex, nofollow',
    );
    for (const pathname of ['/api/openapi.json', '/api/health', '/api/health/ready']) {
      const answer = await h2(STAGING_NAME, pathname, STAGING_AUTH);
      expect(answer.status, pathname).toBe(404);
      expect(answer.body, pathname).not.toMatch(/^staging api /);
    }
  });

  it('produzione: nessuna password, robots.txt dal sito, specifica e salute 404', async () => {
    const home = await h2(PRODUCTION_NAME, '/');
    expect(home.status).toBe(200);
    expect(home.headers['www-authenticate']).toBeUndefined();
    expect(home.headers['x-robots-tag']).toBe('all');
    for (const pathname of ['/api/openapi.json', '/api/health', '/api/health/live']) {
      expect((await h2(PRODUCTION_NAME, pathname)).status, pathname).toBe(404);
    }
  });

  it('indirizzo del visitatore: con le intestazioni falsificate l’applicazione riceve una sola voce, quella vera', async () => {
    const forged = {
      'x-forwarded-for': '6.6.6.6, 7.7.7.7',
      'x-real-ip': '9.9.9.9',
      forwarded: 'for=8.8.8.8;proto=http',
      'x-forwarded-proto': 'http',
      'x-forwarded-host': 'falso.example',
    };
    const answer = await h2(PRODUCTION_NAME, '/eco', forged);
    expect(answer.status).toBe(200);
    expect(answer.body).not.toMatch(/6\.6\.6\.6|7\.7\.7\.7|9\.9\.9\.9|8\.8\.8\.8|falso/);
    const xff = /xff=\[([^\]]*)\]/.exec(answer.body)?.[1] ?? '';
    // Una sola voce, un indirizzo, e non quello dell'ingresso né della rete tra ingresso e ambiente.
    expect(xff).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(xff.startsWith('10.214.')).toBe(false);
    expect(answer.body).toContain('proto=[https]');
    expect(answer.body).toContain(`host=[${PRODUCTION_NAME}]`);
    expect(answer.body).toContain('xri=[]');
    expect(answer.body).toContain('fwd=[]');
  });

  it('indirizzo del visitatore: un client con indirizzo noto compare tale e quale, e solo lui', () => {
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        net('edge'),
        caddyImage,
        'sh',
        '-c',
        `hostname -i; wget -q -O- --no-check-certificate --header 'X-Forwarded-For: 6.6.6.6, 7.7.7.7' --header 'X-Real-IP: 9.9.9.9' https://${PRODUCTION_NAME}/eco`,
      ],
      { encoding: 'utf8', timeout: 60_000 },
    );
    expect(result.status, result.stderr).toBe(0);
    const [clientIp, body = ''] = result.stdout.trim().split('\n');
    expect(clientIp).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(/xff=\[([^\]]*)\]/.exec(body)?.[1]).toBe(clientIp?.trim());
    expect(body).toContain('proto=[https]');
  });

  it('da fuori della rete dell’ingresso il Caddy dell’ambiente non accetta un indirizzo imposto', () => {
    const result = spawnSync(
      'docker',
      [
        'run',
        '--rm',
        '--network',
        net('app-production'),
        caddyImage,
        'sh',
        '-c',
        `hostname -i; wget -q -O- --header 'Host: ${PRODUCTION_NAME}' --header 'X-Forwarded-For: 6.6.6.6' --header 'X-Forwarded-Proto: https' http://env-production/eco`,
      ],
      { encoding: 'utf8', timeout: 60_000 },
    );
    expect(result.status, result.stderr).toBe(0);
    const [clientIp, body = ''] = result.stdout.trim().split('\n');
    expect(/xff=\[([^\]]*)\]/.exec(body)?.[1]).toBe(clientIp?.trim());
    expect(body).not.toContain('6.6.6.6');
    expect(body).toContain('proto=[http]');
  });

  it('indirizzo del visitatore: Connection con X-Forwarded-For o Forwarded non toglie l’indirizzo vero', async () => {
    for (const connection of [
      'X-Forwarded-For, X-Real-IP',
      'Forwarded',
      'close, X-Forwarded-For',
    ]) {
      const body = await new Promise<string>((resolve, reject) => {
        const request = https.request(
          {
            host: '127.0.0.1',
            port: httpsPort,
            path: '/eco',
            servername: PRODUCTION_NAME,
            ca: rootCa,
            agent: false,
            headers: {
              Host: PRODUCTION_NAME,
              Connection: connection,
              'X-Forwarded-For': '6.6.6.6',
              Forwarded: 'for=8.8.8.8',
            },
          },
          (response) => {
            let text = '';
            response.setEncoding('utf8');
            response.on('data', (chunk: string) => (text += chunk));
            response.on('end', () => resolve(text));
          },
        );
        request.on('error', reject);
        request.end();
      });
      const xff = /xff=\[([^\]]*)\]/.exec(body)?.[1] ?? '';
      expect(body, connection).not.toMatch(/6\.6\.6\.6|8\.8\.8\.8/);
      expect(xff, connection).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      expect(xff.startsWith('10.214.'), connection).toBe(false);
      expect(body, connection).toContain('fwd=[]');
    }
  });

  /** Dal contenitore, `wget` verso il nome: l'isolamento vale solo se il nome non si risolve o la connessione non si apre. */
  function assertUnreachable(from: string, other: string): void {
    const state = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', from], {
      encoding: 'utf8',
    });
    expect(state.stdout.trim(), `${from} non è in esecuzione`).toBe('true');
    const result = spawnSync(
      'docker',
      ['exec', from, 'wget', '-q', '-T', '3', '-O', '/dev/null', `http://${other}/`],
      { encoding: 'utf8', timeout: 30_000 },
    );
    expect(result.status, `${other} risponde`).not.toBe(0);
    // Un 401 o un 404 sono risposte del server: non provano l'isolamento.
    expect(result.stderr, other).not.toMatch(/server returned error|HTTP\/1/i);
    expect(result.stderr, other).toMatch(
      /bad address|can't connect|connection refused|timed out|unreachable/i,
    );
  }

  it('la prova di isolamento non si lascia ingannare: un nome che risponde (401 o 200) la fa fallire', () => {
    expect(() => assertUnreachable(ingressId, 'amoris-staging-caddy')).toThrow();
    expect(() => assertUnreachable(ingressId, 'amoris-production-caddy')).toThrow();
    expect(() =>
      assertUnreachable('contenitore-inesistente-prova', 'amoris-staging-caddy'),
    ).toThrow();
  });

  it('i Caddy dei due ambienti non si raggiungono tra loro (reti interne come nel Compose)', () => {
    // L'ingresso parte raggiungendo entrambi: altrimenti l'isolamento sarebbe solo un contenitore muto.
    for (const other of ['amoris-production-caddy', 'amoris-staging-caddy']) {
      const result = spawnSync(
        'docker',
        ['exec', ingressId, 'wget', '-q', '-T', '5', '-O', '/dev/null', `http://${other}/`],
        { encoding: 'utf8', timeout: 30_000 },
      );
      // 401 dello staging e 200 della produzione: basta che il server risponda.
      expect([0, 1]).toContain(result.status);
      expect(result.stderr).not.toMatch(/bad address|timed out|can't connect/i);
    }
    assertUnreachable(envStaging, 'amoris-production-caddy');
    assertUnreachable(envProduction, 'amoris-staging-caddy');
  });

  it('il controllo di salute interno dell’ingresso risponde', () => {
    const result = spawnSync(
      'docker',
      ['exec', ingressId, 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:2020/health/live'],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
  });
});
