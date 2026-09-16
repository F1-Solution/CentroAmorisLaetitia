/**
 * Permessi. ADR-007 §3.2: le autorizzazioni si esprimono come permessi, **mai**
 * come confronti sul nome del ruolo.
 *
 * L'elenco è esattamente quello che ADR-007 §3.2 nomina per la Fase 1: non ne
 * viene aggiunto nessuno, perché ruoli e autorizzazioni non si decidono di
 * iniziativa. I moduli nuovi di questa wave si appoggiano ai cinque esistenti
 * secondo la mappa qui sotto, che è una scelta di attuazione e non un permesso
 * nuovo:
 *
 * | Modulo | Lettura | Scrittura |
 * |---|---|---|
 * | `content`, `terms`, `menu` | `content.read` | `content.write`, più `content.publish` per pubblicare e ritirare |
 * | `media` | `content.read` | `media.write` |
 * | `seo`, `redirects`, `settings` | `content.read` | `settings.write` |
 *
 * Una divisione più fine è un cambio di dati — righe in `role_permissions` — non
 * un cambio di codice.
 */
export const PERMISSIONS = {
  contentRead: 'content.read',
  contentWrite: 'content.write',
  contentPublish: 'content.publish',
  mediaWrite: 'media.write',
  settingsWrite: 'settings.write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

/**
 * I permessi di una persona sono l'**unione** di quelli dei suoi ruoli.
 *
 * DR-050 ha poi adottato «un solo ruolo attivo per volta», ma riguarda ciò che
 * l'**interfaccia** mostra: restringere lato servizio richiede che la sessione
 * sappia quale ruolo è attivo, e il commutatore nasce nella `1D-W8`. In Fase 1
 * la differenza non è osservabile, perché ADR-007 §3.2 prevede un solo ruolo.
 * La discrepanza fra il criterio di uscita 24, che cita DR-047, e DR-050 che lo
 * supera è segnalata e non risolta qui.
 */
export function unionOfPermissions(
  rows: readonly { readonly permissionKey: string }[],
): ReadonlySet<string> {
  return new Set(rows.map((row) => row.permissionKey));
}
