import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Difetto del 2026-09-23: `pnpm db:migrate` falliva con «DATABASE_URL non è
 * impostata» pur essendoci un `.env` giusto alla radice. Nessuno lo leggeva.
 * Colpiva cinque comandi, non uno, e nessun test se n'era accorto perché le
 * prove si costruiscono il database da sé e non passano da questi script.
 *
 * Qui si difendono due cose distinte:
 *
 * 1. che il **meccanismo** funzioni — `--env-file-if-exists` carica davvero un
 *    file e non esplode quando il file non c'è. Si verifica avviando Node per
 *    davvero su un `.env` costruito al momento, non sul `.env` della macchina:
 *    in CI quel file non esiste, e un test che lo pretendesse sarebbe verde
 *    solo qui;
 * 2. che **nessuno script lo perda per strada**. È questa la regressione vera:
 *    si aggiunge un comando che legge la configurazione e ci si dimentica del
 *    flag. Il controllo è sui manifesti, che sono la cosa che cambia.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..', '..');

const temp = mkdtempSync(path.join(tmpdir(), 'amoris-env-'));

afterAll(() => {
  rmSync(temp, { recursive: true, force: true });
});

function nodeSees(args: string[]): string {
  return execFileSync(
    process.execPath,
    [...args, '-e', 'process.stdout.write(process.env.VALORE_INVENTATO ?? "assente")'],
    { encoding: 'utf8' },
  );
}

describe('il meccanismo di caricamento', () => {
  it('legge il file quando c’è', () => {
    const envPath = path.join(temp, '.env');
    writeFileSync(envPath, 'VALORE_INVENTATO=letto-dal-file\n', 'utf8');
    expect(nodeSees([`--env-file-if-exists=${envPath}`])).toBe('letto-dal-file');
  });

  it('non fallisce quando il file non c’è, com’è in CI', () => {
    const assente = path.join(temp, 'nessun-file-qui.env');
    expect(nodeSees([`--env-file-if-exists=${assente}`])).toBe('assente');
  });
});

interface Manifest {
  readonly scripts?: Readonly<Record<string, string>>;
}

function scriptsOf(relativePath: string): Readonly<Record<string, string>> {
  const manifest = JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as Manifest;
  return manifest.scripts ?? {};
}

/**
 * I comandi che hanno bisogno della configurazione. `db:generate` non compare:
 * `drizzle-kit` è un eseguibile suo e non inoltra i flag di Node, quindi carica
 * il `.env` dentro `drizzle.config.ts`, ed è l'ultimo test a controllarlo.
 */
const COMANDI: readonly { readonly manifesto: string; readonly script: string }[] = [
  { manifesto: 'packages/db/package.json', script: 'migrate' },
  { manifesto: 'packages/db/package.json', script: 'verify' },
  { manifesto: 'apps/api/package.json', script: 'dev' },
  { manifesto: 'apps/api/package.json', script: 'start' },
  { manifesto: 'apps/api/package.json', script: 'seed' },
];

/**
 * Il flag non basta che ci sia: deve stare **al posto giusto**.
 *
 * Il 2026-09-23 lo script di sviluppo era `tsx --env-file-if-exists=… watch
 * src/server.ts`, e `tsx` ha creduto che il file da avviare fosse `watch`.
 * Il controllo che si limitava a cercare il flag nella stringa passava lo
 * stesso. Qui si guarda la forma della riga: `watch` è un sottocomando e viene
 * prima di ogni flag, e l'ultimo argomento è il file da avviare.
 */
function pezziDi(comando: string): string[] {
  return comando.trim().split(/\s+/);
}

describe('nessuno script perde il caricamento del .env', () => {
  for (const { manifesto, script } of COMANDI) {
    it(`${manifesto} → ${script}`, () => {
      const comando = scriptsOf(manifesto)[script];
      expect(comando, `lo script ${script} non esiste più`).toBeDefined();
      expect(comando).toContain('--env-file-if-exists=../../.env');

      const pezzi = pezziDi(comando ?? '');
      expect(pezzi[0]).toBe('tsx');

      const posizioneFlag = pezzi.findIndex((pezzo) => pezzo.startsWith('--env-file-if-exists='));
      const sottocomandi = pezzi.filter((pezzo) => pezzo === 'watch');
      for (const sottocomando of sottocomandi) {
        expect(
          pezzi.indexOf(sottocomando),
          'il sottocomando di tsx viene prima dei flag, altrimenti tsx lo scambia per il file da avviare',
        ).toBeLessThan(posizioneFlag);
      }

      expect(pezzi[pezzi.length - 1], 'l’ultimo argomento è il file da avviare').toMatch(/\.ts$/);
    });
  }

  it('drizzle.config.ts carica il .env da sé e non ha alcun indirizzo di ripiego', () => {
    const config = readFileSync(path.join(root, 'packages/db/drizzle.config.ts'), 'utf8');
    expect(config).toContain('process.loadEnvFile');
    // Un indirizzo scritto nel file farebbe generare le migrazioni contro il
    // database sbagliato senza che nessuno se ne accorga.
    expect(config).not.toMatch(/postgres:\/\//);
  });
});
