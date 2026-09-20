/**
 * Aree dell'area amministrativa (DR-050, attuata da DR-067).
 *
 * Il modello viene da `ux-proposals.md` §4.3 e §4.4, che DR-045 ha approvato:
 * **il ruolo non è un attributo invisibile, è il luogo in cui ci si trova.**
 * La conseguenza che conta per il servizio è il punto 2 del §4.4: finché si
 * lavora in un'area, le richieste portano il contesto di quell'area e il
 * sistema **rifiuta** i dati di un'altra area *anche quando il permesso ci
 * sarebbe*. Il permesso non basta: serve essere nell'area giusta.
 *
 * In Fase 1 le aree sono due (`design-system.md` §7.2). Le altre quattro del
 * §7.1 non compaiono: il gate vieta di **pianificare** le fasi gestionali, e
 * un valore dichiarato qui sarebbe una pianificazione.
 *
 * L'area non si deriva dal permesso, si dichiara sulla rotta. I due assi non
 * coincidono: SEO e redirect stanno in Redazione (`design-system.md` §7.2) ma
 * usano `settings.write`, perché ADR-007 §3.2 fissa cinque permessi e non se
 * ne aggiungono di iniziativa.
 */
export const ADMIN_AREAS = ['redazione', 'impostazioni'] as const;

export type AdminArea = (typeof ADMIN_AREAS)[number];

/** Come l'area si chiama a schermo: `ActiveContextBadge` scrive una frase, non un'icona. */
export const AREA_LABELS: Readonly<Record<AdminArea, string>> = {
  redazione: 'Redazione',
  impostazioni: 'Impostazioni',
};

export function isAdminArea(value: string): value is AdminArea {
  return (ADMIN_AREAS as readonly string[]).includes(value);
}
