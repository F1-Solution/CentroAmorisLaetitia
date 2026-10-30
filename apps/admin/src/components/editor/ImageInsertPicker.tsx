'use client';

import { MediaPicker, type MediaPickerItem } from '@amoris/ui';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { siteUrl } from '../../lib/siteUrl';

interface MediaItem {
  readonly id: string;
  readonly publicPath: string;
  readonly fileName: string;
  readonly title: string | null;
  readonly altText?: string | null;
  readonly isPrivate: boolean;
}

interface MediaListResponse {
  readonly items: readonly MediaItem[];
}

export interface ImageInsertPickerProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** `mediaAlt` è il testo alternativo scritto in Media, per chi non ripiega su di esso (DR-321). */
  readonly onInsert: (mediaId: string, alt: string, decorative: boolean, mediaAlt: string) => void;
}

/** Passo «quale immagine?» dell'inserimento del blocco «Immagine»: solo media pubblici, con il testo alternativo (DR-283). */
export function ImageInsertPicker({
  open,
  onClose,
  onInsert,
}: ImageInsertPickerProps): React.JSX.Element | null {
  const [search, setSearch] = useState('');
  const [media, setMedia] = useState<readonly MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      void (async () => {
        const query = new URLSearchParams({ mimePrefix: 'image/', perPage: '100' });
        if (search.trim()) query.set('search', search.trim());
        try {
          const list = await api<MediaListResponse>(`/media?${query.toString()}`, {
            signal: controller.signal,
          });
          // Solo immagini pubbliche: una privata non comparirebbe sul sito.
          setMedia(list.items.filter((item) => !item.isPrivate));
        } catch (caught) {
          if (!controller.signal.aborted) {
            setMedia([]);
            setError(
              caught instanceof ApiError
                ? caught.fullMessage
                : 'L’elenco dei media non si è caricato.',
            );
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, search]);

  return (
    <MediaPicker
      open={open}
      onClose={onClose}
      loading={loading}
      items={media.map<MediaPickerItem>((item) => ({
        id: item.id,
        thumbnailUrl: siteUrl(item.publicPath),
        title: item.title ?? item.fileName,
        altText: item.altText ?? null,
      }))}
      {...(error !== null ? { errorText: error } : {})}
      searchValue={search}
      onSearchChange={setSearch}
      onSelect={(item, alt, decorative) => onInsert(item.id, alt, decorative, item.altText ?? '')}
    />
  );
}
