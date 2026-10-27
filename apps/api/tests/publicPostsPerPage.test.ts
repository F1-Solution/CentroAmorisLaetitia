import { schema } from '@amoris/db';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './_support/harness.js';

/*
 * DR-270, «Articoli per pagina» (`content.posts_per_page`, ex `posts_per_page` di
 * WordPress). Nella sorgente l'opzione decideva solo:
 *
 * - l'indice degli articoli di WordPress, che il sito non ha (`show_on_front = page`,
 *   `page_for_posts = 0`);
 * - quanti articoli mostra un elenco Category Posts senza numero proprio
 *   (`default_settings()['num'] = get_option('posts_per_page')`, `cat-posts.php`).
 *
 * Archivi di categoria, ricerca e altri archivi usano invece le opzioni del tema
 * Divi (`divi_catnum_posts`, `divi_searchnum_posts`, `divi_archivenum_posts`), il
 * feed `posts_per_rss`: l'impostazione lì non vale. Qui si prova il solo punto che
 * la usa, l'elenco del blocco `post_list` senza `limit`. Dati sintetici.
 */

let h: Harness;
let termId = '';

async function pagina(path: string, limit: number | null): Promise<void> {
  await h.db.insert(schema.contents).values({
    type: 'page',
    status: 'published',
    slug: path.replaceAll('/', ''),
    path,
    title: `Pagina ${path}`,
    blocks: {
      schema: 1,
      blocks: [
        {
          type: 'post_list',
          id: 'b_elenco000001',
          props: { termIds: [termId], limit, offset: 0, order: 'date_desc' },
        },
      ],
    },
    publishedAt: new Date('2026-02-01T10:00:00Z'),
  });
}

async function articoliPerPagina(value: unknown): Promise<void> {
  await h.db
    .update(schema.settings)
    // `settings.value` è `jsonb NOT NULL`: il `null` si scrive come valore JSON.
    .set({ value: value === null ? sql`'null'::jsonb` : value })
    .where(eq(schema.settings.key, 'content.posts_per_page'));
}

const elenco = async (path: string): Promise<string[]> => {
  const response = await h.app.inject({ method: 'GET', url: `/public/content?path=${path}` });
  expect(response.statusCode).toBe(200);
  return response.json().postLists.b_elenco000001.map((p: { path: string }) => p.path);
};

beforeAll(async () => {
  h = await createHarness('amoris_api_articoli_per_pagina');
  const [term] = await h.db
    .insert(schema.terms)
    .values({
      taxonomy: 'category',
      slug: 'sintetica',
      name: 'Sintetica',
      path: '/category/sintetica/',
    })
    .returning({ id: schema.terms.id });
  termId = term?.id ?? '';
  for (let n = 1; n <= 12; n += 1) {
    const [row] = await h.db
      .insert(schema.contents)
      .values({
        type: 'post',
        status: 'published',
        slug: `articolo-${n}`,
        path: `/articolo-${n}/`,
        title: `Articolo ${n}`,
        publishedAt: new Date(Date.UTC(2026, 0, n, 10)),
      })
      .returning({ id: schema.contents.id });
    await h.db.insert(schema.contentTerms).values({ contentId: row?.id ?? '', termId });
  }
  await pagina('/senza-numero/', null);
  await pagina('/con-numero/', 4);
  await h.db
    .insert(schema.settings)
    .values({ key: 'content.posts_per_page', value: 10, label: 'Articoli per pagina' });
}, 120_000);

afterAll(async () => {
  await h?.teardown();
});

describe('«Articoli per pagina» nell’elenco Category Posts (DR-270)', () => {
  it('con il valore di oggi (10) l’elenco senza numero mostra 10 articoli, i più recenti', async () => {
    await articoliPerPagina(10);
    const paths = await elenco('/senza-numero/');
    expect(paths).toHaveLength(10);
    expect(paths[0]).toBe('/articolo-12/');
  });

  it('con 3 l’elenco senza numero ne mostra 3; quello con un numero proprio resta a 4', async () => {
    await articoliPerPagina(3);
    expect(await elenco('/senza-numero/')).toEqual([
      '/articolo-12/',
      '/articolo-11/',
      '/articolo-10/',
    ]);
    expect(await elenco('/con-numero/')).toHaveLength(4);
  });

  it('prova negativa: un valore assurdo nel database non rompe la pagina e vale 10', async () => {
    for (const assurdo of [0, -5, 1_000_000, 'tanti', null, 2.5]) {
      await articoliPerPagina(assurdo);
      expect(await elenco('/senza-numero/'), String(assurdo)).toHaveLength(10);
    }
  });

  it('la ricerca non la usa: resta a 5 risultati per pagina, `divi_searchnum_posts` della sorgente', async () => {
    // Il numero dell'archivio di categoria lo sceglie il sito (6): la prova è in `apps/web/tests/siteDates.test.tsx`.
    await articoliPerPagina(3);
    const ricerca = await h.app.inject({ method: 'GET', url: '/public/search?s=Articolo' });
    expect(ricerca.json().meta.perPage).toBe(5);
    expect(ricerca.json().items).toHaveLength(5);
    await articoliPerPagina(10);
  });
});
