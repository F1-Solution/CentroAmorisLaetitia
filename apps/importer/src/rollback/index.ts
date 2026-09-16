/**
 * `rollback --run <id>` — annullare un'esecuzione (`importer-spec.md` §9,
 * `IMPORTER-DESIGN.md` §7). Attuato nella wave `1D-W5c`.
 *
 * Che cosa fa, esattamente: risale `import_id_map` filtrando su `run_id`, in
 * ordine inverso alle fasi, e cancella le entità che quella esecuzione ha
 * **creato** (`action = 'created'`, DR-059). Le chiavi esterne dello schema
 * fanno il resto — cancellare un contenuto porta via le sue relazioni, le sue
 * righe SEO e le sue voci di tassonomia.
 *
 * Che cosa **non** fa, e va detto invece che scoperto:
 *
 * 1. **Ciò che quell'esecuzione ha aggiornato non si ripristina.** L'importer
 *    non conserva l'immagine precedente di una riga e la specifica non gliela
 *    chiede (§7.1). `rollback` elenca le entità aggiornate e dichiara di non
 *    averle riportate indietro. Per tornare indietro davvero, `importer-spec.md`
 *    §9 indica il ripristino del backup.
 * 2. **Rifiuta di procedere se c'è stato lavoro redazionale** dopo
 *    l'esecuzione (`importer-spec.md` §9, terza riga). È la verifica di §6.4
 *    applicata all'inverso, e non si aggira con un'opzione.
 * 3. **Non tocca il registro**: `import_runs`, `import_issues` e l'audit log
 *    restano. Ciò che è accaduto resta scritto.
 * 4. **Annulla solo l'esecuzione più recente.** `import_id_map` ha una chiave
 *    unica per entità e ogni esecuzione la sovrascrive: dopo un secondo
 *    `apply`, della prima esecuzione non resta traccia nella mappa. Annullarla
 *    non cancellerebbe nulla e lo direbbe come se fosse riuscito, che è il
 *    modo peggiore di fallire. Si rifiuta invece, e si spiega perché
 *    (misurato in `1D-W5c`, `IMPORTER-DESIGN.md` §11.15).
 */
import { and, desc, eq, gt, inArray, isNotNull, ne } from 'drizzle-orm';
import { schema, type Database } from '@amoris/db';
import type { EntityKind } from '../stages/types.js';

/**
 * L'ordine di cancellazione: **l'inverso** dell'ordine delle fasi di
 * `importer-spec.md` §4. Non è una preferenza — `documents.mediaId` e
 * `form_submissions.formId` sono chiavi esterne `restrict`, e cancellare un
 * media prima del documento che lo cita, o un form prima delle sue
 * compilazioni, fallisce.
 */
const DELETION_ORDER: readonly EntityKind[] = [
  'form',
  'slider_slide',
  'slider',
  'document',
  'menu_item',
  'menu',
  'content',
  'term',
  'media',
  'user',
];

/**
 * Le entità che `import_id_map` non registra: `settings`, `roles`,
 * `permissions` e `seo_templates` hanno una chiave naturale, si aggiornano con
 * un `INSERT … ON CONFLICT` e non passano dalla mappa (`persistence/idMap.ts`).
 * Sono configurazione, non contenuto importato: `rollback` non le tocca, e lo
 * dichiara.
 */
export const ENTITIES_NOT_ROLLED_BACK: readonly EntityKind[] = [
  'setting',
  'seo_template',
  'role',
  'permission',
];

export interface EntityTally {
  readonly entity: EntityKind;
  readonly count: number;
}

export interface RollbackPlan {
  readonly runId: string;
  readonly runExists: boolean;
  /** `null` se l'esecuzione non è mai stata chiusa. */
  readonly runFinishedAt: Date | null;
  /**
   * L'identificatore di un'esecuzione successiva che ha sovrascritto la
   * traccia di questa in `import_id_map`. Se non è `null`, `rollback` **non
   * procede**: vedi il punto 4 dell'intestazione.
   */
  readonly supersededBy: string | null;
  /**
   * Gli identificatori dei contenuti modificati da un redattore dopo la fine
   * dell'esecuzione. Se non è vuoto, `rollback` **non procede**.
   */
  readonly editorialWorkAfter: readonly string[];
  /** Entità create da questa esecuzione: verranno cancellate. */
  readonly toDelete: readonly EntityTally[];
  /** Entità che l'esecuzione ha solo aggiornato: **non** vengono ripristinate. */
  readonly updatedNotRestored: readonly EntityTally[];
}

export function canProceed(plan: RollbackPlan): boolean {
  return plan.runExists && plan.editorialWorkAfter.length === 0 && plan.supersededBy === null;
}

/** Legge che cosa `rollback` farebbe, senza cancellare nulla. */
export async function planRollback(db: Database, runId: string): Promise<RollbackPlan> {
  const [run] = await db
    .select({
      id: schema.importRuns.id,
      startedAt: schema.importRuns.startedAt,
      finishedAt: schema.importRuns.finishedAt,
    })
    .from(schema.importRuns)
    .where(eq(schema.importRuns.id, runId));

  if (!run) {
    return {
      runId,
      runExists: false,
      runFinishedAt: null,
      supersededBy: null,
      editorialWorkAfter: [],
      toDelete: [],
      updatedNotRestored: [],
    };
  }

  const rows = await db
    .select({
      entity: schema.importIdMap.entity,
      action: schema.importIdMap.action,
    })
    .from(schema.importIdMap)
    .where(eq(schema.importIdMap.runId, runId));

  const created = new Map<EntityKind, number>();
  const updated = new Map<EntityKind, number>();
  for (const row of rows) {
    const entity = row.entity as EntityKind;
    const target = row.action === 'created' ? created : updated;
    target.set(entity, (target.get(entity) ?? 0) + 1);
  }

  const tally = (source: ReadonlyMap<EntityKind, number>): EntityTally[] =>
    DELETION_ORDER.filter((entity) => source.has(entity)).map((entity) => ({
      entity,
      count: source.get(entity) ?? 0,
    }));

  return {
    runId,
    runExists: true,
    runFinishedAt: run.finishedAt,
    supersededBy: await laterRunInIdMap(db, runId, run.startedAt),
    editorialWorkAfter: await contentsEditedAfter(db, run.finishedAt),
    toDelete: tally(created),
    updatedNotRestored: tally(updated),
  };
}

/**
 * L'esecuzione successiva che ha sovrascritto la traccia di questa. Si cerca
 * in `import_id_map` e non in `import_runs`: un'esecuzione successiva che non
 * abbia toccato la mappa — per esempio un `apply` fallito al preflight — non
 * ha sovrascritto nulla e non deve impedire l'annullamento.
 */
async function laterRunInIdMap(
  db: Database,
  runId: string,
  startedAt: Date,
): Promise<string | null> {
  // Solo le esecuzioni **iniziate dopo** questa: una precedente non può averne
  // sovrascritto la traccia, ed è anzi il caso normale di un secondo `apply`
  // che si annulla. Basta la piu' recente: non serve `distinct`, che con un
  // `ORDER BY` su una colonna non selezionata PostgreSQL rifiuta.
  const [row] = await db
    .select({ runId: schema.importIdMap.runId })
    .from(schema.importIdMap)
    .innerJoin(schema.importRuns, eq(schema.importRuns.id, schema.importIdMap.runId))
    .where(
      and(
        isNotNull(schema.importIdMap.runId),
        ne(schema.importIdMap.runId, runId),
        gt(schema.importRuns.startedAt, startedAt),
      ),
    )
    .orderBy(desc(schema.importRuns.startedAt))
    .limit(1);
  return row?.runId ?? null;
}

/**
 * I contenuti con una riga di cronologia redazionale successiva alla fine
 * dell'esecuzione. Stessa traccia della protezione in avanti
 * (`stages/contents/editorialProtection.ts`): `content_revisions`, che
 * l'importer non scrive mai.
 */
async function contentsEditedAfter(
  db: Database,
  finishedAt: Date | null,
): Promise<readonly string[]> {
  if (finishedAt === null) return [];
  const rows = await db
    .selectDistinct({ contentId: schema.contentRevisions.contentId })
    .from(schema.contentRevisions)
    .where(gt(schema.contentRevisions.createdAt, finishedAt));
  return rows.map((row) => row.contentId);
}

export interface RollbackResult {
  readonly deleted: readonly EntityTally[];
  readonly migrationRedirectsDeleted: number;
}

/**
 * Esegue l'annullamento. Una sola transazione: un annullamento a metà
 * lascerebbe il database in uno stato che nessuna esecuzione ha mai prodotto,
 * peggiore sia di quello di prima sia di quello di dopo.
 */
export async function applyRollback(db: Database, plan: RollbackPlan): Promise<RollbackResult> {
  if (!canProceed(plan)) {
    throw new Error('applyRollback chiamata su un piano che non può procedere');
  }

  const deleted: EntityTally[] = [];
  let migrationRedirectsDeleted = 0;

  await db.transaction(async (tx) => {
    for (const { entity } of plan.toDelete) {
      const ids = await createdIdsFor(tx, plan.runId, entity);
      if (ids.length === 0) continue;

      if (entity === 'form') {
        // `form_submissions.formId` è `restrict`: le compilazioni dei form
        // creati da questa esecuzione se ne vanno con loro. Le ha inserite la
        // stessa esecuzione — la fase 12 inserisce e non aggiorna mai
        // (`importer-spec.md` §6.2) — quindi non è lavoro di nessun altro.
        await tx.delete(schema.formSubmissions).where(inArray(schema.formSubmissions.formId, ids));
      }

      deleted.push({ entity, count: await deleteEntityRows(tx, entity, ids) });
    }

    // I redirect `migration` e le due tabelle `legacy_*` non passano da
    // `import_id_map`: nessuna riga di quelle tabelle porta scritto da quale
    // esecuzione venga. Si svuotano **solo se questo annullamento ha davvero
    // cancellato qualcosa**.
    //
    // Il motivo del «solo se» è un difetto misurato in `1D-W5c`: annullare
    // un'esecuzione che non ha creato nulla — il secondo `apply` di fila —
    // svuotava comunque quelle tabelle, cioè distruggeva le righe della
    // **prima** esecuzione, che resta valida. Un'esecuzione che non ha creato
    // niente non ha niente di proprio là dentro, e la regola di §7.1 vale
    // anche qui: ciò che ha solo riscritto non si ripristina.
    if (deleted.length > 0) {
      const removed = await tx
        .delete(schema.redirects)
        .where(eq(schema.redirects.origin, 'migration'))
        .returning({ id: schema.redirects.id });
      migrationRedirectsDeleted = removed.length;

      // Quelli `manual` non si toccano mai: lo dice `importer-spec.md` §9 e un
      // test lo verifica.
      await tx.delete(schema.legacyEmailLog);
      await tx.delete(schema.legacyDownloadStats);
    }

    // Le righe della mappa che puntano a entità ormai cancellate se ne vanno
    // con loro: lasciarle farebbe credere alla prossima esecuzione di dover
    // aggiornare una riga che non esiste più.
    await tx
      .delete(schema.importIdMap)
      .where(
        and(eq(schema.importIdMap.runId, plan.runId), eq(schema.importIdMap.action, 'created')),
      );
  });

  return { deleted, migrationRedirectsDeleted };
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

async function createdIdsFor(tx: Tx, runId: string, entity: EntityKind): Promise<string[]> {
  const rows = await tx
    .select({ entityId: schema.importIdMap.entityId })
    .from(schema.importIdMap)
    .where(
      and(
        eq(schema.importIdMap.runId, runId),
        eq(schema.importIdMap.entity, entity),
        eq(schema.importIdMap.action, 'created'),
      ),
    );
  return rows.map((row) => row.entityId);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- le tabelle hanno forme diverse fra loro: qui conta solo la colonna dell'identificatore, e tipizzarne l'unione non aggiungerebbe alcuna garanzia. */

async function deleteEntityRows(
  tx: Tx,
  entity: EntityKind,
  ids: readonly string[],
): Promise<number> {
  switch (entity) {
    case 'content':
      return deleteLeavesFirst(tx, ids, schema.contents, schema.contents.id, schema.contents.parentId);
    case 'term':
      return deleteLeavesFirst(tx, ids, schema.terms, schema.terms.id, schema.terms.parentId);
    case 'media':
      return simpleDelete(tx, schema.media, schema.media.id, ids);
    case 'user':
      return simpleDelete(tx, schema.users, schema.users.id, ids);
    case 'menu':
      return simpleDelete(tx, schema.menus, schema.menus.id, ids);
    case 'menu_item':
      // `menu_items.parentId` è `cascade`: un solo `DELETE` basta, e le voci
      // annidate se ne vanno con la loro radice.
      return simpleDelete(tx, schema.menuItems, schema.menuItems.id, ids);
    case 'document':
      return simpleDelete(tx, schema.documents, schema.documents.id, ids);
    case 'slider':
      return simpleDelete(tx, schema.sliders, schema.sliders.id, ids);
    case 'slider_slide':
      return simpleDelete(tx, schema.sliderSlides, schema.sliderSlides.id, ids);
    case 'form':
      return simpleDelete(tx, schema.forms, schema.forms.id, ids);
    default:
      // `setting`, `seo_template`, `role`, `permission`: vedi
      // `ENTITIES_NOT_ROLLED_BACK`.
      return 0;
  }
}

async function simpleDelete(
  tx: Tx,
  table: any,
  idColumn: any,
  ids: readonly string[],
): Promise<number> {
  const removed = await tx
    .delete(table)
    .where(inArray(idColumn, [...ids]))
    .returning({ id: idColumn });
  return removed.length;
}

/**
 * `contents.parentId` e `terms.parentId` sono chiavi esterne `restrict` verso
 * la stessa tabella: cancellare un genitore prima dei suoi figli fallisce, e
 * un solo `DELETE` non basta perché `restrict` è verificata riga per riga, non
 * a fine istruzione. Si cancella quindi a ondate, partendo dalle foglie.
 */
async function deleteLeavesFirst(
  tx: Tx,
  ids: readonly string[],
  table: any,
  idColumn: any,
  parentColumn: any,
): Promise<number> {
  let remaining = [...ids];
  let total = 0;

  while (remaining.length > 0) {
    const referenced = await tx
      .selectDistinct({ parentId: parentColumn })
      .from(table)
      .where(and(inArray(idColumn, remaining), isNotNull(parentColumn)));
    const parents = new Set(
      (referenced as readonly { parentId: string | null }[]).map((row) => row.parentId),
    );
    const leaves = remaining.filter((id) => !parents.has(id));

    if (leaves.length === 0) {
      // Lo schema non consente un ciclo fra genitori, ma se ce ne fosse uno
      // questo giro non finirebbe mai. Ci si ferma e lo si dice.
      throw new Error(
        `rollback: ciclo di genitori fra ${remaining.length} righe, cancellazione interrotta`,
      );
    }

    const removed = await tx
      .delete(table)
      .where(inArray(idColumn, leaves))
      .returning({ id: idColumn });
    total += removed.length;
    remaining = remaining.filter((id) => !leaves.includes(id));
  }

  return total;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
