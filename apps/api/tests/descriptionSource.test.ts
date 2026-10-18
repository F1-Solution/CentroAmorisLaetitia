import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Description della sorgente (DR-180) e data di modifica (DR-186) davanti al CMS:
 * l'import le scrive; una modifica a estratto o testo azzera la description, ogni
 * salvataggio aggiorna la data di modifica. Dati sintetici.
 */

let harness: Harness;
let signed: Signed;
let contentId: string;
const IMPORTED_MODIFIED = new Date('2020-05-06T07:08:09Z');

beforeAll(async () => {
  harness = await createHarness('api_description_sorgente');
  signed = await signIn(harness, { area: 'redazione' });
  const creata = await harness.app.inject({
    method: 'POST',
    url: '/contents',
    headers: signed.writeHeaders,
    payload: {
      type: 'page',
      slug: 'pagina-con-description',
      title: 'Pagina con description',
      excerpt: 'Estratto importato',
    },
  });
  contentId = creata.json().id;
  await harness.db
    .update(schema.contents)
    .set({
      contentText: 'Testo importato',
      descriptionSource: 'Description "importata"',
      modifiedAt: IMPORTED_MODIFIED,
    })
    .where(eq(schema.contents.id, contentId));
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const stored = async () => {
  const [row] = await harness.db
    .select({
      descriptionSource: schema.contents.descriptionSource,
      modifiedAt: schema.contents.modifiedAt,
    })
    .from(schema.contents)
    .where(eq(schema.contents.id, contentId));
  return row;
};

const patch = (payload: Record<string, unknown>) =>
  harness.app.inject({
    method: 'PATCH',
    url: `/contents/${contentId}`,
    headers: signed.writeHeaders,
    payload,
  });

describe('description della sorgente e data di modifica (DR-180, DR-186)', () => {
  it('un salvataggio con estratto e testo uguali conserva la description e aggiorna la data', async () => {
    const response = await patch({
      title: 'Nuovo titolo',
      excerpt: 'Estratto importato',
      contentText: 'Testo\n importato',
    });
    expect(response.statusCode).toBe(200);
    const row = await stored();
    expect(row?.descriptionSource).toBe('Description "importata"');
    expect(row?.modifiedAt?.getTime()).toBeGreaterThan(IMPORTED_MODIFIED.getTime());
  });

  it('un salvataggio senza modifiche non cambia la data di modifica (1E-19)', async () => {
    const [prima] = await harness.db
      .select({
        title: schema.contents.title,
        excerpt: schema.contents.excerpt,
        blocks: schema.contents.blocks,
        contentText: schema.contents.contentText,
        modifiedAt: schema.contents.modifiedAt,
      })
      .from(schema.contents)
      .where(eq(schema.contents.id, contentId));
    const response = await patch({
      title: prima?.title,
      excerpt: prima?.excerpt,
      blocks: prima?.blocks,
      contentText: prima?.contentText,
      showTitle: true,
    });
    expect(response.statusCode).toBe(200);
    expect((await stored())?.modifiedAt?.getTime()).toBe(prima?.modifiedAt?.getTime());
  });

  it('un testo diverso solo negli spazi non cambia la data di modifica', async () => {
    // Il confronto normalizza gli spazi come quello della description: prima la
    // regex era `s+` per un escape perso nel modello `sql`, e lo scarto contava.
    const [prima] = await harness.db
      .select({ contentText: schema.contents.contentText, modifiedAt: schema.contents.modifiedAt })
      .from(schema.contents)
      .where(eq(schema.contents.id, contentId));
    const response = await patch({ contentText: prima?.contentText?.replace(' ', '\n\t ') });
    expect(response.statusCode).toBe(200);
    expect((await stored())?.modifiedAt?.getTime()).toBe(prima?.modifiedAt?.getTime());
  });

  it('un estratto cambiato dal CMS la azzera', async () => {
    expect((await patch({ excerpt: 'Estratto riscritto' })).statusCode).toBe(200);
    expect((await stored())?.descriptionSource).toBeNull();
  });

  it('un testo cambiato dal CMS la azzera', async () => {
    await harness.db
      .update(schema.contents)
      .set({ descriptionSource: 'Di nuovo importata' })
      .where(eq(schema.contents.id, contentId));
    expect((await patch({ contentText: 'Testo riscritto dal CMS' })).statusCode).toBe(200);
    expect((await stored())?.descriptionSource).toBeNull();
  });

  it('blocchi inviati senza testo la azzerano: il testo non si può confrontare', async () => {
    await harness.db
      .update(schema.contents)
      .set({ descriptionSource: 'Ancora importata' })
      .where(eq(schema.contents.id, contentId));
    const [row] = await harness.db
      .select({ blocks: schema.contents.blocks })
      .from(schema.contents)
      .where(eq(schema.contents.id, contentId));
    expect((await patch({ blocks: row?.blocks })).statusCode).toBe(200);
    expect((await stored())?.descriptionSource).toBeNull();
  });
});
