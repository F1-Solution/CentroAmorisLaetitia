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
 * Raccoglie in un insieme le chiavi di permesso di un elenco di righe.
 *
 * **Chi lo chiama decide che cosa significa.** `permissionsOfRole` gli passa i
 * permessi del **solo ruolo attivo**, ed è quello che vale come autorizzazione
 * (DR-050, attuata da DR-067). `reachableAreasOf` gli passa i permessi di
 * **tutti** i ruoli posseduti, che non autorizzano nulla: servono solo a sapere
 * in quali aree la persona può entrare, cioè che cosa il commutatore le offre.
 *
 * Fino al 2026-09-20 questa funzione calcolava l'unione dei ruoli **come**
 * autorizzazione, perché il criterio di uscita 24 citava DR-047. DR-067 ha
 * chiuso quella discrepanza in favore del ruolo attivo.
 */
export function collectPermissions(
  rows: readonly { readonly permissionKey: string }[],
): ReadonlySet<string> {
  return new Set(rows.map((row) => row.permissionKey));
}
