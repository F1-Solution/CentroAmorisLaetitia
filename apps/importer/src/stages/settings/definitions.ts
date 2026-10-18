/**
 * Le chiavi di `settings` che questa fase scrive
 * (`docs/architecture/schema.sql` §10, «Chiavi previste all'import»;
 * `docs/migration/wp-to-postgres-mapping.md` §5).
 *
 * Due famiglie:
 *
 * - **derivate da `wp_options`**: 8 chiavi, un valore preso da una riga della
 *   sorgente. Se la riga manca, la fase registra un `import_issues` di
 *   gravità `warning` e salta quella sola chiave — non inventa un valore.
 * - **nuove, senza equivalente in `wp_options`**: 9 chiavi (le ultime due da DR-185) che il sistema
 *   nuovo richiede e che WordPress non aveva. Non hanno una riga sorgente:
 *   si seminano con un valore predefinito prudente, dichiarato qui.
 *
 * **Scostamento dichiarato**: `docs/architecture/schema.sql` §10 elenca
 * esattamente queste 15 chiavi come «previste all'import». Il conteggio
 * atteso scritto altrove nel codice (`report/constants.ts`,
 * `importer-spec.md` §8.1) è **18**, tre in più, e nessun documento letto in
 * questa wave dice quali siano le tre chiavi mancanti. Non si inventano:
 * questa fase importa le 15 documentate e riporta lo scostamento
 * nell'audit, sullo stesso modello di `IMPORTER-DESIGN.md` §11.3.
 */

export type SettingsSource =
  | { readonly kind: 'wp_options'; readonly optionName: string }
  | { readonly kind: 'default'; readonly syntheticId: number };

export interface SettingsDefinition {
  readonly key: string;
  readonly label: string;
  readonly description: string | null;
  readonly isSecret: boolean;
  readonly source: SettingsSource;
  /** Converte il valore grezzo di `wp_options.option_value` nel valore JSON da scrivere. */
  readonly parse: (raw: string) => unknown;
  /** Solo per `source.kind === 'default'`: il valore seminato. */
  readonly defaultValue?: unknown;
}

const identity = (raw: string): unknown => raw;
const asInteger = (raw: string): unknown => {
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? raw : n;
};

export const SETTINGS_DEFINITIONS: readonly SettingsDefinition[] = [
  {
    key: 'site.title',
    label: 'Titolo del sito',
    description: null,
    isSecret: false,
    source: { kind: 'wp_options', optionName: 'blogname' },
    parse: identity,
  },
  {
    key: 'site.description',
    label: 'Descrizione del sito',
    description: null,
    isSecret: false,
    source: { kind: 'wp_options', optionName: 'blogdescription' },
    parse: identity,
  },
  {
    key: 'site.timezone',
    label: 'Fuso orario',
    description: null,
    isSecret: false,
    source: { kind: 'wp_options', optionName: 'timezone_string' },
    parse: identity,
  },
  {
    key: 'site.locale',
    label: 'Lingua del sito',
    description: null,
    isSecret: false,
    source: { kind: 'wp_options', optionName: 'WPLANG' },
    parse: identity,
  },
  {
    key: 'site.date_format',
    label: 'Formato data',
    description: null,
    isSecret: false,
    source: { kind: 'wp_options', optionName: 'date_format' },
    parse: identity,
  },
  {
    key: 'site.time_format',
    label: 'Formato ora',
    description: null,
    isSecret: false,
    source: { kind: 'wp_options', optionName: 'time_format' },
    parse: identity,
  },
  {
    key: 'site.start_of_week',
    label: 'Primo giorno della settimana',
    description: null,
    isSecret: false,
    source: { kind: 'wp_options', optionName: 'start_of_week' },
    parse: asInteger,
  },
  {
    key: 'content.posts_per_page',
    label: 'Articoli per pagina',
    description: null,
    isSecret: false,
    source: { kind: 'wp_options', optionName: 'posts_per_page' },
    parse: asInteger,
  },
  {
    key: 'seo.robots_txt',
    label: 'Contenuto di robots.txt',
    description: 'Valore predefinito: nessuna riga sorgente in wp_options.',
    isSecret: false,
    source: { kind: 'default', syntheticId: 1 },
    parse: identity,
    defaultValue: 'User-agent: *\nAllow: /',
  },
  {
    key: 'seo.sitemap_enabled',
    label: 'Sitemap attiva',
    description: 'Valore predefinito: nessuna riga sorgente in wp_options.',
    isSecret: false,
    source: { kind: 'default', syntheticId: 2 },
    parse: identity,
    defaultValue: true,
  },
  {
    key: 'seo.redirect_attachment_urls',
    label: 'Redirect delle pagine allegato',
    description: '1B-W0 §2.6: è una regola, non un comportamento osservato.',
    isSecret: false,
    source: { kind: 'default', syntheticId: 3 },
    parse: identity,
    defaultValue: true,
  },
  {
    key: 'analytics.ga4_measurement_id',
    label: 'Identificativo di misurazione GA4',
    description: 'Nessun account collegato nella sorgente (1B-W0 §5).',
    isSecret: false,
    source: { kind: 'default', syntheticId: 4 },
    parse: identity,
    defaultValue: null,
  },
  {
    key: 'cookie.banner_enabled',
    label: 'Banner cookie attivo',
    description: 'Valore predefinito: nessuna riga sorgente in wp_options.',
    isSecret: false,
    source: { kind: 'default', syntheticId: 5 },
    parse: identity,
    defaultValue: true,
  },
  {
    key: 'maps.embed_enabled',
    label: 'Mappe incorporate attive',
    description: 'Valore predefinito: nessuna riga sorgente in wp_options.',
    isSecret: false,
    source: { kind: 'default', syntheticId: 6 },
    parse: identity,
    defaultValue: true,
  },
  {
    key: 'contact.address',
    label: 'Indirizzo del Centro',
    description: 'Nessuna opzione strutturata nella sorgente: richiede compilazione manuale.',
    isSecret: false,
    source: { kind: 'default', syntheticId: 7 },
    parse: identity,
    defaultValue: null,
  },
  {
    key: 'contact.phone',
    label: 'Telefono del Centro',
    description:
      'Per i dati strutturati (DR-185); la sorgente non lo ha: richiede compilazione manuale.',
    isSecret: false,
    source: { kind: 'default', syntheticId: 8 },
    parse: identity,
    defaultValue: '',
  },
  {
    key: 'social.profiles',
    label: 'Profili social',
    description:
      'Indirizzi completi dei profili, uno per voce (DR-185); la sorgente non ne ha: elenco vuoto.',
    isSecret: false,
    source: { kind: 'default', syntheticId: 9 },
    parse: identity,
    defaultValue: [],
  },
];
