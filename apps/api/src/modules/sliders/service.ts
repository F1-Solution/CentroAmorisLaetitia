import { ruleForMime } from '@amoris/contracts/mediaRules';
import { schema, type Database } from '@amoris/db';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { lockMedia } from '../media/derivatives.js';
import type { replaceBody } from './schemas.js';

/** Servizio del dominio `sliders`. Le rotte non toccano il database (ADR-001 §3 punto 2). */

type ReplaceInput = z.infer<typeof replaceBody>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

function sliderError(code: string, message: string): Error {
  return Object.assign(new Error(message), { statusCode: 400, code });
}

export async function list(db: Database) {
  const rows = await db
    .select({
      id: schema.sliders.id,
      title: schema.sliders.title,
      updatedAt: schema.sliders.updatedAt,
      // Nomi qualificati a mano: drizzle ometterebbe la tabella e la sottoquery leggerebbe la propria colonna.
      slideCount: sql<number>`(select count(*)::int from slider_slides ss where ss.slider_id = sliders.id)`,
      usedInCount: sql<number>`(select count(*)::int from contents c where strpos(c.blocks::text, sliders.id::text) > 0)`,
    })
    .from(schema.sliders)
    .orderBy(sql`lower(${schema.sliders.title})`, asc(schema.sliders.id));
  return rows.map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
}

export async function findById(db: Database | Transaction, id: string) {
  const [slider] = await db
    .select({
      id: schema.sliders.id,
      title: schema.sliders.title,
      updatedAt: schema.sliders.updatedAt,
    })
    .from(schema.sliders)
    .where(eq(schema.sliders.id, id));
  if (!slider) return null;
  const slides = await db
    .select({
      id: schema.sliderSlides.id,
      position: schema.sliderSlides.position,
      mediaId: schema.sliderSlides.mediaId,
      heading: schema.sliderSlides.heading,
      body: schema.sliderSlides.body,
      fileName: schema.media.fileName,
      publicPath: schema.media.publicPath,
    })
    .from(schema.sliderSlides)
    // Un media riservato non presta nome né indirizzo: la slide si mostra senza immagine (L3).
    .leftJoin(
      schema.media,
      and(eq(schema.media.id, schema.sliderSlides.mediaId), eq(schema.media.isPrivate, false)),
    )
    .where(eq(schema.sliderSlides.sliderId, id))
    .orderBy(asc(schema.sliderSlides.position));
  // Contenuti che citano l'id come testo dei blocchi, come `citedBy` dei media (S18).
  const usedIn = await db
    .select({ id: schema.contents.id, title: schema.contents.title, type: schema.contents.type })
    .from(schema.contents)
    .where(sql`strpos(${schema.contents.blocks}::text, ${id}) > 0`)
    .orderBy(sql`lower(${schema.contents.title})`, asc(schema.contents.id))
    .limit(10);
  return {
    id: slider.id,
    title: slider.title,
    updatedAt: slider.updatedAt.toISOString(),
    slides: slides.map((slide) => ({
      id: slide.id,
      position: slide.position,
      mediaId: slide.mediaId,
      heading: slide.heading,
      body: slide.body,
      image:
        slide.fileName && slide.publicPath
          ? { fileName: slide.fileName, publicPath: slide.publicPath }
          : null,
    })),
    usedIn,
  };
}

const slideInvalid = (): Error =>
  sliderError('SLIDER_SLIDE_INVALID', 'Una slide indicata non appartiene a questo carosello.');

/**
 * Ogni `id` compare una volta sola e non è di un altro carosello; quello che non esiste più in
 * alcun carosello vale come voce nuova, perché vince l'ultimo «Salva» per intero (§6.9).
 */
async function resolveSlideIds(
  tx: Transaction,
  input: ReplaceInput,
  existing: ReadonlySet<string>,
): Promise<ReplaceInput['slides']> {
  const seen = new Set<string>();
  for (const entry of input.slides) {
    if (entry.id === undefined) continue;
    if (seen.has(entry.id)) throw slideInvalid();
    seen.add(entry.id);
  }
  const unknown = [...seen].filter((slideId) => !existing.has(slideId));
  if (unknown.length === 0) return input.slides;
  const foreign = await tx
    .select({ id: schema.sliderSlides.id })
    .from(schema.sliderSlides)
    .where(inArray(schema.sliderSlides.id, unknown))
    .limit(1);
  if (foreign.length > 0) throw slideInvalid();
  return input.slides.map(({ id: slideId, ...entry }) =>
    slideId !== undefined && existing.has(slideId) ? { id: slideId, ...entry } : entry,
  );
}

/** Blocca i media delle slide in ordine crescente, come l'eliminazione e la sostituzione del file (A4). */
async function lockSlideMedia(tx: Transaction, input: ReplaceInput): Promise<void> {
  const ids = [...new Set(input.slides.map((entry) => entry.mediaId))].sort();
  for (const mediaId of ids) await lockMedia(tx, mediaId);
}

/** Ogni media esiste, è pubblico ed è un'immagine ammessa (DR-218). */
async function checkMedia(tx: Transaction, input: ReplaceInput): Promise<void> {
  const wanted = [...new Set(input.slides.map((entry) => entry.mediaId))];
  const rows = await tx
    .select({ id: schema.media.id, mimeType: schema.media.mimeType })
    .from(schema.media)
    .where(and(inArray(schema.media.id, wanted), eq(schema.media.isPrivate, false)));
  const valid = new Set(
    rows.filter((row) => ruleForMime(row.mimeType)?.derivatives === true).map((row) => row.id),
  );
  if (wanted.some((id) => !valid.has(id))) {
    throw sliderError(
      'SLIDER_MEDIA_INVALID',
      "Ogni slide richiede un'immagine pubblica (JPEG, PNG o WebP).",
    );
  }
}

/**
 * Sostituisce l'elenco ordinato delle slide sotto blocco del carosello (S16): le posizioni
 * passano da valori negativi perché il vincolo unico non è differibile. `null` se manca.
 */
export async function replaceSlides(db: Database, id: string, input: ReplaceInput) {
  const done = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: schema.sliders.id })
      .from(schema.sliders)
      .where(eq(schema.sliders.id, id))
      .for('update');
    if (!locked) return false;

    const current = await tx
      .select({ id: schema.sliderSlides.id })
      .from(schema.sliderSlides)
      .where(eq(schema.sliderSlides.sliderId, id));
    const slides = await resolveSlideIds(tx, input, new Set(current.map((row) => row.id)));
    await lockSlideMedia(tx, input);
    await checkMedia(tx, input);

    const kept = new Set(slides.flatMap((entry) => (entry.id ? [entry.id] : [])));
    const removed = current.filter((row) => !kept.has(row.id)).map((row) => row.id);
    if (removed.length > 0) {
      await tx.delete(schema.sliderSlides).where(inArray(schema.sliderSlides.id, removed));
    }
    // Posizioni provvisorie negative: nessuna collisione mentre si riordina.
    await tx
      .update(schema.sliderSlides)
      .set({ position: sql`-${schema.sliderSlides.position}` })
      .where(eq(schema.sliderSlides.sliderId, id));

    for (const [index, entry] of slides.entries()) {
      const fields = {
        position: index + 1,
        mediaId: entry.mediaId,
        heading: entry.heading,
        body: entry.body,
      };
      if (entry.id) {
        await tx
          .update(schema.sliderSlides)
          .set(fields)
          .where(eq(schema.sliderSlides.id, entry.id));
      } else {
        await tx.insert(schema.sliderSlides).values({ sliderId: id, ...fields });
      }
    }
    await tx.update(schema.sliders).set({ updatedAt: new Date() }).where(eq(schema.sliders.id, id));
    return true;
  });
  return done ? findById(db, id) : null;
}
