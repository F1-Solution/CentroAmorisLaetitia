/**
 * Chi può contenere chi (`BLOCK-MODEL.md` §3.15) e l'invariante di `row`
 * (§3.2): verificati a livello di documento, perché sono regole fra fratelli
 * e fra genitore e figli, non del solo nodo.
 */
import type { z } from 'zod';
import { ALLOWED_CHILDREN, type BlockNode, type BlockType } from './block';
import { checkClassConsistency } from './consistency';

export function validateContainment(
  nodes: readonly BlockNode[],
  allowedTypes: readonly BlockType[],
  path: (string | number)[],
  ctx: z.RefinementCtx,
): void {
  nodes.forEach((node, index) => {
    const nodePath = [...path, index];

    if (!allowedTypes.includes(node.type)) {
      ctx.addIssue({
        code: 'custom',
        path: [...nodePath, 'type'],
        message: `il tipo "${node.type}" non è ammesso in questa posizione (BLOCK-MODEL.md §3.15)`,
      });
    }

    if (node.type === 'row') {
      const columnWidths = node.children.filter((c) => c.type === 'column').map((c) => c.props.width);
      const expected = columnWidths.join(',');
      if (node.props.columnStructure !== expected) {
        ctx.addIssue({
          code: 'custom',
          path: [...nodePath, 'props', 'columnStructure'],
          message:
            'columnStructure deve essere esattamente l\'unione, nell\'ordine, dei "width" delle colonne figlie (§3.2)',
        });
      }
    }

    checkClassConsistency(node, ctx, nodePath);

    const childAllowed = ALLOWED_CHILDREN[node.type];
    validateContainment(node.children, childAllowed, [...nodePath, 'children'], ctx);
  });
}
