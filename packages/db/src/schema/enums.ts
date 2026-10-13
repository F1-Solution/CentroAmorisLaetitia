import { pgEnum } from 'drizzle-orm/pg-core';

/** Tipi enumerati dello schema canonico (`docs/architecture/schema.sql`). */

export const contentType = pgEnum('content_type', ['page', 'post']);
export const contentStatus = pgEnum('content_status', ['draft', 'published', 'archived']);
/** Layout della pagina, ex `_et_pb_page_layout` di Divi (DR-139). */
export const pageLayout = pgEnum('page_layout', ['right_sidebar', 'full_width', 'no_sidebar']);
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
/**
 * Aree dell'area amministrativa (`design-system.md` §7.2). In Fase 1 sono due;
 * le altre quattro del §7.1 non si dichiarano qui, perche' il gate vieta di
 * pianificare le fasi gestionali e un valore enumerato e' una pianificazione.
 */
export const adminArea = pgEnum('admin_area', ['redazione', 'impostazioni']);
