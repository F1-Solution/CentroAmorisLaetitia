import { hash, verify, type Algorithm } from '@node-rs/argon2';
import type { Config } from '../config.js';

/**
 * ADR-007 §3.1 controllo 1: Argon2id da libreria collaudata, con i parametri
 * dichiarati in configurazione.
 *
 * La libreria è `@node-rs/argon2`, scelta fra le due ammesse dal §5 del piano di
 * fase sul criterio dichiarato lì — la compilazione su Windows e in container:
 * distribuisce binari già compilati per `win32-x64` e per Linux, quindi non
 * richiede `node-gyp` né una catena di compilazione C, né sulla macchina di
 * sviluppo né nell'immagine.
 */

/**
 * `Algorithm` è un `const enum` ambientale, e `verbatimModuleSyntax` non lascia
 * leggerne i membri: il valore è quello che la libreria dichiara per Argon2id.
 */
const ARGON2ID = 2 as Algorithm;

function options(config: Config) {
  return {
    algorithm: ARGON2ID,
    memoryCost: config.ARGON2_MEMORY_KIB,
    timeCost: config.ARGON2_TIME_COST,
    parallelism: config.ARGON2_PARALLELISM,
  };
}

export function hashPassword(password: string, config: Config): Promise<string> {
  return hash(password, options(config));
}

export async function verifyPassword(expectedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(expectedHash, password);
  } catch {
    // Un hash malformato a database non deve far entrare nessuno, né esplodere.
    return false;
  }
}
