import { ApiError } from '../../lib/api';
import { entityTypeLabel } from '../../lib/auditLabels';
import type { AuditFilters, AuditItem, AuditView } from './types';

const LIMIT = 50;

/** L'istante della mezzanotte locale di `AAAA-MM-GG`, in ISO. */
export function startOfDay(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString();
}

/** La mezzanotte locale del giorno dopo: l'API vuole `to` escluso, la persona sceglie un giorno incluso. */
export function startOfNextDay(day: string): string {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function buildQuery(view: AuditView, filters: AuditFilters, cursor?: string): string {
  const query = new URLSearchParams({ view, limit: String(LIMIT) });
  if (filters.actorUserId) query.set('actorUserId', filters.actorUserId);
  if (filters.action) query.set('action', filters.action);
  if (filters.outcome) query.set('outcome', filters.outcome);
  if (filters.contentId.trim()) {
    query.set('entityType', 'content');
    query.set('entityId', filters.contentId.trim());
  }
  if (filters.fromDay) query.set('from', startOfDay(filters.fromDay));
  if (filters.toDay) query.set('to', startOfNextDay(filters.toDay));
  if (cursor) query.set('cursor', cursor);
  return `/audit?${query.toString()}`;
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const FORM_SUBMISSION = 'POST /forms/:slug/submissions';

/** Chi ha agito: mai un nome vuoto (caso 4). */
export function actorText(item: AuditItem): string {
  if (item.actorLabel) return item.actorLabel;
  if (item.action === FORM_SUBMISSION) return 'Dal sito pubblico';
  if (item.action === 'auth.login') return 'Accesso non riuscito';
  return 'Senza sessione valida';
}

/** Su che cosa: il titolo se esiste, altrimenti il tipo e, per i contenuti, che non c'è più (caso 2). */
export function objectText(item: AuditItem): string {
  if (!item.entityType || item.entityType === 'auth.identifier') return '—';
  if (item.entityLabel) return item.entityLabel;
  if (item.entityType === 'content' || item.entityType === 'content_seo') {
    return 'contenuto non più presente';
  }
  return entityTypeLabel(item.entityType);
}

export function auditErrorMessage(caught: unknown): string {
  if (caught instanceof ApiError) return caught.fullMessage;
  return 'Non è stato possibile contattare il servizio.';
}
