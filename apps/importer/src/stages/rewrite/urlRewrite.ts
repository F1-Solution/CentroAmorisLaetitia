/**
 * La riscrittura vera (ADR-004 §3.3): una regola sola, applicata a un valore
 * qualunque. Funzione pura, senza accesso al database — cosi' il test che la
 * esercita non ha bisogno di Postgres.
 *
 * Riconosce `https://www.centroamorislaetitia.it/wp-content/uploads/` e le
 * sue varianti — con e senza `www`, `http` e `https`, e la forma relativa
 * `/wp-content/uploads/` — e le sostituisce con `/media/`. Non interpreta il
 * contenuto in cui il riferimento compare (attributo, blocco, JSON): sostituisce
 * la sottostringa ovunque compaia, come richiede ADR-004 §3.3 ("una regola
 * sola, in un punto solo").
 */

const UPLOADS_REFERENCE =
  /(?:https?:\/\/(?:www\.)?centroamorislaetitia\.it)?\/wp-content\/uploads\//gi;

/** Usata anche dalla fase `verify` per contare i riferimenti rimasti. */
export const UPLOADS_REMNANT_PROBE = /wp-content\/uploads/i;

export function rewriteUploadsReferences(value: string): string {
  return value.replace(UPLOADS_REFERENCE, '/media/');
}

export function hasUploadsReference(value: string): boolean {
  return UPLOADS_REMNANT_PROBE.test(value);
}

export interface RewriteOutcome<T> {
  readonly value: T;
  readonly changed: boolean;
}

/**
 * Percorre un valore JSON qualunque (stringa, numero, booleano, `null`,
 * array, oggetto) e riscrive ogni stringa che trova. Non conosce la forma dei
 * blocchi (ADR-005): tratta il JSON come dato opaco, di proposito — è la
 * ragione per cui questa fase resta "stupida e verificabile" invece di
 * interpretare i blocchi (`importer-spec.md` §4.1).
 */
export function rewriteJsonValue(value: unknown): RewriteOutcome<unknown> {
  if (typeof value === 'string') {
    const rewritten = rewriteUploadsReferences(value);
    return { value: rewritten, changed: rewritten !== value };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const rewritten = value.map((item) => {
      const outcome = rewriteJsonValue(item);
      if (outcome.changed) changed = true;
      return outcome.value;
    });
    return { value: changed ? rewritten : value, changed };
  }

  if (value !== null && typeof value === 'object') {
    let changed = false;
    const rewritten: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      const outcome = rewriteJsonValue(entryValue);
      if (outcome.changed) changed = true;
      rewritten[key] = outcome.value;
    }
    return { value: changed ? rewritten : value, changed };
  }

  return { value, changed: false };
}

/** Come {@link rewriteJsonValue}, ma per un campo testo semplice (mai `null`). */
export function rewriteTextField(value: string | null): RewriteOutcome<string | null> {
  if (value === null) return { value: null, changed: false };
  const rewritten = rewriteUploadsReferences(value);
  return { value: rewritten, changed: rewritten !== value };
}
