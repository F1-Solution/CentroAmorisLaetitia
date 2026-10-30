import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './_support/harness.js';

/**
 * 1G-W9, sito pubblico: titoli di slide con HTML (W8-26), mappa del sito e modello
 * SEO (W8-36), contatore degli usi dei redirect (W8-18). Dati sintetici.
 */

let h: Harness;
const ids: Record<string, string> = {};
const get = (url: string) => h.app.inject({ method: 'GET', url });

async function page(key: string, path: string): Promise<string> {
  const [row] = await h.db
    .insert(schema.contents)
    .values({
      type: 'page',
      status: 'published',
      slug: path.split('/').filter(Boolean).pop() ?? key,
      path,
      title: `Titolo ${key}`,
      contentText: '',
      blocks: { schema: 1, blocks: [] },
      publishedAt: new Date('2026-02-01T10:00:00Z'),
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('pagina non creata');
  ids[key] = row.id;
  return row.id;
}

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  let value = await read();
  for (let i = 0; i < 40 && !done(value); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    value = await read();
  }
  return value;
}

beforeAll(async () => {
  h = await createHarness('amoris_api_w9');
  await h.db.insert(schema.seoTemplates).values([
    { scope: 'page', titleTemplate: '{title} - {site_title}', robotsDirectives: ['noindex'] },
    { scope: 'post', titleTemplate: '{title} - {site_title}' },
  ]);
  await page('modello', '/pagina-col-modello/');
  await h.db.insert(schema.contents).values({
    type: 'post',
    status: 'published',
    slug: 'articolo-indicizzato',
    path: '/articolo-indicizzato/',
    title: 'Articolo',
    contentText: '',
    blocks: { schema: 1, blocks: [] },
    publishedAt: new Date('2026-02-01T10:00:00Z'),
  });

  const heading =
    '<div align="center">Famiglia<br>in cammino<script>alert(1)</script>' +
    '<a href="javascript:alert(2)" onclick="x()">Link</a><i class="fa-heart"></i></div>';
  const [slider] = await h.db
    .insert(schema.sliders)
    .values({ key: 'caroselli-w9', title: 'Carosello sintetico' })
    .returning({ id: schema.sliders.id });
  ids.slider = slider?.id ?? '';
  await h.db
    .insert(schema.sliderSlides)
    .values({ sliderId: ids.slider, position: 0, heading, mediaId: null });
  await page('conCarosello', '/con-carosello/');
  await h.db
    .update(schema.contents)
    .set({
      blocks: {
        schema: 1,
        blocks: [{ type: 'slider', id: 'b1', props: { sliderId: ids.slider } }],
      },
    })
    .where(eq(schema.contents.id, ids.conCarosello ?? ''));

  await h.db.insert(schema.redirects).values([
    { sourcePath: '/vecchio-uno/', targetPath: '/pagina-col-modello/', statusCode: 301 },
    { sourcePath: '/vecchio-due/', targetPath: '/pagina-col-modello/', statusCode: 301 },
  ]);
});

afterAll(async () => {
  await h?.teardown();
});

describe('W8-26: titolo di slide con HTML', () => {
  it('la lettura pubblica dà solo l’HTML ammesso', async () => {
    const body = (await get('/public/content?path=/con-carosello/')).json();
    const heading = body.sliders[ids.slider ?? ''].slides[0].heading as string;
    expect(heading).toContain('Famiglia');
    expect(heading).toContain('<br>');
    expect(heading).not.toMatch(/script|alert|javascript|onclick|<a|fa-heart|<div|align=/i);
    // T2b (DR-311): il cuore resta, come icona del sito.
    expect(heading).toContain('<i class="blk-slide-icon-heart" aria-hidden="true"></i>');
  });
});

describe('W8-36: mappa del sito e modello SEO', () => {
  it('una pagina con noindex nel modello del suo tipo esce dalla mappa', async () => {
    const paths = (await get('/public/sitemap'))
      .json()
      .entries.map((e: { path: string }) => e.path);
    expect(paths).not.toContain('/pagina-col-modello/');
    expect(paths).toContain('/articolo-indicizzato/');
  });

  // Revisione T2, M2: le categorie seguono la stessa regola delle meta robots dei loro archivi.
  it('con noindex nel modello «category» le categorie escono dalla mappa', async () => {
    const [term] = await h.db
      .insert(schema.terms)
      .values({
        taxonomy: 'category',
        slug: 'categoria-w9',
        name: 'Categoria sintetica',
        path: '/category/categoria-w9/',
      })
      .returning({ id: schema.terms.id });
    if (!term) throw new Error('categoria non creata');
    const [post] = await h.db
      .select({ id: schema.contents.id })
      .from(schema.contents)
      .where(eq(schema.contents.path, '/articolo-indicizzato/'));
    await h.db.insert(schema.contentTerms).values({ contentId: post!.id, termId: term.id });
    const paths = async () =>
      (await get('/public/sitemap')).json().entries.map((e: { path: string }) => e.path);
    expect(await paths()).toContain('/category/categoria-w9/');

    await h.db.insert(schema.seoTemplates).values({
      scope: 'category',
      titleTemplate: '{term_title} - {site_title}',
      robotsDirectives: ['noindex'],
    });
    try {
      expect(await paths()).not.toContain('/category/categoria-w9/');
      expect(await paths()).toContain('/articolo-indicizzato/');
    } finally {
      await h.db.delete(schema.seoTemplates).where(eq(schema.seoTemplates.scope, 'category'));
    }
  });
});

describe('W8-18: contatore degli usi dei redirect', () => {
  const rule = async (source: string) => {
    const [row] = await h.db
      .select()
      .from(schema.redirects)
      .where(eq(schema.redirects.sourcePath, source));
    return row!;
  };

  it('ogni risposta aggiorna usi e ultimo utilizzo', async () => {
    expect((await rule('/vecchio-uno/')).hitCount).toBe(0);
    expect((await get('/public/redirect?path=/vecchio-uno/')).statusCode).toBe(200);
    expect((await get('/public/redirect?path=/vecchio-uno/')).statusCode).toBe(200);
    const after = await waitFor(
      () => rule('/vecchio-uno/'),
      (r) => r.hitCount >= 2,
    );
    expect(after.hitCount).toBe(2);
    expect(after.lastHitAt).not.toBeNull();
    expect((await rule('/vecchio-due/')).hitCount).toBe(0);
  });

  it('un percorso senza regola non cambia nulla e risponde 404', async () => {
    expect((await get('/public/redirect?path=/non-esiste/')).statusCode).toBe(404);
    expect((await rule('/vecchio-due/')).hitCount).toBe(0);
  });
});
