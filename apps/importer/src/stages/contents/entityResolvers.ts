/**
 * Risolutori verso le entità prodotte dalle fasi `documents`, `sliders` e
 * `forms` (`convert/shared/context.ts`, `ConvertResolvers`).
 *
 * Esistono perché **DR-062** ha spostato quelle tre fasi prima di `contents`:
 * finché giravano dopo, ogni riferimento a un modulo form diventava un blocco
 * `html` di riserva e la soglia di ADR-005 §3.4 misurava un artefatto
 * dell'ordine, non la qualità della conversione.
 *
 * Stessa forma di `mediaResolver.ts`: una lettura sola per fase, poi una
 * funzione pura. Il convertitore non tocca il database.
 */
import { schema } from '@amoris/db';
import type { Tx } from '../../persistence/tx.js';

/** Prefisso del riferimento prodotto da `convertFormSelector` (blocco `wpforms/form-selector`). */
const WPFORMS_PREFIX = 'wpforms:';

/**
 * Indicizza per identificativo di origine, scartando le collisioni invece di
 * sceglierne una: due entità con lo stesso `legacyId` sono un dato che non
 * sappiamo interpretare, e un riferimento risolto a caso è peggio di un blocco
 * di riserva, che almeno si vede.
 */
function indexByLegacyId(
  rows: readonly { id: string; legacyId: number | null }[],
): Map<number, string | null> {
  const byLegacyId = new Map<number, string | null>();
  for (const row of rows) {
    if (row.legacyId === null) continue;
    byLegacyId.set(row.legacyId, byLegacyId.has(row.legacyId) ? null : row.id);
  }
  return byLegacyId;
}

function parseLegacyId(raw: string): number | null {
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : null;
}

/**
 * `wpforms:<id>` — l'identificativo è quello del `wp_posts` di tipo `wpforms`,
 * cioè la stessa chiave con cui la fase `forms` scrive `forms.legacyId`.
 *
 * `divi-contact-form:<titolo>` **non si risolve, ed è voluto**: un modulo
 * `et_pb_contact_form` non ha una riga sorgente propria, quindi non esiste
 * alcuna entità `forms` a cui puntare. Resta un blocco di riserva, che è
 * l'esito onesto.
 */
export async function buildFormResolver(tx: Tx): Promise<(legacyRef: string) => string | null> {
  const rows = await tx
    .select({ id: schema.forms.id, legacyId: schema.forms.legacyId })
    .from(schema.forms);
  const byLegacyId = indexByLegacyId(rows);

  return (legacyRef: string) => {
    if (!legacyRef.startsWith(WPFORMS_PREFIX)) return null;
    const legacyId = parseLegacyId(legacyRef.slice(WPFORMS_PREFIX.length));
    return legacyId === null ? null : (byLegacyId.get(legacyId) ?? null);
  };
}

/**
 * `[doc id="<id>"]` — l'attributo è l'identificativo del `wp_posts` del
 * documento. `documents.legacyId` è unico per `legacySource`, non in assoluto:
 * i due sorgenti (`wpdmpro`, `cuar_private_file`) sono tipi di `wp_posts`
 * diversi e quindi non possono collidere, ma se collidessero il riferimento
 * resterebbe non risolto invece di puntare a uno dei due a caso.
 */
export async function buildDocumentResolver(tx: Tx): Promise<(legacyRef: string) => string | null> {
  const rows = await tx
    .select({ id: schema.documents.id, legacyId: schema.documents.legacyId })
    .from(schema.documents);
  const byLegacyId = indexByLegacyId(rows);

  return (legacyRef: string) => {
    const legacyId = parseLegacyId(legacyRef);
    return legacyId === null ? null : (byLegacyId.get(legacyId) ?? null);
  };
}

/**
 * Per alias (`sliders.key`, cioè `wp_revslider_sliders.alias`) o per
 * identificativo numerico di origine: sono le due forme con cui Slider
 * Revolution si cita in un contenuto.
 *
 * **Nessun convertitore lo chiama oggi**: sulla sorgente misurata non compare
 * alcun riferimento a un carosello dentro `post_content`. Esiste perché
 * `ConvertResolvers` lo dichiara e perché il codice di anomalia
 * `unresolved-slider-reference` lo presuppone; se un riferimento comparisse,
 * si risolverebbe invece di diventare un blocco di riserva silenzioso.
 */
export async function buildSliderResolver(tx: Tx): Promise<(legacyRef: string) => string | null> {
  const rows = await tx
    .select({ id: schema.sliders.id, key: schema.sliders.key, legacyId: schema.sliders.legacyId })
    .from(schema.sliders);
  const byLegacyId = indexByLegacyId(rows);
  const byKey = new Map<string, string>();
  for (const row of rows) byKey.set(row.key, row.id);

  return (legacyRef: string) => {
    const trimmed = legacyRef.trim();
    const legacyId = parseLegacyId(trimmed);
    if (legacyId !== null) return byLegacyId.get(legacyId) ?? null;
    return byKey.get(trimmed) ?? null;
  };
}
