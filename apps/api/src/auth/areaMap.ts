import type { AdminArea } from './areas.js';
import { PERMISSIONS } from './permissions.js';

/**
 * Quali aree usano un dato permesso.
 *
 * Serve a una cosa sola: sapere in quali aree un ruolo può entrare, cioè che
 * cosa il commutatore gli offre. **Non autorizza**: autorizzano i permessi del
 * ruolo attivo, e il confronto fra l'area della rotta e l'area della sessione
 * (`plugins/auth.ts`).
 *
 * La mappa è l'inverso di come le rotte sono raggruppate in `app.ts`, dove
 * l'area si dichiara per modulo secondo `design-system.md` §7.2:
 *
 * | Area | Sezioni | Moduli |
 * |---|---|---|
 * | Redazione | Pagine · Notizie · Media · Menu · SEO e indirizzi | `content`, `terms`, `media`, `menu`, `seo`, `redirects` |
 * | Impostazioni | Persone e permessi · Registro delle operazioni · Impostazioni del sito | `settings` |
 *
 * `settings.write` compare in **entrambe** perché i due assi non coincidono:
 * SEO e redirect stanno in Redazione ma usano quel permesso, e ADR-007 §3.2
 * fissa cinque permessi che non si allargano di iniziativa.
 */
export const AREA_OF_PERMISSION: Readonly<Record<string, readonly AdminArea[]>> = {
  [PERMISSIONS.contentRead]: ['redazione'],
  [PERMISSIONS.contentWrite]: ['redazione'],
  [PERMISSIONS.contentPublish]: ['redazione'],
  [PERMISSIONS.mediaWrite]: ['redazione'],
  [PERMISSIONS.settingsWrite]: ['redazione', 'impostazioni'],
};
