'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { messageOf, type EditorialDocument } from './documentModel';

export interface PublicDocumentsState {
  readonly documents: readonly EditorialDocument[] | null;
  readonly error: string | null;
}

/** I documenti pubblici, caricati quando `active` è vero: lo stesso elenco della schermata «Documenti», senza i riservati (DR-218). */
export function usePublicDocuments(active = true): PublicDocumentsState {
  const [state, setState] = useState<PublicDocumentsState>({ documents: null, error: null });

  useEffect(() => {
    if (!active) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const documents = await api<EditorialDocument[]>('/documents', {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setState({ documents, error: null });
      } catch (caught) {
        if (!controller.signal.aborted) setState({ documents: null, error: messageOf(caught) });
      }
    })();
    return () => controller.abort();
  }, [active]);

  return state;
}
