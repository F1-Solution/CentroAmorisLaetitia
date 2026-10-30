-- DR-312 (D203 B): i blocchi Immagine dei contenuti importati non usano la didascalia del media.
-- Mette `useMediaCaption: false` dove manca, a ogni livello dell'albero; rieseguita non cambia nulla.
CREATE FUNCTION pg_temp.amoris_dr312_blocks(nodes jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  result jsonb := '[]'::jsonb;
  node jsonb;
BEGIN
  IF jsonb_typeof(nodes) IS DISTINCT FROM 'array' THEN
    RETURN nodes;
  END IF;
  FOR node IN
    SELECT e.value FROM jsonb_array_elements(nodes) WITH ORDINALITY AS e(value, n) ORDER BY e.n
  LOOP
    IF jsonb_typeof(node) = 'object' THEN
      IF node->>'type' = 'image'
        AND jsonb_typeof(node->'props') = 'object'
        AND NOT (node->'props' ? 'useMediaCaption') THEN
        node := jsonb_set(node, '{props,useMediaCaption}', 'false'::jsonb);
      END IF;
      IF jsonb_typeof(node->'children') = 'array' THEN
        node := jsonb_set(node, '{children}', pg_temp.amoris_dr312_blocks(node->'children'));
      END IF;
    END IF;
    result := result || jsonb_build_array(node);
  END LOOP;
  RETURN result;
END
$$;
--> statement-breakpoint
UPDATE "contents" AS c
SET "blocks" = m.blocks
FROM (
  SELECT id, jsonb_set("blocks", '{blocks}', pg_temp.amoris_dr312_blocks("blocks"->'blocks')) AS blocks
  FROM "contents"
  WHERE "legacy_id" IS NOT NULL AND jsonb_typeof("blocks"->'blocks') = 'array'
) AS m
WHERE c.id = m.id AND c."blocks" IS DISTINCT FROM m.blocks;
--> statement-breakpoint
UPDATE "content_drafts" AS d
SET "blocks" = m.blocks
FROM (
  SELECT dr.id, jsonb_set(dr."blocks", '{blocks}', pg_temp.amoris_dr312_blocks(dr."blocks"->'blocks')) AS blocks
  FROM "content_drafts" AS dr
  JOIN "contents" AS ct ON ct.id = dr."content_id"
  WHERE ct."legacy_id" IS NOT NULL AND jsonb_typeof(dr."blocks"->'blocks') = 'array'
) AS m
WHERE d.id = m.id AND d."blocks" IS DISTINCT FROM m.blocks;
--> statement-breakpoint
UPDATE "content_revisions" AS r
SET "blocks" = m.blocks
FROM (
  SELECT rv.id, jsonb_set(rv."blocks", '{blocks}', pg_temp.amoris_dr312_blocks(rv."blocks"->'blocks')) AS blocks
  FROM "content_revisions" AS rv
  JOIN "contents" AS ct ON ct.id = rv."content_id"
  WHERE ct."legacy_id" IS NOT NULL AND jsonb_typeof(rv."blocks"->'blocks') = 'array'
) AS m
WHERE r.id = m.id AND r."blocks" IS DISTINCT FROM m.blocks;
--> statement-breakpoint
DROP FUNCTION pg_temp.amoris_dr312_blocks(jsonb);
