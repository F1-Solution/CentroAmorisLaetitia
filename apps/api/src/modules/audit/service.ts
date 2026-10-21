import type { AuditContentOption, AuditItem, LastChange } from '@amoris/contracts';
import { schema, type Database } from '@amoris/db';
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { CHANGE_ACTIONS } from './actions.js';
import { encodeCursor, type AuditQuery } from './schemas.js';

/** Sola lettura di `audit_log`, che resta append-only. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Microsecondi in UTC, come li tiene il database. */
const occurredAtText = sql<string>`to_char(${schema.auditLog.occurredAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

function conditions(query: AuditQuery): SQL[] {
  const { auditLog } = schema;
  const where: SQL[] = [];
  // Un'azione esplicita prevale sulla vista.
  if (query.action) where.push(eq(auditLog.action, query.action));
  else if (query.view === 'changes') where.push(inArray(auditLog.action, [...CHANGE_ACTIONS]));
  if (query.entityType === 'content') {
    where.push(inArray(auditLog.entityType, ['content', 'content_seo']));
  } else if (query.entityType) {
    where.push(eq(auditLog.entityType, query.entityType));
  }
  if (query.entityId) {
    where.push(eq(auditLog.entityId, query.entityId));
    // L'impronta dell'identificativo di un accesso fallito non si ritrova per id (caso 4).
    where.push(sql`${auditLog.entityType} is distinct from 'auth.identifier'`);
  }
  if (query.actorUserId) where.push(eq(auditLog.actorUserId, query.actorUserId));
  if (query.outcome) where.push(eq(auditLog.outcome, query.outcome));
  if (query.from) {
    where.push(sql`${auditLog.occurredAt} >= ${query.from.toISOString()}::timestamptz`);
  }
  if (query.to) where.push(sql`${auditLog.occurredAt} < ${query.to.toISOString()}::timestamptz`);
  if (query.cursor) {
    where.push(
      sql`(${auditLog.occurredAt}, ${auditLog.id}) < (${query.cursor.occurredAt}::timestamptz, ${query.cursor.id}::bigint)`,
    );
  }
  return where;
}

interface Row {
  readonly entityType: string | null;
  readonly entityId: string | null;
}

/** Un'interrogazione per tipo di oggetto e per pagina, mai una per riga. */
async function labelsFor(
  db: Database,
  rows: readonly Row[],
): Promise<{ labels: Map<string, string>; types: Map<string, 'page' | 'post'> }> {
  const idsOf = (types: readonly string[]): string[] => [
    ...new Set(
      rows.flatMap((r) =>
        r.entityType && types.includes(r.entityType) && r.entityId && UUID.test(r.entityId)
          ? [r.entityId]
          : [],
      ),
    ),
  ];
  const contentIds = idsOf(['content', 'content_seo']);
  const mediaIds = idsOf(['media']);
  const itemIds = idsOf(['menu_item']);
  const [contents, media, items] = await Promise.all([
    contentIds.length
      ? db
          .select({
            id: schema.contents.id,
            title: schema.contents.title,
            type: schema.contents.type,
            path: schema.contents.path,
          })
          .from(schema.contents)
          .where(inArray(schema.contents.id, contentIds))
      : [],
    mediaIds.length
      ? db
          .select({
            id: schema.media.id,
            title: schema.media.title,
            fileName: schema.media.fileName,
          })
          .from(schema.media)
          .where(inArray(schema.media.id, mediaIds))
      : [],
    itemIds.length
      ? db
          .select({ id: schema.menuItems.id, label: schema.menuItems.label })
          .from(schema.menuItems)
          .where(inArray(schema.menuItems.id, itemIds))
      : [],
  ]);
  const labels = new Map<string, string>();
  const types = new Map<string, 'page' | 'post'>();
  for (const c of contents) {
    types.set(`content:${c.id}`, c.type);
    // Il titolo può mancare per scelta (home importata): si ripiega sul percorso.
    labels.set(`content:${c.id}`, c.title || c.path);
  }
  for (const m of media) {
    const label = m.title || m.fileName;
    if (label) labels.set(`media:${m.id}`, label);
  }
  for (const i of items) if (i.label) labels.set(`menu_item:${i.id}`, i.label);
  return { labels, types };
}

const labelKey = (row: Row): string =>
  `${row.entityType === 'content_seo' ? 'content' : row.entityType}:${row.entityId}`;

export async function listAudit(
  db: Database,
  query: AuditQuery,
): Promise<{ items: AuditItem[]; nextCursor: string | null }> {
  const { auditLog } = schema;
  const where = conditions(query);
  const rows = await db
    .select({
      id: auditLog.id,
      occurredAt: auditLog.occurredAt,
      occurredAtText,
      actorUserId: auditLog.actorUserId,
      actorLabel: auditLog.actorLabel,
      actorRoleLabel: auditLog.actorRoleLabel,
      actorArea: auditLog.actorArea,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      outcome: auditLog.outcome,
    })
    .from(auditLog)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
    .limit(query.limit + 1);

  const page = rows.slice(0, query.limit);
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > query.limit && last
      ? encodeCursor({ occurredAt: last.occurredAtText, id: String(last.id) })
      : null;
  const { labels, types } = await labelsFor(db, page);
  const items = page.map((row) => ({
    id: String(row.id),
    occurredAt: row.occurredAt.toISOString(),
    actorUserId: row.actorUserId,
    actorLabel: row.actorLabel,
    actorRoleLabel: row.actorRoleLabel,
    actorArea: row.actorArea,
    action: row.action,
    entityType: row.entityType,
    // Per l'accesso fallito l'id e' l'impronta dell'identificativo: non si mostra.
    entityId: row.entityType === 'auth.identifier' ? null : row.entityId,
    entityLabel: labels.get(labelKey(row)) ?? null,
    contentType: types.get(labelKey(row)) ?? null,
    outcome: row.outcome,
  }));
  return { items, nextCursor };
}

/** Fino a dieci contenuti per titolo o percorso, per scegliere su quale filtrare il registro. */
export async function searchContents(db: Database, search: string): Promise<AuditContentOption[]> {
  const escaped = search.replace(/[\\%_]/g, (char) => `\\${char}`);
  const pattern = `%${escaped}%`;
  const label = sql<string>`coalesce(nullif(${schema.contents.title}, ''), ${schema.contents.path})`;
  return db
    .select({ id: schema.contents.id, title: label, type: schema.contents.type })
    .from(schema.contents)
    .where(or(ilike(schema.contents.title, pattern), ilike(schema.contents.path, pattern)))
    .orderBy(label)
    .limit(10);
}

/** Azioni che cambiano la pagina pubblica; le copie di lavoro non contano (D127). */
const PUBLIC_CHANGES = ['content.create', 'content.update', 'content.publish', 'content.unpublish'];

export async function lastChangeOf(db: Database, contentId: string): Promise<LastChange> {
  const { auditLog } = schema;
  const [row] = await db
    .select({ actorLabel: auditLog.actorLabel, occurredAt: auditLog.occurredAt })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.outcome, 'success'),
        eq(auditLog.entityId, contentId),
        or(
          and(eq(auditLog.entityType, 'content'), inArray(auditLog.action, PUBLIC_CHANGES)),
          and(eq(auditLog.entityType, 'content_seo'), eq(auditLog.action, 'seo.content.update')),
        ),
      ),
    )
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
    .limit(1);
  if (row) {
    return {
      actorLabel: row.actorLabel ?? 'Persona non indicata',
      occurredAt: row.occurredAt.toISOString(),
    };
  }
  const [content] = await db
    .select({ modifiedAt: schema.contents.modifiedAt })
    .from(schema.contents)
    .where(eq(schema.contents.id, contentId))
    .limit(1);
  return content?.modifiedAt ? { importedAt: content.modifiedAt.toISOString() } : null;
}
