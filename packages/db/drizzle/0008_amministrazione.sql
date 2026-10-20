INSERT INTO "permissions" ("key", "label") VALUES
  ('content.read', 'Leggere i contenuti'),
  ('content.write', 'Modificare i contenuti'),
  ('content.publish', 'Pubblicare i contenuti'),
  ('media.write', 'Caricare e modificare i media'),
  ('settings.write', 'Modificare le impostazioni'),
  ('users.manage', 'Gestire persone e permessi'),
  ('audit.read', 'Leggere il registro delle operazioni'),
  ('site.settings.write', 'Modificare le impostazioni del sito')
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "roles" ("key", "label", "is_system") VALUES ('amministrazione', 'Amministrazione', true)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_key")
SELECT r."id", p."key" FROM "roles" r
CROSS JOIN (VALUES ('users.manage'), ('audit.read'), ('site.settings.write')) AS p("key")
WHERE r."key" = 'amministrazione'
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "roles" SET "label" = 'Redazione' WHERE "key" = 'editor';
