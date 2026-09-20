CREATE TYPE "public"."admin_area" AS ENUM('redazione', 'impostazioni');--> statement-breakpoint
CREATE TABLE "content_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"blocks" jsonb NOT NULL,
	"base_updated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_drafts_content_author_unique" UNIQUE("content_id","author_id"),
	CONSTRAINT "content_drafts_blocks_have_schema" CHECK (blocks ? 'schema' AND blocks ? 'blocks')
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_role_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_role_label" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_area" "admin_area";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "active_role_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "active_area" "admin_area";--> statement-breakpoint
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_drafts" ADD CONSTRAINT "content_drafts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_drafts_author_idx" ON "content_drafts" USING btree ("author_id","updated_at" DESC NULLS FIRST);--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_role_id_roles_id_fk" FOREIGN KEY ("actor_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_active_role_id_roles_id_fk" FOREIGN KEY ("active_role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;