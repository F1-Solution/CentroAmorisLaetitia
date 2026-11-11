import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_KEYS } from '../src/config.js';
import { SCRUB_SERVER_CONFIG_KEYS } from '../src/scrubServerConfig.js';

/**
 * Esempio d'ambiente di produzione (1F-W2 T8).
 *
 * `infra/deploy/.env.production.example` è il modello del file passato a
 * `docker compose --env-file`. Queste prove lo confrontano con le chiavi che l'API e il
 * servizio di pulizia leggono davvero e con quelle che il Compose interpola: una chiave nuova
 * nella configurazione senza la sua riga nell'esempio fa diventare rossa la prova.
 *
 * L'esempio non contiene valori riusabili: ogni chiave obbligatoria del Compose è vuota, così
 * l'esempio copiato senza modifiche non avvia nulla, e ogni segreto porta il comando che lo
 * genera abbastanza lungo per la validazione dell'API (almeno 32 caratteri).
 */

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const examplePath = path.join(repoRoot, 'infra', 'deploy', '.env.production.example');
const composePath = path.join(repoRoot, 'infra', 'deploy', 'compose.yml');

/** Segreti dell'ambiente di produzione: vuoti nell'esempio, con il comando che li genera. */
const SECRETS = [
  'POSTGRES_PASSWORD',
  'DB_OWNER_PASSWORD',
  'DB_APP_PASSWORD',
  'DB_BACKUP_PASSWORD',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_API_SECRET_KEY',
  'S3_BACKUP_SECRET_KEY',
  'IP_HASH_SALT',
  'CSRF_SECRET',
  'TOTP_ENCRYPTION_KEY',
  'SCRUB_SERVICE_TOKEN',
] as const;

interface ExampleLine {
  readonly key: string;
  readonly value: string;
  readonly active: boolean;
  /** Commenti che precedono la riga, fino alla riga vuota. */
  readonly notes: readonly string[];
}

function readExample(): ExampleLine[] {
  const lines = readFileSync(examplePath, 'utf8').split(/\r?\n/);
  const result: ExampleLine[] = [];
  let notes: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      notes = [];
      continue;
    }
    const match = /^(#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match !== null) {
      result.push({
        key: match[2] ?? '',
        value: match[3] ?? '',
        active: match[1] === undefined,
        notes,
      });
      continue;
    }
    if (line.startsWith('#')) notes = [...notes, line];
  }
  return result;
}

/** Variabili interpolate dal Compose: `${NOME}`, `${NOME:-…}`, `${NOME:?…}`. */
function composeVariables(): { all: Set<string>; required: Set<string> } {
  const text = readFileSync(composePath, 'utf8');
  const all = new Set<string>();
  const required = new Set<string>();
  for (const match of text.matchAll(/(?<!\$)\$\{([A-Z][A-Z0-9_]*)(:?[-?][^}]*)?\}/g)) {
    const name = match[1] ?? '';
    all.add(name);
    if (match[2]?.startsWith(':?') === true) required.add(name);
  }
  return { all, required };
}

describe('esempio d’ambiente di produzione', () => {
  it('esiste ed è tracciato da Git (non escluso da .gitignore)', () => {
    expect(existsSync(examplePath)).toBe(true);
    const ignored = spawnSync('git', ['check-ignore', '-q', examplePath], { cwd: repoRoot });
    expect(ignored.status, 'l’esempio è escluso da .gitignore').toBe(1);
  });

  it('contiene ogni chiave letta dalla configurazione dell’API', () => {
    const keys = new Set(readExample().map((line) => line.key));
    const missing = CONFIG_KEYS.filter((key) => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('contiene ogni chiave letta dal servizio di pulizia', () => {
    const keys = new Set(readExample().map((line) => line.key));
    const missing = SCRUB_SERVER_CONFIG_KEYS.filter((key) => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('contiene ogni variabile del Compose, e le obbligatorie sono righe attive', () => {
    const example = readExample();
    const keys = new Set(example.map((line) => line.key));
    const active = new Set(example.filter((line) => line.active).map((line) => line.key));
    const { all, required } = composeVariables();
    expect(required.size).toBeGreaterThan(0);
    expect([...all].filter((name) => !keys.has(name))).toEqual([]);
    expect([...required].filter((name) => !active.has(name))).toEqual([]);
  });

  it('DR-409: la rete verso l’ingresso è obbligatoria e le porte pubbliche non sono più dell’ambiente', () => {
    const keys = readExample().map((line) => line.key);
    const line = readExample().find((candidate) => candidate.key === 'INGRESS_SUBNET');
    expect(line?.active).toBe(true);
    expect(line?.value).toBe('');
    expect(keys).not.toContain('CADDY_HTTP_PORT');
    expect(keys).not.toContain('CADDY_HTTPS_PORT');
  });

  it('DR-412: sottorete e bridge dei backup sono righe attive e vuote, per ambiente', () => {
    for (const key of ['BACKUP_OUT_SUBNET', 'BACKUP_OUT_BRIDGE']) {
      const line = readExample().find((candidate) => candidate.key === key);
      expect(line?.active, key).toBe(true);
      expect(line?.value, key).toBe('');
    }
  });

  it('N6: i percorsi delle chiavi del backup sono righe attive e vuote, con percorso assoluto in commento', () => {
    for (const key of ['BACKUP_SSH_KEY_PATH', 'BACKUP_KNOWN_HOSTS_PATH']) {
      const line = readExample().find((candidate) => candidate.key === key);
      expect(line?.active, key).toBe(true);
      expect(line?.value, key).toBe('');
    }
    expect(readFileSync(examplePath, 'utf8')).toContain('/etc/amoris/backup-chiavi/');
  });

  it('lascia vuote le chiavi obbligatorie del Compose: copiato così com’è non avvia nulla', () => {
    const { required } = composeVariables();
    const filled = readExample().filter(
      (line) => line.active && required.has(line.key) && line.value !== '',
    );
    expect(filled.map((line) => line.key)).toEqual([]);
  });

  it('non ha valori attivi per le chiavi che il Compose non legge', () => {
    // Una chiave dell'API scritta qui non arriva al contenitore: il Compose passa solo le sue.
    const { all } = composeVariables();
    const stray = readExample().filter((line) => line.active && !all.has(line.key));
    expect(stray.map((line) => line.key)).toEqual([]);
  });

  it.each(SECRETS)('%s è vuoto, con il comando che lo genera lungo almeno 32 caratteri', (key) => {
    const lines = readExample().filter((line) => line.key === key);
    expect(lines).toHaveLength(1);
    const [line] = lines;
    expect(line?.active).toBe(true);
    expect(line?.value).toBe('');
    const command = line?.notes
      .map((note) => /openssl rand -hex (\d+)/.exec(note))
      .find((match) => match !== null);
    expect(command, `${key} senza comando «openssl rand -hex N»`).toBeDefined();
    // Ogni byte diventa due cifre esadecimali: nessun carattere riservato degli URL.
    expect(Number(command?.[1]) * 2).toBeGreaterThanOrEqual(32);
  });

  it('non contiene nessun valore che somigli a un segreto', () => {
    const suspicious = readExample().filter((line) => /^[A-Za-z0-9+/=_-]{24,}$/.test(line.value));
    expect(suspicious.map((line) => line.key)).toEqual([]);
  });
});
