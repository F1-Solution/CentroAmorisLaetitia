'use client';

import {
  Alert,
  Button,
  CheckboxField,
  FieldGroup,
  MediaPicker,
  type MediaPickerItem,
} from '@amoris/ui';
import { useEffect, useId, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { siteUrl } from '../../lib/siteUrl';
import type { FeaturedMedia, LastChange } from '../../lib/editor/roundtrip';

/** Immagine in evidenza e categorie di una notizia, la sola immagine di una pagina (S2, DR-278), salvate da sole. */

interface CategoryOption {
  readonly id: string;
  readonly name: string;
  readonly contentCount: number;
}

interface MediaItem {
  readonly id: string;
  readonly publicPath: string;
  readonly fileName: string;
  readonly title: string | null;
  readonly isPrivate: boolean;
}

interface MediaListResponse {
  readonly items: readonly MediaItem[];
}

export interface ListingSaved {
  readonly featuredMedia?: FeaturedMedia | null;
  readonly termIds?: readonly string[];
  readonly lastChange?: LastChange;
  /** Il PATCH dell'immagine sposta la data di modifica del contenuto. */
  readonly updatedAt?: string;
}

export interface ContentListingPanelProps {
  readonly contentId: string;
  /** Una pagina non ha categorie (S4). */
  readonly type: 'page' | 'post';
  readonly featuredMedia: FeaturedMedia | null;
  readonly termIds: readonly string[];
  readonly disabled: boolean;
  /** Pubblicato, il sito usa subito l'immagine scelta o tolta (DR-329). */
  readonly published?: boolean;
  readonly onSaved: (saved: ListingSaved) => void;
}

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.fullMessage : fallback;
}

function sameIds(a: ReadonlySet<string>, b: readonly string[]): boolean {
  return a.size === b.length && b.every((id) => a.has(id));
}

/** Dove l'immagine conta sul sito: il tema della sorgente non la mostrava nel testo delle pagine (`divi_page_thumbnails`). */
const IMAGE_DESCRIPTION: Readonly<Record<'page' | 'post', string>> = {
  post: 'Compare nell’archivio della categoria, nella ricerca e in «Elenco articoli». Solo immagini pubbliche; il testo alternativo è quello del media.',
  page: 'Come nel sito di partenza, il sito non la mostra nella pagina: compare nella ricerca e nei dati strutturati per i motori di ricerca. Solo immagini pubbliche; il testo alternativo è quello del media.',
};

interface ImageNotice {
  readonly title: string;
  readonly text: string;
}

/** Gli avvisi dopo la scelta e la rimozione (DR-329). */
function imageNoticeOf(chosen: boolean, published: boolean): ImageNotice {
  if (chosen) {
    return {
      title: 'Immagine salvata',
      text: published
        ? 'Il sito usa già la nuova immagine in evidenza.'
        : 'Immagine in evidenza salvata.',
    };
  }
  return {
    title: 'Immagine tolta',
    text: published
      ? 'Il sito non usa più un’immagine in evidenza.'
      : 'Immagine in evidenza tolta.',
  };
}

export function ContentListingPanel({
  contentId,
  type,
  featuredMedia,
  termIds,
  disabled,
  published = false,
  onSaved,
}: ContentListingPanelProps): React.JSX.Element {
  const [categories, setCategories] = useState<readonly CategoryOption[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(termIds));
  const [termsBusy, setTermsBusy] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termsNotice, setTermsNotice] = useState(false);

  const [picking, setPicking] = useState(false);
  const [mediaSearch, setMediaSearch] = useState('');
  const [media, setMedia] = useState<readonly MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageNotice, setImageNotice] = useState<ImageNotice | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const imageNoteId = useId();
  // L'avviso dice che cosa fa il sito: con lo stato cambiato non vale più.
  useEffect(() => setImageNotice(null), [published]);
  const describedByNote = published ? { 'aria-describedby': imageNoteId } : {};

  // Una chiave stabile: l'elenco arriva da fuori e un array nuovo a ogni resa azzererebbe la scelta.
  const termsKey = termIds.join(',');
  useEffect(() => setSelected(new Set(termIds)), [termsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (type !== 'post') return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const list = await api<readonly CategoryOption[]>('/terms?taxonomy=category', {
          signal: controller.signal,
        });
        setCategories(list);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setCategoriesError(messageOf(caught, 'Le categorie non si sono caricate.'));
        }
      }
    })();
    return () => controller.abort();
  }, [type]);

  useEffect(() => {
    if (!picking) return undefined;
    const controller = new AbortController();
    setMediaLoading(true);
    setMediaError(null);
    const timer = setTimeout(() => {
      void (async () => {
        const query = new URLSearchParams({ mimePrefix: 'image/', perPage: '100' });
        if (mediaSearch.trim()) query.set('search', mediaSearch.trim());
        try {
          const list = await api<MediaListResponse>(`/media?${query.toString()}`, {
            signal: controller.signal,
          });
          // Solo immagini pubbliche: una privata non comparirebbe sul sito.
          setMedia(list.items.filter((item) => !item.isPrivate));
        } catch (caught) {
          if (!controller.signal.aborted) {
            setMedia([]);
            setMediaError(messageOf(caught, 'L’elenco dei media non si è caricato.'));
          }
        } finally {
          if (!controller.signal.aborted) setMediaLoading(false);
        }
      })();
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [picking, mediaSearch]);

  /** Nel contenuto resta il percorso relativo: l'indirizzo del sito serve solo a mostrarlo. */
  function publicPathOf(item: MediaPickerItem): string {
    return media.find((candidate) => candidate.id === item.id)?.publicPath ?? item.thumbnailUrl;
  }

  async function changeImage(next: MediaPickerItem | null): Promise<void> {
    setImageBusy(true);
    setImageError(null);
    setImageNotice(null);
    try {
      const saved = await api<{ updatedAt?: string }>(`/contents/${contentId}`, {
        method: 'PATCH',
        body: { featuredMediaId: next ? next.id : null },
      });
      onSaved({
        featuredMedia: next
          ? { id: next.id, title: next.title, thumbnailUrl: publicPathOf(next) }
          : null,
        ...(saved?.updatedAt !== undefined ? { updatedAt: saved.updatedAt } : {}),
      });
      setImageNotice(imageNoticeOf(next !== null, published));
    } catch (caught) {
      setImageError(messageOf(caught, 'L’immagine in evidenza non è stata salvata.'));
    } finally {
      setImageBusy(false);
    }
  }

  async function saveTerms(): Promise<void> {
    setTermsBusy(true);
    setTermsError(null);
    setTermsNotice(false);
    try {
      const ids = [...selected];
      const saved = await api<{ termIds: readonly string[]; lastChange?: LastChange }>(
        `/contents/${contentId}/terms`,
        { method: 'PUT', body: { termIds: ids } },
      );
      onSaved({
        termIds: saved?.termIds ?? ids,
        ...(saved?.lastChange !== undefined ? { lastChange: saved.lastChange } : {}),
      });
      setTermsNotice(true);
    } catch (caught) {
      setTermsError(messageOf(caught, 'Le categorie non sono state salvate.'));
    } finally {
      setTermsBusy(false);
    }
  }

  function toggle(id: string, checked: boolean): void {
    setTermsNotice(false);
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="amoris-editor__listing">
      <FieldGroup
        title="Immagine in evidenza"
        description={IMAGE_DESCRIPTION[type]}
        disabled={disabled || imageBusy}
      >
        {imageError ? (
          <Alert variant="error" title="Immagine non salvata">
            {imageError}
          </Alert>
        ) : null}
        {imageNotice ? (
          <Alert variant="success" title={imageNotice.title}>
            {imageNotice.text}
          </Alert>
        ) : null}
        {featuredMedia ? (
          <img
            className="amoris-editor__listing-preview"
            src={siteUrl(featuredMedia.thumbnailUrl)}
            alt={featuredMedia.title ?? 'Immagine in evidenza'}
          />
        ) : (
          <p>Nessuna immagine in evidenza.</p>
        )}
        <div className="amoris-editor__listing-actions">
          <Button
            variant="secondary"
            permitted={!disabled}
            onClick={() => setPicking(true)}
            {...describedByNote}
          >
            {featuredMedia ? 'Cambia l’immagine' : 'Scegli un’immagine'}
          </Button>
          {featuredMedia ? (
            <Button
              variant="tertiary"
              permitted={!disabled}
              onClick={() => void changeImage(null)}
              {...describedByNote}
            >
              Togli l’immagine
            </Button>
          ) : null}
        </div>
        {published ? (
          <p id={imageNoteId}>
            L’immagine scelta o tolta cambia subito sul sito, senza passare dall’anteprima.
          </p>
        ) : null}
      </FieldGroup>

      {type === 'post' ? (
        <FieldGroup
          title="Categorie"
          description="Una notizia pubblicata deve avere almeno una categoria, quindi l’ultima non si può togliere. Una bozza può non averne, ma per pubblicarla ne servirà almeno una."
          disabled={disabled || termsBusy}
        >
          {categoriesError ? (
            <Alert variant="error" title="Categorie non disponibili">
              {categoriesError}
            </Alert>
          ) : null}
          {termsError ? (
            <Alert variant="error" title="Categorie non salvate">
              {termsError}
            </Alert>
          ) : null}
          {termsNotice ? (
            <Alert variant="success" title="Categorie salvate">
              Categorie salvate.
            </Alert>
          ) : null}
          {categories === null && !categoriesError ? (
            <p>Caricamento delle categorie in corso…</p>
          ) : null}
          {categories?.length === 0 ? (
            <p>Non ci sono ancora categorie: si creano dalla schermata «Categorie».</p>
          ) : null}
          {categories?.map((category) => (
            <CheckboxField
              key={category.id}
              label={category.name}
              checked={selected.has(category.id)}
              onChange={(event) => toggle(category.id, event.target.checked)}
            />
          ))}
          <div className="amoris-editor__listing-actions">
            <Button
              variant="primary"
              permitted={!disabled}
              disabled={termsBusy || sameIds(selected, termIds)}
              loading={termsBusy}
              onClick={() => void saveTerms()}
            >
              Salva le categorie
            </Button>
          </div>
        </FieldGroup>
      ) : null}

      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        requireAlt={false}
        loading={mediaLoading}
        items={media.map<MediaPickerItem>((item) => ({
          id: item.id,
          thumbnailUrl: siteUrl(item.publicPath),
          title: item.title ?? item.fileName,
        }))}
        {...(mediaError !== null ? { errorText: mediaError } : {})}
        searchValue={mediaSearch}
        onSearchChange={setMediaSearch}
        onSelect={(item) => {
          setPicking(false);
          void changeImage(item);
        }}
      />
    </div>
  );
}
