import { ApiError } from '../../lib/api';
import { italianDate } from '../accounts/accountLabels';

/** Un documento come lo restituisce `GET /documents`. */
export interface EditorialDocument {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly publishedAt: string | null;
  readonly modifiedAt: string | null;
  readonly sitePath: string;
  readonly file: {
    readonly mediaId: string;
    readonly fileName: string;
    readonly mimeType: string;
    readonly byteSize: number;
    readonly publicPath: string;
  };
}

export const CONNECTION_ERROR = 'Non è stato possibile contattare il servizio.';

/** «Ultimo aggiornamento» come lo mostra il sito: la modifica, altrimenti la pubblicazione (D156). */
export function lastUpdate(document: EditorialDocument): string {
  const iso = document.modifiedAt ?? document.publishedAt;
  return iso ? italianDate(iso) : '—';
}

/** Messaggio in italiano di un errore dell'API: i campi rifiutati, se ci sono, altrimenti il messaggio. */
export function messageOf(caught: unknown): string {
  if (!(caught instanceof ApiError)) return CONNECTION_ERROR;
  return caught.details.length > 0
    ? caught.details.map((detail) => detail.message).join(' ')
    : caught.message;
}
