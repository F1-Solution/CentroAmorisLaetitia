import type { AddressOption, AddressPlan } from '@amoris/contracts';
import { databaseNow, schema, type Database } from '@amoris/db';
import { and, eq, inArray, notInArray, or, sql } from 'drizzle-orm';
import { PERMISSIONS } from '../../auth/permissions.js';
import { homeContentId, resolveRedirect } from '../public/service.js';
import { decodeSlug } from './schemas.js';

/**
 * Cambio d'indirizzo di un contenuto (wave 1G-W3, W3-PLAN §5): una sola funzione
 * calcola il piano, **senza scrivere**, per l'anteprima e per la scrittura, che lo
 * ricalcola dentro la propria transazione e lo applica.
 */

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Database o transazione: la scrittura ricalcola il piano dentro la propria. */
export type Executor = Database | Transaction;

/** Slug di primo livello che il sito instrada per sé (D133-A, DR-237). */
export const RESERVED_SLUGS: readonly string[] = [
  'category',
  'download',
  'download-category',
  'media',
  'forms',
  'feed',
  'wp-content',
  'page',
  'fonts',
  'admin',
  'api',
  '_next',
  'wp-sitemap.xml',
  'sitemap.xml',
  'robots.txt',
  'favicon.ico',
];

export interface AddressTarget {
  readonly slug: string;
  /** `null`: primo livello. */
  readonly parentId: string | null;
}

type Move = AddressPlan['moves'][number];
type RedirectChanges = Pick<
  AddressPlan,
  'redirectsCreated' | 'redirectsRetargeted' | 'redirectsRemoved'
>;

interface Rule {
  readonly sourcePath: string;
  readonly targetPath: string;
  readonly kind: 'exact' | 'prefix';
  readonly origin: 'migration' | 'manual' | 'automatic';
}

const ORIGIN_LABELS: Record<Rule['origin'], string> = {
  manual: 'un redirect manuale',
  migration: 'un redirect della migrazione',
  automatic: 'un redirect automatico',
};

const c = schema.contents;
const r = schema.redirects;

/** Ordine dei byte: le discendenti seguono il genitore qualunque sia la collazione del database. */
const byPath = () => sql`${c.path} collate "C"`;

function addressError(statusCode: 400 | 403 | 409, code: string, message: string): Error {
  return Object.assign(new Error(message), { statusCode, code });
}

const invalidParent = (message: string) => addressError(400, 'CONTENT_PARENT_INVALID', message);

async function findContent(exec: Executor, id: string) {
  const [row] = await exec
    .select({ id: c.id, type: c.type, path: c.path })
    .from(c)
    .where(eq(c.id, id))
    .limit(1);
  return row ?? null;
}

type Current = NonNullable<Awaited<ReturnType<typeof findContent>>>;

const pathTaken = (path?: string) =>
  addressError(
    409,
    'CONTENT_PATH_TAKEN',
    `L'indirizzo ${path ?? 'scelto'} è già usato da un altro contenuto.`,
  );

/** Gli slug riservati si confrontano decodificati e in minuscolo: `%4d%45%44%49%41` è `media`, il proxy ignora le maiuscole (D136-A). */
function assertSlugAllowed(target: AddressTarget): void {
  const slug = decodeSlug(target.slug) ?? target.slug;
  if (target.parentId === null && RESERVED_SLUGS.includes(slug.toLowerCase())) {
    throw addressError(
      400,
      'CONTENT_SLUG_RESERVED',
      `L'indirizzo /${slug}/ è usato dal sito stesso: al primo livello non si può dare a un contenuto.`,
    );
  }
}

/** La pagina genitore di un contenuto di quel tipo (S2); `selfId` è il contenuto che si sposta, se c'è. */
async function parentPage(
  exec: Executor,
  type: Current['type'],
  parentId: string,
  selfId: string | null,
) {
  if (type === 'post') throw invalidParent('Una notizia non ha una pagina genitore.');
  if (parentId === selfId) {
    throw invalidParent('Un contenuto non può essere il genitore di sé stesso.');
  }
  const parent = await findContent(exec, parentId);
  if (!parent) throw invalidParent('La pagina scelta come genitore non esiste.');
  if (parent.type !== 'page') {
    throw invalidParent('Il genitore deve essere una pagina, non una notizia.');
  }
  return parent;
}

/** Il percorso sotto cui va il contenuto: `/` al primo livello, altrimenti quello della pagina genitore (S2). */
async function parentPathOf(exec: Executor, content: Current, parentId: string | null) {
  if (parentId === null) return '/';
  const parent = await parentPage(exec, content.type, parentId, content.id);
  if (parent.path.startsWith(content.path)) {
    throw invalidParent('La pagina scelta come genitore sta sotto questo contenuto.');
  }
  return parent.path;
}

/** Il contenuto e le discendenti, per prefisso del percorso materializzato, col percorso nuovo. */
async function movesOf(exec: Executor, from: string, to: string): Promise<Move[]> {
  const rows = await exec
    .select({ id: c.id, title: c.title, path: c.path, status: c.status })
    .from(c)
    .where(sql`starts_with(${c.path}, ${from})`)
    .orderBy(byPath());
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    from: row.path,
    to: to + row.path.slice(from.length),
    published: row.status === 'published',
  }));
}

/** Un percorso nuovo già usato fuori dal sottoalbero rifiuta l'intero spostamento (§6 caso 2). */
async function assertPathsFree(
  exec: Executor,
  paths: readonly string[],
  movingIds: readonly string[],
): Promise<void> {
  const [taken] = await exec
    .select({ path: c.path })
    .from(c)
    .where(and(inArray(c.path, [...paths]), notInArray(c.id, [...movingIds])))
    .orderBy(byPath())
    .limit(1);
  if (taken) throw pathTaken(taken.path);
}

/** Le regole che partono da un indirizzo coinvolto o puntano a un vecchio indirizzo. */
function rulesTouching(exec: Executor, moves: readonly Move[]): Promise<Rule[]> {
  const from = moves.map((move) => move.from);
  const to = moves.map((move) => move.to);
  return exec
    .select({ sourcePath: r.sourcePath, targetPath: r.targetPath, kind: r.kind, origin: r.origin })
    .from(r)
    .where(or(inArray(r.sourcePath, [...from, ...to]), inArray(r.targetPath, from)))
    .orderBy(sql`${r.sourcePath} collate "C"`);
}

/** Il criterio «regola di partenza», comune a piano e scrittura: il vecchio indirizzo di un contenuto pubblicato che si sposta. */
function departureOf(moves: readonly Move[], path: string): Move | undefined {
  return moves.find((move) => move.published && move.from === path);
}

interface Arrivals {
  readonly removed: Rule[];
  readonly kept: Rule[];
}

/**
 * D131-A, in arrivo: una regola manuale o della migrazione fa rifiutare; una automatica
 * si toglie se arriva un contenuto pubblicato, altrimenti resta com'è (D135-A, DR-239).
 */
function arrivalRules(rules: readonly Rule[], moves: readonly Move[]): Arrivals {
  const arriving = new Map(moves.map((move) => [move.to, move]));
  const found = rules.filter((rule) => rule.kind === 'exact' && arriving.has(rule.sourcePath));
  const blocking = found.find((rule) => rule.origin !== 'automatic');
  if (blocking) {
    throw addressError(
      409,
      'REDIRECT_AT_DESTINATION',
      `L'indirizzo ${blocking.sourcePath} è l'origine di ${ORIGIN_LABELS[blocking.origin]} verso ${blocking.targetPath}: va tolto o cambiato dalla pagina dei redirect prima dello spostamento.`,
    );
  }
  const published = (rule: Rule) => arriving.get(rule.sourcePath)?.published === true;
  return {
    removed: found.filter(published),
    kept: found.filter((rule) => !published(rule)),
  };
}

/** Sul vecchio indirizzo di un contenuto pubblicato non può nascere il redirect se c'è una regola a prefisso (S4). */
function assertNoPrefixOnDeparture(rules: readonly Rule[], moves: readonly Move[]) {
  const blocking = rules.find(
    (rule) => rule.kind === 'prefix' && departureOf(moves, rule.sourcePath) !== undefined,
  );
  if (blocking) {
    throw addressError(
      409,
      'REDIRECT_AT_DESTINATION',
      `L'indirizzo ${blocking.sourcePath} è l'origine di una regola a prefisso verso ${blocking.targetPath}, che non si riscrive: va tolta o cambiata dalla pagina dei redirect prima dello spostamento.`,
    );
  }
}

/** Redirect creati, riscritti e tolti; per la home la destinazione è `/` (S3). */
function redirectChanges(
  rules: readonly Rule[],
  moves: readonly Move[],
  homeId: string | null,
): RedirectChanges {
  const destination = (move: Move) => (move.id === homeId ? '/' : move.to);
  const { removed, kept } = arrivalRules(rules, moves);
  // Le regole in arrivo non si riscrivono: tolte, o rimaste com'erano (D135-A).
  const arrivals = new Set([...removed, ...kept].map((rule) => rule.sourcePath));
  const moved = new Map(moves.map((move) => [move.from, destination(move)]));
  assertNoPrefixOnDeparture(rules, moves);

  const retargeted: AddressPlan['redirectsRetargeted'] = [];
  for (const rule of rules) {
    if (rule.kind !== 'exact' || arrivals.has(rule.sourcePath)) continue;
    // La regola nascosta in partenza porta al nuovo indirizzo (D131-A); le altre, se puntano a un vecchio (D130-A).
    const departing = departureOf(moves, rule.sourcePath);
    const to = departing ? destination(departing) : moved.get(rule.targetPath);
    if (to === undefined) continue;
    retargeted.push({ source: rule.sourcePath, from: rule.targetPath, to, origin: rule.origin });
  }

  // Dove una regola esiste già la si riusa: l'origine di una regola è unica.
  const sources = new Set(rules.map((rule) => rule.sourcePath));
  return {
    redirectsCreated: moves
      .filter((move) => move.published && !sources.has(move.from))
      .map((move) => ({ from: move.from, to: destination(move) })),
    redirectsRetargeted: retargeted,
    redirectsRemoved: removed.map((rule) => ({ source: rule.sourcePath, target: rule.targetPath })),
  };
}

/** D132-A: canonical e voci di menu personalizzate uguali a un vecchio percorso si segnalano, non si riscrivono. */
async function warningsFor(exec: Executor, oldPaths: string[]): Promise<AddressPlan['warnings']> {
  const seo = schema.contentSeo;
  const item = schema.menuItems;
  const canonical = await exec
    .select({ id: seo.contentId, value: sql<string>`${seo.canonicalUrl}` })
    .from(seo)
    .where(inArray(sql`trim(${seo.canonicalUrl})`, oldPaths))
    .orderBy(seo.contentId);
  const menu = await exec
    .select({ id: item.id, value: sql<string>`${item.url}` })
    .from(item)
    .where(and(eq(item.kind, 'custom'), inArray(sql`trim(${item.url})`, oldPaths)))
    .orderBy(item.id);
  return [
    ...canonical.map((row) => ({ kind: 'canonical' as const, ...row })),
    ...menu.map((row) => ({ kind: 'menu' as const, ...row })),
  ];
}

/**
 * Il piano per portare il contenuto a `target`; `null` se il contenuto non c'è.
 * Lancia gli errori con i codici stabili del W3-PLAN §5; non scrive nulla.
 */
export async function planAddressChange(
  exec: Executor,
  contentId: string,
  target: AddressTarget,
): Promise<AddressPlan | null> {
  const content = await findContent(exec, contentId);
  if (!content) return null;
  assertSlugAllowed(target);
  const path = `${await parentPathOf(exec, content, target.parentId)}${target.slug}/`;
  if (path === content.path) {
    return {
      path,
      moves: [],
      redirectsCreated: [],
      redirectsRetargeted: [],
      redirectsRemoved: [],
      warnings: [],
    };
  }

  const moves = await movesOf(exec, content.path, path);
  await assertPathsFree(
    exec,
    moves.map((move) => move.to),
    moves.map((move) => move.id),
  );
  const changes = redirectChanges(
    await rulesTouching(exec, moves),
    moves,
    await homeContentId(exec),
  );
  const warnings = await warningsFor(
    exec,
    moves.map((move) => move.from),
  );
  return { path, moves, ...changes, warnings };
}

/** Le pagine che possono fare da genitore: non il contenuto né le sue discendenti; nessuna per una notizia. */
export async function parentOptions(
  exec: Executor,
  contentId: string,
): Promise<AddressOption[] | null> {
  const content = await findContent(exec, contentId);
  if (!content) return null;
  if (content.type === 'post') return [];
  return exec
    .select({ id: c.id, title: c.title, path: c.path })
    .from(c)
    .where(and(eq(c.type, 'page'), sql`not starts_with(${c.path}, ${content.path})`))
    .orderBy(byPath());
}

/** Il percorso di un contenuto nuovo, con gli stessi controlli del cambio d'indirizzo (W3-5). */
export async function newContentPath(
  exec: Executor,
  type: Current['type'],
  target: AddressTarget,
): Promise<string> {
  assertSlugAllowed(target);
  const parentPath =
    target.parentId === null ? '/' : (await parentPage(exec, type, target.parentId, null)).path;
  const path = `${parentPath}${target.slug}/`;
  await assertPathsFree(exec, [path], []);
  return path;
}

interface PgError {
  readonly code?: unknown;
  readonly constraint_name?: unknown;
  readonly detail?: unknown;
}

/** Una violazione d'unicità come rifiuto 409, un genitore sparito come 400; `null` per ogni altro errore. */
function conflictFrom(caught: unknown): Error | null {
  const pg = (caught instanceof Error && caught.cause ? caught.cause : caught) as PgError | null;
  if (typeof pg !== 'object' || pg === null) return null;
  // La pagina genitore eliminata fra il piano e la scrittura (m-5).
  if (pg.code === '23503' && pg.constraint_name === 'contents_parent_id_contents_id_fk') {
    return invalidParent(
      'La pagina scelta come genitore non esiste più: ricarica le pagine e riprova.',
    );
  }
  if (pg.code !== '23505') return null;
  // `Key (path)=(/x/) already exists.`: la coppia non cambia con la lingua del server.
  const pair = typeof pg.detail === 'string' ? /\(([^)]*)\)=\((.*)\)/.exec(pg.detail) : null;
  const path = pair && ['path', 'source_path'].includes(pair[1] ?? '') ? pair[2] : undefined;
  if (pg.constraint_name === 'redirects_source_unique') {
    return addressError(
      409,
      'REDIRECT_AT_DESTINATION',
      `L'indirizzo ${path ?? 'di partenza'} è diventato l'origine di un redirect durante lo spostamento: riapri l'anteprima e riprova.`,
    );
  }
  const contentPath = ['contents_path_unique', 'contents_slug_parent_unique'];
  return contentPath.includes(String(pg.constraint_name)) ? pathTaken(path) : null;
}

/**
 * Le scritture dei percorsi passano una alla volta (blocco consultivo della
 * transazione, come in `accounts`); un duplicato arrivato da fuori diventa un 409,
 * un genitore eliminato da fuori un 400.
 */
export async function withPathLock<T>(
  db: Database,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('contents.paths'))`);
      return run(tx);
    });
  } catch (caught) {
    throw conflictFrom(caught) ?? caught;
  }
}

/** Blocca il contenuto e le discendenti prima di rileggerli; `null` se il contenuto non c'è. */
async function lockSubtree(tx: Transaction, contentId: string): Promise<string | null> {
  const [content] = await tx
    .select({ path: c.path })
    .from(c)
    .where(eq(c.id, contentId))
    .for('update');
  if (!content) return null;
  await tx
    .select({ id: c.id })
    .from(c)
    .where(sql`starts_with(${c.path}, ${content.path})`)
    .for('update');
  return content.path;
}

/** I percorsi del sottoalbero per sostituzione del prefisso, poi slug e genitore del contenuto. */
async function moveContents(
  tx: Transaction,
  contentId: string,
  target: AddressTarget,
  from: string,
  to: string,
): Promise<void> {
  await tx
    .update(c)
    .set({ path: sql`${to}::text || substr(${c.path}, ${from.length + 1}::int)` })
    .where(sql`starts_with(${c.path}, ${from})`);
  // DR-186: cambia la data di modifica; `updatedAt` no, è la base delle copie di lavoro (§6 caso 4).
  await tx
    .update(c)
    .set({ slug: target.slug, parentId: target.parentId, modifiedAt: databaseNow() })
    .where(eq(c.id, contentId));
}

/** Regole in arrivo tolte, riscritture, regole automatiche nuove (D130-A, D131-A, S1). */
async function writeRedirects(tx: Transaction, plan: AddressPlan): Promise<void> {
  const removed = plan.redirectsRemoved.map((rule) => rule.source);
  if (removed.length > 0) {
    await tx.delete(r).where(and(inArray(r.sourcePath, removed), eq(r.origin, 'automatic')));
  }
  for (const rule of plan.redirectsRetargeted) {
    // Sul vecchio indirizzo di un contenuto pubblicato la regola fa da redirect automatico (W3-2, D134-A).
    const reused = departureOf(plan.moves, rule.source)
      ? { isActive: true, statusCode: 301, origin: 'automatic' as const }
      : {};
    await tx
      .update(r)
      .set({ targetPath: rule.to, updatedAt: databaseNow(), ...reused })
      .where(eq(r.sourcePath, rule.source));
  }
  if (plan.redirectsCreated.length === 0) return;
  await tx.insert(r).values(
    plan.redirectsCreated.map((rule) => ({
      sourcePath: rule.from,
      targetPath: rule.to,
      statusCode: 301,
      kind: 'exact' as const,
      origin: 'automatic' as const,
      isActive: true,
    })),
  );
}

interface Touched {
  readonly source: string;
  readonly target: string;
}

const cycle = (rule: Touched, why: string, advice = '') =>
  addressError(
    409,
    'REDIRECT_CYCLE',
    `Il redirect da ${rule.source} verso ${rule.target} ${why}: lo spostamento è stato annullato.${advice}`,
  );

/** Il percorso come lo legge il browser, con i segmenti `.` e `..` risolti anche se codificati (D136-A). */
const normalizedPath = (path: string) => new URL(path, 'http://x').pathname;

/** Le regole che lo spostamento crea o riscrive, con la loro destinazione nuova. */
function touchedRules(plan: AddressPlan): Touched[] {
  return [
    ...plan.redirectsCreated.map((rule) => ({ source: rule.from, target: rule.to })),
    ...plan.redirectsRetargeted.map((rule) => ({ source: rule.source, target: rule.to })),
  ];
}

/** Prima di scrivere: un auto-anello violerebbe `redirects_no_self_loop` con un 500, o il browser lo seguirebbe. */
function assertNoSelfLoop(touched: readonly Touched[]): void {
  const loop = touched.find((rule) => normalizedPath(rule.source) === normalizedPath(rule.target));
  if (loop) throw cycle(loop, 'tornerebbe su sé stesso');
}

/** Il percorso è quello della home, che il sito porta a `/` senza una regola. */
async function isHomePath(tx: Transaction, path: string): Promise<boolean> {
  const homeId = await homeContentId(tx);
  if (!homeId) return false;
  const home = await findContent(tx, homeId);
  return home?.path === path;
}

/**
 * Dopo le scritture: ogni regola esatta attiva toccata, e quella rimasta su un indirizzo
 * d'arrivo (D135-A), porta in un passo, come la legge il sito (W3-3).
 */
async function assertNoChains(
  tx: Transaction,
  sources: readonly string[],
  created: ReadonlySet<string>,
): Promise<void> {
  if (sources.length === 0) return;
  const active = await tx
    .select({ source: r.sourcePath, target: r.targetPath })
    .from(r)
    .where(and(inArray(r.sourcePath, [...sources]), eq(r.kind, 'exact'), eq(r.isActive, true)))
    .orderBy(sql`${r.sourcePath} collate "C"`);
  for (const rule of active) {
    const next = normalizedPath(rule.target);
    const chained = await resolveRedirect(tx, next);
    if (chained) {
      // Il consiglio vale solo se il secondo passo è una regola esistente: non il redirect della home né una regola nata da questo spostamento.
      const editable = !created.has(next) && !(await isHomePath(tx, next));
      throw cycle(
        rule,
        `porterebbe a un altro redirect, da ${next} verso ${chained.targetPath}`,
        editable ? ' Togli o cambia uno dei due dalla pagina dei redirect, poi riprova.' : '',
      );
    }
  }
}

/** D138-A (DR-242): toccare regole esistenti chiede `settings.write`, spostare un contenuto pubblicato `content.publish`. */
function assertPermitted(plan: AddressPlan, permissions: ReadonlySet<string>): void {
  const touchesRules = plan.redirectsRetargeted.length > 0 || plan.redirectsRemoved.length > 0;
  const movesPublished = plan.moves.some((move) => move.published);
  if (
    (touchesRules && !permissions.has(PERMISSIONS.settingsWrite)) ||
    (movesPublished && !permissions.has(PERMISSIONS.contentPublish))
  ) {
    // Come `requirePermission`: il messaggio non dice quale permesso manchi (ADR-007 §3.1, controllo 9).
    throw addressError(403, 'NOT_AUTHORIZED', 'Operazione non consentita.');
  }
}

/**
 * Applica il cambio d'indirizzo in una transazione (W3-PLAN §5): blocco, piano
 * ricalcolato (mai quello dell'anteprima), permessi, scritture, controllo finale
 * di catene e cicli. Restituisce il piano applicato; `null` se il contenuto non c'è.
 */
export function applyAddressChange(
  db: Database,
  contentId: string,
  target: AddressTarget,
  permissions: ReadonlySet<string>,
): Promise<AddressPlan | null> {
  return withPathLock(db, async (tx) => {
    const from = await lockSubtree(tx, contentId);
    if (from === null) return null;
    const plan = await planAddressChange(tx, contentId, target);
    if (!plan || plan.moves.length === 0) return plan;
    assertPermitted(plan, permissions);
    const touched = touchedRules(plan);
    assertNoSelfLoop(touched);
    await moveContents(tx, contentId, target, from, plan.path);
    await writeRedirects(tx, plan);
    // Le regole automatiche rimaste sugli indirizzi d'arrivo (D135-A) devono portare in un passo anch'esse.
    const arrivals = plan.moves.map((move) => move.to);
    await assertNoChains(
      tx,
      [...touched.map((rule) => rule.source), ...arrivals],
      new Set(plan.redirectsCreated.map((rule) => rule.from)),
    );
    return plan;
  });
}
