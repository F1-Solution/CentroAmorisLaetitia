'use client';

import {
  Alert,
  Button,
  ConfirmDestructive,
  Dialog,
  MenuTreeEditor,
  PageHeader,
  SelectField,
  TextField,
  type MenuItemNode,
} from '@amoris/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  buildTree,
  indent,
  moveDown,
  moveItemTo,
  moveUp,
  outdent,
  patchesFor,
  type MenuNode,
} from '../../lib/menu/tree';
import { useSession } from '../../lib/session';
import { AreaShell } from '../AreaShell';
import { DraggableTreeRow, TreeDragArea } from '../dnd/TreeDragArea';
import { MenuItemPanel } from './MenuItemPanel';
import type { MenuItem, MenuItemKind, MenuSummary, RoleOption } from './types';
import './MenuManager.css';

/**
 * Menu di navigazione: il criterio 1D-32 per intero — aggiungere, spostare,
 * annidare, cambiare visibilità.
 *
 * Il trascinamento a due esiti (DR-082) passa dalla stessa via dei bottoni.
 *
 * Lo spostamento si fa qui e non nel componente: `MenuTreeEditor` conosce
 * l'albero ma non il servizio, e l'albero vive piatto a database. Ogni comando
 * ricostruisce l'albero in memoria, rinumera i fratelli e manda **solo** le
 * voci la cui collocazione è cambiata — non tutto il menu a ogni clic.
 */

interface ContentSummary {
  readonly id: string;
  readonly title: string;
}

interface ContentListResponse {
  readonly items: readonly ContentSummary[];
}

interface TermSummary {
  readonly id: string;
  readonly name: string;
  readonly taxonomy: string;
}

const KIND_OPTIONS = [
  { value: 'content', label: 'Una pagina o una notizia' },
  { value: 'term', label: 'Una categoria' },
  { value: 'custom', label: 'Un indirizzo scritto a mano' },
];

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.fullMessage
    : 'Non è stato possibile contattare il servizio.';
}

function toDisplayTree(
  nodes: readonly MenuNode<MenuItem>[],
  contents: ReadonlyMap<string, string>,
  terms: ReadonlyMap<string, string>,
): MenuItemNode[] {
  return nodes.map((node) => {
    const { item } = node;
    const linkType = item.kind === 'custom' ? 'url' : item.kind;
    const target =
      item.kind === 'content'
        ? (contents.get(item.contentId ?? '') ?? 'contenuto non trovato')
        : item.kind === 'term'
          ? (terms.get(item.termId ?? '') ?? 'categoria non trovata')
          : (item.url ?? '');
    return {
      id: item.id,
      label: item.label,
      linkType,
      linkTarget: target,
      children: toDisplayTree(node.children, contents, terms),
    };
  });
}

export function MenuManager(): React.JSX.Element {
  const { user } = useSession();
  const canWrite = user?.permissions.includes('content.write') ?? false;

  const [menus, setMenus] = useState<readonly MenuSummary[]>([]);
  const [menuKey, setMenuKey] = useState('');
  const [items, setItems] = useState<readonly MenuItem[]>([]);
  const [contents, setContents] = useState<readonly ContentSummary[]>([]);
  const [terms, setTerms] = useState<readonly TermSummary[]>([]);
  const [roles, setRoles] = useState<readonly RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newKind, setNewKind] = useState<MenuItemKind>('content');
  const [newLabel, setNewLabel] = useState('');
  const [newTargetId, setNewTargetId] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [loadedMenus, loadedContents, loadedTerms, loadedRoles] = await Promise.all([
          api<MenuSummary[]>('/menus'),
          api<ContentListResponse>('/contents?perPage=100'),
          api<TermSummary[]>('/terms'),
          api<RoleOption[]>('/roles'),
        ]);
        if (cancelled) return;
        setMenus(loadedMenus);
        setContents(loadedContents.items);
        setTerms(loadedTerms);
        setRoles(loadedRoles);
        setMenuKey((previous) => previous || (loadedMenus[0]?.key ?? ''));
        setError(null);
      } catch (caught) {
        if (!cancelled) setError(messageOf(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadItems = useCallback(async (key: string) => {
    if (!key) return;
    setLoading(true);
    try {
      setItems(await api<MenuItem[]>(`/menus/${encodeURIComponent(key)}/items`));
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems(menuKey);
  }, [loadItems, menuKey]);

  const contentNames = useMemo(
    () => new Map(contents.map((row) => [row.id, row.title])),
    [contents],
  );
  const termNames = useMemo(() => new Map(terms.map((row) => [row.id, row.name])), [terms]);

  const tree = useMemo(() => buildTree(items), [items]);
  const displayTree = useMemo(
    () => toDisplayTree(tree, contentNames, termNames),
    [tree, contentNames, termNames],
  );

  const selected = items.find((item) => item.id === selectedId) ?? null;

  async function restructure(next: readonly MenuNode<MenuItem>[]): Promise<void> {
    const patches = patchesFor(items, next);
    if (patches.length === 0) return;
    setBusy(true);
    try {
      for (const patch of patches) {
        await api(`/menu-items/${patch.id}`, {
          method: 'PATCH',
          body: { parentId: patch.parentId, position: patch.position },
        });
      }
      await loadItems(menuKey);
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(id: string, patch: Partial<MenuItem>): Promise<void> {
    await api(`/menu-items/${id}`, { method: 'PATCH', body: patch });
    await loadItems(menuKey);
  }

  async function createItem(): Promise<void> {
    setBusy(true);
    setCreateError(null);
    try {
      const body =
        newKind === 'content'
          ? { kind: 'content', label: newLabel, contentId: newTargetId }
          : newKind === 'term'
            ? { kind: 'term', label: newLabel, termId: newTargetId }
            : { kind: 'custom', label: newLabel, url: newUrl };
      await api(`/menus/${encodeURIComponent(menuKey)}/items`, {
        method: 'POST',
        // In coda alle voci di primo livello: una voce nuova non si infila in
        // mezzo alle altre senza che nessuno l'abbia chiesto.
        body: { ...body, position: tree.length },
      });
      setCreating(false);
      await loadItems(menuKey);
    } catch (caught) {
      setCreateError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(): Promise<void> {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await api(`/menu-items/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      if (selectedId === deleting.id) setSelectedId(null);
      await loadItems(menuKey);
    } catch (caught) {
      setDeleteError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AreaShell
      area="redazione"
      sectionId="menu"
      breadcrumbs={[{ label: 'Redazione', href: '/redazione/pagine' }, { label: 'Menu' }]}
    >
      <PageHeader
        title="Menu"
        summary="Le voci di navigazione del sito pubblico, con il loro ordine e la loro visibilità."
        action={
          <Button
            variant="primary"
            permitted={canWrite && menuKey !== ''}
            onClick={() => {
              setNewKind('content');
              setNewLabel('');
              setNewTargetId('');
              setNewUrl('');
              setCreateError(null);
              setCreating(true);
            }}
          >
            Aggiungi una voce
          </Button>
        }
      />

      <SelectField
        label="Menu"
        value={menuKey}
        options={menus.map((menu) => ({ value: menu.key, label: menu.label }))}
        emptyText="Nessun menu."
        disabled={loading}
        onChange={(event) => {
          setMenuKey(event.target.value);
          setSelectedId(null);
        }}
      />

      {error ? (
        <Alert variant="error" title="Non è stato possibile">
          {error}
        </Alert>
      ) : null}

      <TreeDragArea
        canNest={() => true}
        canDrop={(activeId, targetId, zone) =>
          moveItemTo(tree, activeId, targetId, zone)
            ? null
            : 'Una voce non può entrare in sé stessa o in una sua sottovoce.'
        }
        onDrop={(activeId, targetId, zone) => {
          const next = moveItemTo(tree, activeId, targetId, zone);
          if (next) void restructure(next);
        }}
        describe={(id) => items.find((item) => item.id === id)?.label ?? id}
      >
        <MenuTreeEditor
          items={displayTree}
          {...(selectedId ? { selectedId } : {})}
          onSelect={setSelectedId}
          onMoveUp={(id) => void restructure(moveUp(tree, id))}
          onMoveDown={(id) => void restructure(moveDown(tree, id))}
          onIndent={(id) => void restructure(indent(tree, id))}
          onOutdent={(id) => void restructure(outdent(tree, id))}
          onDelete={(id) => {
            setDeleteError(null);
            setDeleting(items.find((item) => item.id === id) ?? null);
          }}
          loading={loading}
          disabled={busy || !canWrite}
          {...(busy || !canWrite ? {} : { renderRow: DraggableTreeRow })}
        />
      </TreeDragArea>

      {selected ? (
        <MenuItemPanel
          item={selected}
          roles={roles}
          canWrite={canWrite}
          onClose={() => setSelectedId(null)}
          onSave={(patch) => saveItem(selected.id, patch)}
        />
      ) : null}

      {creating ? (
        <Dialog open onClose={() => setCreating(false)} title="Aggiungi una voce">
          <SelectField
            label="La voce punta a"
            value={newKind}
            options={KIND_OPTIONS}
            onChange={(event) => {
              setNewKind(event.target.value as MenuItemKind);
              setNewTargetId('');
            }}
          />
          <TextField
            label="Etichetta"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
          />
          {newKind === 'content' ? (
            <SelectField
              label="Contenuto"
              value={newTargetId}
              options={contents.map((row) => ({ value: row.id, label: row.title }))}
              emptyText="Nessun contenuto."
              onChange={(event) => setNewTargetId(event.target.value)}
            />
          ) : null}
          {newKind === 'term' ? (
            <SelectField
              label="Categoria"
              value={newTargetId}
              options={terms.map((row) => ({ value: row.id, label: row.name }))}
              emptyText="Nessuna categoria."
              onChange={(event) => setNewTargetId(event.target.value)}
            />
          ) : null}
          {newKind === 'custom' ? (
            <TextField
              label="Indirizzo"
              value={newUrl}
              onChange={(event) => setNewUrl(event.target.value)}
            />
          ) : null}
          {createError ? (
            <Alert variant="error" title="Non è stata aggiunta">
              {createError}
            </Alert>
          ) : null}
          <div className="amoris-menu-manager__dialog-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setCreating(false)}>
              Annulla
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void createItem()}>
              Aggiungi
            </Button>
          </div>
        </Dialog>
      ) : null}

      {deleting ? (
        <ConfirmDestructive
          open
          onClose={() => setDeleting(null)}
          onConfirm={() => void removeItem()}
          title="Elimina la voce di menu"
          description="La voce esce dal menu insieme a tutte le voci annidate sotto di lei. I contenuti collegati restano al loro posto."
          objectName={deleting.label}
          loading={busy}
          {...(deleteError ? { errorText: deleteError } : {})}
        />
      ) : null}
    </AreaShell>
  );
}
