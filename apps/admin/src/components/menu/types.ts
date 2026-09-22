/** Tipi del menu, condivisi fra la schermata e la scheda della voce. */

export type MenuVisibility = 'public' | 'authenticated' | 'roles' | 'hidden';

export type MenuItemKind = 'content' | 'term' | 'custom';

export interface MenuSummary {
  readonly id: string;
  readonly key: string;
  readonly label: string;
}

export interface MenuItem {
  readonly id: string;
  readonly menuId: string;
  readonly parentId: string | null;
  readonly position: number;
  readonly kind: MenuItemKind;
  readonly label: string;
  readonly contentId: string | null;
  readonly termId: string | null;
  readonly url: string | null;
  readonly linkTarget: string | null;
  readonly cssClasses: string | null;
  readonly visibility: MenuVisibility;
  readonly visibleToRoles: readonly string[];
}

export interface RoleOption {
  readonly key: string;
  readonly label: string;
}
