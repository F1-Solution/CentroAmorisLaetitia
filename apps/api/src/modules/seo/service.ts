import { schema, type Database } from '@amoris/db';
import { asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { contentSeoBody, templateBody } from './schemas.js';

/**
 * Servizio del dominio `seo`. 1B-W0 §2 e R-10: si migrano le **regole**, non i
 * record, quindi i template globali sono la parte che conta e la sovrascrittura
 * per contenuto nasce quasi vuota.
 */

type TemplateInput = z.infer<typeof templateBody>;
type ContentSeoInput = z.infer<typeof contentSeoBody>;

export function listTemplates(db: Database) {
  return db.select().from(schema.seoTemplates).orderBy(asc(schema.seoTemplates.scope));
}

export async function findTemplate(db: Database, scope: string) {
  const [row] = await db
    .select()
    .from(schema.seoTemplates)
    .where(eq(schema.seoTemplates.scope, scope))
    .limit(1);
  return row ?? null;
}

export async function upsertTemplate(
  db: Database,
  scope: string,
  input: TemplateInput,
  updatedBy: string,
) {
  const values = {
    scope,
    titleTemplate: input.titleTemplate,
    descriptionTemplate: input.descriptionTemplate ?? null,
    robotsDirectives: input.robotsDirectives ?? [],
    ogType: input.ogType ?? null,
    schemaType: input.schemaType ?? null,
    updatedAt: new Date(),
    updatedBy,
  };
  await db
    .insert(schema.seoTemplates)
    .values(values)
    .onConflictDoUpdate({ target: schema.seoTemplates.scope, set: values });
  return findTemplate(db, scope);
}

export async function findContentSeo(db: Database, contentId: string) {
  const [row] = await db
    .select()
    .from(schema.contentSeo)
    .where(eq(schema.contentSeo.contentId, contentId))
    .limit(1);
  return row ?? null;
}

export async function upsertContentSeo(db: Database, contentId: string, input: ContentSeoInput) {
  const current = await findContentSeo(db, contentId);
  const values = {
    contentId,
    title: input.title === undefined ? (current?.title ?? null) : input.title,
    description:
      input.description === undefined ? (current?.description ?? null) : input.description,
    canonicalUrl:
      input.canonicalUrl === undefined ? (current?.canonicalUrl ?? null) : input.canonicalUrl,
    ogTitle: input.ogTitle === undefined ? (current?.ogTitle ?? null) : input.ogTitle,
    ogDescription:
      input.ogDescription === undefined ? (current?.ogDescription ?? null) : input.ogDescription,
    ogImageId: input.ogImageId === undefined ? (current?.ogImageId ?? null) : input.ogImageId,
    robotsNoindex: input.robotsNoindex ?? current?.robotsNoindex ?? false,
    robotsNofollow: input.robotsNofollow ?? current?.robotsNofollow ?? false,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.contentSeo)
    .values(values)
    .onConflictDoUpdate({ target: schema.contentSeo.contentId, set: values });
  return findContentSeo(db, contentId);
}

export async function contentExists(db: Database, contentId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.contents.id })
    .from(schema.contents)
    .where(eq(schema.contents.id, contentId))
    .limit(1);
  return row !== undefined;
}
