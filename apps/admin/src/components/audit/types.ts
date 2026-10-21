/** Forma della risposta di `GET /audit`, che rispecchia packages/contracts/src/audit.ts. */
export interface AuditItem {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorUserId: string | null;
  readonly actorLabel: string | null;
  readonly actorRoleLabel: string | null;
  readonly actorArea: string | null;
  readonly action: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly entityLabel: string | null;
  readonly contentType: 'page' | 'post' | null;
  readonly outcome: 'success' | 'failure';
}

export interface AuditList {
  readonly items: readonly AuditItem[];
  readonly nextCursor: string | null;
}

export type AuditView = 'changes' | 'all';

export interface AuditFilters {
  readonly actorUserId: string;
  readonly action: string;
  readonly outcome: string;
  readonly contentId: string;
  readonly fromDay: string;
  readonly toDay: string;
}

export const NO_FILTERS: AuditFilters = {
  actorUserId: '',
  action: '',
  outcome: '',
  contentId: '',
  fromDay: '',
  toDay: '',
};

/** Un contenuto proposto da `GET /audit/contents`. */
export interface ContentOption {
  readonly id: string;
  readonly title: string;
  readonly type: 'page' | 'post';
}
