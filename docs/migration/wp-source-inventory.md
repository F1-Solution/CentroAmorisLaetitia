# Inventario tecnico della sorgente WordPress — Fase 1A, wave 1A-W1

Rilevato il 2026-09-13. **Sola lettura.** Ogni dato è ricavato dalla sorgente, mai
dai documenti storici, che su più punti risultano errati (vedi §11).

**Sorgenti autorevoli**

| Path | Contenuto |
|---|---|
| `source-private/wordpress-2026-09-13/` | Installazione completa: 21.350 file, 875 MB |
| `source-private/BackupDB-2026-09-13/Sql1138799_1.sql` | Dump BackWPup 5.7.6 del 2026-09-13 07:55, 11,6 MB |

**Strumento di verifica:** istanza di riferimento in `tools/wp-reference/`, container
PHP 8.2 + Apache 2.4.68 + MariaDB 10.11, con il dump caricato e i file montati.
Validata contro il sito online: su `/`, `/chi-siamo/` e `/contatti/` produce lo
stesso numero di moduli Divi e la stessa struttura di intestazioni.

---

## 1. Piattaforma

| Voce | Valore | Fonte |
|---|---|---|
| WordPress | **7.1** | `wp-includes/version.php` |
| Prefisso tabelle | `wp_` | `wp-config.php`, header del dump |
| Tabelle | **53** | dump |
| Charset DB dichiarato | `utf8` (`DB_CHARSET`), dump in `utf8mb4` | `wp-config.php`, header dump |
| Lingua | `it_IT` | `wp_options.WPLANG` |
| Fuso orario | `Europe/Rome` | `wp_options.timezone_string` |
| Formato data | `j F Y` | `wp_options.date_format` |
| Struttura permalink | `/%postname%/` | `wp_options.permalink_structure` |
| Base categorie / tag | default (`/category/`, `/tag/`) | `category_base`, `tag_base` vuoti |
| Homepage | **statica**, pagina ID **62** | `show_on_front=page`, `page_on_front=62` |
| Pagina archivio articoli | **nessuna** (`page_for_posts=0`) | `wp_options` |
| Articoli per pagina | 10 | `wp_options.posts_per_page` |
| Commenti | **chiusi** di default, 0 commenti in tutto il sito | `default_comment_status`, `wp_comments` |
| Indicizzazione | consentita (`blog_public=1`) | `wp_options` |
| Path di produzione | `/web/htdocs/www.centroamorislaetitia.it/home/` | manifest BackWPup |
| PHP di produzione | **non determinabile dal backup** — vedi `missing-inputs.md` | — |

### 1.1 Configurazione server replicata

Da `.user.ini`: `memory_limit=256M`, `max_execution_time=120`, `max_input_time=60`,
`max_input_vars=1000`, `post_max_size=100M`, `upload_max_filesize=100M`,
`output_buffering=4096`, `display_errors=Off`, `zlib.output_compression=Off`,
`short_open_tag=Off`. Riprodotta nell'istanza di riferimento.

`.htaccess` contiene **solo** le regole standard di WordPress: nessun redirect
personalizzato, nessuna regola di cache, nessuna riscrittura custom.

---

## 2. Tema

| Voce | Valore |
|---|---|
| Tema attivo | **Divi 4.18.0** (`template` = `stylesheet` = `Divi`) |
| Child theme | **nessuno** |
| Temi presenti ma inattivi | `twentytwentythree`, `twentytwentyfour`, `twentytwentyfive` |
| Peso | 68 MB |
| Cache CSS del tema | `wp-content/et-cache/` (12 MB), con `et-divi-customizer-global.min.css` e CSS dinamico per pagina |
| Font di interfaccia | icon font Divi (`modules.woff`, `.ttf`, `.eot`) |

Divi è un page builder a shortcode: il contenuto è salvato come `[et_pb_*]` in
`post_content` e reso da PHP più JavaScript. L'entità reale del problema è però
molto minore di quanto i documenti storici lasciassero temere — vedi §5.

---

## 3. Plugin

### 3.1 Attivi — 16

Da `wp_options.active_plugins`, non dai documenti.

| Plugin | Ruolo sul sito pubblico |
|---|---|
| `all-in-one-seo-pack` | SEO, sitemap, robots |
| `backwpup` | backup (nessun effetto pubblico) |
| `category-posts` | widget elenco articoli per categoria |
| `cookie-notice` | banner cookie (`cdn.hu-manity.co`) |
| `download-manager` | documenti scaricabili, endpoint `/download/` |
| `duplicate-post` | solo redazione |
| `google-analytics-for-wordpress` | MonsterInsights, GA4 + UA legacy |
| `members` | ruoli e capability |
| `nav-menu-roles` | voci di menu condizionate al ruolo |
| `optinmonster` | popup e lead capture |
| `revslider` | Slider Revolution: 1 slider, 12 slide |
| `shk-hide-title` | nasconde il titolo su singole pagine |
| `wp-mail-smtp` | invio email |
| `wpforms` | form: 25 pubblicati, 3 nel cestino |
| `wpforms-mailchimp` | integrazione Mailchimp |
| `wpforms-paypal-standard` | pagamenti PayPal nei form |

### 3.2 Installati ma **disattivati** — 2

Rilevato confrontando le cartelle in `wp-content/plugins/` con `active_plugins`.
I documenti storici li elencavano come attivi: **non lo sono**.

| Plugin | Contenuto rimasto a database |
|---|---|
| `customer-area` (WP Customer Area) | 4 `cuar_private_file`, 9 `cuar_log_event`, 1 menu «Menù WP Customer Area» vuoto, cartella `wp-content/customer-area/` (518 KB) |
| `wp-event-manager` | 1 `event_listing`, 20 termini `event_listing_type`, 12 termini `event_listing_category` — **tutti i termini con 0 contenuti associati** |

**Conseguenza:** l'area riservata e la gestione eventi **non sono funzionanti sul
sito attuale**. I loro contenuti sono residui. Vanno trattati come tali, non come
funzionalità da riprodurre.

---

## 4. Contenuti

### 4.1 Per tipo e stato

| Tipo | Stato | N. |
|---|---|---|
| `page` | publish | **78** |
| `post` | publish | **29** |
| `post` | draft | 1 |
| `post` | auto-draft | 1 |
| `attachment` | inherit | **170** |
| `nav_menu_item` | publish | **64** |
| `revision` | inherit | 837 |
| `wpforms` | publish / trash | 25 / 3 |
| `et_pb_layout` | publish | 4 |
| `wpdmpro` | publish | 4 |
| `cuar_log_event` | publish | 9 |
| `cuar_private_file` | publish | 4 |
| `event_listing` | publish | 1 |
| `wp_template`, `wp_navigation`, `wp_global_styles`, `custom_css` | publish | 1 ciascuno |

**Nessun contenuto `private`, `pending`, `future` o protetto da password.**
Verificato sul dump, non solo sull'export.

### 4.2 Tassonomie

| Tassonomia | Termini | Note |
|---|---|---|
| `category` | 2 | `news` (21 articoli), `senza-categoria` (8) |
| `post_tag` | **0** | nessun tag usato |
| `nav_menu` | 2 | «Menu principale» (64 voci), «Menù WP Customer Area» (0 voci) |
| `event_listing_type` | 20 | tutti a 0 contenuti — residui del plugin disattivato |
| `event_listing_category` | 12 | tutti a 0 contenuti |
| `wpdmcategory` | 1 | `moduli-consulenze` (4 file) |
| `cuar_private_file_category` | 1 | residuo |
| `monsterinsights_note_category` | 3 | interno al plugin |
| `layout_type`, `scope`, `module_width`, `wp_theme` | 1 ciascuna | interne a Divi |

### 4.3 Media

170 allegati a database, **1.546 file** in `wp-content/uploads` (la differenza sono
le dimensioni derivate generate da WordPress e le cartelle di servizio dei plugin).

| MIME | N. |
|---|---|
| `image/jpeg` | 81 |
| `application/pdf` | **44** |
| `image/png` | 43 |
| `video/mp4` | 2 |

Copertura per anno: 2017 (202 file), 2018 (274), 2019 (186), 2020 (149), 2021 (50),
2022 (229), 2023 (110), 2024 (113), 2025 (52), 2026 (105).

**Il rischio R-02 dei documenti di Fase 0 è chiuso:** i media successivi al 2021,
assenti dal backup di marzo, sono tutti presenti in questo backup.

Cartelle di servizio da **escludere** dall'import: `uploads/backwpup*` (backup
annidati del sito), `uploads/wpforms`, `uploads/aioseo`, `uploads/wpdm-cache`,
`uploads/et_temp`, `uploads/download-manager-files`.

---

## 5. Page builder e shortcode — il dato che ridimensiona il rischio

Solo **10 shortcode Divi distinti** sono effettivamente usati, e la coda è corta:

| Shortcode | Occorrenze | Natura |
|---|---|---|
| `et_pb_column` | 161 | struttura |
| `et_pb_text` | 103 | testo |
| `et_pb_row` | 102 | struttura |
| `et_pb_image` | 68 | immagine |
| `et_pb_section` | 52 | struttura |
| `et_pb_video` | 7 | video |
| `et_pb_contact_field` | 4 | campo form |
| `et_pb_map_pin` | 2 | mappa |
| `et_pb_map` | 2 | mappa |
| `et_pb_contact_form` | 1 | form |

Cinque dei dieci — sezione, riga, colonna, testo, immagine — coprono il 97% delle
occorrenze e si mappano direttamente su blocchi React elementari.

**Quanto contenuto usa davvero Divi:**

| Tipo | Con shortcode Divi | Senza |
|---|---|---|
| `page` | 29 | **49** |
| `post` | 18 | **11** |

Quindi **60 contenuti su 107 sono HTML semplice**, senza page builder.

Shortcode non-Divi presenti: `wpdm_user_dashboard`, `event_dashboard`, `doc`,
`catposts`, `hash`. I primi due appartengono ai plugin **disattivati**: oggi non
producono nulla sul sito pubblico.

**Template Divi** (`et_pb_layout`, 4): «Offerta formativa», «Giornata informativa»,
«Pagina corso semplice», «Articolo Prossimi eventi». Sono modelli di redazione, non
contenuto pubblicato.

Solo **1 pagina pubblicata** ha contenuto inferiore a 50 caratteri.

---

## 6. Navigazione

Un solo menu operativo: **«Menu principale», 64 voci**. Il secondo menu, legato a
WP Customer Area, è vuoto e appartiene a un plugin disattivato.

Il plugin `nav-menu-roles` consente voci condizionate al ruolo: da verificare in
Fase 1B se qualche voce è nascosta agli utenti anonimi.

---

## 7. SEO

Plugin: **All in One SEO**, non Yoast come riportato dai documenti storici.

| Voce | Valore |
|---|---|
| Righe in `wp_aioseo_posts` | 282 |
| Con **title** personalizzato | **2** |
| Con **description** personalizzata | **0** |
| Con **og_image** | **0** |

**Conseguenza rilevante:** non esiste quasi nessun metadato SEO scritto a mano.
Titoli e descrizioni sono generati dai **template** di AIOSEO. La migrazione non
deve copiare 282 record di metadati: deve **riprodurre le regole di generazione**.
Il dettaglio dei template va estratto in Fase 1B da `wp_options.aioseo_options`.

### 7.1 robots.txt servito

```
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /wp-content/uploads/wpforms/

Sitemap: /sitemap.xml
Sitemap: /sitemap.rss
```

### 7.2 Sitemap

`/sitemap.xml` è un **indice** che rimanda a: `page-sitemap.xml` (78 URL),
`post-sitemap.xml` (29), `category-sitemap.xml` (2), `wpdmpro-sitemap.xml`,
`wpdmcategory-sitemap.xml`, con foglio di stile `default-sitemap.xsl`.
`attachment-sitemap.xml` esiste ma è **vuoto**: gli allegati non sono indicizzati.

`/wp-sitemap.xml` (sitemap nativa di WordPress) risponde **302** verso
`/sitemap.xml`: AIOSEO la disattiva.

---

## 8. Redirect

**Nessun redirect personalizzato configurato.** Né in `.htaccess`, né in tabelle di
plugin: le tabelle del modulo Redirects di AIOSEO non esistono nel dump.

Gli unici redirect sono comportamenti nativi, misurati sull'istanza di riferimento:

| Origine | Codice | Destinazione |
|---|---|---|
| 169 pagine allegato | **301** | il file in `/wp-content/uploads/…` |
| 4 `wpdmpro` | **301** | `/download/…` |
| `/wp-sitemap.xml` | 302 | `/sitemap.xml` |
| `/wp-admin/` | 302 | `/wp-login.php` |

Questo è un **requisito di parità**: il nuovo sito deve riprodurre i 301 dalle
pagine allegato ai file, altrimenti 169 URL indicizzati cambiano comportamento.

---

## 9. Dipendenze esterne del sito pubblico

| Host | Uso | Impatto sulla ricostruzione |
|---|---|---|
| `fonts.googleapis.com` / `fonts.gstatic.com` | **Open Sans** 300/400/600/700/800 con corsivi, subset latin, latin-ext, cyrillic, greek, vietnamese, `display=swap` | Font da riprodurre; valutare self-hosting |
| `www.googletagmanager.com` | GA4 (`G-XWJE7L8WWX`) **e** Universal Analytics legacy (`UA-…`) | UA è dismesso: da non riportare |
| `maps.googleapis.com` | Mappa nella pagina Contatti, **con chiave API in chiaro nell'HTML** | Vedi §12 |
| `cdn.hu-manity.co` | Banner cookie | Da sostituire |
| `www.elegantthemes.com` | Riferimenti del tema Divi | Decade |
| `api.w.org`, `ogp.me`, `gnu.org`, `opensource.org`, `daneden.me` | Namespace e licenze nel markup | Nessun impatto |

Asset caricati: CSS e JS di Divi, Revolution Slider (`rs6.css`, `rs6.min.js`),
Download Manager, jQuery e jquery-migrate, `wp-includes/js/dist/hooks` e `i18n`.

---

## 10. Dati personali presenti nella sorgente

Conteggi rilevati, senza estrarre alcun contenuto.

| Tabella | Righe | Natura |
|---|---|---|
| `wp_users` | **1** | un solo account, ruolo `administrator` |
| `wp_usermeta` | 52 | metadati di quell'unico account |
| `wp_comments` | **0** | nessun commento |
| `wp_wpforms_entries` | **425** | **compilazioni reali** di form |
| `wp_wpforms_entry_fields` | **3.710** | valori dei campi compilati |
| `wp_wpmailsmtp_debug_events` | 187 | log di invio email, con destinatari |
| `wp_ahm_download_stats` | 1 | tracciamento download |
| `wp_ahm_assets` | 0 | — |

**Il quadro è molto più concentrato di quanto ipotizzato in Fase 0:** un solo
utente, nessun commento. Il rischio privacy è quasi interamente nelle **425
compilazioni di form** e nei 187 log di invio email.

L'utente ha deciso (DR-025, opzione C) di importare tutto senza bonifica. La
decisione è registrata; le verifiche privacy sono rimandate e richiederanno
**validazione legale** — vedi `migration-risks.md`, rischio R-04.

---

## 11. Correzioni ai documenti storici

Verificate sulla sorgente. In ogni caso fa fede la sorgente.

| # | Affermazione storica | Realtà |
|---|---|---|
| 1 | WordPress 6.9 | **7.1** |
| 2 | 18 plugin attivi | **16 attivi**, 2 installati ma **disattivati** |
| 3 | 54 tabelle | **53** |
| 4 | SEO su Yoast (`_yoast_wpseo_*`) | **All in One SEO** (`wp_aioseo_posts`) |
| 5 | Form con Contact Form 7 o Gravity Forms | **WPForms** |
| 6 | «~30 voci di menu» | **64** |
| 7 | 75 pagine, 29 articoli, 166 allegati | **78** pagine, **29+1 bozza** articoli, **170** allegati |
| 8 | «WP Customer Area» come funzionalità da preservare | plugin **disattivato**: l'area riservata non funziona |
| 9 | «WP Event Manager» fra i plugin attivi | **disattivato**, 1 solo contenuto residuo |
| 10 | Homepage Divi «senza contenuto recuperabile» | la pagina 62 rende correttamente; il contenuto esiste |
| 11 | Rischio alto da page builder | **10 shortcode distinti**, 60 contenuti su 107 senza Divi |

---

## 12. Segnalazioni di sicurezza

1. **Chiave API Google Maps esposta in chiaro** nell'HTML pubblico della pagina
   Contatti. È una chiave client-side, quindi visibile per progetto, ma va
   **limitata per referrer** e **ruotata** prima del passaggio al nuovo dominio.
   La chiave non è riportata in questo documento.
2. **Universal Analytics** è ancora caricato accanto a GA4: codice morto che invia
   richieste a un servizio dismesso. Non va riportato.
3. `wp-config.php` di produzione contiene le credenziali del database: **non è
   stato copiato** nella copia di lavoro né letto nelle parti riservate.
4. Nel backup sono presenti **backup annidati del sito** in
   `uploads/backwpup-dea540-*`: esclusi dalla copia di lavoro e da non pubblicare.

---

## 13. Riproducibilità

L'istanza di riferimento si ricostruisce con:

```
docker compose -f tools/wp-reference/docker-compose.yml --env-file tools/wp-reference/.env up -d --build
```

più il caricamento del dump. Configurazione e istruzioni in `tools/wp-reference/`.
L'istanza è **confinata**: nessun cron, nessun aggiornamento automatico, nessuna
chiamata HTTP in uscita, nessun invio di email, porte esposte solo su `127.0.0.1`.
