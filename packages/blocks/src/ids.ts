/**
 * L'identificatore stabile del blocco (`BLOCK-MODEL.md` §4). Deterministico,
 * derivato dalla posizione nella sorgente e non dalla posizione nel risultato
 * (§4.1): una riesecuzione dell'import produce gli stessi identificatori.
 */
import { createHash, randomBytes } from 'node:crypto';

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
 * Blocchi creati nell'area amministrativa (§4.3): non hanno una sorgente,
 * quindi non hanno una chiave deterministica. Sei byte da un generatore
 * crittografico, nello stesso formato. Non è l'importer a chiamarla.
 */
export function generateAdminBlockId(): string {
  return `b_${randomBytes(6).toString('hex')}`;
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
