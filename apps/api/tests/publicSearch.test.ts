import { schema } from '@amoris/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './_support/harness.js';

/**
 * Ricerca del sito pubblico (DR-144) sul database usa e getta: insieme dei
 * risultati, ordine per pertinenza e per data, paginazione, e la prova negativa
 * del criterio 1E-16 (bozze e download riservati non escono). Dati sintetici.
 */

let h: Harness;
const ids: Record<string, string> = {};

async function content(
  key: string,
  values: {
    path: string;
    title: string;
    text?: string;
    excerpt?: string;
    type?: 'page' | 'post';
    status?: 'draft' | 'published';
    date: string;
  },
): Promise<void> {
  const status = values.status ?? 'published';
  const [row] = await h.db
    .insert(schema.contents)
    .values({
      type: values.type ?? 'post',
      status,
      slug: values.path.split('/').filter(Boolean).pop() ?? 'home',
      path: values.path,
      title: values.title,
      excerpt: values.excerpt ?? null,
      contentText: values.text ?? '',
      publishedAt: status === 'published' ? new Date(values.date) : null,
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('contenuto non creato');
  ids[key] = row.id;
}

beforeAll(async () => {
  h = await createHarness('api_ricerca_pubblica');
  await content('home', {
    path: '/home/',
    title: 'Benvenuti',
    type: 'page',
    text: 'Il corso di base',
    date: '2020-01-01T00:00:00Z',
  });
  await content('vecchio', {
    path: '/corso-vecchio/',
    title: 'Corso vecchio',
    date: '2021-01-01T00:00:00Z',
  });
  await content('nuovo', {
    path: '/notizia-nuova/',
    title: 'Notizia nuova',
    text: 'Parla del corso',
    date: '2025-01-01T00:00:00Z',
  });
  await content('titolo', {
    path: '/corso-nuovo/',
    title: 'Corso nuovo',
    date: '2024-01-01T00:00:00Z',
  });
  await content('accento', {
    path: '/perche/',
    title: 'Perché la coppia',
    date: '2023-01-01T00:00:00Z',
  });
  await content('frase', {
    path: '/consulente/',
    title: 'Diventare consulente familiare',
    date: '2019-01-01T00:00:00Z',
  });
  await content('sparsa', {
    path: '/sparsa/',
    title: 'Il familiare e il consulente',
    date: '2026-01-01T00:00:00Z',
  });
  await content('apostrofo', {
    path: '/io-e-l-altro/',
    title: 'Io e l’altro',
    text: 'Il cammino “Noi due” per le coppie',
    date: '2018-01-01T00:00:00Z',
  });
  await content('bozza', {
    path: '/bozza-corso/',
    title: 'Corso in bozza',
    status: 'draft',
    date: '2026-01-01T00:00:00Z',
  });

  const [file] = await h.db
    .insert(schema.media)
    .values({
      storageKey: '2026/01/modulo.pdf',
      publicPath: '/media/2026/01/modulo.pdf',
      fileName: 'modulo.pdf',
      mimeType: 'application/pdf',
      byteSize: 4,
      checksum: Buffer.from('modulo'.padEnd(32, '0')),
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  await h.db.insert(schema.documents).values([
    {
      slug: 'modulo-corso',
      title: 'Modulo per il corso',
      mediaId: file?.id ?? '',
      publishedAt: new Date('2022-01-01T00:00:00Z'),
    },
    {
      slug: 'modulo-corso-riservato',
      title: 'Modulo corso riservato',
      mediaId: file?.id ?? '',
      isPrivate: true,
    },
  ]);
  await h.db
    .insert(schema.settings)
    .values({ key: 'site.home_content_id', value: ids.home ?? '', label: 'Pagina iniziale' });
}, 120_000);

afterAll(async () => {
  await h?.teardown();
});

const search = async (query: string) => {
  const response = await h.app.inject({ method: 'GET', url: `/public/search?${query}` });
  expect(response.statusCode).toBe(200);
  return response.json() as {
    items: { path: string; publishedAt: string | null }[];
    meta: { total: number };
  };
};

describe('ricerca pubblica (DR-144)', () => {
  it('una parola: prima i titoli che la contengono, poi per data; download pubblico compreso, home a /', async () => {
    const body = await search('s=corso');
    expect(body.items.map((i) => i.path)).toEqual([
      '/corso-nuovo/',
      '/download/modulo-corso/',
      '/corso-vecchio/',
      '/notizia-nuova/',
      '/',
    ]);
    expect(body.meta.total).toBe(5);
  });

  it('bozze e download riservati non escono (1E-16)', async () => {
    const paths = (await search('s=corso&perPage=50')).items.map((i) => i.path);
    expect(paths).not.toContain('/bozza-corso/');
    expect(paths).not.toContain('/download/modulo-corso-riservato/');
  });

  it('pagina: 5 per pagina come la sorgente, la seconda con il resto', async () => {
    const body = await search('s=e&page=2');
    expect(body.meta.total).toBeGreaterThan(5);
    expect(body.items.length).toBe(body.meta.total - 5);
  });

  it('maiuscole e accenti non contano', async () => {
    expect((await search('s=PERCHE')).items.map((i) => i.path)).toEqual(['/perche/']);
  });

  it('apici e virgolette tipografici valgono come quelli dritti scritti da chi cerca (DR-151)', async () => {
    expect((await search(`s=${encodeURIComponent("l'altro")}`)).items.map((i) => i.path)).toEqual([
      '/io-e-l-altro/',
    ]);
    expect(
      (await search(`s=${encodeURIComponent('"Noi due"')}`)).items.map((i) => i.path),
    ).toEqual(['/io-e-l-altro/']);
  });

  it('più parole: la frase intera nel titolo viene prima di tutte le parole sparse', async () => {
    const body = await search(`s=${encodeURIComponent('consulente familiare')}`);
    expect(body.items.map((i) => i.path)).toEqual(['/consulente/', '/sparsa/']);
  });

  it('il trattino esclude il termine', async () => {
    const paths = (await search('s=-corso&perPage=50')).items.map((i) => i.path);
    expect(paths).not.toContain('/corso-nuovo/');
    expect(paths).toContain('/perche/');
  });

  it('i caratteri speciali di LIKE si cercano alla lettera', async () => {
    expect((await search(`s=${encodeURIComponent('100%')}`)).meta.total).toBe(0);
  });

  it('una frase troppo lunga è respinta', async () => {
    const response = await h.app.inject({
      method: 'GET',
      url: `/public/search?s=${'x'.repeat(201)}`,
    });
    expect(response.statusCode).toBe(400);
  });
});
