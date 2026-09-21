/**
 * Come si contano i blocchi di riserva (`BLOCK-MODEL.md` §8, ADR-005 §3.4).
 * Funzione pura: prende i documenti e restituisce i numeri, senza decidere
 * nulla su di essi — la decisione, se una soglia è superata, spetta a chi
 * chiama (`apps/importer`, 1D-W2…W3).
 */
import { CONTAINER_BLOCK_TYPES } from './schema/block-type';
import type { BlockNode } from './schema/block';
import type { BlockDocument } from './schema/document';
import { HTML_BLOCK_REASONS, type HtmlBlockReason } from './schema/html';

export interface ReserveCountResult {
  /** Denominatore (§8.1): tutti i blocchi il cui tipo non è un contenitore, `media_text` incluso. */
  readonly nonContainerBlocks: number;
  /** Numeratore (§8.2): tutti i blocchi `html`, `wp_html_block` compresi. */
  readonly htmlBlocks: number;
  /** Valore **non arrotondato**: è quello che conta per il confronto con la soglia (§8.3). */
  readonly percentage: number;
  /** Contenuti con almeno un blocco `html`, ovunque nell'albero (§8.3, §8.4). */
  readonly touchedContents: number;
  readonly contentsCount: number;
  readonly byReason: Readonly<Record<HtmlBlockReason, number>>;
  /** Vero se il valore non arrotondato supera 10 (§8.3). */
  readonly exceedsPercentageThreshold: boolean;
  /** Vero se il conteggio è 16 o più, cioè più di 15 su 108 (§8.3). */
  readonly exceedsContentThreshold: boolean;
}

const CONTAINER_TYPE_SET: ReadonlySet<string> = new Set(CONTAINER_BLOCK_TYPES);

export function countReserveBlocks(documents: readonly BlockDocument[]): ReserveCountResult {
  let nonContainerBlocks = 0;
  let htmlBlocks = 0;
  let touchedContents = 0;
  const byReason: Record<HtmlBlockReason, number> = Object.fromEntries(
    HTML_BLOCK_REASONS.map((reason) => [reason, 0]),
  ) as Record<HtmlBlockReason, number>;

  for (const doc of documents) {
    let touchedThisDoc = false;

    const walk = (nodes: readonly BlockNode[]): void => {
      for (const node of nodes) {
        if (!CONTAINER_TYPE_SET.has(node.type)) {
          nonContainerBlocks += 1;
          if (node.type === 'html') {
            htmlBlocks += 1;
            byReason[node.props.reason] += 1;
            touchedThisDoc = true;
          }
        }
        walk(node.children);
      }
    };
    walk(doc.blocks);

    if (touchedThisDoc) {
      touchedContents += 1;
    }
  }

  const percentage = nonContainerBlocks === 0 ? 0 : (htmlBlocks / nonContainerBlocks) * 100;

  return {
    nonContainerBlocks,
    htmlBlocks,
    percentage,
    touchedContents,
    contentsCount: documents.length,
    byReason,
    exceedsPercentageThreshold: percentage > 10,
    exceedsContentThreshold: touchedContents >= 16,
  };
}
