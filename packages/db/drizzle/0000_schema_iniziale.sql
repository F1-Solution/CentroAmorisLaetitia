-- Migrazione iniziale. Generata da drizzle-kit dallo schema di src/schema e poi
-- **letta e completata a mano**, come ADR-002 §5 impone. Due interventi manuali:
--
-- 1. Le tre estensioni, che drizzle-kit non genera. Senza, falliscono
--    gen_random_uuid(), il tipo citext e la ricerca senza accenti.
-- 2. I due vincoli *_path_shape: drizzle-kit tronca l'espressione CHECK al primo
--    punto e virgola, e il punto e virgola compare dentro la classe di caratteri
--    dell'espressione regolare. Qui sono riportati per intero.
--
-- Se un giorno queste due righe tornassero troncate, `pnpm db:verify` fallisce:
-- e' quello il controllo, non la memoria di chi rigenera.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "citext";--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "unaccent";--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('page', 'post');--> statement-breakpoint
CREATE TYPE "public"."menu_item_kind" AS ENUM('content', 'term', 'custom');--> statement-breakpoint
CREATE TYPE "public"."menu_visibility" AS ENUM('public', 'authenticated', 'roles', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."redirect_kind" AS ENUM('exact', 'prefix');--> statement-breakpoint
CREATE TYPE "public"."redirect_origin" AS ENUM('migration', 'manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."submission_origin" AS ENUM('migration', 'live');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"outcome" "audit_outcome" DEFAULT 'success' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" "bytea",
	"session_id" uuid
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_digest" "bytea" NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	"ip_hash" "bytea",
	CONSTRAINT "sessions_token_digest_unique" UNIQUE("token_digest")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"password_hash" text,
	"full_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"legacy_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"public_path" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" "bytea" NOT NULL,
	"title" text,
	"alt_text" text,
	"caption" text,
	"description" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"uploaded_by" uuid,
	"legacy_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_public_path_unique" UNIQUE("public_path"),
	CONSTRAINT "media_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "media_public_path_shape" CHECK (public_path LIKE '/media/%')
);
--> statement-breakpoint
CREATE TABLE "media_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"public_path" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"byte_size" bigint NOT NULL,
	"checksum" "bytea" NOT NULL,
	CONSTRAINT "media_variants_public_path_unique" UNIQUE("public_path"),
	CONSTRAINT "media_variants_public_path_shape" CHECK (public_path LIKE '/media/%')
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"title" text NOT NULL,
	"blocks" jsonb NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "content_revisions_unique" UNIQUE("content_id","revision_no")
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "content_type" NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"slug" text NOT NULL,
	"path" text NOT NULL,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"show_title" boolean DEFAULT true NOT NULL,
	"is_sticky" boolean DEFAULT false NOT NULL,
	"excerpt" text,
	"blocks" jsonb DEFAULT '{"schema":1,"blocks":[]}'::jsonb NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"featured_media_id" uuid,
	"published_at" timestamp with time zone,
	"author_id" uuid,
	"legacy_id" bigint,
	"legacy_type" text,
	"legacy_format" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('italian', coalesce(title, '')), 'A') || setweight(to_tsvector('italian', coalesce(excerpt, '')), 'B') || setweight(to_tsvector('italian', coalesce(content_text, '')), 'C')) STORED,
	CONSTRAINT "contents_path_unique" UNIQUE("path"),
	CONSTRAINT "contents_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "contents_slug_parent_unique" UNIQUE("parent_id","slug"),
	CONSTRAINT "contents_published_has_date" CHECK (status <> 'published' OR published_at IS NOT NULL),
	CONSTRAINT "contents_posts_have_no_parent" CHECK (type <> 'post' OR parent_id IS NULL),
	CONSTRAINT "contents_path_shape" CHECK (path ~ '^/([a-z0-9._~%!$&()*+,;=:@-]+/)*$'),
	CONSTRAINT "contents_blocks_have_schema" CHECK (blocks ? 'schema' AND blocks ? 'blocks')
);
--> statement-breakpoint
CREATE TABLE "content_terms" (
	"content_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "content_terms_content_id_term_id_pk" PRIMARY KEY("content_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taxonomy" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"path" text NOT NULL,
	"legacy_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "terms_taxonomy_slug_unique" UNIQUE("taxonomy","slug"),
	CONSTRAINT "terms_path_unique" UNIQUE("path"),
	CONSTRAINT "terms_legacy_unique" UNIQUE("taxonomy","legacy_id"),
	CONSTRAINT "terms_path_shape" CHECK (path ~ '^/([a-z0-9._~%!$&()*+,;=:@-]+/)*$')
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_id" uuid NOT NULL,
	"parent_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" "menu_item_kind" NOT NULL,
	"label" text NOT NULL,
	"content_id" uuid,
	"term_id" uuid,
	"url" text,
	"link_target" text,
	"css_classes" text,
	"visibility" "menu_visibility" DEFAULT 'public' NOT NULL,
	"visible_to_roles" text[] DEFAULT '{}' NOT NULL,
	"legacy_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_items_legacy_unique" UNIQUE("legacy_id"),
	CONSTRAINT "menu_items_target_matches_kind" CHECK ((kind = 'content' AND content_id IS NOT NULL AND term_id IS NULL AND url IS NULL) OR (kind = 'term' AND term_id IS NOT NULL AND content_id IS NULL AND url IS NULL) OR (kind = 'custom' AND url IS NOT NULL AND content_id IS NULL AND term_id IS NULL)),
	CONSTRAINT "menu_items_roles_only_when_needed" CHECK (visibility = 'roles' OR cardinality(visible_to_roles) = 0)
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"legacy_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menus_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "content_seo" (
	"content_id" uuid PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"canonical_url" text,
	"og_title" text,
	"og_description" text,
	"og_image_id" uuid,
	"robots_noindex" boolean DEFAULT false NOT NULL,
	"robots_nofollow" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_templates" (
	"scope" text PRIMARY KEY NOT NULL,
	"title_template" text NOT NULL,
	"description_template" text,
	"robots_directives" text[] DEFAULT '{}' NOT NULL,
	"og_type" text,
	"schema_type" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "term_seo" (
	"term_id" uuid PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"robots_noindex" boolean DEFAULT false NOT NULL,
	"robots_nofollow" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"target_path" text NOT NULL,
	"status_code" smallint DEFAULT 301 NOT NULL,
	"kind" "redirect_kind" DEFAULT 'exact' NOT NULL,
	"origin" "redirect_origin" DEFAULT 'manual' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"note" text,
	"hit_count" bigint DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redirects_source_unique" UNIQUE("source_path"),
	CONSTRAINT "redirects_status_valid" CHECK (status_code IN (301, 302, 307, 308)),
	CONSTRAINT "redirects_no_self_loop" CHECK (source_path <> target_path)
);
--> statement-breakpoint
CREATE TABLE "form_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"name" text NOT NULL,
	"recipients" text NOT NULL,
	"subject" text NOT NULL,
	"sender_name" text,
	"reply_to" text,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"origin" "submission_origin" NOT NULL,
	"payload" jsonb NOT NULL,
	"ip_hash" "bytea",
	"user_agent" text,
	"notified_at" timestamp with time zone,
	"notification_error" text,
	"legacy_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "form_submissions_legacy_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"definition" jsonb NOT NULL,
	"confirmation_message" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"requires_payment" boolean DEFAULT false NOT NULL,
	"legacy_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forms_slug_unique" UNIQUE("slug"),
	CONSTRAINT "forms_legacy_id_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "document_terms" (
	"document_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	CONSTRAINT "document_terms_document_id_term_id_pk" PRIMARY KEY("document_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"media_id" uuid NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"download_count" bigint DEFAULT 0 NOT NULL,
	"legacy_id" bigint,
	"legacy_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_slug_unique" UNIQUE("slug"),
	CONSTRAINT "documents_legacy_unique" UNIQUE("legacy_source","legacy_id")
);
--> statement-breakpoint
CREATE TABLE "slider_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slider_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"media_id" uuid,
	"heading" text,
	"body" text,
	"link_url" text,
	"link_label" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"legacy_id" bigint,
	CONSTRAINT "slider_slides_position_unique" UNIQUE("slider_id","position")
);
--> statement-breakpoint
CREATE TABLE "sliders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"legacy_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sliders_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "import_id_map" (
	"source_table" text NOT NULL,
	"source_id" bigint NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_id_map_source_table_source_id_entity_pk" PRIMARY KEY("source_table","source_id","entity")
);
--> statement-breakpoint
CREATE TABLE "import_issues" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"severity" text NOT NULL,
	"category" text NOT NULL,
	"source_table" text,
	"source_id" bigint,
	"message" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"is_dry_run" boolean NOT NULL,
	"source_label" text NOT NULL,
	"importer_version" text NOT NULL,
	"outcome" text,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "legacy_download_stats" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone,
	"payload" jsonb NOT NULL,
	"legacy_id" bigint,
	CONSTRAINT "legacy_download_stats_legacy_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "legacy_email_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone,
	"event_type" text,
	"payload" jsonb NOT NULL,
	"legacy_id" bigint,
	CONSTRAINT "legacy_email_log_legacy_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_parent_id_contents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."contents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_featured_media_id_media_id_fk" FOREIGN KEY ("featured_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_terms" ADD CONSTRAINT "content_terms_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_terms" ADD CONSTRAINT "content_terms_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_parent_id_terms_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_id_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parent_id_menu_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_seo" ADD CONSTRAINT "content_seo_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_seo" ADD CONSTRAINT "content_seo_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_templates" ADD CONSTRAINT "seo_templates_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_seo" ADD CONSTRAINT "term_seo_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_notifications" ADD CONSTRAINT "form_notifications_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_terms" ADD CONSTRAINT "document_terms_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_terms" ADD CONSTRAINT "document_terms_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slider_slides" ADD CONSTRAINT "slider_slides_slider_id_sliders_id_fk" FOREIGN KEY ("slider_id") REFERENCES "public"."sliders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slider_slides" ADD CONSTRAINT "slider_slides_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_id_map" ADD CONSTRAINT "import_id_map_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_run_id_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_runs" ADD CONSTRAINT "import_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_occurred_at_idx" ON "audit_log" USING btree ("occurred_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_user_id","occurred_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "sessions_user_active_idx" ON "sessions" USING btree ("user_id") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "media_mime_idx" ON "media" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "media_private_idx" ON "media" USING btree ("is_private") WHERE is_private;--> statement-breakpoint
CREATE INDEX "media_variants_media_idx" ON "media_variants" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "content_revisions_content_idx" ON "content_revisions" USING btree ("content_id","revision_no" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "contents_type_status_idx" ON "contents" USING btree ("type","status","published_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "contents_parent_idx" ON "contents" USING btree ("parent_id","position");--> statement-breakpoint
CREATE INDEX "contents_blocks_gin" ON "contents" USING gin (blocks jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "contents_search_idx" ON "contents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "content_terms_term_idx" ON "content_terms" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "menu_items_menu_idx" ON "menu_items" USING btree ("menu_id","parent_id","position");--> statement-breakpoint
CREATE INDEX "menu_items_public_idx" ON "menu_items" USING btree ("menu_id","position") WHERE visibility = 'public';--> statement-breakpoint
CREATE INDEX "redirects_active_idx" ON "redirects" USING btree ("source_path") WHERE is_active;--> statement-breakpoint
CREATE INDEX "form_notifications_form_idx" ON "form_notifications" USING btree ("form_id","position");--> statement-breakpoint
CREATE INDEX "form_submissions_form_idx" ON "form_submissions" USING btree ("form_id","submitted_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "import_id_map_entity_idx" ON "import_id_map" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "import_issues_run_idx" ON "import_issues" USING btree ("run_id","severity","category");