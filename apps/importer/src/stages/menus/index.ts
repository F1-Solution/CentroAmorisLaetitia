/**
 * Fase 7 `menus` (`importer-spec.md` §4): produce `menus` e `menu_items`.
 *
 * Sorgente (`wp-to-postgres-mapping.md`, righe su `nav_menu_item` e sulle
 * chiavi `_menu_item_*`/`_nav_menu_role*`): il menu stesso è un termine della
 * tassonomia `wp_terms`/`wp_term_taxonomy` con `taxonomy = 'nav_menu'` (stesso
 * schema di lettura di `terms/index.ts`, incluso lo scarto delle righe di
 * tassonomia senza termine corrispondente); le 64 voci sono `wp_posts` con
 * `post_type = 'nav_menu_item'`, e i dettagli di ciascuna stanno in
 * `wp_postmeta`.
 *
 * Misurato sulla sorgente reale: **una sola** riga `wp_term_taxonomy` con
 * `taxonomy = 'nav_menu'` ha anche una riga `wp_terms` corrispondente
 * (`term_id = 3`, «Menu principale», `count = 64`); l'altra
 * (`term_taxonomy_id = 40`) è orfana e si scarta, come per `terms`. Il menu
 * importato è quindi uno solo.
 *
 * **Visibilità** (`source-supplementary-findings.md` §3, e la logica del
 * plugin sorgente `nav-menu-roles`, letta per capire come combina
 * `_nav_menu_role` e `_nav_menu_role_display_mode`): quattro casi, misurati
 * sulla sorgente.
 *
 * | `_nav_menu_role` | `_nav_menu_role_display_mode` | `menuVisibility` |
 * |---|---|---|
 * | assente o vuoto | `show` (o assente) | `public` |
 * | assente o vuoto | `hide` | `hidden` — invertita: nascosta a tutti, anche agli amministratori |
 * | `'in'` | `show` (o assente) | `authenticated` |
 * | array di ruoli serializzato PHP | `show` (o assente) | `roles`, con `visibleToRoles` |
 *
 * Qualunque altra combinazione (per esempio `'out'`, o `display_mode = 'hide'`
 * insieme a `'in'` o a un array — nessuna presente nella sorgente misurata) è
 * un fatto nuovo: si registra un avviso e la voce diventa `hidden`, la scelta
 * più prudente, invece di indovinare.
 *
 * **Voci non risolvibili**: una delle 64 voci (`_menu_item_type = 'taxonomy'`,
 * `_menu_item_object = 'wpdmcategory'`) punta a un termine di una tassonomia
 * che `terms/index.ts` non importa — quella fase importa solo
 * `taxonomy = 'category'` (commento in testa a quel modulo). Espandere quella
 * scelta appartiene alla fase `terms`, già completata e non in perimetro qui:
 * questa fase non la rifà di propria iniziativa. La voce non risolvibile
 * produce un avviso e non genera una riga `menu_items` — lo schema
 * (`menu_items_target_matches_kind`) non permette comunque un `kind = 'term'`
 * senza un `termId` valido. È coerente con `relations/index.ts`, che fa lo
 * stesso per un riferimento a termine non risolvibile.
 */
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';
import { phpUnserialize, type PhpValue } from '../../source/php/unserialize.js';
import { texturizePlain } from '../../convert/shared/wptexturize.js';

interface MenuRow {
  readonly termId: number;
  readonly slug: string;
  readonly name: string;
}

interface MenuItemVisibility {
  readonly visibility: 'public' | 'authenticated' | 'roles' | 'hidden';
  readonly visibleToRoles: readonly string[];
}

interface MenuItemRow {
  readonly legacyId: number;
  readonly menuTermId: number;
  readonly label: string;
  readonly position: number;
  readonly parentLegacyId: number; // 0 = radice
  readonly itemType: string; // '_menu_item_type': 'post_type' | 'custom' | 'taxonomy'
  readonly objectName: string; // '_menu_item_object'
  readonly objectId: number; // '_menu_item_object_id'
  readonly url: string | null;
  readonly linkTarget: string | null;
  readonly cssClasses: string | null;
  readonly rawRoles: string;
  readonly rawDisplayMode: string;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

/**
 * `_nav_menu_role` e `_nav_menu_role_display_mode` -> `menuVisibility` (vedi
 * il commento di testa). `unclassified` segnala una combinazione non
 * misurata: la voce diventa `hidden` e si registra un avviso.
 */
function computeVisibility(
  rawRoles: string,
  displayMode: string,
): { readonly result: MenuItemVisibility; readonly unclassified: boolean } {
  const hide = displayMode === 'hide';

  if (rawRoles === '' || rawRoles === undefined) {
    return hide
      ? { result: { visibility: 'hidden', visibleToRoles: [] }, unclassified: false }
      : { result: { visibility: 'public', visibleToRoles: [] }, unclassified: false };
  }

  if (rawRoles === 'in' && !hide) {
    return { result: { visibility: 'authenticated', visibleToRoles: [] }, unclassified: false };
  }

  if (rawRoles.startsWith('a:') && !hide) {
    let roles: readonly string[] = [];
    try {
      const parsed: PhpValue = phpUnserialize(rawRoles);
      if (parsed instanceof Map) {
        roles = [...parsed.values()].filter((v): v is string => typeof v === 'string');
      }
    } catch {
      // trattato come non classificato sotto
    }
    if (roles.length > 0) {
      return { result: { visibility: 'roles', visibleToRoles: roles }, unclassified: false };
    }
  }

  // 'out', o 'hide' insieme a 'in'/un array: nessun caso misurato sulla
  // sorgente reale. Non si indovina l'effetto: si nasconde, il più prudente.
  return { result: { visibility: 'hidden', visibleToRoles: [] }, unclassified: true };
}

async function loadMenuRow(ctx: StageContext): Promise<MenuRow | null> {
  const [termsRows, taxonomyRows] = await Promise.all([
    ctx.source.rows('wp_terms'),
    ctx.source.rows('wp_term_taxonomy'),
  ]);
  const termsById = new Map<number, { slug: string; name: string }>();
  for (const row of termsRows as readonly SqlRow[]) {
    termsById.set(asNumber(row['term_id']), {
      slug: asString(row['slug']),
      name: asString(row['name']),
    });
  }
  for (const row of taxonomyRows as readonly SqlRow[]) {
    if (asString(row['taxonomy']) !== 'nav_menu') continue;
    const termId = asNumber(row['term_id']);
    const term = termsById.get(termId);
    if (!term) continue; // riga di tassonomia senza termine: non classificabile, come in terms/index.ts
    return { termId, slug: term.slug, name: term.name };
  }
  return null;
}

/**
 * Non registra avvisi: questa lista si legge anche da `expected()`, che non
 * deve produrre effetti collaterali. Le anomalie si contano una sola volta,
 * dentro `run()` (`computeVisibility` e la risoluzione di `kind`).
 */
async function loadMenuItemRows(
  ctx: StageContext,
  menuTermId: number,
): Promise<readonly MenuItemRow[]> {
  const [postRows, metaRows, relationRows, taxonomyRows] = await Promise.all([
    ctx.source.rows('wp_posts'),
    ctx.source.rows('wp_postmeta'),
    ctx.source.rows('wp_term_relationships'),
    ctx.source.rows('wp_term_taxonomy'),
  ]);

  const navMenuTaxonomyIds = new Set<number>();
  for (const row of taxonomyRows as readonly SqlRow[]) {
    if (asString(row['taxonomy']) === 'nav_menu' && asNumber(row['term_id']) === menuTermId) {
      navMenuTaxonomyIds.add(asNumber(row['term_taxonomy_id']));
    }
  }

  const menuTermIdByObjectId = new Set<number>();
  for (const row of relationRows as readonly SqlRow[]) {
    if (navMenuTaxonomyIds.has(asNumber(row['term_taxonomy_id']))) {
      menuTermIdByObjectId.add(asNumber(row['object_id']));
    }
  }

  const metaByPost = new Map<number, Map<string, string>>();
  for (const row of metaRows as readonly SqlRow[]) {
    const postId = asNumber(row['post_id']);
    const key = asString(row['meta_key']);
    if (!metaByPost.has(postId)) metaByPost.set(postId, new Map());
    metaByPost.get(postId)!.set(key, asString(row['meta_value']));
  }

  const rows: MenuItemRow[] = [];
  for (const row of postRows as readonly SqlRow[]) {
    if (asString(row['post_type']) !== 'nav_menu_item') continue;
    const legacyId = asNumber(row['ID']);
    if (!menuTermIdByObjectId.has(legacyId)) continue; // non appartiene a questo menu

    const meta = metaByPost.get(legacyId) ?? new Map<string, string>();

    rows.push({
      legacyId,
      menuTermId,
      // Le voci di menu passavano da `the_title`, quindi da `wptexturize()` (DR-151).
      label: texturizePlain(asString(row['post_title'])),
      position: asNumber(row['menu_order']),
      parentLegacyId: asNumber(meta.get('_menu_item_menu_item_parent')),
      itemType: meta.get('_menu_item_type') ?? '',
      objectName: meta.get('_menu_item_object') ?? '',
      objectId: asNumber(meta.get('_menu_item_object_id')),
      url: meta.get('_menu_item_url') || null,
      linkTarget: meta.get('_menu_item_target') || null,
      cssClasses: parseCssClasses(meta.get('_menu_item_classes') || null),
      rawRoles: meta.get('_nav_menu_role') ?? '',
      rawDisplayMode: meta.get('_nav_menu_role_display_mode') ?? '',
    });
  }
  return rows;
}

/**
 * `_menu_item_classes` è un array PHP serializzato (es. `a:1:{i:0;s:0:"";}`),
 * non una stringa di classi: senza questo passo il testo serializzato finiva
 * letteralmente nell'attributo `class` della voce di menu resa.
 */
export function parseCssClasses(raw: string | null): string | null {
  if (!raw) return null;
  let valori: readonly PhpValue[] = [];
  try {
    const parsed: PhpValue = phpUnserialize(raw);
    if (parsed instanceof Map) valori = [...parsed.values()];
    else if (Array.isArray(parsed)) valori = parsed;
  } catch {
    return null; // non classificabile: meglio nessuna classe che un valore grezzo
  }
  const classi = valori.filter((v): v is string => typeof v === 'string' && v !== '');
  return classi.length > 0 ? classi.join(' ') : null;
}

/** Genitori prima dei figli, come `terms/index.ts`, cosi' il genitore esiste sempre già. */
function orderByDepth(rows: readonly MenuItemRow[]): readonly MenuItemRow[] {
  const byId = new Map(rows.map((r) => [r.legacyId, r]));
  const depthOf = (row: MenuItemRow, seen: ReadonlySet<number> = new Set()): number => {
    if (row.parentLegacyId === 0 || seen.has(row.legacyId)) return 0;
    const parent = byId.get(row.parentLegacyId);
    if (!parent) return 0;
    return 1 + depthOf(parent, new Set([...seen, row.legacyId]));
  };
  return [...rows].sort((a, b) => depthOf(a) - depthOf(b));
}

export const menusStage: Stage = {
  name: 'menus',
  dependsOn: ['contents', 'terms'],

  async expected(ctx: StageContext) {
    const menu = await loadMenuRow(ctx);
    if (!menu) return 0;
    return (await loadMenuItemRows(ctx, menu.termId)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const menuRow = await loadMenuRow(ctx);
    if (!menuRow) {
      return { created: 0, updated: 0, skipped: 0, errors: 0 };
    }

    // Il menu stesso: una sola riga, identità tramite `import_id_map` come le altre entità con id numerico di sorgente.
    const existingMenuId = await ctx.ids.find(ctx.tx, 'wp_terms', menuRow.termId, 'menu');
    const [writtenMenu] = await ctx.tx
      .insert(schema.menus)
      .values({
        id: existingMenuId ?? undefined,
        key: menuRow.slug,
        label: menuRow.name,
        legacyId: menuRow.termId,
      })
      .onConflictDoUpdate({
        target: schema.menus.id,
        set: { key: menuRow.slug, label: menuRow.name, legacyId: menuRow.termId },
      })
      .returning({ id: schema.menus.id });
    if (!writtenMenu) throw new Error('inserimento di menus non ha restituito una riga');
    await ctx.ids.remember(
      ctx.tx,
      'wp_terms',
      menuRow.termId,
      'menu',
      writtenMenu.id,
      ctx.mode === 'apply' ? ctx.runId : null,
      existingMenuId ? 'updated' : 'created',
    );

    const itemRows = orderByDepth(await loadMenuItemRows(ctx, menuRow.termId));

    return forEachItem(
      ctx.tx,
      itemRows,
      (row): ItemKey => ({ sourceTable: 'wp_posts', sourceId: row.legacyId }),
      async (row, tx) => {
        let kind: 'content' | 'term' | 'custom';
        let contentId: string | null = null;
        let termId: string | null = null;
        let url: string | null = null;

        if (row.itemType === 'custom') {
          kind = 'custom';
          url = row.url;
          if (!url) throw new Error('voce di menu custom senza _menu_item_url');
        } else if (row.itemType === 'post_type' && row.objectName === 'page') {
          const resolved = await ctx.ids.find(tx, 'wp_posts', row.objectId, 'content');
          if (!resolved) {
            await ctx.issues.record({
              severity: 'warning',
              stage: 'menus',
              code: 'item-import-failed',
              sourceTable: 'wp_posts',
              sourceId: row.legacyId,
              detail: 'unresolved-content-reference',
            });
            return 'skipped';
          }
          kind = 'content';
          contentId = resolved;
        } else if (row.itemType === 'taxonomy') {
          const resolved = await ctx.ids.find(tx, 'wp_terms', row.objectId, 'term');
          if (!resolved) {
            // Caso misurato: `wpdmcategory`, tassonomia che `terms/index.ts`
            // non importa (solo `category`). Vedi il commento in testa al
            // modulo: non si espande lo scopo di `terms` da qui.
            await ctx.issues.record({
              severity: 'warning',
              stage: 'menus',
              code: 'item-import-failed',
              sourceTable: 'wp_posts',
              sourceId: row.legacyId,
              detail: 'unresolved-term-reference',
            });
            return 'skipped';
          }
          kind = 'term';
          termId = resolved;
        } else {
          // Combinazione di `_menu_item_type`/`_menu_item_object` non
          // misurata sulla sorgente reale: fatto nuovo, si segnala come
          // errore strutturale invece di essere interpretato alla cieca
          // (principio 5, `importer-spec.md` §2).
          throw new Error(
            `combinazione menu item non classificata: ${row.itemType}/${row.objectName}`,
          );
        }

        const { result: visibility, unclassified } = computeVisibility(
          row.rawRoles,
          row.rawDisplayMode,
        );
        if (unclassified) {
          await ctx.issues.record({
            severity: 'warning',
            stage: 'menus',
            code: 'unclassified-value-form',
            sourceTable: 'wp_postmeta',
            sourceId: row.legacyId,
            detail: 'unclassified-nav-menu-role',
          });
        }

        const parentId =
          row.parentLegacyId === 0
            ? null
            : await ctx.ids.find(tx, 'wp_posts', row.parentLegacyId, 'menu_item');

        const existingId = await ctx.ids.find(tx, 'wp_posts', row.legacyId, 'menu_item');
        const [written] = await tx
          .insert(schema.menuItems)
          .values({
            id: existingId ?? undefined,
            menuId: writtenMenu.id,
            parentId,
            position: row.position,
            kind,
            label: row.label,
            contentId,
            termId,
            url,
            linkTarget: row.linkTarget || null,
            cssClasses: row.cssClasses || null,
            visibility: visibility.visibility,
            visibleToRoles: [...visibility.visibleToRoles],
            legacyId: row.legacyId,
          })
          .onConflictDoUpdate({
            target: schema.menuItems.id,
            set: {
              menuId: writtenMenu.id,
              parentId,
              position: row.position,
              kind,
              label: row.label,
              contentId,
              termId,
              url,
              linkTarget: row.linkTarget || null,
              cssClasses: row.cssClasses || null,
              visibility: visibility.visibility,
              visibleToRoles: [...visibility.visibleToRoles],
              legacyId: row.legacyId,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.menuItems.id });
        if (!written) throw new Error('inserimento di menu_items non ha restituito una riga');

        await ctx.ids.remember(
          tx,
          'wp_posts',
          row.legacyId,
          'menu_item',
          written.id,
          ctx.mode === 'apply' ? ctx.runId : null,
          existingId ? 'updated' : 'created',
        );

        return existingId ? 'updated' : 'created';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'menus',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );
  },
};
