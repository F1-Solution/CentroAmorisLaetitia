import { schema, type Database } from '@amoris/db';
import { and, asc, desc, eq, ilike, like, or, type SQL, sql } from 'drizzle-orm';
import { UUID } from './schemas.js';

/** Servizio del dominio `settings`. */

const columns = {
  key: schema.settings.key,
  value: schema.settings.value,
  label: schema.settings.label,
  description: schema.settings.description,
  isSecret: schema.settings.isSecret,
  updatedAt: schema.settings.updatedAt,
};

export function list(db: Database) {
  return db.select(columns).from(schema.settings).orderBy(asc(schema.settings.key));
}

export async function findByKey(db: Database, key: string) {
  const [row] = await db
    .select(columns)
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1);
  return row ?? null;
}

export async function update(
  db: Database,
  key: string,
  input: { value: unknown; label?: string | undefined; description?: string | null | undefined },
  updatedBy: string,
) {
  const current = await findByKey(db, key);
  if (!current) return null;

  await db
    .update(schema.settings)
    .set({
      // `null` di JavaScript diventa il `null` di JSON: la colonna è `jsonb NOT NULL`.
      value: input.value === null ? sql`'null'::jsonb` : input.value,
      label: input.label ?? current.label,
      description: input.description === undefined ? current.description : input.description,
      updatedAt: new Date(),
      updatedBy,
    })
    .where(eq(schema.settings.key, key));
  return findByKey(db, key);
}

/** Quante immagini l'elenco del logo mostra al massimo: la ricerca restringe il resto. */
const LOGO_CHOICES_LIMIT = 50;

const logoColumns = {
  id: schema.media.id,
  title: schema.media.title,
  fileName: schema.media.fileName,
  publicPath: schema.media.publicPath,
};

/** Solo le immagini pubbliche possono fare da logo: il sito le serve senza sessione. */
const publicImage = and(eq(schema.media.isPrivate, false), like(schema.media.mimeType, 'image/%'));

/** Vero se l'identificativo è di un'immagine pubblica (W8-38). */
export async function isPublicImage(db: Database, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.media.id })
    .from(schema.media)
    .where(and(eq(schema.media.id, id), publicImage))
    .limit(1);
  return row !== undefined;
}

/** Vero se l'identificativo è di una pagina pubblicata, la sola che il sito può servire a «/» (W8-38). */
export async function isPublishedPage(db: Database, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.contents.id })
    .from(schema.contents)
    .where(
      and(
        eq(schema.contents.id, id),
        eq(schema.contents.type, 'page'),
        eq(schema.contents.status, 'published'),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** Le immagini fra cui scegliere il logo, più recenti prima, e il logo attuale se è ancora valido. */
export async function logoChoices(db: Database, search: string | undefined) {
  const filters: SQL[] = [];
  if (search) {
    const pattern = `%${search}%`;
    const match = or(ilike(schema.media.fileName, pattern), ilike(schema.media.title, pattern));
    if (match) filters.push(match);
  }
  const items = await db
    .select(logoColumns)
    .from(schema.media)
    .where(and(publicImage, ...filters))
    .orderBy(desc(schema.media.uploadedAt))
    .limit(LOGO_CHOICES_LIMIT);

  const currentId = (await findByKey(db, 'site.logo_media_id'))?.value;
  const [current] =
    typeof currentId === 'string' && UUID.test(currentId)
      ? await db
          .select(logoColumns)
          .from(schema.media)
          .where(and(eq(schema.media.id, currentId), publicImage))
          .limit(1)
      : [];
  return { items, current: current ?? null };
}

/** Quante pagine l'elenco della pagina iniziale mostra al massimo: la sorgente ne pubblica 78. */
const HOME_CHOICES_LIMIT = 200;

const homeColumns = {
  id: schema.contents.id,
  title: schema.contents.title,
  path: schema.contents.path,
};

const publishedPage = and(
  eq(schema.contents.type, 'page'),
  eq(schema.contents.status, 'published'),
);

/** Le pagine pubblicate fra cui scegliere la pagina iniziale, in ordine di titolo, e quella attuale se è ancora valida. */
export async function homeChoices(db: Database) {
  const items = await db
    .select(homeColumns)
    .from(schema.contents)
    .where(publishedPage)
    .orderBy(asc(schema.contents.title))
    .limit(HOME_CHOICES_LIMIT);

  const currentId = (await findByKey(db, 'site.home_content_id'))?.value;
  const [current] =
    typeof currentId === 'string' && UUID.test(currentId)
      ? await db
          .select(homeColumns)
          .from(schema.contents)
          .where(and(eq(schema.contents.id, currentId), publishedPage))
          .limit(1)
      : [];
  return { items, current: current ?? null };
}
