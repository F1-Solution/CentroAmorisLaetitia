import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Conta le righe della logica di autenticazione, per il criterio di uscita 18 e
 * per la contromisura 3 del §6 di ADR-007: «se la soluzione propria superasse le
 * 300 righe di logica di autenticazione, la premessa della proporzione è caduta
 * e si adotta Better Auth senza discutere».
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

export const CORE_FILES = [
  'lib/crypto.ts',
  'lib/password.ts',
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
] as const;

/** Soglia di ADR-007 §6 contromisura 3. */
export const THRESHOLD = 300;

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
