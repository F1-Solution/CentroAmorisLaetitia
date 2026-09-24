/**
 * Il **sottoinsieme sintetico** su cui la CI prova l'importazione intera:
 * idempotenza, andata e ritorno dei contenuti, e l'ordine delle fasi di
 * DR-062.
 *
 * Perché esiste. La prova che conta davvero — due `apply` di fila sulla
 * sorgente reale — vive in `tests/real/idempotency.real.test.ts` e **non gira
 * in CI** (DR-010): legge `source-private/`, che non entra in Git. Senza un
 * equivalente sintetico, la catena completa non verrebbe mai esercitata da un
 * controllo automatico, e una regressione si scoprirebbe solo alla `1D-W11`,
 * cioè troppo tardi.
 *
 * Questo sottoinsieme non imita la sorgente nei numeri: imita i **meccanismi**.
 * Una riga per ciascuna forma di idempotenza che l'importer usa:
 *
 * | Meccanismo | Fase che lo rappresenta qui |
 * |---|---|
 * | creazione e poi aggiornamento sul posto via `import_id_map` | `contents`, `media`, `terms`, `forms`, `sliders` |
 * | catalogo a chiave fissa | `settings` |
 * | cancella e reinserisci i figli | `menus` |
 * | solo inserimento, mai aggiornamento | `submissions`, `legacy` |
 * | ricalcolo completo | `redirects` |
 * | riscrittura di ciò che le fasi prima hanno scritto | `rewrite` |
 *
 * **Nessun dato reale.** Nomi inventati, dominio `esempio.invalid`, indirizzi
 * IP dagli intervalli riservati alla documentazione (RFC 5737).
 */
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SourceReader } from '../../../src/source/index.js';
import type { SqlRow } from '../../../src/source/sql/types.js';
import { listUploadedFiles } from '../../../src/source/files/uploads.js';
import { serializedAttachmentMetadata } from './mediaFixtures.js';

/** Identificativi di origine, tenuti insieme perché i riferimenti incrociati si leggano. */
export const LEGACY = {
  user: 1,
  attachment: 400,
  pagina: 100,
  articolo: 101,
  modulo: 700,
  voceMenuRadice: 500,
  voceMenuFiglia: 501,
  categoria: 10,
  menu: 3,
  slider: 9,
} as const;

export const ATTACHED_FILE = '2026/01/immagine-di-prova.jpg';
export const VARIANT_FILE = '2026/01/immagine-di-prova-150x150.jpg';

/**
 * Il contenuto della pagina: un blocco Gutenberg che **cita il modulo 700**.
 *
 * È il caso che DR-062 esiste per risolvere. Con `forms` dopo `contents`
 * questo blocco diventa un blocco `html` di riserva; con l'ordine nuovo
 * diventa un blocco `form` con l'identificativo vero. La differenza è
 * osservabile, ed è ciò che `syntheticSubset.test.ts` verifica.
 */
const PAGINA_CONTENT = [
  '<!-- wp:paragraph -->',
  '<p>Un paragrafo con un riferimento a <img src="/wp-content/uploads/2026/01/immagine-di-prova.jpg" alt="prova"> dentro.</p>',
  '<!-- /wp:paragraph -->',
  `<!-- wp:wpforms/form-selector {"formId":"${LEGACY.modulo}","displayTitle":true,"displayDesc":false} /-->`,
  '<!-- wp:heading -->',
  '<h2>Un titolo</h2>',
  '<!-- /wp:heading -->',
].join('\n');

const ARTICOLO_CONTENT = [
  '<!-- wp:paragraph -->',
  '<p>Accenti, città, e un&#8217;apostrofo tipografico. Emoji 🎉.</p>',
  '<!-- /wp:paragraph -->',
  '<!-- wp:list -->',
  '<ul><li>Primo</li><li>Secondo</li></ul>',
  '<!-- /wp:list -->',
].join('\n');

const MODULO_DEFINITION = JSON.stringify({
  id: String(LEGACY.modulo),
  field_id: '3',
  fields: {
    1: { id: '1', type: 'name', label: 'Nome e cognome', required: '1', format: 'simple' },
    2: { id: '2', type: 'email', label: 'Posta elettronica', required: '1' },
  },
  settings: {
    form_title: 'Richiesta di informazioni',
    submit_text: 'Invia',
    notification_enable: '1',
    notifications: {
      1: {
        notification_name: 'Segreteria',
        email: 'segreteria@esempio.invalid',
        subject: 'Nuova richiesta',
        sender_name: 'Sito di prova',
        sender_address: 'noreply@esempio.invalid',
        replyto: '',
        message: 'È arrivata una richiesta.',
      },
    },
    confirmations: { 1: { message: '<p>Grazie.</p>' } },
  },
  payments: {},
  meta: {},
});

function postmeta(postId: number, key: string, value: string | null): SqlRow {
  return { meta_id: postId * 1000 + key.length, post_id: postId, meta_key: key, meta_value: value };
}

const WP_POSTS: readonly SqlRow[] = [
  {
    ID: LEGACY.attachment,
    post_author: LEGACY.user,
    post_type: 'attachment',
    post_status: 'inherit',
    post_parent: LEGACY.pagina,
    post_name: 'immagine-di-prova',
    post_title: 'Immagine di prova',
    post_excerpt: 'Didascalia di prova',
    post_content: '',
    post_mime_type: 'image/jpeg',
    post_date: '2026-01-02 09:00:00',
    menu_order: 0,
  },
  {
    ID: LEGACY.pagina,
    post_author: LEGACY.user,
    post_type: 'page',
    post_status: 'publish',
    post_parent: 0,
    post_name: 'pagina-di-prova',
    post_title: 'Pagina di prova',
    post_excerpt: '',
    post_content: PAGINA_CONTENT,
    post_date: '2026-01-03 09:00:00',
    menu_order: 1,
  },
  {
    ID: LEGACY.articolo,
    post_author: LEGACY.user,
    post_type: 'post',
    post_status: 'publish',
    post_parent: 0,
    post_name: 'articolo-di-prova',
    post_title: 'Articolo di prova',
    post_excerpt: 'Estratto di prova',
    post_content: ARTICOLO_CONTENT,
    post_date: '2026-01-04 09:00:00',
    menu_order: 0,
  },
  {
    ID: LEGACY.modulo,
    post_author: LEGACY.user,
    post_type: 'wpforms',
    post_status: 'publish',
    post_parent: 0,
    post_name: 'richiesta-informazioni',
    post_title: 'Richiesta di informazioni',
    post_excerpt: '',
    post_content: MODULO_DEFINITION,
    post_date: '2026-01-01 09:00:00',
    menu_order: 0,
  },
  {
    ID: LEGACY.voceMenuRadice,
    post_author: LEGACY.user,
    post_type: 'nav_menu_item',
    post_status: 'publish',
    post_parent: 0,
    post_name: '',
    post_title: 'Pagina di prova',
    post_excerpt: '',
    post_content: '',
    post_date: '2026-01-05 09:00:00',
    menu_order: 1,
  },
  {
    ID: LEGACY.voceMenuFiglia,
    post_author: LEGACY.user,
    post_type: 'nav_menu_item',
    post_status: 'publish',
    post_parent: 0,
    post_name: '',
    post_title: 'Collegamento esterno',
    post_excerpt: '',
    post_content: '',
    post_date: '2026-01-05 09:01:00',
    menu_order: 2,
  },
];

const WP_POSTMETA: readonly SqlRow[] = [
  postmeta(LEGACY.attachment, '_wp_attached_file', ATTACHED_FILE),
  postmeta(
    LEGACY.attachment,
    '_wp_attachment_metadata',
    serializedAttachmentMetadata({
      width: 800,
      height: 600,
      variantFile: VARIANT_FILE,
      variantWidth: 150,
      variantHeight: 150,
      variantMimeType: 'image/jpeg',
    }),
  ),
  postmeta(LEGACY.attachment, '_wp_attachment_image_alt', 'Testo alternativo di prova'),
  postmeta(LEGACY.pagina, '_thumbnail_id', String(LEGACY.attachment)),

  postmeta(LEGACY.voceMenuRadice, '_menu_item_type', 'post_type'),
  postmeta(LEGACY.voceMenuRadice, '_menu_item_object', 'page'),
  postmeta(LEGACY.voceMenuRadice, '_menu_item_object_id', String(LEGACY.pagina)),
  postmeta(LEGACY.voceMenuRadice, '_menu_item_menu_item_parent', '0'),

  postmeta(LEGACY.voceMenuFiglia, '_menu_item_type', 'custom'),
  postmeta(LEGACY.voceMenuFiglia, '_menu_item_url', 'https://esempio.invalid/altrove'),
  postmeta(LEGACY.voceMenuFiglia, '_menu_item_menu_item_parent', String(LEGACY.voceMenuRadice)),
  postmeta(LEGACY.voceMenuFiglia, '_nav_menu_role', 'in'),
];

const WP_TERMS: readonly SqlRow[] = [
  { term_id: LEGACY.categoria, name: 'Notizie', slug: 'notizie', term_group: 0 },
  { term_id: LEGACY.menu, name: 'Menu principale', slug: 'menu-principale', term_group: 0 },
];

const WP_TERM_TAXONOMY: readonly SqlRow[] = [
  {
    term_taxonomy_id: 1,
    term_id: LEGACY.categoria,
    taxonomy: 'category',
    description: 'Le notizie',
    parent: 0,
    count: 1,
  },
  {
    term_taxonomy_id: 2,
    term_id: LEGACY.menu,
    taxonomy: 'nav_menu',
    description: '',
    parent: 0,
    count: 2,
  },
];

const WP_TERM_RELATIONSHIPS: readonly SqlRow[] = [
  { object_id: LEGACY.articolo, term_taxonomy_id: 1, term_order: 0 },
  { object_id: LEGACY.voceMenuRadice, term_taxonomy_id: 2, term_order: 0 },
  { object_id: LEGACY.voceMenuFiglia, term_taxonomy_id: 2, term_order: 0 },
];

const WP_OPTIONS: readonly SqlRow[] = [
  { option_id: 1, option_name: 'blogname', option_value: 'Sito di prova' },
  { option_id: 2, option_name: 'blogdescription', option_value: 'Sottotitolo di prova' },
  { option_id: 3, option_name: 'timezone_string', option_value: 'Europe/Rome' },
  { option_id: 4, option_name: 'WPLANG', option_value: '' },
  { option_id: 5, option_name: 'date_format', option_value: 'd/m/Y' },
  { option_id: 6, option_name: 'time_format', option_value: 'H:i' },
  { option_id: 7, option_name: 'start_of_week', option_value: '1' },
  { option_id: 8, option_name: 'posts_per_page', option_value: '10' },
];

const WP_USERS: readonly SqlRow[] = [
  {
    ID: LEGACY.user,
    user_login: 'redattore-di-prova',
    user_email: 'redattore@esempio.invalid',
    display_name: 'Redattore Di Prova',
    user_registered: '2026-01-01 08:00:00',
  },
];

const WP_USERMETA: readonly SqlRow[] = [
  { umeta_id: 1, user_id: LEGACY.user, meta_key: 'first_name', meta_value: 'Redattore' },
  { umeta_id: 2, user_id: LEGACY.user, meta_key: 'last_name', meta_value: 'Di Prova' },
  {
    umeta_id: 3,
    user_id: LEGACY.user,
    meta_key: 'wp_capabilities',
    meta_value: 'a:1:{s:13:"administrator";b:1;}',
  },
];

const WP_REVSLIDER_SLIDERS: readonly SqlRow[] = [
  {
    id: LEGACY.slider,
    title: 'Carosello di prova',
    alias: 'home',
    params: JSON.stringify({
      general: { fullWidth: 'on' },
      nav: { arrows: 'on' },
      version: '6.5.0',
    }),
    settings: JSON.stringify({ version: '6.5.0' }),
    type: 'standard',
  },
];

const WP_REVSLIDER_SLIDES: readonly SqlRow[] = [
  {
    id: 91,
    slider_id: LEGACY.slider,
    slide_order: 1,
    params: JSON.stringify({
      bg: { type: 'image', image: `https://esempio.invalid/wp-content/uploads/${ATTACHED_FILE}` },
      timeline: { duration: 9000 },
      version: '6.5.0',
    }),
    layers: JSON.stringify({ '1': { type: 'text', text: 'Titolo della slide' } }),
  },
  {
    id: 92,
    slider_id: LEGACY.slider,
    slide_order: 2,
    params: JSON.stringify({ bg: { type: 'color' }, version: '6.5.0' }),
    layers: JSON.stringify([]),
  },
];

const WP_WPFORMS_ENTRIES: readonly SqlRow[] = [
  {
    entry_id: 1,
    form_id: LEGACY.modulo,
    post_id: 0,
    user_id: 0,
    status: '',
    type: '',
    viewed: 1,
    starred: 0,
    fields: JSON.stringify({
      1: { name: 'Nome di fantasia', value: 'Nome Di Fantasia' },
      2: { name: 'Posta elettronica', value: 'persona@esempio.invalid' },
    }),
    meta: '{}',
    date: '2026-01-10 10:00:00',
    date_modified: '2026-01-10 10:00:00',
    ip_address: '203.0.113.5',
    user_agent: 'AgenteFinto/1.0',
    user_uuid: 'uuid-finto-1',
  },
];

const WP_WPFORMS_ENTRY_META: readonly SqlRow[] = [];

const WP_WPMAILSMTP_DEBUG_EVENTS: readonly SqlRow[] = [
  {
    id: 1,
    content: 'Messaggio di fantasia inviato a destinatario@esempio.invalid',
    initiator: 'wp_mail',
    event_type: 'email_sent',
    created_at: '2026-01-11 09:00:00',
  },
];

const WP_AHM_DOWNLOAD_STATS: readonly SqlRow[] = [
  {
    id: 1,
    file_id: LEGACY.attachment,
    ip: '198.51.100.7',
    date: '2026-01-12 09:00:00',
    filename: 'documento-di-fantasia.pdf',
    agent: 'AgenteFinto/1.0',
  },
];

const WP_AIOSEO_POSTS: readonly SqlRow[] = [
  {
    id: 1,
    post_id: LEGACY.pagina,
    title: 'Titolo SEO della pagina di prova',
    canonical_url: '',
    robots_default: '1',
    robots_noindex: '0',
    robots_nofollow: '0',
  },
];

/** Le tabelle del sottoinsieme, nella forma che i lettori delle fasi si aspettano. */
export const SYNTHETIC_TABLES: Readonly<Record<string, readonly SqlRow[]>> = {
  wp_posts: WP_POSTS,
  wp_postmeta: WP_POSTMETA,
  wp_terms: WP_TERMS,
  wp_term_taxonomy: WP_TERM_TAXONOMY,
  wp_term_relationships: WP_TERM_RELATIONSHIPS,
  wp_options: WP_OPTIONS,
  wp_users: WP_USERS,
  wp_usermeta: WP_USERMETA,
  wp_revslider_sliders: WP_REVSLIDER_SLIDERS,
  wp_revslider_slides: WP_REVSLIDER_SLIDES,
  wp_wpforms_entries: WP_WPFORMS_ENTRIES,
  wp_wpforms_entry_meta: WP_WPFORMS_ENTRY_META,
  wp_wpmailsmtp_debug_events: WP_WPMAILSMTP_DEBUG_EVENTS,
  wp_ahm_download_stats: WP_AHM_DOWNLOAD_STATS,
  wp_aioseo_posts: WP_AIOSEO_POSTS,
};

export interface SyntheticSubset {
  readonly source: SourceReader;
  teardown(): Promise<void>;
}

/**
 * Costruisce la sorgente sintetica, con i **file veri** sotto una cartella usa
 * e getta: la fase `media` calcola checksum e dimensioni leggendo il file, e
 * senza file non la si eserciterebbe.
 */
export async function createSyntheticSubset(): Promise<SyntheticSubset> {
  const uploadsPath = await mkdtemp(path.join(tmpdir(), 'amoris-subset-uploads-'));
  const privateStoragePath = await mkdtemp(path.join(tmpdir(), 'amoris-subset-private-'));

  for (const relative of [ATTACHED_FILE, VARIANT_FILE]) {
    const absolute = path.join(uploadsPath, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    // Contenuto inventato: basta a esistere come file e ad avere un checksum.
    await writeFile(absolute, `contenuto sintetico di ${path.basename(relative)}`, 'utf8');
  }

  const source: SourceReader = {
    dumpPath: '/sintetico/dump.sql',
    uploadsPath,
    privateStoragePath,
    fingerprint: async () => ({ sha256: 'sintetico', sizeBytes: 0 }),
    dump: async () => ({
      tables: new Map(
        Object.keys(SYNTHETIC_TABLES).map((t) => [t, Object.keys(SYNTHETIC_TABLES[t]?.[0] ?? {})]),
      ),
      rows: new Map(Object.entries(SYNTHETIC_TABLES)),
      issues: [],
    }),
    tableNames: async () => Object.keys(SYNTHETIC_TABLES),
    rows: async (table: string) => SYNTHETIC_TABLES[table] ?? [],
    uploadedFiles: () => listUploadedFiles(uploadsPath),
    privateFiles: async () => [],
  };

  return {
    source,
    async teardown() {
      await rm(uploadsPath, { recursive: true, force: true });
      await rm(privateStoragePath, { recursive: true, force: true });
    },
  };
}
