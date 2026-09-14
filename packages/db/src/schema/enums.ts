import { pgEnum } from 'drizzle-orm/pg-core';

/** Tipi enumerati dello schema canonico (`docs/architecture/schema.sql`). */

export const contentType = pgEnum('content_type', ['page', 'post']);
export const contentStatus = pgEnum('content_status', ['draft', 'published', 'archived']);
export const menuItemKind = pgEnum('menu_item_kind', ['content', 'term', 'custom']);
export const menuVisibility = pgEnum('menu_visibility', [
  'public',
  'authenticated',
  'roles',
  'hidden',
]);
export const redirectKind = pgEnum('redirect_kind', ['exact', 'prefix']);
export const redirectOrigin = pgEnum('redirect_origin', ['migration', 'manual', 'automatic']);
export const submissionOrigin = pgEnum('submission_origin', ['migration', 'live']);
export const auditOutcome = pgEnum('audit_outcome', ['success', 'failure']);
