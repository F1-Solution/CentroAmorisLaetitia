/** Chiave della memoria di scheda con cui un'altra schermata lascia un avviso alla schermata di accesso. */
export const ACCESS_NOTICE_KEY = 'amoris.accesso.avviso';

/** Valore lasciato dopo il cambio del proprio indirizzo, che chiude la sessione. */
export const EMAIL_CHANGED_NOTICE = 'indirizzo-cambiato';

/** Valore lasciato dopo aver tolto un proprio ruolo, che chiude la sessione (W8-28). */
export const ROLES_CHANGED_NOTICE = 'ruoli-cambiati';

// Una Map e non un oggetto: `__proto__` o `toString` non devono trovare nulla.
const MESSAGES: ReadonlyMap<string, string> = new Map([
  [EMAIL_CHANGED_NOTICE, 'Indirizzo cambiato: entra di nuovo con il nuovo indirizzo.'],
  [ROLES_CHANGED_NOTICE, 'Ruoli cambiati: la sessione è stata chiusa. Entra di nuovo.'],
]);

/** Legge l'avviso una volta sola e lo cancella; senza memoria del browser non c'è avviso. */
export function takeAccessNotice(): string | null {
  try {
    const key = window.sessionStorage.getItem(ACCESS_NOTICE_KEY);
    window.sessionStorage.removeItem(ACCESS_NOTICE_KEY);
    return key ? (MESSAGES.get(key) ?? null) : null;
  } catch {
    return null;
  }
}
