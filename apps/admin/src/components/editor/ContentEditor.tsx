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
  TextArea,
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
import { previewUrl } from '../../lib/siteUrl';
import { AreaShell } from '../AreaShell';
import { DraggableTreeRow, TreeDragArea } from '../dnd/TreeDragArea';
import { BlockInspector } from './BlockInspector';
import { ContentAddressPanel } from './ContentAddressPanel';
import { ContentDeleteAction } from './ContentDeleteAction';
import { ContentLayoutPanel } from './ContentLayoutPanel';
import { ContentListingPanel } from './ContentListingPanel';
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

/** D141-A detto prima di scrivere: lo stesso rifiuto del servizio, con dove rimediare. */
const CATEGORY_REQUIRED =
  'Per pubblicare una notizia serve almeno una categoria: sceglila nella scheda «Elenchi e archivi».';

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

function dayOf(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** «Ultima modifica di X il Y» dal registro, o la data della sorgente importata (D127). */
function lastChangeText(change: ContentDetail['lastChange']): string | null {
  if (!change) return null;
  if ('importedAt' in change) {
    return `Importato dalla sorgente, ultima modifica il ${dayOf(change.importedAt)}`;
  }
  return `Ultima modifica di ${change.actorLabel} il ${dayOf(change.occurredAt)} alle ${timeOf(change.occurredAt)}`;
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
  const [reloading, setReloading] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  const canWrite = user?.permissions.includes('content.write') ?? false;
  const canPublish = user?.permissions.includes('content.publish') ?? false;
  const readOnly = !canWrite;

  const load = useCallback(async () => {
    setReloading(true);
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
    } finally {
      setReloading(false);
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

  const saveDraft = useRef<() => Promise<boolean>>(async () => true);
  saveDraft.current = async () => {
    if (!state || !content) return true;
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
      return true;
    } catch (caught) {
      setActionError(
        caught instanceof ApiError
          ? caught.fullMessage
          : 'La copia di lavoro non è stata salvata: le modifiche sono ancora solo sullo schermo.',
      );
      return false;
    }
  };

  /** S17: salva la copia di lavoro in sospeso e apre la pagina come sarà sul sito, in una scheda nuova. */
  async function openSitePreview(): Promise<void> {
    const url = previewUrl(contentId);
    if (!pending) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    // La scheda si apre subito, nel gesto dell'utente: il salvataggio può durare quanto basta a far scattare il blocco dei popup.
    const tab = window.open('', '_blank');
    const saved = await saveDraft.current();
    if (!saved) {
      tab?.close();
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }

  useEffect(() => {
    // Durante un salvataggio la copia di lavoro aspetta: ripartirà sul contenuto riletto.
    if (!pending || readOnly || busy) return undefined;
    const timer = setTimeout(() => void saveDraft.current(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pending, state, readOnly, busy]);

  async function writeToContent(publish: boolean | null): Promise<void> {
    if (!state || !content) return;
    // Il rifiuto arriva prima del PATCH: altrimenti il contenuto cambierebbe senza essere pubblicato.
    if (publish === true && content.type === 'post' && (content.termIds ?? []).length === 0) {
      setActionError(CATEGORY_REQUIRED);
      return;
    }
    const editsBefore = editCount.current;
    setBusy(true);
    setActionError(null);
    let patched = false;
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
        const written = await api<{ updatedAt?: string } | undefined>(`/contents/${contentId}`, {
          method: 'PATCH',
          body: {
            title: saved.payload.title,
            excerpt: saved.payload.excerpt,
            blocks: saved.payload.blocks,
            contentHtml: saved.payload.contentHtml,
            contentText: saved.payload.contentText,
          },
        });
        patched = true;
        const updatedAt = written?.updatedAt;
        // Il contenuto ora è ciò che si è scritto, con la sua data nuova: la copia di lavoro riparte da lì.
        setContent((current) =>
          current
            ? {
                ...current,
                title: saved.payload.title,
                excerpt: saved.payload.excerpt,
                blocks: saved.payload.blocks,
                contentHtml: saved.payload.contentHtml,
                ...(updatedAt !== undefined ? { updatedAt } : {}),
              }
            : current,
        );
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
      // Il PATCH è passato, la pubblicazione o il ritiro no: la copia di lavoro si riscrive sulla data nuova.
      if (patched && draftSavedAt !== null) setPending(true);
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

  /** Rilegge solo «ultima modifica»: lo stato dell'editor non si tocca. */
  const refreshLastChange = useCallback(async () => {
    try {
      const fresh = await api<ContentDetail>(`/contents/${contentId}`);
      const { lastChange } = fresh;
      if (lastChange === undefined) return;
      setContent((current) => (current ? { ...current, lastChange } : current));
    } catch {
      // La riga resta quella già mostrata: il salvataggio è comunque riuscito.
    }
  }, [contentId]);

  const lastChange = lastChangeText(content?.lastChange);

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
        {...(content
          ? {
              action: (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => void openSitePreview()}
                    disabled={busy}
                  >
                    Anteprima sul sito
                  </Button>
                  {canPublish && content.status === 'published' ? (
                    <Button
                      variant="secondary"
                      onClick={() => void writeToContent(false)}
                      disabled={busy}
                    >
                      Ritira
                    </Button>
                  ) : null}
                  <ContentDeleteAction
                    contentId={contentId}
                    title={content.title}
                    published={content.status === 'published'}
                    canPublish={canPublish}
                    disabled={readOnly}
                    listHref={listHref}
                  />
                </>
              ),
            }
          : {})}
      />

      {lastChange ? <p className="amoris-editor__last-change">{lastChange}</p> : null}

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
            { key: 'indirizzo', label: 'Indirizzo' },
            ...(content?.type === 'post' ? [{ key: 'elenchi', label: 'Elenchi e archivi' }] : []),
          ]}
          activeKey={tab}
          onChange={setTab}
        >
          {tab === 'pagina' && content ? (
            <ContentLayoutPanel
              contentId={contentId}
              initial={content.pageLayout}
              disabled={readOnly}
              onSaved={(pageLayout, updatedAt) => {
                setContent((current) =>
                  current
                    ? {
                        ...current,
                        pageLayout,
                        ...(updatedAt !== undefined ? { updatedAt } : {}),
                      }
                    : current,
                );
                // Come per l'immagine in evidenza: la copia di lavoro si riscrive sulla data nuova.
                if (updatedAt !== undefined && draftSavedAt !== null) setPending(true);
                void refreshLastChange();
              }}
            />
          ) : null}
          {tab === 'elenchi' && content?.type === 'post' ? (
            <ContentListingPanel
              contentId={contentId}
              featuredMedia={content.featuredMedia ?? null}
              termIds={content.termIds ?? []}
              disabled={readOnly}
              onSaved={(saved) => {
                // Solo immagine, categorie e ultima modifica: il documento sullo schermo resta com'è (§6 caso 2).
                setContent((current) =>
                  current
                    ? {
                        ...current,
                        ...(saved.featuredMedia !== undefined
                          ? { featuredMedia: saved.featuredMedia }
                          : {}),
                        ...(saved.termIds !== undefined ? { termIds: saved.termIds } : {}),
                        ...(saved.lastChange !== undefined ? { lastChange: saved.lastChange } : {}),
                        ...(saved.updatedAt !== undefined ? { updatedAt: saved.updatedAt } : {}),
                      }
                    : current,
                );
                // La copia di lavoro porta la data vecchia: si riscrive, così resta riprendibile.
                if (saved.updatedAt !== undefined && draftSavedAt !== null) setPending(true);
                void refreshLastChange();
              }}
            />
          ) : null}
          {tab === 'seo' ? (
            <ContentSeoPanel
              contentId={contentId}
              path={content?.path ?? ''}
              disabled={readOnly}
              onSaved={() => void refreshLastChange()}
            />
          ) : null}
          {tab === 'indirizzo' && content ? (
            <ContentAddressPanel
              contentId={contentId}
              type={content.type}
              slug={content.slug}
              parentId={content.parentId}
              isHome={content.isHome ?? false}
              disabled={readOnly}
              // Mentre l'editor salva o rilegge, una lettura vecchia riporterebbe l'indirizzo di prima.
              paused={busy || reloading}
              onSaved={(moved) =>
                // Solo indirizzo e ultima modifica: il documento sullo schermo resta com'è (§6 caso 4).
                setContent((current) =>
                  current
                    ? {
                        ...current,
                        slug: moved.slug,
                        parentId: moved.parentId,
                        path: moved.path,
                        ...(moved.lastChange !== undefined ? { lastChange: moved.lastChange } : {}),
                      }
                    : current,
                )
              }
            />
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
            {content?.type === 'post' ? (
              <TextArea
                label="Estratto"
                value={state.excerpt ?? ''}
                disabled={readOnly}
                rows={3}
                helpText="Compare nell’archivio della categoria, nella ricerca, in «Elenco articoli», nel feed e come descrizione per i motori di ricerca. Se resta vuoto si usa l’inizio del testo."
                onChange={(event) => mutate({ ...state, excerpt: event.target.value })}
              />
            ) : null}
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
