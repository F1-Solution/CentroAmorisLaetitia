'use client';

import { ALLOWED_CHILDREN, type BlockType, type BlockNode as ModelBlock } from '@amoris/blocks';
import {
  Alert,
  BlockInserter,
  BlockTreeEditor,
  Button,
  PageHeader,
  SaveBar,
  Tabs,
  TextField,
  insertableBlockTypes,
  type DropZone,
  type PreviewViewport,
} from '@amoris/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import {
  UNCREATABLE_REASON,
  creatableChildTypes,
  findBlock,
  canDropBlock,
  insertBlock,
  labelOf,
  moveBlockBy,
  moveBlockTo,
  removeBlock,
  replaceBlock,
  setColumnStructure,
  toTreeNodes,
} from '../../lib/editor/tree';
import {
  isUnchanged,
  openContent,
  savePayloadOf,
  type ContentDetail,
  type EditorState,
} from '../../lib/editor/roundtrip';
import { useSession } from '../../lib/session';
import { AreaShell } from '../AreaShell';
import { DraggableTreeRow, TreeDragArea } from '../dnd/TreeDragArea';
import { BlockInspector } from './BlockInspector';
import { ContentLayoutPanel } from './ContentLayoutPanel';
import { ContentSeoPanel } from './ContentSeoPanel';
import { EditorPreview } from './EditorPreview';
import './ContentEditor.css';

/**
 * L'editor di un contenuto.
 *
 * **Due scritture, non una** (DR-068). Il salvataggio automatico scrive sulla
 * copia di lavoro — `PUT /contents/:id/draft`, che non tocca `contents` — e il
 * contenuto pubblicato cambia **solo** su comando esplicito. È per questo che
 * il criterio 1D-36 si verifica sul contenuto e non sulla bozza: sono due
 * record distinti, e la bozza non è mai ciò che il pubblico legge.
 *
 * **Salvare senza modifiche non scrive.** Non «scrive gli stessi valori»: non
 * scrive. `isUnchanged` confronta ciò che si è letto con ciò che si scriverebbe
 * e, se coincidono, la richiesta non parte e lo schermo lo dice. È il modo più
 * diretto di rendere vero il requisito F-05, e rende visibile il caso in cui
 * non lo fosse.
 */

interface DraftDetail {
  readonly title: string;
  readonly excerpt: string | null;
  readonly blocks: unknown;
  readonly updatedAt: string;
  readonly stillCurrent: boolean;
}

const AUTOSAVE_DELAY_MS = 1500;

/**
 * «Archiviato» a schermo si dice «ritirato», che è la parola con cui ADR-006
 * §3.2 chiama l'operazione. Lo stesso divario che `ContentList` colma nella
 * pastiglia di stato.
 */
const STATUS_LABEL: Record<ContentDetail['status'], string> = {
  published: 'pubblicato',
  draft: 'bozza',
  archived: 'ritirato',
};

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export interface ContentEditorProps {
  readonly contentId: string;
  readonly sectionId: string;
  readonly listHref: string;
  readonly listLabel: string;
}

export function ContentEditor({
  contentId,
  sectionId,
  listHref,
  listLabel,
}: ContentEditorProps): React.JSX.Element {
  const { user } = useSession();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [state, setState] = useState<EditorState | null>(null);
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [inserterParent, setInserterParent] = useState<string | null | undefined>(undefined);
  const [tab, setTab] = useState('contenuto');
  const [inserterSearch, setInserterSearch] = useState('');
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const canWrite = user?.permissions.includes('content.write') ?? false;
  const canPublish = user?.permissions.includes('content.publish') ?? false;
  const readOnly = !canWrite;

  const load = useCallback(async () => {
    try {
      const fresh = await api<ContentDetail>(`/contents/${contentId}`);
      const outcome = openContent(fresh);
      setContent(fresh);
      if (!outcome.ok) {
        setLoadError(outcome.reason);
        return;
      }
      setState(outcome.state);
      setWarnings(outcome.warnings);
      setLoadError(null);

      // La copia di lavoro si riprende solo se il contenuto non è cambiato
      // sotto: riprenderla comunque significherebbe riscrivere il lavoro di
      // qualcun altro senza dirlo.
      try {
        const draft = await api<DraftDetail>(`/contents/${contentId}/draft`);
        if (draft.stillCurrent) {
          setState({ title: draft.title, excerpt: draft.excerpt, document: draft.blocks as never });
          setDraftSavedAt(draft.updatedAt);
          setNotice(
            `Ripresa la copia di lavoro salvata alle ${timeOf(draft.updatedAt)}. Il contenuto pubblicato non è cambiato.`,
          );
        } else {
          setWarnings((previous) => [
            ...previous,
            'Esiste una copia di lavoro più vecchia del contenuto: il contenuto è cambiato dopo che la copia era stata aperta, quindi la copia non è stata ripresa.',
          ]);
        }
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 404) throw caught;
      }
    } catch (caught) {
      setLoadError(
        caught instanceof ApiError
          ? caught.fullMessage
          : 'Non è stato possibile contattare il servizio.',
      );
    }
  }, [contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  // L'ultima modifica e il suo contatore: dopo un salvataggio dicono se si è
  // scritto qualcosa nel frattempo, che la rilettura non deve cancellare (DR-102).
  const lastEdit = useRef<EditorState | null>(null);
  const editCount = useRef(0);

  /** Ogni modifica passa di qui: un solo punto che segna il documento da salvare. */
  const mutate = useCallback((next: EditorState) => {
    lastEdit.current = next;
    editCount.current += 1;
    setState(next);
    setPending(true);
    setActionError(null);
  }, []);

  const saveDraft = useRef<() => Promise<void>>(async () => undefined);
  saveDraft.current = async () => {
    if (!state || !content) return;
    try {
      const saved = await api<DraftDetail>(`/contents/${contentId}/draft`, {
        method: 'PUT',
        body: {
          title: state.title,
          excerpt: state.excerpt,
          blocks: state.document,
          baseUpdatedAt: content.updatedAt,
        },
      });
      setDraftSavedAt(saved.updatedAt);
      setPending(false);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError
          ? caught.fullMessage
          : 'La copia di lavoro non è stata salvata: le modifiche sono ancora solo sullo schermo.',
      );
    }
  };

  useEffect(() => {
    // Durante un salvataggio la copia di lavoro aspetta: ripartirà sul contenuto riletto.
    if (!pending || readOnly || busy) return undefined;
    const timer = setTimeout(() => void saveDraft.current(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pending, state, readOnly, busy]);

  async function writeToContent(publish: boolean | null): Promise<void> {
    if (!state || !content) return;
    const editsBefore = editCount.current;
    setBusy(true);
    setActionError(null);
    try {
      const unchanged = isUnchanged(content, state);
      if (unchanged && publish === null) {
        setNotice('Nessuna modifica: il contenuto non è stato riscritto.');
        return;
      }
      if (!unchanged) {
        const saved = savePayloadOf(state);
        if (!saved.ok) {
          setActionError(saved.reason);
          return;
        }
        await api(`/contents/${contentId}`, {
          method: 'PATCH',
          body: {
            title: saved.payload.title,
            excerpt: saved.payload.excerpt,
            blocks: saved.payload.blocks,
            contentHtml: saved.payload.contentHtml,
            contentText: saved.payload.contentText,
          },
        });
      }
      if (publish !== null) {
        await api(`/contents/${contentId}/${publish ? 'publish' : 'unpublish'}`, {
          method: 'POST',
        });
      }
      // Riversata nel contenuto, la copia di lavoro non ha più ragione di
      // esistere: è uno dei tre casi di eliminazione dichiarati (DR-068).
      await api(`/contents/${contentId}/draft`, { method: 'DELETE' }).catch(() => undefined);
      setDraftSavedAt(null);
      setPending(false);
      setNotice(
        publish === null
          ? 'Contenuto salvato.'
          : publish
            ? 'Contenuto pubblicato.'
            : 'Contenuto ritirato: non è più raggiungibile dal pubblico.',
      );
      await load();
      const editedMeanwhile = lastEdit.current;
      if (editCount.current !== editsBefore && editedMeanwhile) {
        setState(editedMeanwhile);
        setPending(true);
      }
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.fullMessage : 'L’operazione non è riuscita.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function discardDraft(): Promise<void> {
    await api(`/contents/${contentId}/draft`, { method: 'DELETE' }).catch(() => undefined);
    setDraftSavedAt(null);
    setPending(false);
    setNotice('Copia di lavoro scartata: è tornato il contenuto salvato.');
    await load();
  }

  const statusText = (() => {
    if (!content || !state) return 'Caricamento in corso…';
    if (pending) return 'Modifiche non ancora salvate nella copia di lavoro.';
    if (draftSavedAt) {
      return `Copia di lavoro salvata alle ${timeOf(draftSavedAt)}. Il contenuto pubblicato non è ancora cambiato.`;
    }
    if (isUnchanged(content, state)) return 'Nessuna modifica rispetto al contenuto salvato.';
    return 'Modifiche da riversare nel contenuto.';
  })();

  function onInsert(type: BlockType): void {
    if (!state || inserterParent === undefined) return;
    const { document, insertedId } = insertBlock(state.document, inserterParent, type);
    mutate({ ...state, document });
    setSelectedId(insertedId);
    setInserterParent(undefined);
    setInserterSearch('');
  }

  function onBlockChange(next: ModelBlock): void {
    if (!state) return;
    mutate({ ...state, document: replaceBlock(state.document, next) });
  }

  function onDrop(activeId: string, targetId: string, zone: DropZone): void {
    if (!state) return;
    const outcome = moveBlockTo(state.document, activeId, targetId, zone);
    if (!outcome.ok) {
      setActionError(outcome.reason);
      return;
    }
    mutate({ ...state, document: outcome.document });
  }

  const selectedBlock = state && selectedId ? findBlock(state.document.blocks, selectedId) : null;
  // Che cosa l'inseritore deve mostrare spento: tutto ciò che elenca e che qui
  // non si può creare, o perché il contenitore non lo ammette o perché in
  // questa fase non si crea da zero.
  const creatable = state ? creatableChildTypes(state.document, inserterParent ?? null) : [];
  const uncreatable = insertableBlockTypes
    .map((option) => option.type)
    .filter((type) => !creatable.includes(type));

  return (
    <AreaShell
      area="redazione"
      sectionId={sectionId}
      breadcrumbs={[
        { label: 'Redazione', href: '/redazione/pagine' },
        { label: listLabel, href: listHref },
        { label: content?.title ?? 'Contenuto' },
      ]}
    >
      <PageHeader
        title={content?.title ?? 'Contenuto'}
        {...(content ? { summary: `${content.path} — ${STATUS_LABEL[content.status]}` } : {})}
        {...(canPublish && content?.status === 'published'
          ? {
              action: (
                <Button
                  variant="secondary"
                  onClick={() => void writeToContent(false)}
                  disabled={busy}
                >
                  Ritira
                </Button>
              ),
            }
          : {})}
      />

      {loadError ? (
        <Alert variant="error" title="Il contenuto non si apre">
          {loadError}
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="error" title="Operazione non riuscita">
          {actionError}
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="info" title="Esito">
          {notice}
        </Alert>
      ) : null}
      {warnings.map((warning) => (
        <Alert key={warning} variant="warning" title="Da sapere prima di salvare">
          {warning}
        </Alert>
      ))}
      {readOnly ? (
        <Alert variant="info" title="Sola lettura">
          Il ruolo attivo non permette di modificare i contenuti.
        </Alert>
      ) : null}

      {state ? (
        <Tabs
          tabs={[
            { key: 'contenuto', label: 'Contenuto' },
            { key: 'pagina', label: 'Pagina' },
            { key: 'seo', label: 'SEO' },
          ]}
          activeKey={tab}
          onChange={setTab}
        >
          {tab === 'pagina' && content ? (
            <ContentLayoutPanel
              contentId={contentId}
              initial={content.pageLayout}
              disabled={readOnly}
              onSaved={(pageLayout) => setContent({ ...content, pageLayout })}
            />
          ) : null}
          {tab === 'seo' ? (
            <ContentSeoPanel contentId={contentId} path={content?.path ?? ''} disabled={readOnly} />
          ) : null}
        </Tabs>
      ) : null}

      {state && tab === 'contenuto' ? (
        <div className="amoris-editor">
          <section className="amoris-editor__column" aria-label="Struttura del contenuto">
            <TextField
              label="Titolo"
              value={state.title}
              disabled={readOnly}
              onChange={(event) => mutate({ ...state, title: event.target.value })}
            />
            <TreeDragArea
              canNest={(id) => {
                const block = findBlock(state.document.blocks, id);
                return block ? ALLOWED_CHILDREN[block.type].length > 0 : false;
              }}
              canDrop={(activeId, targetId, zone) =>
                canDropBlock(state.document, activeId, targetId, zone)
              }
              onDrop={onDrop}
              describe={(id) => {
                const block = findBlock(state.document.blocks, id);
                return block ? labelOf(block) : id;
              }}
            >
              <BlockTreeEditor
                blocks={toTreeNodes(state.document.blocks)}
                {...(selectedId ? { selectedId } : {})}
                onSelect={setSelectedId}
                onMoveUp={(id) =>
                  mutate({ ...state, document: moveBlockBy(state.document, id, -1) })
                }
                onMoveDown={(id) =>
                  mutate({ ...state, document: moveBlockBy(state.document, id, 1) })
                }
                onDelete={(id) => {
                  mutate({ ...state, document: removeBlock(state.document, id) });
                  if (id === selectedId) setSelectedId(undefined);
                }}
                onAddRequest={(parentId) => setInserterParent(parentId)}
                {...(readOnly ? {} : { renderRow: DraggableTreeRow })}
              />
            </TreeDragArea>
            {draftSavedAt ? (
              <Button variant="tertiary" onClick={() => void discardDraft()} disabled={busy}>
                Scarta la copia di lavoro
              </Button>
            ) : null}
          </section>

          <section className="amoris-editor__column" aria-label="Blocco selezionato">
            <BlockInspector
              block={selectedBlock}
              disabled={readOnly}
              onChange={onBlockChange}
              onColumnStructureChange={(rowId, structure) =>
                mutate({ ...state, document: setColumnStructure(state.document, rowId, structure) })
              }
            />
          </section>

          <section className="amoris-editor__column" aria-label="Anteprima">
            <EditorPreview
              document={state.document}
              viewport={viewport}
              onViewportChange={setViewport}
            />
          </section>
        </div>
      ) : null}

      <BlockInserter
        open={inserterParent !== undefined}
        onClose={() => setInserterParent(undefined)}
        onInsert={onInsert}
        searchValue={inserterSearch}
        onSearchChange={setInserterSearch}
        unavailableTypes={uncreatable}
        unavailableReason={UNCREATABLE_REASON}
      />

      <SaveBar
        statusText={statusText}
        saving={busy}
        disabled={readOnly || !state}
        onSave={() => void writeToContent(null)}
        {...(canPublish ? { onPublish: () => void writeToContent(true) } : {})}
      />
    </AreaShell>
  );
}
