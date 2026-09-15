/**
 * Il documento a blocchi (`BLOCK-MODEL.md` §1). È ciò che sta nella colonna
 * `contents.blocks` (vincolo `contents_blocks_have_schema`,
 * `packages/db/src/schema/content.ts`).
 */
import { z } from 'zod';
import { blockNodeSchema } from './block.js';
import { ROOT_ALLOWED_TYPES } from './block-type.js';
import { validateContainment } from './containment.js';

export const blockDocumentSchema = z
  .object({
    schema: z.literal(1),
    blocks: z.array(blockNodeSchema),
  })
  .strict()
  .superRefine((doc, ctx) => {
    validateContainment(doc.blocks, ROOT_ALLOWED_TYPES, ['blocks'], ctx);
  });

export type BlockDocument = z.infer<typeof blockDocumentSchema>;

export const emptyBlockDocument: BlockDocument = { schema: 1, blocks: [] };
