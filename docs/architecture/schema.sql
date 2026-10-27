-- =====================================================================
-- Centro per la Famiglia Amoris Laetitia
-- Schema PostgreSQL — Fase 1B, wave 1B-W2
--
-- Stato: PROPOSTA. Nessuna migrazione viene eseguita prima
--        dell'approvazione delle ADR (vincolo di D5 / DR-035).
--
-- Convenzione dei nomi: inglese, snake_case (DR-036, supera DR-H05 e RN-07).
-- Commenti in italiano (DR-H04, RN-06).
--
-- Questo file e' la forma canonica e leggibile dello schema. La
-- definizione eseguibile vive in packages/db come schema Drizzle
-- (ADR-002) e deve corrispondere a questo file.
--
-- Perimetro: sito pubblico e CMS minimo della Fase 1 (DR-033).
-- Nessuna tabella della fase gestionale, che il gate vieta di costruire.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- email senza distinzione fra maiuscole e minuscole
CREATE EXTENSION IF NOT EXISTS "unaccent";   -- ricerca senza accenti in italiano

-- ---------------------------------------------------------------------
-- Tipi enumerati
-- ---------------------------------------------------------------------

CREATE TYPE content_type   AS ENUM ('page', 'post');
CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE menu_item_kind AS ENUM ('content', 'term', 'custom');
CREATE TYPE menu_visibility AS ENUM ('public', 'authenticated', 'roles', 'hidden');
CREATE TYPE redirect_kind  AS ENUM ('exact', 'prefix');
CREATE TYPE redirect_origin AS ENUM ('migration', 'manual', 'automatic');
CREATE TYPE submission_origin AS ENUM ('migration', 'live');
CREATE TYPE audit_outcome  AS ENUM ('success', 'failure');
-- Aree dell'area amministrativa (design-system.md §7.2). In Fase 1 sono due: le
-- altre quattro del §7.1 non si dichiarano, perche' il gate vieta di pianificare
-- le fasi gestionali e un valore enumerato e' una pianificazione.
CREATE TYPE admin_area     AS ENUM ('redazione', 'impostazioni');
-- Layout della pagina, ex `_et_pb_page_layout` di Divi (DR-139).
CREATE TYPE page_layout    AS ENUM ('right_sidebar', 'full_width', 'no_sidebar');


-- =====================================================================
-- 1. PERSONE, RUOLI, SESSIONI, AUDIT
--    Requisiti: RU-01, RU-02, RU-05, RN-03. ADR-007.
-- =====================================================================

-- Persone che accedono all'area amministrativa.
-- In Fase 1 sono uno o due redattori. Gli utenti delle consulenze
-- (RU-04) NON stanno qui e non esistono in Fase 1.
CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           citext NOT NULL,
    password_hash   text,                      -- NULL finche' la persona non imposta la password
    full_name       text NOT NULL,
    is_active       boolean NOT NULL DEFAULT true,
    must_change_password boolean NOT NULL DEFAULT false,
    last_login_at   timestamptz,
    legacy_id       bigint,                    -- wp_users.ID, per idempotenza dell'import
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_legacy_id_unique UNIQUE (legacy_id)
);

-- Ruoli. Dalla wave 1G-W1 (DR-220, DR-229) sono 'editor', etichetta
-- «Redazione», e 'amministrazione'; la struttura e' quella definitiva:
-- RU-02 chiede piu' ruoli sulla stessa persona e aggiungere la relazione
-- dopo costerebbe una migrazione su dati reali.
CREATE TABLE roles (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key         text NOT NULL,                 -- 'editor', 'amministrazione', ...
    label       text NOT NULL,
    description text,
    is_system   boolean NOT NULL DEFAULT false,-- i ruoli di sistema non si cancellano
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT roles_key_unique UNIQUE (key)
);

-- Relazione molti-a-molti: RU-02.
CREATE TABLE user_roles (
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at  timestamptz NOT NULL DEFAULT now(),
    granted_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

-- Le autorizzazioni si esprimono come permessi, mai come confronti sul
-- nome del ruolo (ADR-007 §3.2). Otto permessi (DR-227): content.read,
-- content.write, content.publish, media.write, settings.write della
-- redazione; users.manage, audit.read, site.settings.write dell'amministrazione.
CREATE TABLE permissions (
    key         text PRIMARY KEY,              -- 'content.publish', 'media.write', ...
    label       text NOT NULL,
    description text
);

CREATE TABLE role_permissions (
    role_id        uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key text NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_key)
);

-- Sessioni opache (ADR-007). Si conserva il digest del token, mai il token.
CREATE TABLE sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_digest    bytea NOT NULL,
    issued_at       timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz NOT NULL,      -- scadenza assoluta
    revoked_at      timestamptz,
    user_agent      text,
    ip_hash         bytea,                     -- digest con sale, mai l'indirizzo in chiaro
    -- Ruolo attivo della sessione (DR-050, attuata da DR-067): i permessi in
    -- vigore sono quelli di questo ruolo, non l'unione dei ruoli posseduti.
    -- Nullo fra l'accesso e la scelta dell'area.
    active_role_id  uuid REFERENCES roles(id) ON DELETE SET NULL,
    -- Area in cui si sta lavorando (ux-proposals.md §4.4 punto 2): il servizio
    -- rifiuta i dati di un'altra area anche quando il permesso ci sarebbe.
    active_area     admin_area,
    CONSTRAINT sessions_token_digest_unique UNIQUE (token_digest)
);

CREATE INDEX sessions_user_active_idx
    ON sessions (user_id)
    WHERE revoked_at IS NULL;

-- Audit log: RU-05 e RN-03 lo rendono obbligatorio dal primo giorno.
-- Append-only: nessun UPDATE, nessun DELETE.
CREATE TABLE audit_log (
    id            bigserial PRIMARY KEY,
    occurred_at   timestamptz NOT NULL DEFAULT now(),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    actor_label   text,                        -- conservato anche se la persona viene rimossa
    action        text NOT NULL,               -- 'content.publish', 'auth.login', ...
    entity_type   text,                        -- 'content', 'media', 'menu', ...
    entity_id     text,
    outcome       audit_outcome NOT NULL DEFAULT 'success',
    detail        jsonb NOT NULL DEFAULT '{}'::jsonb, -- MAI dati personali di terzi
    ip_hash       bytea,
    session_id    uuid REFERENCES sessions(id) ON DELETE SET NULL,
    actor_role_id    uuid REFERENCES roles(id) ON DELETE SET NULL, -- in quale veste (DR-067)
    actor_role_label text,                      -- conservata come actor_label
    actor_area       admin_area                 -- in quale area (ux-proposals.md §4.3)
);

CREATE INDEX audit_log_occurred_at_idx ON audit_log (occurred_at DESC);
CREATE INDEX audit_log_entity_idx      ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_actor_idx       ON audit_log (actor_user_id, occurred_at DESC);


-- =====================================================================
-- 2. MEDIA
--    Requisiti: RC-03. ADR-004.
-- =====================================================================

-- 170 allegati a database, 1.546 file su disco: la differenza sono le
-- dimensioni derivate, che stanno in media_variants.
CREATE TABLE media (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key   text NOT NULL,               -- chiave nel bucket, es. '2017/09/logo_header_2.png'
    public_path   text NOT NULL,               -- percorso servito, es. '/media/2017/09/logo_header_2.png'
    file_name     text NOT NULL,
    mime_type     text NOT NULL,
    byte_size     bigint NOT NULL,
    width         integer,                     -- solo immagini
    height        integer,
    checksum      bytea NOT NULL,              -- SHA-256: verifica di completezza dell'import
    title         text,
    alt_text      text,
    caption       text,
    description   text,
    is_private    boolean NOT NULL DEFAULT false, -- bucket riservato (ADR-004 §3.6, DR-033)
    uploaded_at   timestamptz NOT NULL,
    uploaded_by   uuid REFERENCES users(id) ON DELETE SET NULL,
    legacy_id     bigint,                      -- wp_posts.ID dell'allegato
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT media_public_path_unique UNIQUE (public_path),
    CONSTRAINT media_storage_key_unique UNIQUE (storage_key),
    CONSTRAINT media_legacy_id_unique   UNIQUE (legacy_id)
);

CREATE INDEX media_mime_idx    ON media (mime_type);
CREATE INDEX media_private_idx ON media (is_private) WHERE is_private;

-- Dimensioni derivate: quelle importate da WordPress e, dal 2026-10-23, quelle
-- generate al caricamento e alla sostituzione (ADR-004 §3.2): il contenuto le
-- referenzia negli attributi srcset.
CREATE TABLE media_variants (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id    uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    storage_key text NOT NULL,
    public_path text NOT NULL,
    width       integer NOT NULL,
    height      integer NOT NULL,
    byte_size   bigint NOT NULL,
    checksum    bytea NOT NULL,
    CONSTRAINT media_variants_public_path_unique UNIQUE (public_path)
);

CREATE INDEX media_variants_media_idx ON media_variants (media_id);


-- =====================================================================
-- 3. CONTENUTI
--    Requisiti: RC-01, RC-03. ADR-005.
-- =====================================================================

CREATE TABLE contents (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type          content_type NOT NULL,
    status        content_status NOT NULL DEFAULT 'draft',
    slug          text NOT NULL,
    path          text NOT NULL,               -- percorso completo, es. '/chi-siamo/'
    parent_id     uuid REFERENCES contents(id) ON DELETE RESTRICT,
    position      integer NOT NULL DEFAULT 0,  -- ex menu_order
    title         text NOT NULL,
    show_title    boolean NOT NULL DEFAULT true, -- 1B-W0 §4: sostituisce shk-hide-title e Divi
    is_sticky     boolean NOT NULL DEFAULT false, -- 1B-W0 §8.1
    page_layout   page_layout NOT NULL DEFAULT 'right_sidebar', -- DR-139
    gutter_width  smallint,                    -- ex _et_pb_gutter_width; vuota = tema (DR-149)
    excerpt       text,
    blocks        jsonb NOT NULL DEFAULT '{"schema":1,"blocks":[]}'::jsonb, -- ADR-005 §3.1
    content_html  text NOT NULL DEFAULT '',    -- cache di resa, rigenerata (ADR-005 §3.6)
    content_text  text NOT NULL DEFAULT '',    -- solo testo, per ricerca e description
    summary_source text,                       -- forma contata da Divi per l'estratto; vuota per il CMS (D71)
    description_source text,                   -- description calcolata all'import come All in One SEO (DR-180)
    featured_media_id uuid REFERENCES media(id) ON DELETE SET NULL,
    published_at  timestamptz,
    author_id     uuid REFERENCES users(id) ON DELETE SET NULL,
    legacy_id     bigint,
    legacy_type   text,                        -- 'page', 'post'
    legacy_format text,                        -- 'gutenberg', 'divi', 'html' — 1B-W0 §1
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    modified_at   timestamptz,                 -- post_modified_gmt all'import, poi modifica dal CMS (DR-186)
    CONSTRAINT contents_path_unique      UNIQUE (path),
    CONSTRAINT contents_legacy_id_unique UNIQUE (legacy_id),
    CONSTRAINT contents_slug_parent_unique UNIQUE (parent_id, slug),
    -- Un contenuto pubblicato ha sempre una data di pubblicazione.
    CONSTRAINT contents_published_has_date
        CHECK (status <> 'published' OR published_at IS NOT NULL),
    -- Gli articoli non hanno gerarchia: nella sorgente nessuno ce l'ha.
    CONSTRAINT contents_posts_have_no_parent
        CHECK (type <> 'post' OR parent_id IS NULL),
    CONSTRAINT contents_gutter_width_range
        CHECK (gutter_width BETWEEN 1 AND 4)
);

CREATE INDEX contents_type_status_idx ON contents (type, status, published_at DESC);
CREATE INDEX contents_parent_idx      ON contents (parent_id, position);
CREATE INDEX contents_blocks_gin      ON contents USING gin (blocks jsonb_path_ops);

-- Ricerca full-text in italiano. Colonna generata: non puo' divergere.
ALTER TABLE contents
    ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('italian', coalesce(title, '')),   'A') ||
        setweight(to_tsvector('italian', coalesce(excerpt, '')), 'B') ||
        setweight(to_tsvector('italian', coalesce(content_text, '')), 'C')
    ) STORED;

CREATE INDEX contents_search_idx ON contents USING gin (search_vector);

-- Cronologia. Le 837 revisioni di WordPress NON si importano
-- (ADR-005 §3.7): la cronologia nuova parte vuota.
CREATE TABLE content_revisions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id  uuid NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    revision_no integer NOT NULL,
    title       text NOT NULL,
    blocks      jsonb NOT NULL,
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT content_revisions_unique UNIQUE (content_id, revision_no)
);

CREATE INDEX content_revisions_content_idx
    ON content_revisions (content_id, revision_no DESC);


-- Copie di lavoro (DR-068). L'editor vi salva da solo; il contenuto pubblicato
-- cambia solo su comando esplicito, ed e' per questo che il criterio 1D-36 si
-- verifica su contents e non qui. Una copia per persona e per contenuto:
-- ADR-006 §3.2 rimanda la modifica collaborativa.
CREATE TABLE content_drafts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id      uuid NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           text NOT NULL,
    excerpt         text,
    blocks          jsonb NOT NULL,
    -- contents.updated_at quando la copia e' stata aperta: se il contenuto e'
    -- cambiato sotto, pubblicare la copia sovrascriverebbe il lavoro di un altro.
    base_updated_at timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT content_drafts_content_author_unique UNIQUE (content_id, author_id),
    CONSTRAINT content_drafts_blocks_have_schema CHECK (blocks ? 'schema' AND blocks ? 'blocks')
);

CREATE INDEX content_drafts_author_idx
    ON content_drafts (author_id, updated_at DESC);


-- =====================================================================
-- 4. TASSONOMIE
--    Requisiti: RC-01, RC-03.
--    Nella sorgente: 2 categorie, 0 tag. La struttura resta generica
--    perche' costa niente e i tag possono servire domani.
-- =====================================================================

CREATE TABLE terms (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    taxonomy    text NOT NULL,                 -- 'category', 'tag'
    slug        text NOT NULL,
    name        text NOT NULL,
    description text,
    parent_id   uuid REFERENCES terms(id) ON DELETE RESTRICT,
    position    integer NOT NULL DEFAULT 0,
    path        text NOT NULL,                 -- es. '/category/news/'
    legacy_id   bigint,                        -- wp_terms.term_id
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT terms_taxonomy_slug_unique UNIQUE (taxonomy, slug),
    CONSTRAINT terms_path_unique          UNIQUE (path),
    CONSTRAINT terms_legacy_unique        UNIQUE (taxonomy, legacy_id)
);

CREATE TABLE content_terms (
    content_id uuid NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    term_id    uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    position   integer NOT NULL DEFAULT 0,
    PRIMARY KEY (content_id, term_id)
);

CREATE INDEX content_terms_term_idx ON content_terms (term_id);


-- =====================================================================
-- 5. MENU
--    Requisiti: RC-01 («il menu del frontend sara' uguale»), RC-03.
--    1B-W0 §3: 64 voci a database, 41 rese a un anonimo.
-- =====================================================================

CREATE TABLE menus (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key        text NOT NULL,                  -- 'main'
    label      text NOT NULL,
    legacy_id  bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT menus_key_unique UNIQUE (key)
);

CREATE TABLE menu_items (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id      uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    parent_id    uuid REFERENCES menu_items(id) ON DELETE CASCADE,
    position     integer NOT NULL DEFAULT 0,
    kind         menu_item_kind NOT NULL,
    label        text NOT NULL,
    content_id   uuid REFERENCES contents(id) ON DELETE SET NULL,
    term_id      uuid REFERENCES terms(id) ON DELETE SET NULL,
    url          text,                         -- solo per kind = 'custom'
    link_target  text,                         -- '_blank' o NULL
    css_classes  text,
    -- Visibilita': sostituisce nav-menu-roles. 'hidden' copre le 20 voci
    -- oggi nascoste a tutti; 'authenticated' la voce «Area riservata»;
    -- 'roles' le due voci limitate a ruoli specifici.
    visibility        menu_visibility NOT NULL DEFAULT 'public',
    visible_to_roles  text[] NOT NULL DEFAULT '{}',
    legacy_id    bigint,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT menu_items_legacy_unique UNIQUE (legacy_id),
    -- Una voce punta a una cosa sola, coerente con il suo tipo.
    CONSTRAINT menu_items_target_matches_kind CHECK (
        (kind = 'content' AND content_id IS NOT NULL AND term_id IS NULL AND url IS NULL) OR
        (kind = 'term'    AND term_id    IS NOT NULL AND content_id IS NULL AND url IS NULL) OR
        (kind = 'custom'  AND url        IS NOT NULL AND content_id IS NULL AND term_id IS NULL)
    ),
    -- I ruoli si elencano solo quando la visibilita' li usa.
    CONSTRAINT menu_items_roles_only_when_needed CHECK (
        visibility = 'roles' OR cardinality(visible_to_roles) = 0
    )
);

CREATE INDEX menu_items_menu_idx   ON menu_items (menu_id, parent_id, position);
CREATE INDEX menu_items_public_idx ON menu_items (menu_id, position)
    WHERE visibility = 'public';


-- =====================================================================
-- 6. SEO
--    Requisiti: RC-04, RC-05, RC-06. 1B-W0 §2.
--    Si migrano le REGOLE, non i 282 record (R-10).
-- =====================================================================

-- Template globali, uno per ambito. Sostituiscono aioseo_options.
CREATE TABLE seo_templates (
    scope            text PRIMARY KEY,         -- 'page', 'post', 'category', 'home', 'attachment', 'search', 'archive'
    title_template   text NOT NULL,            -- es. '{title} - {site_title}'
    description_template text,
    robots_directives text[] NOT NULL DEFAULT '{}',
    og_type          text,
    schema_type      text,
    updated_at       timestamptz NOT NULL DEFAULT now(),
    updated_by       uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Sovrascrittura per singolo contenuto: requisito RC-04.
-- Nella sorgente solo 2 contenuti su 282 hanno un title proprio: qui la
-- tabella nasce quasi vuota ed e' corretto che sia cosi'.
CREATE TABLE content_seo (
    content_id      uuid PRIMARY KEY REFERENCES contents(id) ON DELETE CASCADE,
    title           text,
    description     text,
    canonical_url   text,
    og_title        text,
    og_description  text,
    og_image_id     uuid REFERENCES media(id) ON DELETE SET NULL,
    robots_noindex  boolean NOT NULL DEFAULT false,
    robots_nofollow boolean NOT NULL DEFAULT false,
    schema_type     text,
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Come sopra, per le tassonomie.
CREATE TABLE term_seo (
    term_id         uuid PRIMARY KEY REFERENCES terms(id) ON DELETE CASCADE,
    title           text,
    description     text,
    robots_noindex  boolean NOT NULL DEFAULT false,
    robots_nofollow boolean NOT NULL DEFAULT false,
    updated_at      timestamptz NOT NULL DEFAULT now()
);


-- =====================================================================
-- 7. REDIRECT
--    Requisiti: RC-07. DR-034, R-09. ADR-003 §3: sono DATI, non
--    configurazione del reverse proxy.
-- =====================================================================

CREATE TABLE redirects (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_path   text NOT NULL,
    target_path   text NOT NULL,
    status_code   smallint NOT NULL DEFAULT 301,
    kind          redirect_kind NOT NULL DEFAULT 'exact',
    origin        redirect_origin NOT NULL DEFAULT 'manual',
    is_active     boolean NOT NULL DEFAULT true,
    note          text,
    hit_count     bigint NOT NULL DEFAULT 0,
    last_hit_at   timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT redirects_source_unique UNIQUE (source_path),
    CONSTRAINT redirects_status_valid  CHECK (status_code IN (301, 302, 307, 308)),
    CONSTRAINT redirects_no_self_loop  CHECK (source_path <> target_path)
);

CREATE INDEX redirects_active_idx ON redirects (source_path) WHERE is_active;

-- Contenuto atteso dopo l'import (Fase 1D):
--   169 righe 'exact'  — pagine allegato  -> file          (DR-034)
--     4 righe 'exact'  — wpdmpro          -> /download/... (1A §8)
--     6 righe 'exact'  — slug storici     -> contenuto     (1B-W3 §3.3)
--     1 riga  'prefix' — /wp-content/uploads/ -> /media/    (ADR-004 §3.4)
--   ---------------------------------------------------------------
--   180 righe in totale


-- =====================================================================
-- 8. FORM
--    Requisiti: parita' delle 23 pagine che li contengono. ADR-010.
--    ATTENZIONE: la decisione D14 sui pagamenti e' aperta (R-19).
-- =====================================================================

CREATE TABLE forms (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug           text NOT NULL,
    title          text NOT NULL,
    definition     jsonb NOT NULL,             -- campi, etichette, obbligatorieta', ordine
    confirmation_message text,
    is_active      boolean NOT NULL DEFAULT true,
    -- Vero se la definizione contiene un campo di pagamento. Serve a
    -- impedire la pubblicazione di un form che appare funzionante senza
    -- esserlo, finche' D14 non e' decisa (ADR-010 §6).
    requires_payment boolean NOT NULL DEFAULT false,
    legacy_id      bigint,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT forms_slug_unique      UNIQUE (slug),
    CONSTRAINT forms_legacy_id_unique UNIQUE (legacy_id)
);

CREATE TABLE form_notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id     uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    name        text NOT NULL,
    recipients  text NOT NULL,                 -- destinatari, anche con segnaposto
    subject     text NOT NULL,
    sender_name text,
    reply_to    text,
    body        text NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    position    integer NOT NULL DEFAULT 0
);

CREATE INDEX form_notifications_form_idx ON form_notifications (form_id, position);

-- DATI PERSONALI. 425 righe importate per DR-026. Rischio R-04,
-- verifica legale MI-06 obbligatoria prima della produzione.
-- Nessuna riga di questa tabella compare in documentazione, log,
-- screenshot, fixture o Git (DR-010).
CREATE TABLE form_submissions (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id        uuid NOT NULL REFERENCES forms(id) ON DELETE RESTRICT,
    submitted_at   timestamptz NOT NULL,
    origin         submission_origin NOT NULL,
    payload        jsonb NOT NULL,             -- valori dei campi
    ip_hash        bytea,                      -- mai l'indirizzo in chiaro
    user_agent     text,
    notified_at    timestamptz,
    notification_error text,
    legacy_id      bigint,
    created_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT form_submissions_legacy_unique UNIQUE (legacy_id)
);

CREATE INDEX form_submissions_form_idx ON form_submissions (form_id, submitted_at DESC);


-- =====================================================================
-- 9. DOCUMENTI SCARICABILI E CAROSELLO
--    Requisiti: parita' (1A §2.2, §2.3). DR-033 per i file riservati.
-- =====================================================================

-- I 4 moduli di consulenza, oggi serviti da Download Manager
-- all'indirizzo /download/<slug>/, con 301 dalla pagina del documento.
CREATE TABLE documents (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug          text NOT NULL,
    title         text NOT NULL,
    description   text,
    media_id      uuid NOT NULL REFERENCES media(id) ON DELETE RESTRICT,
    -- Falso per i 4 moduli pubblici; vero per i 4 file di
    -- cuar_private_file, che DR-033 vuole conservati per la futura area
    -- riservata e NON raggiungibili adesso.
    is_private    boolean NOT NULL DEFAULT false,
    download_count bigint NOT NULL DEFAULT 0,
    published_at  timestamptz,                 -- data del download, per la ricerca (DR-144)
    modified_at   timestamptz,                 -- ultima modifica dall'area, nulla per gli importati (D156)
    legacy_id     bigint,
    legacy_source text,                        -- 'wpdmpro' | 'cuar_private_file'
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT documents_slug_unique   UNIQUE (slug),
    CONSTRAINT documents_legacy_unique UNIQUE (legacy_source, legacy_id)
);

CREATE TABLE document_terms (
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    term_id     uuid NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, term_id)
);

-- Un solo carosello, 12 slide (1B-W0 §6). La libreria Slider Revolution
-- non si porta: si ricostruisce un componente.
CREATE TABLE sliders (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    key        text NOT NULL,                  -- 'home'
    title      text NOT NULL,
    settings   jsonb NOT NULL DEFAULT '{}'::jsonb,
    legacy_id  bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sliders_key_unique UNIQUE (key)
);

CREATE TABLE slider_slides (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slider_id  uuid NOT NULL REFERENCES sliders(id) ON DELETE CASCADE,
    position   integer NOT NULL,
    media_id   uuid REFERENCES media(id) ON DELETE SET NULL,
    heading    text,
    body       text,
    link_url   text,
    link_label text,
    settings   jsonb NOT NULL DEFAULT '{}'::jsonb,
    legacy_id  bigint,
    CONSTRAINT slider_slides_position_unique UNIQUE (slider_id, position)
);


-- =====================================================================
-- 10. IMPOSTAZIONI GLOBALI
--     Requisiti: RC-03, RC-05, RC-09, RC-10, RC-11.
-- =====================================================================

CREATE TABLE settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL,
    label       text NOT NULL,
    description text,
    is_secret   boolean NOT NULL DEFAULT false, -- i segreti NON stanno qui: vedi nota
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Nota: is_secret esiste per marcare valori da non mostrare in chiaro
-- nell'interfaccia, non per conservare credenziali. Chiavi API, password
-- e token stanno in variabili d'ambiente (ADR-009 §4.3), mai a database.
--
-- Chiavi previste all'import:
--   site.title, site.description, site.timezone, site.locale,
--   site.date_format, site.time_format, site.start_of_week,
--   content.posts_per_page, seo.robots_txt, seo.sitemap_enabled,
--   seo.redirect_attachment_urls  (1B-W0 §2.6: e' una regola, non un comportamento),
--   analytics.ga4_measurement_id, cookie.banner_enabled,
--   maps.embed_enabled, contact.address


-- =====================================================================
-- 11. MIGRAZIONE
--     Requisiti: idempotenza e rieseguibilita' dell'importer (1B-W4).
-- =====================================================================

CREATE TABLE import_runs (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at     timestamptz NOT NULL DEFAULT now(),
    finished_at    timestamptz,
    is_dry_run     boolean NOT NULL,
    source_label   text NOT NULL,              -- es. 'BackupDB-2026-09-13'
    importer_version text NOT NULL,
    outcome        text,                       -- 'success' | 'partial' | 'failed'
    summary        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by     uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Corrispondenza fra identificatori della sorgente e del sistema nuovo.
-- E' cio' che rende l'import rieseguibile senza duplicare.
CREATE TABLE import_id_map (
    source_table text NOT NULL,                -- 'wp_posts', 'wp_terms', ...
    source_id    bigint NOT NULL,
    entity       text NOT NULL,                -- 'content', 'media', 'term', ...
    entity_id    uuid NOT NULL,
    run_id       uuid REFERENCES import_runs(id) ON DELETE SET NULL,
    action       text NOT NULL DEFAULT 'created', -- 'created' | 'updated' (DR-059)
    created_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_table, source_id, entity)
);

CREATE INDEX import_id_map_entity_idx ON import_id_map (entity, entity_id);

-- Anomalie incontrate: un frammento non convertibile, un file mancante,
-- un riferimento rotto. Sostituisce il "vedremo dopo" con un elenco.
CREATE TABLE import_issues (
    id           bigserial PRIMARY KEY,
    run_id       uuid NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
    severity     text NOT NULL,                -- 'info' | 'warning' | 'error'
    category     text NOT NULL,                -- 'block.fallback', 'media.missing', ...
    source_table text,
    source_id    bigint,
    message      text NOT NULL,
    detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX import_issues_run_idx ON import_issues (run_id, severity, category);


-- =====================================================================
-- 12. CONSERVAZIONE DI DATI LEGACY
--     DR-026: si importa tutto, senza bonifica.
--     Queste tabelle NON alimentano alcuna funzione della Fase 1:
--     esistono solo per non perdere dati. Rischio R-04, MI-06.
-- =====================================================================

-- 187 righe da wp_wpmailsmtp_debug_events: contengono destinatari reali.
CREATE TABLE legacy_email_log (
    id          bigserial PRIMARY KEY,
    occurred_at timestamptz,
    event_type  text,
    payload     jsonb NOT NULL,
    legacy_id   bigint,
    CONSTRAINT legacy_email_log_legacy_unique UNIQUE (legacy_id)
);

-- 1 riga da wp_ahm_download_stats.
CREATE TABLE legacy_download_stats (
    id          bigserial PRIMARY KEY,
    occurred_at timestamptz,
    payload     jsonb NOT NULL,
    legacy_id   bigint,
    CONSTRAINT legacy_download_stats_legacy_unique UNIQUE (legacy_id)
);


-- =====================================================================
-- 13. VINCOLI TRASVERSALI
-- =====================================================================

-- Un contenuto pubblicato deve avere un percorso che inizia e finisce
-- con '/': e' la forma dei permalink della sorgente ('/%postname%/').
ALTER TABLE contents
    ADD CONSTRAINT contents_path_shape
    CHECK (path ~ '^/([a-z0-9._~%!$&()*+,;=:@-]+/)*$');

ALTER TABLE terms
    ADD CONSTRAINT terms_path_shape
    CHECK (path ~ '^/([a-z0-9._~%!$&()*+,;=:@-]+/)*$');

-- I percorsi pubblici dei media vivono sotto /media/ (ADR-004 §3.1).
ALTER TABLE media
    ADD CONSTRAINT media_public_path_shape CHECK (public_path LIKE '/media/%');

ALTER TABLE media_variants
    ADD CONSTRAINT media_variants_public_path_shape CHECK (public_path LIKE '/media/%');

-- Il documento di blocchi dichiara sempre la versione dello schema.
ALTER TABLE contents
    ADD CONSTRAINT contents_blocks_have_schema
    CHECK (blocks ? 'schema' AND blocks ? 'blocks');
