# Mapping WordPress → PostgreSQL — Fase 1B, wave `1B-W3`

Destinazione, campo per campo, di tutto ciò che sta nella sorgente autorevole.

**Criterio di completezza della wave:** ogni colonna della sorgente ha una
destinazione o un motivo di esclusione. Le chiavi di `wp_postmeta`, `wp_termmeta` e
`wp_usermeta` si comportano come colonne e sono trattate allo stesso modo.

Schema di destinazione: [`../architecture/schema.sql`](../architecture/schema.sql).

---

## 1. Le 53 tabelle della sorgente, una per una

**21 tabelle su 53 sono vuote.** Non è una stima: è un conteggio.

### 1.1 Tabelle importate — 15

| Tabella | Righe | Destinazione |
|---|---|---|
| `wp_posts` | 1.234 | `contents`, `media`, `menu_items`, `documents`, `forms` — secondo `post_type` |
| `wp_postmeta` | 6.420 | distribuita su più tabelle e colonne, §4 |
| `wp_terms` | 48 | `terms` (solo le tassonomie utili) |
| `wp_term_taxonomy` | 48 | `terms` |
| `wp_term_relationships` | 125 | `content_terms`, `document_terms` |
| `wp_termmeta` | 4 | §4.4 |
| `wp_users` | 1 | `users` |
| `wp_usermeta` | 52 | §4.5 — quasi tutto escluso |
| `wp_options` | 564 | `settings`, `seo_templates`, `menus` — §5 |
| `wp_aioseo_posts` | 282 | `content_seo`, `term_seo` — solo i 2 record non vuoti, §6 |
| `wp_wpforms_entries` | 425 | `form_submissions` |
| `wp_wpforms_entry_fields` | 3.710 | `form_submissions.payload` |
| `wp_wpforms_entry_meta` | 206 | `form_submissions.payload` |
| `wp_revslider_sliders` | 1 | `sliders` |
| `wp_revslider_slides` | 12 | `slider_slides` |

### 1.2 Tabelle conservate senza uso funzionale — 2

DR-026 impone di importare tutto. Il prefisso `legacy_` dichiara che sono dati
conservati e non alimentati (`database-schema.md` §4.8).

| Tabella | Righe | Destinazione | Nota |
|---|---|---|---|
| `wp_wpmailsmtp_debug_events` | 187 | `legacy_email_log` | **dati personali**: destinatari di email |
| `wp_ahm_download_stats` | 1 | `legacy_download_stats` | contiene un indirizzo IP: si conserva come digest |

### 1.3 Tabelle escluse perché **vuote** — 21

`wp_comments`, `wp_commentmeta`, `wp_links`, `wp_actionscheduler_claims`,
`wp_ahm_assets`, `wp_ahm_asset_links`, `wp_ahm_emails`, `wp_ahm_sessions`,
`wp_ahm_social_conns`, `wp_aioseo_ai_insights_keyword_reports`,
`wp_aioseo_crawl_cleanup_blocked_args`, `wp_aioseo_crawl_cleanup_logs`,
`wp_aioseo_seo_analyzer_results`, `wp_aioseo_writing_assistant_keywords`,
`wp_aioseo_writing_assistant_posts`, `wp_revslider_layer_animations`,
`wp_revslider_layer_animations_bkp`, `wp_revslider_navigations`,
`wp_revslider_navigations_bkp`, `wp_revslider_static_slides_bkp`,
`wp_wpforms_logs`.

Nessuna decisione da prendere: non contengono nulla.

### 1.4 Tabelle escluse per natura — 15

| Tabella | Righe | Motivo dell'esclusione |
|---|---|---|
| `wp_actionscheduler_actions` | 284 | coda di lavori di WordPress. Il sistema nuovo ha la propria |
| `wp_actionscheduler_groups` | 5 | idem |
| `wp_actionscheduler_logs` | 840 | idem |
| `wp_aioseo_cache` | 25 | cache. Si rigenera |
| `wp_aioseo_notifications` | 73 | avvisi dell'interfaccia del plugin |
| `wp_bwpup_backups` | 20 | storico dei backup di BackWPup. Il backup nuovo è responsabilità dell'infrastruttura (ADR-009 §4.5) |
| `wp_revslider_css` | 110 | CSS generato dalla libreria che **non si porta** (1A §2.2) |
| `wp_revslider_css_bkp` | 48 | copia di sicurezza interna al plugin |
| `wp_revslider_settings` | 1 | impostazioni della libreria che non si porta |
| `wp_revslider_sliders_bkp` | 1 | copia di sicurezza interna |
| `wp_revslider_slides_bkp` | 12 | copia di sicurezza interna |
| `wp_revslider_static_slides` | 1 | slide statica sovrapposta, non usata nella resa misurata |
| `wp_ahm_user_download_counts` | 1 | conteggio per utente di un plugin **disattivato** |
| `wp_wpforms_tasks_meta` | 652 | coda interna del plugin |
| `wp_wpmailsmtp_tasks_meta` | 3 | coda interna del plugin |

---

## 2. `wp_posts` — la tabella centrale

`post_type` decide la tabella di destinazione.

| `post_type` | Righe | Destinazione |
|---|---|---|
| `page` | 78 | `contents` con `type = 'page'` |
| `post` | 29 publish + 1 draft + 1 auto-draft | `contents` con `type = 'post'`. L'`auto-draft` **si scarta**: è un contenitore vuoto creato dall'editor |
| `attachment` | 170 | `media` |
| `nav_menu_item` | 64 | `menu_items` |
| `wpdmpro` | 4 | `documents` con `is_private = false` |
| `cuar_private_file` | 4 | `documents` con `is_private = true` — DR-033 |
| `wpforms` | 25 publish | `forms`. I 3 nel cestino **si scartano** |
| `revision` | 837 | **escluse** — cronologia di WordPress, ADR-005 §3.7 |
| `et_pb_layout` | 4 | **escluse** — modelli di redazione di Divi, non contenuto pubblicato |
| `cuar_log_event` | 9 | **escluse** — log di un plugin disattivato |
| `event_listing` | 1 | **escluso** — plugin disattivato, 1 residuo (1A §5) |
| `custom_css` | 1 | valutato in Fase 1E: se contiene regole attive, diventano CSS del tema, non un record |
| `wp_template`, `wp_navigation`, `wp_global_styles` | 1 ciascuna | **escluse** — artefatti dell'editor a blocchi di WordPress, senza effetto sul tema Divi |

### 2.1 Colonne di `wp_posts`

| Colonna | Destinazione | Nota |
|---|---|---|
| `ID` | `legacy_id` della tabella di destinazione, e `import_id_map` | chiave dell'idempotenza |
| `post_author` | `contents.author_id` via `import_id_map` | un solo autore nella sorgente |
| `post_date` | `contents.published_at` | fuso `Europe/Rome` |
| `post_date_gmt` | — | ridondante rispetto a `post_date` convertito |
| `post_content` | `contents.blocks` dopo conversione (ADR-005) | il cuore della migrazione |
| `post_title` | `contents.title`, `media.title`, `documents.title`, `forms.title` | |
| `post_excerpt` | `contents.excerpt`, `media.caption` | per gli articoli alimenta la description SEO |
| `post_status` | `contents.status` | `publish`→`published`, `draft`→`draft`, `inherit`→n/a |
| `comment_status` | — | **escluso**: 0 commenti, commenti chiusi (`1B-W0` §8.8) |
| `ping_status`, `to_ping`, `pinged` | — | **escluse**: funzione di WordPress che non si riproduce |
| `post_password` | — | **escluso**: nessun contenuto protetto da password (1A §4.1) |
| `post_name` | `slug` | concorre a `contents.path` |
| `post_modified` | `updated_at` | |
| `post_modified_gmt` | — | ridondante |
| `post_content_filtered` | — | **escluso**: cache di WordPress |
| `post_parent` | `contents.parent_id`; per gli allegati indica il contenuto di appartenenza | |
| `guid` | — | **escluso**. Non è un URL, malgrado l'apparenza; usarlo come tale è un errore classico |
| `menu_order` | `contents.position`, `menu_items.position` | |
| `post_type` | decide la destinazione | |
| `post_mime_type` | `media.mime_type` | |
| `comment_count` | — | **escluso**: sempre 0 |

---

## 3. Percorsi, redirect e dati derivati

Alcune cose non stanno in nessuna colonna della sorgente: si calcolano.

### 3.1 `contents.path`

Composto risalendo `post_parent` fino alla radice, con la struttura di permalink
`/%postname%/`. Verificato: i **107 percorsi reali** rispettano il vincolo di forma
dello schema.

### 3.2 `redirects` — 180 righe attese

| Origine | Regole | Tipo | Fonte |
|---|---|---|---|
| Pagine allegato → file | **169** | `exact` | DR-034, `url-matrix.csv` |
| `wpdmpro` → `/download/<slug>/` | **4** | `exact` | 1A §8 |
| `/wp-content/uploads/` → `/media/` | **1** | `prefix` | ADR-004 §3.4 |
| **Slug storici → contenuto attuale** | **6** | `exact` | `_wp_old_slug`, §3.3 |

### 3.3 Gli slug storici: un rilievo nuovo di questa wave

`wp_postmeta._wp_old_slug` contiene 7 righe. Sei riguardano articoli pubblicati e
**producono oggi un 301 reale**, verificato sull'istanza di riferimento:

| Vecchio percorso | Risposta misurata | Destinazione |
|---|---|---|
| `/convegno-25-novembre/` | **301** | `/convegno-26-novembre/` |
| `/corsi-e-convegni-2022-2023/` | **301** | `/corsi-2022-2023/` |
| `/472-2/` | **301** | `/inizia-il-lungo-viaggio/` |
| `/542-2/` | **301** | `/riparte-il-corso-per-consulenti-familiari/` |
| `/734-2/` | **301** | `/pronti-a-ripartire/` |
| `/882-2/` | **301** | `/prossimi-corsi/` |

**Non erano in `url-matrix.csv`:** quella matrice elenca gli URL esistenti, non
quelli storici che ancora rispondono. Sono sei indirizzi che possono essere
indicizzati o linkati da terzi, e senza questa riga si perderebbero.

La settima riga riguarda un `wpforms` e non ha URL pubblico: si scarta.

**Regola permanente:** il nuovo CMS deve creare automaticamente un redirect quando
lo slug o il genitore di un contenuto pubblicato cambia. È lo stesso comportamento,
reso esplicito invece che implicito.

### 3.4 `media_variants`

Non esiste una tabella sorgente: le dimensioni derivate stanno dentro
`_wp_attachment_metadata`, serializzato in PHP. Attese circa 1.376 righe, pari alla
differenza fra i 1.546 file e i 170 allegati, al netto delle cartelle escluse.

---

## 4. Chiavi meta — ognuna con destinazione o motivo

### 4.1 `wp_postmeta` — chiavi **importate**

| Chiave | Righe | Destinazione |
|---|---|---|
| `_wp_attached_file` | 170 | `media.storage_key`, `media.public_path` |
| `_wp_attachment_metadata` | 165 | `media.width`, `media.height`, e **`media_variants`** |
| `_thumbnail_id` | 58 | `contents.featured_media_id` |
| `st_hide_title_check_option` | 269 | `contents.show_title` — **1 sola riga attiva** (`1B-W0` §4) |
| `_et_pb_show_title` | 30 | `contents.show_title` — 2 righe a `off` |
| `_wp_old_slug` | 7 | `redirects`, §3.3 |
| `_menu_item_type` | 64 | `menu_items.kind` |
| `_menu_item_object` | 64 | concorre a `menu_items.kind` |
| `_menu_item_object_id` | 64 | `menu_items.content_id` o `term_id` |
| `_menu_item_menu_item_parent` | 64 | `menu_items.parent_id` |
| `_menu_item_url` | 64 | `menu_items.url` |
| `_menu_item_target` | 64 | `menu_items.link_target` |
| `_menu_item_classes` | 64 | `menu_items.css_classes` |
| `_menu_item_xfn` | 64 | — **esclusa**: attributo di relazione XFN, sempre vuoto nella sorgente e senza effetto visibile |
| `_nav_menu_role` | 64 | `menu_items.visibility`, `visible_to_roles` |
| `_nav_menu_role_display_mode` | 64 | `menu_items.visibility` |
| `_aioseo_title` | 50 | `content_seo.title` — **2 righe non vuote** |
| `_aioseo_keywords` | 50 | `content_seo` — 35 non vuote, valore informativo |
| `_aioseo_og_article_tags` | 50 | `content_seo` — 35 non vuote |

Le altre sei chiavi `_aioseo_*` presenti in `wp_postmeta` sono **tutte vuote su tutte
e 50 le righe** e quindi **escluse**: `_aioseo_description`, `_aioseo_og_title`,
`_aioseo_og_description`, `_aioseo_og_article_section`, `_aioseo_twitter_title`,
`_aioseo_twitter_description`. Non c'è nulla da importare, e importare colonne vuote
darebbe l'impressione che un dato esista.

| `__wpdm_files` | 4 | `documents.media_id` |
| `__wpdm_link_label` | 4 | `documents` |
| `__wpdm_terms_title`, `__wpdm_terms_conditions`, `__wpdm_terms_check_label`, `__wpdm_terms_page` | 4 ciascuna | `documents.description` se producono testo visibile |
| `cuar_private_file_file` | 4 | `documents.media_id` dei 4 file riservati (DR-033) |
| `footnotes` | 183 | valutata in Fase 1D: se produce note visibili diventa parte del blocco `rich_text`; quasi certamente vuota |

### 4.2 `wp_postmeta` — chiavi **escluse**, con motivo

| Gruppo | Chiavi | Motivo |
|---|---|---|
| Cronologia di WordPress | `_wp_old_date` (1.881), `_wp_desired_post_slug`, `_wp_attachment_backup_sizes` | cronologia interna; il `_wp_old_date` non produce alcun URL |
| Editing | `_edit_lock`, `_edit_last` | stato transitorio dell'editor |
| Cache di Divi | `_et_dynamic_cached_shortcodes`, `_et_dynamic_cached_attributes`, `_et_builder_module_features_cache`, `_et_pb_first_image`, `_et_pb_old_content`, `et_enqueued_post_fonts`, `_et_builder_version`, `_et_builder_dynamic_assets_loading_attr_threshold` | cache e stato del page builder che non si porta |
| Layout di Divi | `_et_pb_side_nav`, `_et_pb_page_layout`, `_et_pb_post_hide_nav`, `_et_pb_use_builder`, `_et_pb_built_for_post_type`, `_et_pb_gutter_width`, `_et_gb_content_width`, `_et_pb_truncate_post`, `_et_pb_truncate_post_date`, `_et_pb_custom_css`, `_et_pb_enable_shortcode_tracking`, `_et_pb_show_page_creation` | **da verificare in Fase 1E**: se una di queste cambia la resa, diventa una proprietà del blocco `section`. Finché il confronto visivo non lo dimostra, non si importano |
| Colori di Divi | `_et_post_bg_layout`, `_et_post_bg_color`, `_et_pb_section_background_color`, `_et_pb_light_text_color`, `_et_pb_dark_text_color`, `_et_pb_content_area_background_color`, `_et_pb_color_palette`, `_global_colors_info` | stesso trattamento: si verificano sul reso, non si copiano alla cieca |
| Test A/B di Divi | `_et_pb_ab_*`, `_et_pb_enable_ab_testing` | funzione non usata sul sito pubblico |
| Modelli di pagina | `_wp_page_template`, `slide_template` | i modelli sono componenti del sistema nuovo, non dati |
| OptinMonster | `om_disable_all_campaigns` (42) | plugin **non collegato ad alcun account** (`1B-W0` §5) |
| MonsterInsights | `_monsterinsights_*`, `_mi_skip_tracking` | annotazioni interne del plugin di analytics |
| Duplicate Post | `_dp_original` | traccia della duplicazione redazionale |
| Members / area riservata | `_members_access_role`, `_link_visibility`, `_link_roles\|\|\|0\|_empty`, `_convert_to_logout` | la restrizione **non è attiva sul contenuto**: `/bacheca/` risponde 200 a un anonimo (`1B-W0` §8.3) |
| WP Customer Area | `cuar_related_object_type`, `cuar_user_id`, `cuar_ip`, `cuar_attachment`, `cuar_owner_*` | plugin disattivato. `cuar_ip` contiene indirizzi IP: escluderlo è anche corretto per privacy |
| WP Event Manager | `_event_*`, `_registration`, `_cancelled`, `_featured` | plugin disattivato, 1 solo residuo |
| Download Manager, parte interna | `__wpdm_icon`, `__wpdm_access`, `__wpdm_version`, `__wpdm_quota`, `__wpdm_masterkey`, `__wpdm_password`, `__wpdm_page_template`, `__wpdm_package_size*`, `__wpdm_view_count`, `__wpdm_download_count` | stato e configurazione del plugin. `__wpdm_password` e `__wpdm_masterkey` **non si importano per principio**: sono segreti |
| oEmbed | `_oembed_*`, `_oembed_time_*`, `enclosure` | cache di incorporamento di contenuti esterni. Si rigenera |
| Category Posts | `categoryPosts-shorcode` | configurazione del widget, sostituita dal blocco `post_list` |
| Altre | `_view_count` | contatore di un plugin disattivato |

### 4.3 Nota sul gruppo «layout e colori di Divi»

È l'unico gruppo escluso **con riserva**. Sono 300 e passa righe che descrivono
aspetto e struttura, e alcune potrebbero incidere sulla resa. La regola adottata:

> Non si importano adesso. Se il confronto visivo di Fase 1E mostra una differenza
> riconducibile a una di queste chiavi, quella chiave diventa una proprietà
> dichiarata del blocco corrispondente e si importa, con nota in questo documento.

Il contrario — importarle tutte «per sicurezza» — produrrebbe un modello a blocchi
gonfio di proprietà che nessuno usa e di cui nessuno saprebbe più il perché.

### 4.4 `wp_termmeta` — 4 righe

`__wpdm_access`, `__wpdm_icon`, `__wpdm_pagestyle`, `__wpdm_style`: tutte
configurazione di Download Manager. **Tutte escluse.**

### 4.5 `wp_usermeta` — 52 righe, un solo utente

| Chiave | Destinazione |
|---|---|
| `first_name`, `last_name`, `nickname` | `users.full_name` |
| `wp_capabilities` | valutata per assegnare il ruolo: l'unico account è amministratore |
| tutte le altre 40 e oltre | **escluse**: preferenze dell'interfaccia di WordPress, pannelli chiusi, avvisi ignorati, `session_tokens`, opzioni dei plugin. Nessuna ha significato nel sistema nuovo |

`wp_users.user_pass` **non si importa in alcun caso**: è un hash prodotto da un
algoritmo diverso e non riutilizzabile. La persona imposta una nuova password al
primo accesso (`users.must_change_password = true`).

| Colonna di `wp_users` | Destinazione |
|---|---|
| `ID` | `users.legacy_id` |
| `user_email` | `users.email` |
| `display_name` | `users.full_name` |
| `user_registered` | `users.created_at` |
| `user_login`, `user_nicename`, `user_url`, `user_status`, `user_activation_key` | **escluse** |
| `user_pass` | **esclusa per principio** |

---

## 5. `wp_options` — 564 righe, poche utili

Le opzioni non si importano in blocco: si importano **per chiave nota**.

| Chiave sorgente | Destinazione |
|---|---|
| `blogname` | `settings['site.title']` |
| `blogdescription` | `settings['site.description']` — **vuota nella sorgente** |
| `timezone_string` | `settings['site.timezone']` |
| `WPLANG` | `settings['site.locale']` |
| `date_format`, `time_format`, `start_of_week` | `settings['site.*']` |
| `posts_per_page` | `settings['content.posts_per_page']` |
| `sticky_posts` | `contents.is_sticky` |
| `page_on_front` | `settings['site.home_content_id']` |
| `page_for_posts` | — vale 0: **niente da importare**, e non va inventata una pagina blog |
| `permalink_structure` | informativa: la forma dei percorsi è già nello schema |
| `category_base`, `tag_base` | vuote: si usano i valori predefiniti `/category/`, `/tag/` |
| `aioseo_options`, `aioseo_options_dynamic` | `seo_templates`, §6 |
| `nav_menu_options` | `menus` |
| `et_divi` | **esclusa**: impostazioni del tema che non si porta. Il solo valore utile è il logo, che diventa un media |
| `active_plugins`, `cron`, `rewrite_rules`, transient e cache | **escluse** |
| le restanti circa 540 | **escluse**: configurazione di WordPress e dei plugin, senza significato nel sistema nuovo |

**Non si importa alcuna opzione contenente credenziali o token.** È una regola, non
una valutazione caso per caso.

---

## 6. SEO: si migrano le regole, non i record

È il punto in cui questa migrazione si distingue da una copia. Motivato da R-10 e
misurato in `1B-W0` §1 e §2.

### 6.1 Perché

`wp_aioseo_posts` ha 282 righe e circa 60 colonne. Di queste 282:

- **2** hanno un `title` personalizzato;
- **0** hanno una `description`;
- **0** hanno un `og_image`.

Copiare i record darebbe un sito **senza description**. Le description oggi
esistono perché generate dai template, e sono state misurate: 64 URL su 117 ne
hanno una.

### 6.2 Come

| Sorgente | Destinazione |
|---|---|
| `wp_options.aioseo_options` e `aioseo_options_dynamic` | **`seo_templates`**, una riga per ambito |
| `wp_aioseo_posts.title` | `content_seo.title` — **solo le 2 righe non vuote** |
| `wp_aioseo_posts.description`, `og_*`, `twitter_*` | — tutte vuote: **nulla da importare** |
| `wp_aioseo_posts.robots_*` | `content_seo.robots_noindex`, `robots_nofollow` — solo dove differiscono dal predefinito |
| `wp_aioseo_posts.canonical_url` | `content_seo.canonical_url` dove non vuoto |
| `wp_aioseo_posts.seo_score`, `page_analysis`, `truseo`, `ai`, `keyphrases`, `images`, `videos`, `image_scan_date`, `video_scan_date`, `limit_modified_date`, `pillar_content`, `local_seo`, `breadcrumb_settings`, `schema*`, `priority`, `frequency` | **escluse**: sono analisi e stato interno del plugin, non contenuto |

### 6.3 Template da riprodurre

Trascritti in `1B-W0` §2.1. `#separator_sa` diventa il separatore configurabile,
oggi ` - `.

| Ambito | `title_template` | `description_template` |
|---|---|---|
| `home` | `{title} - {site_title}` | dal contenuto della pagina |
| `page` | `{title} - {site_title}` | dal contenuto della pagina |
| `post` | `{title} - {site_title}` | dal riassunto dell'articolo |
| `category` | `{term_title} - {site_title}` | dalla descrizione della categoria |
| `attachment` | `{title} - {site_title}` | dalla didascalia |
| `search` | `{query} - {site_title}` | — |
| paginazione | suffisso, oggi `- Page {n}` | — |

Il suffisso di paginazione è **in inglese** su un sito italiano. Correggerlo è una
difformità dichiarata: rientra in **D13** (R-18).

### 6.4 Verifica del SEO — sul reso, non sul database

La Fase 1E confronta `seo-rendered-baseline.csv` con l'output del nuovo sito, URL per
URL. Il confronto sui record sarebbe privo di significato, perché i record sono
quasi tutti vuoti da entrambe le parti.

---

## 7. Form

| Sorgente | Destinazione |
|---|---|
| `wp_posts` con `post_type='wpforms'`, colonna `post_content` (JSON) | `forms.definition`, `forms.confirmation_message`, `form_notifications` |
| `wp_wpforms_entries.fields` | `form_submissions.payload` |
| `wp_wpforms_entries.date` | `form_submissions.submitted_at` |
| `wp_wpforms_entries.ip_address` | `form_submissions.ip_hash` — **digest con sale, mai in chiaro** |
| `wp_wpforms_entries.user_agent` | `form_submissions.user_agent` |
| `wp_wpforms_entries.entry_id` | `form_submissions.legacy_id` |
| `wp_wpforms_entry_fields` | ridondante rispetto a `fields`: si usa per **verificare** il conteggio dei valori, non come sorgente |
| `wp_wpforms_entry_meta` | `form_submissions.payload` sotto una chiave dedicata |
| `wp_wpforms_entries.status`, `type`, `viewed`, `starred`, `post_id`, `user_id`, `user_uuid` | **escluse**: stato dell'interfaccia del plugin |

Il campo `payment-single` della definizione si importa **come definizione**, ma non
produce alcun comportamento finché **D14** non è decisa (ADR-010 §6, R-19).

---

## 8. Carosello

| Sorgente | Destinazione |
|---|---|
| `wp_revslider_sliders.title`, `alias` | `sliders.title`, `sliders.key` |
| `wp_revslider_sliders.params`, `settings` | `sliders.settings`, filtrati: si tiene ciò che descrive il comportamento (tempi, transizione, altezza), si scarta ciò che descrive la libreria |
| `wp_revslider_slides.slide_order` | `slider_slides.position` |
| `wp_revslider_slides.params` | `slider_slides.media_id`, `link_url`, `settings` |
| `wp_revslider_slides.layers` | `slider_slides.heading`, `body`, `link_label` |
| tabelle `_bkp`, `_css`, `_navigations`, `_layer_animations`, `_static_slides` | **escluse**, §1.4 |

---

## 9. Cosa succede ai dati personali

| Sorgente | Righe | Destinazione | Trattamento |
|---|---|---|---|
| `wp_wpforms_entries` e campi | 425 | `form_submissions` | importati per DR-026. **Rischio R-04, validazione legale MI-06 prima della produzione** |
| `wp_wpmailsmtp_debug_events` | 187 | `legacy_email_log` | conservati, nessuna funzione li usa |
| `wp_users` | 1 | `users` | senza password |
| `wp_ahm_download_stats.ip` | 1 | digest | mai in chiaro |
| `wp_postmeta.cuar_ip` | 9 | **escluso** | plugin disattivato, e sono indirizzi IP |

Nessuna riga di queste tabelle compare in documentazione, log, screenshot, fixture o
Git (DR-010).

---

## 10. Come si dimostra che il mapping è completo

Controlli eseguibili in Fase 1D, non affermazioni:

1. **Copertura delle tabelle:** l'elenco delle 53 tabelle della sorgente coincide
   con l'unione di §1.1, §1.2, §1.3 e §1.4. Nessun residuo.
2. **Copertura delle chiavi meta:** una query estrae le chiavi distinte di
   `wp_postmeta` e le confronta con l'unione di §4.1 e §4.2. Una chiave non
   classificata fa **fallire** l'import.
3. **Volumi:** i conteggi attesi di `database-schema.md` §6 coincidono.
4. **Media:** il numero di oggetti nello storage coincide con i file della sorgente
   meno le cartelle escluse; ogni file ha il checksum verificato.
5. **Redirect:** 180 righe, di cui 6 verificate una per una contro l'istanza di
   riferimento.
6. **SEO:** `seo-rendered-baseline.csv` confrontato con l'output del nuovo sito su
   tutti e 117 gli URL.

## 11. Punti che restano aperti

| # | Questione | Dove si chiude |
|---|---|---|
| 1 | Le chiavi di layout e colore di Divi incidono sulla resa? | Fase 1E, con i confronti alla mano (§4.3) |
| 2 | `custom_css` contiene regole attive? | Fase 1E |
| 3 | `footnotes` produce note visibili? | Fase 1D |
| 4 | Il campo di pagamento dei form | decisione **D14** |
| 5 | Suffisso di paginazione in inglese e altri difetti dei metadati | decisione **D13** |
