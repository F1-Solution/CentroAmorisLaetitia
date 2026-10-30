'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

interface MediaName {
  readonly altText: string | null;
  readonly title: string | null;
}

/** Testo alternativo, o titolo, dei media indicati, letti una volta ciascuno per l'albero dei blocchi (W9-N6). */
export function useMediaNames(ids: readonly string[]): ReadonlyMap<string, string> {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const asked = useRef<ReadonlySet<string>>(new Set());
  const key = [...new Set(ids)].sort().join(',');

  useEffect(() => {
    const missing = key.split(',').filter((id) => id !== '' && !asked.current.has(id));
    if (missing.length === 0) return;
    asked.current = new Set([...asked.current, ...missing]);
    void Promise.all(
      missing.map(async (id) => {
        try {
          const media = await api<MediaName>(`/media/${id}`);
          return [id, media.altText?.trim() || media.title?.trim() || ''] as const;
        } catch {
          // Senza nome l'albero dice «immagine»; il media si richiede quando cambiano le immagini.
          asked.current = new Set([...asked.current].filter((other) => other !== id));
          return [id, ''] as const;
        }
      }),
    ).then((found) => {
      const named = found.filter(([, name]) => name !== '');
      if (named.length > 0) setNames((current) => new Map([...current, ...named]));
    });
  }, [key]);

  return names;
}
