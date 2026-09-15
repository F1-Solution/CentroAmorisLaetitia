/**
 * Template SEO da riprodurre (`docs/migration/wp-to-postgres-mapping.md`
 * §6.3, trascritti in `1B-W0` §2.1). Si migrano le **regole**, non i 282
 * record di `wp_aioseo_posts` (§6.1): questi sei valori sono letterali,
 * fissati nel mapping approvato, non calcolati da `wp_options.aioseo_options`
 * — quel valore serializzato in PHP non aggiunge nulla che il mapping non
 * dica già.
 *
 * `descriptionTemplate` resta `null` per tutti: il mapping dice che ogni
 * descrizione viene «dal contenuto della pagina», «dal riassunto
 * dell'articolo», «dalla descrizione della categoria», «dalla didascalia», o
 * semplicemente non esiste (`search`) — non un modello di testo fisso da
 * riprodurre, ma un valore calcolato altrove, fuori da questa fase.
 *
 * **Scostamento dichiarato**: il suffisso di paginazione (`- Page {n}`,
 * mapping §6.3) non è importato. È in inglese su un sito italiano — una
 * difformità dichiarata sotto **D13** — e non ha una colonna propria in
 * `seo_templates`: non si inventa un ambito per ospitarlo. Resta una
 * decisione da chiudere altrove, non qui.
 */
export interface SeoTemplateDefinition {
  readonly scope: string;
  readonly titleTemplate: string;
  readonly descriptionTemplate: string | null;
}

export const SEO_TEMPLATE_DEFINITIONS: readonly SeoTemplateDefinition[] = [
  { scope: 'home', titleTemplate: '{title} - {site_title}', descriptionTemplate: null },
  { scope: 'page', titleTemplate: '{title} - {site_title}', descriptionTemplate: null },
  { scope: 'post', titleTemplate: '{title} - {site_title}', descriptionTemplate: null },
  { scope: 'category', titleTemplate: '{term_title} - {site_title}', descriptionTemplate: null },
  { scope: 'attachment', titleTemplate: '{title} - {site_title}', descriptionTemplate: null },
  { scope: 'search', titleTemplate: '{query} - {site_title}', descriptionTemplate: null },
];
