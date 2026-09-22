'use client';

import {
  Alert,
  Button,
  CheckboxField,
  FieldGroup,
  MediaPicker,
  SeoPanel,
  TextField,
  type MediaPickerItem,
} from '@amoris/ui';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';

/**
 * Metadati SEO di un singolo contenuto, dentro l'editor del contenuto
 * (DR-076): si scrivono mentre si scrive la pagina.
 *
 * La sovrascrittura **nasce vuota**, e vuota significa «vale il template
 * globale»: il servizio risponde 404 finché non è stata scritta, e quel 404 è
 * lo stato normale, non un guasto. Per questo la schermata lo mostra come
 * «nessuna sovrascrittura» invece che come errore.
 */

interface ContentSeo {
  readonly contentId: string;
  readonly title: string | null;
  readonly description: string | null;
  readonly canonicalUrl: string | null;
  readonly ogTitle: string | null;
  readonly ogDescription: string | null;
  readonly ogImageId: string | null;
  readonly robotsNoindex: boolean;
  readonly robotsNofollow: boolean;
  readonly updatedAt: string;
}

interface MediaItem {
  readonly id: string;
  readonly publicPath: string;
  readonly fileName: string;
  readonly title: string | null;
}

interface MediaListResponse {
  readonly items: readonly MediaItem[];
}

const EMPTY = {
  title: '',
  description: '',
  canonicalUrl: '',
  ogTitle: '',
  ogDescription: '',
  ogImageId: null as string | null,
  robotsNoindex: false,
  robotsNofollow: false,
};

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.message
    : 'Non è stato possibile contattare il servizio.';
}

export interface ContentSeoPanelProps {
  readonly contentId: string;
  /** Percorso pubblico del contenuto, mostrato nell'anteprima del risultato. */
  readonly path: string;
  readonly disabled: boolean;
}

export function ContentSeoPanel({
  contentId,
  path,
  disabled,
}: ContentSeoPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState(EMPTY);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [picking, setPicking] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [media, setMedia] = useState<readonly MediaItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await api<ContentSeo>(`/seo/contents/${contentId}`);
      setDraft({
        title: row.title ?? '',
        description: row.description ?? '',
        canonicalUrl: row.canonicalUrl ?? '',
        ogTitle: row.ogTitle ?? '',
        ogDescription: row.ogDescription ?? '',
        ogImageId: row.ogImageId,
        robotsNoindex: row.robotsNoindex,
        robotsNofollow: row.robotsNofollow,
      });
      setExists(true);
      setError(null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        setDraft(EMPTY);
        setExists(false);
        setError(null);
      } else {
        setError(messageOf(caught));
      }
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!picking) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        const query = new URLSearchParams({ mimePrefix: 'image/', perPage: '50' });
        if (mediaSearch.trim()) query.set('search', mediaSearch.trim());
        try {
          const list = await api<MediaListResponse>(`/media?${query.toString()}`, {
            signal: controller.signal,
          });
          setMedia(list.items);
        } catch {
          if (!controller.signal.aborted) setMedia([]);
        }
      })();
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [picking, mediaSearch]);

  async function save(): Promise<void> {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api(`/seo/contents/${contentId}`, {
        method: 'PUT',
        body: {
          title: draft.title.trim() || null,
          description: draft.description.trim() || null,
          canonicalUrl: draft.canonicalUrl.trim() || null,
          ogTitle: draft.ogTitle.trim() || null,
          ogDescription: draft.ogDescription.trim() || null,
          ogImageId: draft.ogImageId,
          robotsNoindex: draft.robotsNoindex,
          robotsNofollow: draft.robotsNofollow,
        },
      });
      setExists(true);
      setSaved(true);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  const chosenImage = media.find((item) => item.id === draft.ogImageId);

  return (
    <section className="amoris-editor__seo" aria-label="SEO del contenuto">
      {loading ? <p>Caricamento dei metadati in corso…</p> : null}

      {!loading && !exists ? (
        <Alert variant="info" title="Nessuna sovrascrittura">
          Questo contenuto usa i template globali. Quello che si scrive qui vale solo per lui.
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="error" title="Non è stato possibile">
          {error}
        </Alert>
      ) : null}
      {saved ? (
        <Alert variant="success" title="Fatto">
          Metadati SEO salvati.
        </Alert>
      ) : null}

      <SeoPanel
        title={draft.title}
        onTitleChange={(value) => setDraft({ ...draft, title: value })}
        description={draft.description}
        onDescriptionChange={(value) => setDraft({ ...draft, description: value })}
        resultUrl={path}
        disabled={disabled || busy}
        {...(chosenImage ? { shareImageAlt: chosenImage.title ?? chosenImage.fileName } : {})}
        onPickShareImage={() => setPicking(true)}
      />

      <FieldGroup
        title="Indicizzazione"
        description="Che cosa i motori di ricerca possono fare con questa pagina."
        disabled={disabled || busy}
      >
        <CheckboxField
          label="Non indicizzare questa pagina"
          checked={draft.robotsNoindex}
          disabled={disabled || busy}
          onChange={(event) => setDraft({ ...draft, robotsNoindex: event.target.checked })}
        />
        <CheckboxField
          label="Non seguire i collegamenti di questa pagina"
          checked={draft.robotsNofollow}
          disabled={disabled || busy}
          onChange={(event) => setDraft({ ...draft, robotsNofollow: event.target.checked })}
        />
        <TextField
          label="Indirizzo canonico"
          value={draft.canonicalUrl}
          disabled={disabled || busy}
          helpText="Solo se questa pagina ripete il contenuto di un'altra. Di norma resta vuoto."
          onChange={(event) => setDraft({ ...draft, canonicalUrl: event.target.value })}
        />
      </FieldGroup>

      <FieldGroup
        title="Condivisione"
        description="Titolo e descrizione usati quando la pagina viene condivisa."
        disabled={disabled || busy}
      >
        <TextField
          label="Titolo di condivisione"
          value={draft.ogTitle}
          disabled={disabled || busy}
          onChange={(event) => setDraft({ ...draft, ogTitle: event.target.value })}
        />
        <TextField
          label="Descrizione di condivisione"
          value={draft.ogDescription}
          disabled={disabled || busy}
          onChange={(event) => setDraft({ ...draft, ogDescription: event.target.value })}
        />
      </FieldGroup>

      <div className="amoris-editor__seo-actions">
        <Button variant="primary" permitted={!disabled} loading={busy} onClick={() => void save()}>
          Salva i metadati SEO
        </Button>
      </div>

      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        items={media.map<MediaPickerItem>((item) => ({
          id: item.id,
          thumbnailUrl: item.publicPath,
          title: item.title ?? item.fileName,
        }))}
        searchValue={mediaSearch}
        onSearchChange={setMediaSearch}
        onSelect={(item) => {
          setDraft({ ...draft, ogImageId: item.id });
          setPicking(false);
        }}
      />
    </section>
  );
}
