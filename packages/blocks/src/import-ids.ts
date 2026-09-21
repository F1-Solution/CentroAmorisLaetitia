/**
 * L'identificatore **derivato dalla sorgente** (`BLOCK-MODEL.md` §4.1 e §4.2).
 * Deterministico: una riesecuzione dell'import produce gli stessi
 * identificatori, perché la chiave è la posizione nella sorgente e non la
 * posizione nel risultato.
 *
 * Sta in un modulo a sé, e non insieme a `generateAdminBlockId`, per una
 * ragione sola: qui serve una funzione di hash sincrona, quindi `node:crypto`,
 * che nel bundle di un browser non esiste. L'area amministrativa importa
 * `@amoris/blocks` per l'anteprima (ADR-006 §3.3) e tirerebbe dentro questo
 * file senza usarlo. Chi deriva identificatori dalla sorgente è **solo**
 * `apps/importer`, che gira in Node: importa `@amoris/blocks/import-ids`.
 */
import { createHash } from 'node:crypto';

export interface StableIdSourceInput {
  /** `legacy_id` del contenuto in `post_content`. */
  readonly legacyContentId: string | number;
  /** Offset iniziale del costrutto, in byte, dentro `post_content`. */
  readonly startOffset: number;
  /** Offset finale del costrutto, in byte. */
  readonly endOffset: number;
  readonly type: string;
}

function computeKey(input: StableIdSourceInput, attempt: number): string {
  const base = `${input.legacyContentId}#${input.startOffset}-${input.endOffset}#${input.type}`;
  return attempt <= 1 ? base : `${base}#${attempt}`;
}

/**
 * Deriva un identificatore dalla chiave di sorgente. `isTaken` decide se
 * ricalcolare su `chiave + "#N"` (§4.2): il chiamante tiene l'insieme degli
 * identificatori già assegnati nel documento corrente.
 */
export function deriveBlockId(input: StableIdSourceInput, isTaken: (id: string) => boolean): string {
  let attempt = 1;
  for (;;) {
    const key = computeKey(input, attempt);
    const hash = createHash('sha256').update(key).digest('hex');
    const id = `b_${hash.slice(0, 12)}`;
    if (!isTaken(id)) {
      return id;
    }
    attempt += 1;
  }
}

/**
 * Assegna identificatori a tutti i blocchi di un import, visitati in ordine di
 * documento, gestendo le collisioni in modo deterministico (§4.2).
 */
export function createBlockIdAllocator(): { allocate: (input: StableIdSourceInput) => string } {
  const taken = new Set<string>();
  return {
    allocate(input: StableIdSourceInput): string {
      const id = deriveBlockId(input, (candidate) => taken.has(candidate));
      taken.add(id);
      return id;
    },
  };
}
