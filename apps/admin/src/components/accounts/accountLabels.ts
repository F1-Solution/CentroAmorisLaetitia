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

/** Rifiuti della password attuale sul proprio account (DR-288), con il testo mostrato sul campo. */
const PASSWORD_REFUSALS: Readonly<Record<string, string>> = {
  CURRENT_PASSWORD_REQUIRED: 'Scrivi la tua password attuale.',
  INVALID_CREDENTIALS: 'La password attuale non è corretta.',
  TOO_MANY_ATTEMPTS: 'Troppi tentativi. Riprova più tardi.',
};

/** Il testo per il campo della password attuale, o `null` se l'errore è un altro. */
export function passwordRefusalMessage(caught: unknown): string | null {
  if (!(caught instanceof ApiError)) return null;
  return PASSWORD_REFUSALS[caught.code] ?? null;
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
