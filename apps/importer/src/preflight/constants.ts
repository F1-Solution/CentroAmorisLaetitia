/**
 * Valori attesi usati dai controlli di preflight. Misurati una volta sulla
 * sorgente congelata e scritti qui — non stimati (`IMPORTER-DESIGN.md` §3.1,
 * §11.1; `docs/migration/wp-to-postgres-mapping.md` §1, §2, §4).
 */

/** Le 53 tabelle della sorgente (`wp-to-postgres-mapping.md` §1). */
export const EXPECTED_TABLES: readonly string[] = [
  'wp_actionscheduler_actions',
  'wp_actionscheduler_claims',
  'wp_actionscheduler_groups',
  'wp_actionscheduler_logs',
  'wp_ahm_asset_links',
  'wp_ahm_assets',
  'wp_ahm_download_stats',
  'wp_ahm_emails',
  'wp_ahm_sessions',
  'wp_ahm_social_conns',
  'wp_ahm_user_download_counts',
  'wp_aioseo_ai_insights_keyword_reports',
  'wp_aioseo_cache',
  'wp_aioseo_crawl_cleanup_blocked_args',
  'wp_aioseo_crawl_cleanup_logs',
  'wp_aioseo_notifications',
  'wp_aioseo_posts',
  'wp_aioseo_seo_analyzer_results',
  'wp_aioseo_writing_assistant_keywords',
  'wp_aioseo_writing_assistant_posts',
  'wp_bwpup_backups',
  'wp_commentmeta',
  'wp_comments',
  'wp_links',
  'wp_options',
  'wp_postmeta',
  'wp_posts',
  'wp_revslider_css',
  'wp_revslider_css_bkp',
  'wp_revslider_layer_animations',
  'wp_revslider_layer_animations_bkp',
  'wp_revslider_navigations',
  'wp_revslider_navigations_bkp',
  'wp_revslider_settings',
  'wp_revslider_sliders',
  'wp_revslider_sliders_bkp',
  'wp_revslider_slides',
  'wp_revslider_slides_bkp',
  'wp_revslider_static_slides',
  'wp_revslider_static_slides_bkp',
  'wp_term_relationships',
  'wp_term_taxonomy',
  'wp_termmeta',
  'wp_terms',
  'wp_usermeta',
  'wp_users',
  'wp_wpforms_entries',
  'wp_wpforms_entry_fields',
  'wp_wpforms_entry_meta',
  'wp_wpforms_logs',
  'wp_wpforms_tasks_meta',
  'wp_wpmailsmtp_debug_events',
  'wp_wpmailsmtp_tasks_meta',
];

/** Impronta del dump congelato, misurata su `Sql1138799_1.sql` (`IMPORTER-DESIGN.md` §3.1). */
export const EXPECTED_DUMP_FINGERPRINT = {
  sha256: 'a7ca194db28537f569cff2fe5a9f549071b2a374776f4e71df99e8c96bd194a8',
  sizeBytes: 11_559_721,
} as const;

/**
 * File attesi sotto `uploads/`, dopo le esclusioni di
 * `source/files/uploads.ts` — misurato in `IMPORTER-DESIGN.md` §11.1 e
 * corretto da DR-060: 1.470 nelle cartelle anno più i 5 file di
 * `download-manager-files/` (i 4 documenti pubblici e un `.htaccess` del
 * plugin, non più esclusa da questa fase 1D-W5a in poi).
 */
export const EXPECTED_UPLOADS_FILE_COUNT = 1475;

/**
 * Chiavi di `wp_postmeta` classificate come **importate**
 * (`wp-to-postgres-mapping.md` §4.1).
 */
export const CLASSIFIED_POSTMETA_IMPORTED: readonly string[] = [
  '_wp_attached_file',
  '_wp_attachment_metadata',
  '_thumbnail_id',
  'st_hide_title_check_option',
  '_et_pb_show_title',
  '_et_pb_page_layout',
  '_et_pb_gutter_width',
  '_wp_old_slug',
  '_menu_item_type',
  '_menu_item_object',
  '_menu_item_object_id',
  '_menu_item_menu_item_parent',
  '_menu_item_url',
  '_menu_item_target',
  '_menu_item_classes',
  '_nav_menu_role',
  '_nav_menu_role_display_mode',
  '_aioseo_title',
  '_aioseo_keywords',
  '_aioseo_og_article_tags',
  '__wpdm_files',
  '__wpdm_link_label',
  '__wpdm_terms_title',
  '__wpdm_terms_conditions',
  '__wpdm_terms_check_label',
  '__wpdm_terms_page',
  'cuar_private_file_file',
  'footnotes',
];

/**
 * Chiavi di `wp_postmeta` classificate come **escluse**, con motivo
 * (`wp-to-postgres-mapping.md` §4.2), elenco esatto.
 */
export const CLASSIFIED_POSTMETA_EXCLUDED: readonly string[] = [
  '_menu_item_xfn',
  '_aioseo_description',
  '_aioseo_og_title',
  '_aioseo_og_description',
  '_aioseo_og_article_section',
  '_aioseo_twitter_title',
  '_aioseo_twitter_description',
  '_wp_old_date',
  '_wp_desired_post_slug',
  '_wp_attachment_backup_sizes',
  '_edit_lock',
  '_edit_last',
  '_et_dynamic_cached_shortcodes',
  '_et_dynamic_cached_attributes',
  '_et_builder_module_features_cache',
  '_et_pb_first_image',
  '_et_pb_old_content',
  'et_enqueued_post_fonts',
  '_et_builder_version',
  '_et_builder_dynamic_assets_loading_attr_threshold',
  '_et_pb_side_nav',
  '_et_pb_post_hide_nav',
  '_et_pb_use_builder',
  '_et_pb_built_for_post_type',
  '_et_gb_content_width',
  '_et_pb_truncate_post',
  '_et_pb_truncate_post_date',
  '_et_pb_custom_css',
  '_et_pb_enable_shortcode_tracking',
  '_et_pb_show_page_creation',
  '_et_post_bg_layout',
  '_et_post_bg_color',
  '_et_pb_section_background_color',
  '_et_pb_light_text_color',
  '_et_pb_dark_text_color',
  '_et_pb_content_area_background_color',
  '_et_pb_color_palette',
  '_global_colors_info',
  '_et_pb_enable_ab_testing',
  '_wp_page_template',
  'slide_template',
  'om_disable_all_campaigns',
  '_mi_skip_tracking',
  '_dp_original',
  '_members_access_role',
  '_link_visibility',
  '_link_roles|||0|_empty',
  '_convert_to_logout',
  'cuar_related_object_type',
  'cuar_user_id',
  'cuar_ip',
  'cuar_attachment',
  '_registration',
  '_cancelled',
  '_featured',
  '__wpdm_icon',
  '__wpdm_access',
  '__wpdm_version',
  '__wpdm_quota',
  '__wpdm_masterkey',
  '__wpdm_password',
  '__wpdm_page_template',
  '__wpdm_view_count',
  '__wpdm_download_count',
  'enclosure',
  'categoryPosts-shorcode',
  '_view_count',
];

/** Prefissi esclusi (`wp-to-postgres-mapping.md` §4.2, gruppi con `*`). */
export const CLASSIFIED_POSTMETA_EXCLUDED_PREFIXES: readonly string[] = [
  '_et_pb_ab_',
  '_monsterinsights_',
  'cuar_owner_',
  '_event_',
  '__wpdm_package_size',
  '_oembed_',
];

/** `post_type` distinti classificati (`wp-to-postgres-mapping.md` §2). */
export const CLASSIFIED_POST_TYPES: readonly string[] = [
  'page',
  'post',
  'attachment',
  'nav_menu_item',
  'wpdmpro',
  'cuar_private_file',
  'wpforms',
  'revision',
  'et_pb_layout',
  'cuar_log_event',
  'event_listing',
  'custom_css',
  'wp_template',
  'wp_navigation',
  'wp_global_styles',
];

export function isClassifiedPostmetaKey(key: string): boolean {
  if (CLASSIFIED_POSTMETA_IMPORTED.includes(key) || CLASSIFIED_POSTMETA_EXCLUDED.includes(key)) {
    return true;
  }
  return CLASSIFIED_POSTMETA_EXCLUDED_PREFIXES.some((prefix) => key.startsWith(prefix));
}
