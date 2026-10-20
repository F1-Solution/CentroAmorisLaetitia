import { ApiError } from '../../lib/api';

/** Ruoli assegnabili, con l'etichetta mostrata (DR-229: la chiave `editor` si chiama «Redazione»). */
export const ROLE_OPTIONS = [
  { key: 'editor', label: 'Redazione' },
  { key: 'amministrazione', label: 'Amministrazione' },
] as const;

export function roleLabel(key: string): string {
  return ROLE_OPTIONS.find((role) => role.key === key)?.label ?? key;
}

export function italianDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Messaggio in italiano per un errore dell'API: i 409 noti hanno un testo proprio. */
export function accountErrorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    if (caught.code === 'EMAIL_TAKEN') return 'Esiste già un account con questo indirizzo.';
    if (caught.code === 'LAST_ADMINISTRATOR') {
      return 'Non è possibile: nessun account attivo avrebbe più il ruolo di amministrazione.';
    }
    return caught.fullMessage;
  }
  return 'Non è stato possibile contattare il servizio.';
}
