import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Conta le righe della logica di autenticazione, per il criterio di uscita 18 e
 * per la contromisura 3 del §6 di ADR-007: «se la soluzione propria superasse le
 * 500 righe di logica di autenticazione, la premessa della proporzione è caduta
 * e si adotta Better Auth senza discutere». La soglia era 300 fino al 2026-09-21,
 * quando DR-070 l'ha portata a 500.
 *
 * Perché il numero voglia dire qualcosa, la regola di conteggio deve essere
 * scritta prima e non cambiata dopo averlo visto:
 *
 * - si contano le righe **eseguibili**: niente righe vuote, niente commenti;
 * - **non** si contano le righe di `import` e di `export … from`, che sono
 *   cablaggio fra file e non logica;
 * - si contano due insiemi, perché «logica di autenticazione» ammette due
 *   letture oneste e nasconderne una sarebbe il modo più facile di far tornare
 *   il numero:
 *     - il **nucleo**: crittografia, password, sessioni, permessi, limitazione
 *       dei tentativi, riconoscimento della sessione, anti-CSRF;
 *     - il **totale**: il nucleo più le rotte HTTP del modulo `auth` e i loro
 *       schemi, che sono involucro ma pur sempre codice di autenticazione.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'src');

/**
 * Aggiunta del 2026-09-20, wave `1D-W8a`. `auth/areas.ts` e `auth/areaMap.ts`
 * entrano nel nucleo perche' `plugins/auth.ts`, che gia' vi apparteneva, ora
 * rifiuta le richieste che arrivano da un'altra area (DR-067): tenerle fuori
 * sarebbe il modo piu' facile di far restare basso il numero, che e' proprio
 * cio' che la regola scritta prima della misura serve a impedire.
 */
export const CORE_FILES = [
  'lib/crypto.ts',
  'lib/password.ts',
  'auth/areas.ts',
  'auth/areaMap.ts',
  'auth/audit.ts',
  'auth/loginAttempts.ts',
  'auth/permissions.ts',
  'auth/sessions.ts',
  'plugins/auth.ts',
  'plugins/csrf.ts',
] as const;

export const WRAPPER_FILES = [
  'modules/auth/routes.ts',
  'modules/auth/schemas.ts',
  'modules/auth/service.ts',
  // Wave 1G-W1: il modulo degli account crea credenziali e revoca sessioni, quindi si conta.
  'modules/accounts/routes.ts',
  'modules/accounts/schemas.ts',
  'modules/accounts/service.ts',
] as const;

/**
 * Soglia di ADR-007 §6 contromisura 3, portata da 300 a 500 il 2026-09-21 da
 * DR-070. La regola di conteggio qui sopra **non** cambia: cambiare la regola
 * dopo aver visto il numero e cambiare la soglia sono due cose diverse, e solo
 * la seconda è stata decisa.
 */
export const THRESHOLD = 500;

function countExecutableLines(source: string): number {
  let inBlockComment = false;
  let counted = 0;

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    if (line.startsWith('/*')) {
      if (!line.includes('*/')) inBlockComment = true;
      continue;
    }
    if (line.startsWith('//') || line.startsWith('*')) continue;
    if (/^import\b/.test(line) || /^export .* from /.test(line)) continue;
    if (/^\}\s*from\s/.test(line)) continue;

    counted += 1;
  }

  return counted;
}

export interface LineCount {
  readonly perFile: ReadonlyArray<{ readonly file: string; readonly lines: number }>;
  readonly core: number;
  readonly total: number;
}

export async function countAuthLines(): Promise<LineCount> {
  const files = [...CORE_FILES, ...WRAPPER_FILES];
  const perFile = await Promise.all(
    files.map(async (file) => ({
      file,
      lines: countExecutableLines(await readFile(path.join(src, file), 'utf8')),
    })),
  );

  const sum = (names: readonly string[]) =>
    perFile
      .filter((entry) => names.includes(entry.file))
      .reduce((running, entry) => running + entry.lines, 0);

  return { perFile, core: sum(CORE_FILES), total: sum(files) };
}
