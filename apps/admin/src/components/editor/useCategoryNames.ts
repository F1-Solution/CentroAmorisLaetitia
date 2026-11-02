'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface CategoryOption {
  readonly id: string;
  readonly name: string;
}

/** I nomi delle categorie per l'albero (W10-N1), chiesti con una sola richiesta quando `active` è vero; `undefined` finché non arrivano. */
export function useCategoryNames(active: boolean): ReadonlyMap<string, string> | undefined {
  const [names, setNames] = useState<ReadonlyMap<string, string> | undefined>(undefined);

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const list = await api<readonly CategoryOption[]>('/terms?taxonomy=category', {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setNames(new Map(list.map((item) => [item.id, item.name])));
      } catch {
        // Senza nomi l'albero resta col nome del tipo: il pannello dell'elenco mostra già l'errore.
      }
    })();
    return () => controller.abort();
  }, [active]);

  return names;
}
