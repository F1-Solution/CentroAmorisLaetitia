'use client';

import {
  Alert,
  Button,
  CheckboxField,
  FieldGroup,
  MediaPicker,
  SelectField,
  SeoPanel,
  TextField,
  type MediaPickerItem,
} from '@amoris/ui';
import { SEO_SCHEMA_TYPE_LABELS, SEO_SCHEMA_TYPES } from '@amoris/contracts/seoSchemaTypes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { siteUrl } from '../../lib/siteUrl';

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
  /** Assente da un'API che non lo conosce ancora. */
  readonly schemaType?: string | null;
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
  schemaType: '',
};

/** Vuoto vale il modello SEO; gli altri sono i tipi che il sito sa produrre (DR-278). */
const SCHEMA_TYPE_OPTIONS = [
  { value: '', label: 'Come il modello SEO' },
  ...SEO_SCHEMA_TYPES.map((value) => ({ value, label: SEO_SCHEMA_TYPE_LABELS[value] })),
];

type SeoDraft = typeof EMPTY;

/** I valori letti, tranne nei campi che la persona ha già modificato (DR-102). */
function mergeUntouched(
  current: SeoDraft,
  loaded: SeoDraft,
  touched: ReadonlySet<keyof SeoDraft>,
): SeoDraft {
  const merged = { ...loaded };
  for (const key of touched) Object.assign(merged, { [key]: current[key] });
  return merged;
}

function messageOf(caught: unknown): string {
  return caught instanceof ApiError
    ? caught.fullMessage
    : 'Non è stato possibile contattare il servizio.';
}

export interface ContentSeoPanelProps {
  readonly contentId: string;
  /** Percorso pubblico del contenuto, mostrato nell'anteprima del risultato. */
  readonly path: string;
  readonly disabled: boolean;
  /** Chiamata dopo un salvataggio riuscito. */
  readonly onSaved?: () => void;
}

export function ContentSeoPanel({
  contentId,
  path,
  disabled,
  onSaved,
}: ContentSeoPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState(EMPTY);
  const touched = useRef(new Set<keyof SeoDraft>());
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [picking, setPicking] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [media, setMedia] = useState<readonly MediaItem[]>([]);
  // L'immagine già scelta si legge a parte: l'elenco del selettore si carica solo quando è aperto.
  const [chosen, setChosen] = useState<MediaItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Senza sovrascrittura l'API risponde 204, che il client consegna come `undefined` (1G-24).
      const row = await api<ContentSeo | undefined>(`/seo/contents/${contentId}`);
      if (!row) {
        setDraft((current) => mergeUntouched(current, EMPTY, touched.current));
        setExists(false);
        setError(null);
        return;
      }
      const loaded: SeoDraft = {
        title: row.title ?? '',
        description: row.description ?? '',
        canonicalUrl: row.canonicalUrl ?? '',
        ogTitle: row.ogTitle ?? '',
        ogDescription: row.ogDescription ?? '',
        ogImageId: row.ogImageId,
        robotsNoindex: row.robotsNoindex,
        robotsNofollow: row.robotsNofollow,
        schemaType: row.schemaType ?? '',
      };
      setDraft((current) => mergeUntouched(current, loaded, touched.current));
      setExists(true);
      setError(null);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        setDraft((current) => mergeUntouched(current, EMPTY, touched.current));
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

  /** Ogni modifica passa di qui, così la lettura sa quali campi lasciare stare. */
  function edit(patch: Partial<SeoDraft>): void {
    for (const key of Object.keys(patch) as (keyof SeoDraft)[]) touched.current.add(key);
    setDraft((current) => ({ ...current, ...patch }));
  }

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

  useEffect(() => {
    const id = draft.ogImageId;
    if (id === null || media.some((item) => item.id === id) || chosen?.id === id) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const item = await api<MediaItem>(`/media/${id}`, { signal: controller.signal });
        if (!controller.signal.aborted) setChosen(item);
      } catch {
        // Senza il nome la scheda dice solo che l'immagine c'è: non è un errore da mostrare.
      }
    })();
    return () => controller.abort();
  }, [draft.ogImageId, media, chosen]);

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
          schemaType: draft.schemaType || null,
        },
      });
      setExists(true);
      setSaved(true);
      touched.current.clear();
      onSaved?.();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  const chosenImage =
    draft.ogImageId === null
      ? undefined
      : (media.find((item) => item.id === draft.ogImageId) ??
        (chosen?.id === draft.ogImageId ? chosen : undefined));

  const shareImageName =
    draft.ogImageId === null
      ? null
      : chosenImage
        ? (chosenImage.title ?? chosenImage.fileName)
        : 'immagine scelta';

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
        onTitleChange={(value) => edit({ title: value })}
        description={draft.description}
        onDescriptionChange={(value) => edit({ description: value })}
        resultUrl={path}
        disabled={disabled || busy}
        {...(shareImageName !== null ? { shareImageAlt: shareImageName } : {})}
        onPickShareImage={() => setPicking(true)}
      />
      {shareImageName !== null ? (
        <p className="amoris-editor__seo-image">Immagine di condivisione: {shareImageName}</p>
      ) : null}
      {draft.ogImageId !== null ? (
        <div className="amoris-editor__seo-actions">
          <Button
            variant="tertiary"
            permitted={!disabled}
            disabled={busy}
            onClick={() => edit({ ogImageId: null })}
          >
            Togli l’immagine
          </Button>
        </div>
      ) : null}

      <FieldGroup
        title="Indicizzazione"
        description="Che cosa i motori di ricerca possono fare con questa pagina."
        disabled={disabled || busy}
      >
        <CheckboxField
          label="Non indicizzare questa pagina"
          checked={draft.robotsNoindex}
          disabled={disabled || busy}
          onChange={(event) => edit({ robotsNoindex: event.target.checked })}
        />
        <CheckboxField
          label="Non seguire i collegamenti di questa pagina"
          checked={draft.robotsNofollow}
          disabled={disabled || busy}
          onChange={(event) => edit({ robotsNofollow: event.target.checked })}
        />
        <TextField
          label="Indirizzo canonico"
          value={draft.canonicalUrl}
          disabled={disabled || busy}
          helpText="Solo se questa pagina ripete il contenuto di un'altra. Di norma resta vuoto."
          onChange={(event) => edit({ canonicalUrl: event.target.value })}
        />
      </FieldGroup>

      <FieldGroup
        title="Dati strutturati"
        description="Il tipo di pagina che il sito dichiara ai motori di ricerca."
        disabled={disabled || busy}
      >
        <SelectField
          label="Tipo di dati strutturati"
          options={SCHEMA_TYPE_OPTIONS}
          value={draft.schemaType}
          disabled={disabled || busy}
          helpText="Il modello SEO dà «Pagina web» alle pagine e «Articolo di blog» alle notizie, come il sito di partenza."
          onChange={(event) => edit({ schemaType: event.target.value })}
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
          onChange={(event) => edit({ ogTitle: event.target.value })}
        />
        <TextField
          label="Descrizione di condivisione"
          value={draft.ogDescription}
          disabled={disabled || busy}
          onChange={(event) => edit({ ogDescription: event.target.value })}
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
        requireAlt={false}
        items={media.map<MediaPickerItem>((item) => ({
          id: item.id,
          thumbnailUrl: siteUrl(item.publicPath),
          title: item.title ?? item.fileName,
        }))}
        searchValue={mediaSearch}
        onSearchChange={setMediaSearch}
        onSelect={(item) => {
          edit({ ogImageId: item.id });
          setPicking(false);
        }}
      />
    </section>
  );
}
