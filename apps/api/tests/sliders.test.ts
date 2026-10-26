import { schema } from '@amoris/db';
import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../src/auth/permissions.js';
import { lockMedia } from '../src/modules/media/derivatives.js';
import { signInWithPermissions } from './_support/contentAddress.js';
import {
  ADMIN_EMAIL,
  createHarness,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W6, T4b: caroselli nell'API (S16-S18, DR-257). Lettura, sostituzione
 * dell'elenco ordinato delle slide, rifiuti senza scritture e lettura pubblica. Dati sintetici.
 */

let h: Harness;
let signed: Signed;
let impostazioni: Signed;
let sola: Signed;

let counter = 0;

async function insertMedia(
  options: { isPrivate?: boolean; mimeType?: string; extension?: string } = {},
): Promise<string> {
  counter += 1;
  const fileName = `carosello-sintetico-${counter}.${options.extension ?? 'png'}`;
  const storageKey = `2026/02/${fileName}`;
  const [row] = await h.db
    .insert(schema.media)
    .values({
      storageKey,
      publicPath: `/media/${storageKey}`,
      fileName,
      mimeType: options.mimeType ?? 'image/png',
      byteSize: 10,
      checksum: Buffer.from(fileName.padEnd(32, '0')),
      isPrivate: options.isPrivate ?? false,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media non creato');
  return row.id;
}

interface SlideSeed {
  readonly mediaId: string | null;
  readonly heading?: string | null;
  readonly body?: string | null;
  readonly linkUrl?: string | null;
  readonly linkLabel?: string | null;
  readonly settings?: Record<string, unknown>;
  readonly legacyId?: number | null;
}

/** Un carosello con le slide date, in posizione da 1 a n. */
async function newSlider(seeds: readonly SlideSeed[]): Promise<{ id: string; slides: string[] }> {
  counter += 1;
  const [slider] = await h.db
    .insert(schema.sliders)
    .values({
      key: `carosello-${counter}`,
      title: `Carosello ${counter}`,
      settings: { autoplay: true },
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.sliders.id });
  if (!slider) throw new Error('carosello non creato');
  const rows = await h.db
    .insert(schema.sliderSlides)
    .values(
      seeds.map((seed, index) => ({
        sliderId: slider.id,
        position: index + 1,
        mediaId: seed.mediaId,
        heading: seed.heading ?? null,
        body: seed.body ?? null,
        linkUrl: seed.linkUrl ?? null,
        linkLabel: seed.linkLabel ?? null,
        settings: seed.settings ?? {},
        legacyId: seed.legacyId ?? null,
      })),
    )
    .returning({ id: schema.sliderSlides.id, position: schema.sliderSlides.position });
  return {
    id: slider.id,
    slides: rows.sort((a, b) => a.position - b.position).map((row) => row.id),
  };
}

async function slidesOf(sliderId: string) {
  return h.db
    .select()
    .from(schema.sliderSlides)
    .where(eq(schema.sliderSlides.sliderId, sliderId))
    .orderBy(asc(schema.sliderSlides.position));
}

async function sliderRow(id: string) {
  const [row] = await h.db.select().from(schema.sliders).where(eq(schema.sliders.id, id));
  if (!row) throw new Error('carosello sparito');
  return row;
}

/** Le righe `success`: una richiesta rifiutata lascia solo la riga d'esito negativo. */
async function updateEntries(sliderId: string) {
  return h.db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.action, 'slider.update'),
        eq(schema.auditLog.entityId, sliderId),
        eq(schema.auditLog.outcome, 'success'),
      ),
    );
}

async function pageWithSlider(sliderId: string, slug: string): Promise<string> {
  const [row] = await h.db
    .insert(schema.contents)
    .values({
      type: 'page',
      status: 'published',
      slug,
      path: `/${slug}/`,
      title: `Pagina ${slug}`,
      blocks: {
        schema: 1,
        blocks: [
          { type: 'slider', id: `b-${slug}`, props: { sliderId, classes: [] }, children: [] },
        ],
      },
      publishedAt: new Date('2026-02-01T10:00:00Z'),
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('contenuto non creato');
  return row.id;
}

const get = (url: string, cookie = signed.cookie) =>
  h.app.inject({ method: 'GET', url, headers: { cookie } });

type Entry = { id?: string; mediaId: string; heading: string | null; body: string | null };

const put = (id: string, slides: unknown, who: Signed = signed) =>
  h.app.inject({
    method: 'PUT',
    url: `/sliders/${id}/slides`,
    headers: who.writeHeaders,
    payload: { slides },
  });

beforeAll(async () => {
  h = await createHarness('api_sliders');
  signed = await signIn(h, { area: 'redazione' });
  impostazioni = await signIn(h, { email: ADMIN_EMAIL, area: 'impostazioni' });
  sola = await signInWithPermissions(h, 'solo-lettura', [PERMISSIONS.contentRead]);
}, 180_000);

afterAll(async () => {
  await h?.teardown();
});

describe('lettura (S16, S18)', () => {
  it('GET /sliders elenca per titolo con slideCount e usedInCount', async () => {
    const a = await newSlider([{ mediaId: await insertMedia() }, { mediaId: await insertMedia() }]);
    await pageWithSlider(a.id, 'pagina-conteggio-a');
    await pageWithSlider(a.id, 'pagina-conteggio-b');
    const response = await get('/sliders');
    expect(response.statusCode, response.body).toBe(200);
    const items = response.json() as {
      id: string;
      title: string;
      slideCount: number;
      usedInCount: number;
      updatedAt: string;
    }[];
    const mine = items.find((item) => item.id === a.id);
    expect(mine).toEqual({
      id: a.id,
      title: expect.stringMatching(/^Carosello \d+$/),
      slideCount: 2,
      usedInCount: 2,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const titles = items.map((item) => item.title);
    expect(titles).toEqual([...titles].sort((x, y) => x.localeCompare(y, 'it')));
  });

  it('GET /sliders/:id restituisce le slide in ordine, l’immagine e usedIn', async () => {
    const first = await insertMedia();
    const second = await insertMedia();
    const s = await newSlider([
      { mediaId: first, heading: 'Uno', body: 'Testo uno' },
      { mediaId: second, heading: null },
      { mediaId: null, heading: 'Senza immagine' },
    ]);
    const pageId = await pageWithSlider(s.id, 'pagina-dettaglio');
    const response = await get(`/sliders/${s.id}`);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      id: s.id,
      title: expect.stringMatching(/^Carosello \d+$/),
      updatedAt: '2026-01-01T00:00:00.000Z',
      slides: [
        {
          id: s.slides[0],
          position: 1,
          mediaId: first,
          heading: 'Uno',
          body: 'Testo uno',
          image: {
            fileName: expect.stringMatching(/^carosello-sintetico-\d+\.png$/),
            publicPath: expect.stringMatching(/^\/media\/2026\/02\/carosello-sintetico-\d+\.png$/),
          },
        },
        {
          id: s.slides[1],
          position: 2,
          mediaId: second,
          heading: null,
          body: null,
          image: expect.any(Object),
        },
        {
          id: s.slides[2],
          position: 3,
          mediaId: null,
          heading: 'Senza immagine',
          body: null,
          image: null,
        },
      ],
      usedIn: [{ id: pageId, title: 'Pagina pagina-dettaglio', type: 'page' }],
    });
  });

  it('una slide che punta a un media riservato non ne mostra nome né indirizzo', async () => {
    const riservato = await insertMedia({ isPrivate: true });
    const s = await newSlider([{ mediaId: riservato, heading: 'Riservata' }]);
    const response = await get(`/sliders/${s.id}`);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().slides[0]).toMatchObject({ heading: 'Riservata', image: null });
    expect(response.body).not.toContain('carosello-sintetico-');
  });

  it('usedIn è vuoto se nessun contenuto cita il carosello; inesistente 404; id non uuid 400', async () => {
    const s = await newSlider([{ mediaId: await insertMedia() }]);
    expect((await get(`/sliders/${s.id}`)).json().usedIn).toEqual([]);
    expect((await get('/sliders/00000000-0000-4000-8000-000000000000')).statusCode).toBe(404);
    expect((await get('/sliders/non-un-uuid')).statusCode).toBe(400);
  });

  it('anonimo 401; sessione Impostazioni 403', async () => {
    const s = await newSlider([{ mediaId: await insertMedia() }]);
    for (const url of ['/sliders', `/sliders/${s.id}`]) {
      expect((await h.app.inject({ method: 'GET', url })).statusCode).toBe(401);
      expect((await get(url, impostazioni.cookie)).statusCode).toBe(403);
    }
    expect((await put(s.id, [], impostazioni)).statusCode).toBe(403);
  });

  it('la sola lettura legge ma non sostituisce (403)', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m, heading: 'Resta' }]);
    expect((await get(`/sliders/${s.id}`, sola.cookie)).statusCode).toBe(200);
    const response = await put(
      s.id,
      [{ id: s.slides[0], mediaId: m, heading: 'Cambia', body: null }],
      sola,
    );
    expect(response.statusCode).toBe(403);
    expect((await slidesOf(s.id))[0]?.heading).toBe('Resta');
    expect(await updateEntries(s.id)).toHaveLength(0);
  });
});

describe('sostituzione dell’elenco (S16)', () => {
  it('inverte l’intero ordine e riscrive le posizioni da 1 a n', async () => {
    const medias = [await insertMedia(), await insertMedia(), await insertMedia()];
    const s = await newSlider(medias.map((mediaId, i) => ({ mediaId, heading: `Slide ${i + 1}` })));
    const reversed: Entry[] = [2, 1, 0].map((i) => ({
      id: s.slides[i],
      mediaId: medias[i] ?? '',
      heading: `Slide ${i + 1}`,
      body: null,
    }));
    const response = await put(s.id, reversed);
    expect(response.statusCode, response.body).toBe(200);
    const rows = await slidesOf(s.id);
    expect(rows.map((row) => row.id)).toEqual([s.slides[2], s.slides[1], s.slides[0]]);
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3]);
    expect(
      (response.json() as { slides: { id: string; position: number }[] }).slides.map(
        (slide) => slide.id,
      ),
    ).toEqual([s.slides[2], s.slides[1], s.slides[0]]);
  });

  it('aggiunge, toglie, cambia immagine e testo in una richiesta, conservando il resto delle slide elencate', async () => {
    const [m1, m2, m3, nuova, cambiata] = [
      await insertMedia(),
      await insertMedia(),
      await insertMedia(),
      await insertMedia({ mimeType: 'image/webp', extension: 'webp' }),
      await insertMedia({ mimeType: 'image/jpeg', extension: 'jpg' }),
    ] as [string, string, string, string, string];
    const s = await newSlider([
      {
        mediaId: m1,
        heading: 'Uno',
        linkUrl: 'https://esempio.invalid/uno',
        linkLabel: 'Vai',
        settings: { effetto: 'dissolvenza' },
        legacyId: 101,
      },
      { mediaId: m2, heading: 'Due', legacyId: 102 },
      { mediaId: m3, heading: 'Tre', legacyId: 103 },
    ]);
    const before = await sliderRow(s.id);
    await new Promise((resolve) => setTimeout(resolve, 20));

    const response = await put(s.id, [
      { mediaId: nuova, heading: '  Nuova  ', body: 'Testo nuovo' },
      { id: s.slides[0], mediaId: cambiata, heading: 'Uno modificato', body: '' },
      { id: s.slides[2], mediaId: m3, heading: '', body: '<b>Testo</b>' },
    ]);
    expect(response.statusCode, response.body).toBe(200);

    const rows = await slidesOf(s.id);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3]);
    expect(rows.find((row) => row.id === s.slides[1])).toBeUndefined();

    const [first, second, third] = rows;
    // Voce senza id: nasce con collegamento nullo e settings vuoti.
    expect(first).toMatchObject({
      mediaId: nuova,
      heading: 'Nuova',
      body: 'Testo nuovo',
      linkUrl: null,
      linkLabel: null,
      settings: {},
      legacyId: null,
    });
    expect(first?.id).not.toBe(s.slides[0]);
    // Voce elencata: conserva id, collegamento, settings e legacyId.
    expect(second).toMatchObject({
      id: s.slides[0],
      mediaId: cambiata,
      heading: 'Uno modificato',
      body: null,
      linkUrl: 'https://esempio.invalid/uno',
      linkLabel: 'Vai',
      settings: { effetto: 'dissolvenza' },
      legacyId: 101,
    });
    // Il testo resta testo: nessuna ripulitura dell'HTML, nessun collegamento.
    expect(third).toMatchObject({
      id: s.slides[2],
      heading: null,
      body: '<b>Testo</b>',
      legacyId: 103,
    });

    const after = await sliderRow(s.id);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(after.title).toBe(before.title);
    expect(after.key).toBe(before.key);
    expect(after.settings).toEqual({ autoplay: true });

    const righe = await updateEntries(s.id);
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ entityType: 'slider', outcome: 'success' });
  });

  it('heading di 300 caratteri e body di 2000 si accettano', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m }]);
    const response = await put(s.id, [
      { id: s.slides[0], mediaId: m, heading: 'h'.repeat(300), body: 'b'.repeat(2000) },
    ]);
    expect(response.statusCode, response.body).toBe(200);
  });

  it('un carosello inesistente risponde 404', async () => {
    const m = await insertMedia();
    const response = await put('00000000-0000-4000-8000-000000000000', [
      { mediaId: m, heading: null, body: null },
    ]);
    expect(response.statusCode).toBe(404);
  });

  it('un id che non esiste in alcun carosello vale come voce nuova', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m, heading: 'Resta' }]);
    const sparito = '00000000-0000-4000-8000-000000000000';
    const response = await put(s.id, [
      { id: s.slides[0], mediaId: m, heading: 'Resta', body: null },
      { id: sparito, mediaId: m, heading: 'Rinata', body: null },
    ]);
    expect(response.statusCode, response.body).toBe(200);
    const rows = await slidesOf(s.id);
    expect(rows.map((row) => row.heading)).toEqual(['Resta', 'Rinata']);
    expect(rows[1]?.id).not.toBe(sparito);
    expect(rows[1]).toMatchObject({ linkUrl: null, linkLabel: null, settings: {}, legacyId: null });
  });
});

describe('due schede sullo stesso carosello (§6.9: vince l’ultimo Salva, per intero)', () => {
  it('B salva il proprio elenco con la slide che A ha tolto: 200, elenco e ordine di B', async () => {
    const medias = [await insertMedia(), await insertMedia(), await insertMedia()];
    const s = await newSlider(
      medias.map((mediaId, i) => ({
        mediaId,
        heading: `Slide ${i + 1}`,
        linkUrl: `https://esempio.invalid/${i + 1}`,
        settings: { posizione: i + 1 },
      })),
    );
    const [uno, due, tre] = s.slides as [string, string, string];
    const [m1, m2, m3] = medias as [string, string, string];

    // Scheda A: toglie la seconda slide e salva.
    const a = await put(s.id, [
      { id: uno, mediaId: m1, heading: 'Slide 1', body: null },
      { id: tre, mediaId: m3, heading: 'Slide 3', body: null },
    ]);
    expect(a.statusCode, a.body).toBe(200);

    // Scheda B, aperta prima del salvataggio di A: elenca ancora la seconda, in un altro ordine.
    const b = await put(s.id, [
      { id: tre, mediaId: m3, heading: 'Tre da B', body: null },
      { id: due, mediaId: m2, heading: 'Due da B', body: 'Testo di B' },
      { id: uno, mediaId: m1, heading: 'Uno da B', body: null },
    ]);
    expect(b.statusCode, b.body).toBe(200);

    const rows = await slidesOf(s.id);
    expect(rows.map((row) => row.heading)).toEqual(['Tre da B', 'Due da B', 'Uno da B']);
    expect(rows.map((row) => row.mediaId)).toEqual([m3, m2, m1]);
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3]);
    // Le slide ancora esistenti conservano id e collegamento; quella tolta da A rinasce nuova.
    expect(rows[0]).toMatchObject({ id: tre, linkUrl: 'https://esempio.invalid/3' });
    expect(rows[2]).toMatchObject({ id: uno, linkUrl: 'https://esempio.invalid/1' });
    expect(rows[1]?.id).not.toBe(due);
    expect(rows[1]).toMatchObject({
      body: 'Testo di B',
      linkUrl: null,
      linkLabel: null,
      settings: {},
    });
    expect(
      (b.json() as { slides: { heading: string | null }[] }).slides.map((x) => x.heading),
    ).toEqual(['Tre da B', 'Due da B', 'Uno da B']);
  });

  it('un id di un altro carosello resta 400 SLIDER_SLIDE_INVALID', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m, heading: 'A' }]);
    const altro = await newSlider([{ mediaId: m, heading: 'B' }]);
    const response = await put(s.id, [
      { id: s.slides[0], mediaId: m, heading: 'A', body: null },
      { id: altro.slides[0], mediaId: m, heading: 'B', body: null },
    ]);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('SLIDER_SLIDE_INVALID');
    expect((await slidesOf(s.id)).map((row) => row.id)).toEqual(s.slides);
  });
});

describe('media bloccati durante la sostituzione (A4)', () => {
  it('la sostituzione attende il blocco del media tenuto da un’altra transazione', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m, heading: 'Prima' }]);
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    let held: () => void = () => {};
    const isHeld = new Promise<void>((resolve) => (held = resolve));
    // Come un'eliminazione o una sostituzione del file in corso: il blocco del media è preso.
    const holder = h.db.transaction(async (tx) => {
      await lockMedia(tx, m);
      held();
      await released;
    });
    await isHeld;

    let settled = false;
    const pending = put(s.id, [{ id: s.slides[0], mediaId: m, heading: 'Dopo', body: null }]).then(
      (response) => {
        settled = true;
        return response;
      },
    );
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(settled).toBe(false);
      expect((await slidesOf(s.id))[0]?.heading).toBe('Prima');
    } finally {
      release();
      await holder;
    }
    const response = await pending;
    expect(response.statusCode, response.body).toBe(200);
    expect((await slidesOf(s.id))[0]?.heading).toBe('Dopo');
  });
});

describe('rifiuti senza scritture (S16)', () => {
  async function expectUntouched(
    sliderId: string,
    slides: unknown,
    status: number,
    code: string,
  ): Promise<void> {
    const rowsBefore = await slidesOf(sliderId);
    const sliderBefore = await sliderRow(sliderId);
    const response = await put(sliderId, slides);
    expect(response.statusCode, response.body).toBe(status);
    expect(response.json().error.code).toBe(code);
    expect(await slidesOf(sliderId)).toEqual(rowsBefore);
    expect(await sliderRow(sliderId)).toEqual(sliderBefore);
    expect(await updateEntries(sliderId)).toHaveLength(0);
  }

  it('l’id di una slide di un altro carosello → SLIDER_SLIDE_INVALID', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m, heading: 'A' }]);
    const altro = await newSlider([{ mediaId: m, heading: 'B' }]);
    await expectUntouched(
      s.id,
      [
        { id: s.slides[0], mediaId: m, heading: 'A2', body: null },
        { id: altro.slides[0], mediaId: m, heading: 'B2', body: null },
      ],
      400,
      'SLIDER_SLIDE_INVALID',
    );
    expect((await slidesOf(altro.id))[0]?.heading).toBe('B');
  });

  it('un id ripetuto → SLIDER_SLIDE_INVALID', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m }]);
    await expectUntouched(
      s.id,
      [
        { id: s.slides[0], mediaId: m, heading: null, body: null },
        { id: s.slides[0], mediaId: m, heading: null, body: null },
      ],
      400,
      'SLIDER_SLIDE_INVALID',
    );
  });

  it('un media inesistente, riservato o PDF → SLIDER_MEDIA_INVALID', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m, heading: 'Resta' }]);
    const riservato = await insertMedia({ isPrivate: true });
    const pdf = await insertMedia({ mimeType: 'application/pdf', extension: 'pdf' });
    for (const mediaId of ['00000000-0000-4000-8000-000000000000', riservato, pdf]) {
      await expectUntouched(
        s.id,
        [
          { id: s.slides[0], mediaId: m, heading: 'Cambiato', body: null },
          { mediaId, heading: null, body: null },
        ],
        400,
        'SLIDER_MEDIA_INVALID',
      );
    }
  });

  it('0 o 51 voci, heading oltre 300, body oltre 2000, mediaId non uuid → 400 di validazione', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m, heading: 'Resta' }]);
    const one = (extra: Record<string, unknown>) => [
      { id: s.slides[0], mediaId: m, heading: null, body: null, ...extra },
    ];
    const cases: unknown[] = [
      [],
      Array.from({ length: 51 }, () => ({ mediaId: m, heading: null, body: null })),
      one({ heading: 'h'.repeat(301) }),
      one({ body: 'b'.repeat(2001) }),
      one({ mediaId: 'non-un-uuid' }),
    ];
    for (const slides of cases) {
      await expectUntouched(s.id, slides, 400, 'VALIDATION_FAILED');
    }
  });

  it('50 voci si accettano', async () => {
    const m = await insertMedia();
    const s = await newSlider([{ mediaId: m }]);
    const response = await put(
      s.id,
      Array.from({ length: 50 }, () => ({ mediaId: m, heading: null, body: null })),
    );
    expect(response.statusCode, response.body).toBe(200);
    expect((await slidesOf(s.id)).map((row) => row.position)).toEqual(
      Array.from({ length: 50 }, (_, i) => i + 1),
    );
  });
});

describe('sul sito (S16, W6-5)', () => {
  it('GET /public/content restituisce le slide nell’ordine salvato', async () => {
    const medias = [await insertMedia(), await insertMedia(), await insertMedia()];
    const s = await newSlider(medias.map((mediaId, i) => ({ mediaId, heading: `Slide ${i + 1}` })));
    await pageWithSlider(s.id, 'pagina-sul-sito');
    const slidesOnSite = async () => {
      const body = (
        await h.app.inject({ method: 'GET', url: '/public/content?path=/pagina-sul-sito/' })
      ).json() as { sliders: Record<string, { slides: { heading: string | null }[] }> };
      return body.sliders[s.id]?.slides.map((slide) => slide.heading);
    };
    expect(await slidesOnSite()).toEqual(['Slide 1', 'Slide 2', 'Slide 3']);

    const response = await put(
      s.id,
      [2, 0, 1].map((i) => ({
        id: s.slides[i],
        mediaId: medias[i] ?? '',
        heading: `Slide ${i + 1}`,
        body: null,
      })),
    );
    expect(response.statusCode, response.body).toBe(200);
    expect(await slidesOnSite()).toEqual(['Slide 3', 'Slide 1', 'Slide 2']);
  });
});
