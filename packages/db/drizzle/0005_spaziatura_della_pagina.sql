ALTER TABLE "contents" ADD COLUMN "gutter_width" smallint;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_gutter_width_range" CHECK (gutter_width BETWEEN 1 AND 4);