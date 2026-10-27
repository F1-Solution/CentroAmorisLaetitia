/** Tipi di dati strutturati di pagine e notizie che il sito sa produrre (DR-278), condivisi da API e area. */

/** I valori ammessi; vuoto vuol dire il predefinito: WebPage per le pagine, BlogPosting per le notizie. */
export const SEO_SCHEMA_TYPES = ['WebPage', 'BlogPosting'] as const;

export type SeoSchemaType = (typeof SEO_SCHEMA_TYPES)[number];

/** Gli ambiti dei modelli SEO che rendono un contenuto: solo lì il tipo si sceglie. */
export const SEO_SCHEMA_SCOPES: readonly string[] = ['home', 'page', 'post'];

/** Le voci in italiano, con il nome Schema.org fra parentesi. */
export const SEO_SCHEMA_TYPE_LABELS: Readonly<Record<SeoSchemaType, string>> = {
  WebPage: 'Pagina web (WebPage)',
  BlogPosting: 'Articolo di blog (BlogPosting)',
};

export const SEO_SCHEMA_TYPE_MESSAGE = 'Il tipo di dati strutturati è «WebPage» o «BlogPosting».';

export const SEO_SCHEMA_SCOPE_MESSAGE =
  'Il tipo di dati strutturati si sceglie solo nei modelli della pagina iniziale, delle pagine e delle notizie.';
