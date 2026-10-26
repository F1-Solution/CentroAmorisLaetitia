import { extractContentText } from '@amoris/blocks/model';
import { schema } from '@amoris/db';
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ADMIN_EMAIL,
  BOTH_EMAIL,
  TEST_EMAIL,
  createHarness,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Anteprima della bozza (wave 1G-W5, S13/S14): `GET /contents/:id/preview` ha la forma di
 * `GET /public/content` e applica la copia di lavoro di chi chiede. Dati sintetici.
 */

let h: Harness;
let redazione: Signed;
let impostazioni: Signed;
const ids: Record<string, string> = {};
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');

const doc = (blocks: unknown[]) => ({ schema: 1, blocks });
const paragraph = (id: string, html: string) => ({
  type: 'rich_text',
  id: `b_${id.padStart(12, '0')}`,
  props: { html },
  children: [],
});

async function media(key: string, isPrivate: boolean): Promise<string> {
  const [row] = await h.db
    .insert(schema.media)
    .values({
      storageKey: `2026/01/${key}.png`,
      publicPath: `/media/2026/01/${key}.png`,
      fileName: `${key}.png`,
      mimeType: 'image/png',
      byteSize: PNG.length,
      width: 100,
      height: 50,
      checksum: Buffer.from(key.padEnd(32, '0')),
      isPrivate,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  ids[key] = row?.id ?? '';
  return ids[key];
}

async function content(
  key: string,
  values: {
    path: string;
    status: 'draft' | 'published';
    blocks?: unknown[];
    excerpt?: string | null;
    text?: string;
    descriptionSource?: string | null;
  },
): Promise<string> {
  const [row] = await h.db
    .insert(schema.contents)
    .values({
      type: 'page',
      status: values.status,
      slug: values.path.split('/').filter(Boolean).pop() ?? 'home',
      path: values.path,
      title: `Titolo ${key}`,
      excerpt: values.excerpt ?? null,
      contentText: values.text ?? '',
      descriptionSource: values.descriptionSource ?? null,
      blocks: doc(values.blocks ?? []),
      publishedAt: values.status === 'published' ? new Date('2026-02-01T10:00:00Z') : null,
    })
    .returning({ id: schema.contents.id });
  ids[key] = row?.id ?? '';
  return ids[key];
}

async function userId(email: string): Promise<string> {
  const [row] = await h.db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return row?.id ?? '';
}

async function draftOf(contentKey: string, email: string, values: Record<string, unknown>) {
  const [current] = await h.db
    .select({ updatedAt: schema.contents.updatedAt })
    .from(schema.contents)
    .where(eq(schema.contents.id, ids[contentKey] ?? ''));
  await h.db.insert(schema.contentDrafts).values({
    contentId: ids[contentKey] ?? '',
    authorId: await userId(email),
    title: 'Titolo della copia',
    excerpt: null,
    blocks: doc([]),
    baseUpdatedAt: current?.updatedAt ?? new Date(),
    ...values,
  });
}

function preview(key: string, session: Signed | null, id?: string) {
  return h.app.inject({
    method: 'GET',
    url: `/contents/${id ?? ids[key]}/preview`,
    headers: session ? { cookie: session.cookie } : {},
  });
}

beforeAll(async () => {
  h = await createHarness('amoris_api_anteprima');
  redazione = await signIn(h, { area: 'redazione' });
  impostazioni = await signIn(h, { email: ADMIN_EMAIL, area: 'impostazioni' });

  await media('pubblico', false);
  await media('riservato', true);
  await content('pagina', {
    path: '/pagina-sintetica/',
    status: 'published',
    excerpt: 'Estratto salvato.',
    text: 'Testo salvato della pagina.',
    blocks: [
      paragraph('p1', '<p>Testo salvato della pagina.</p>'),
      { type: 'image', id: 'i1', props: { mediaId: ids.pubblico } },
      { type: 'image', id: 'i2', props: { mediaId: ids.riservato } },
    ],
    descriptionSource: 'Descrizione importata.',
  });
  await content('bozza', { path: '/bozza-sintetica/', status: 'draft' });
  await content('home', { path: '/casa-sintetica/', status: 'published' });
  await h.db.insert(schema.seoTemplates).values([
    { scope: 'page', titleTemplate: '{title} - {site_title}' },
    { scope: 'home', titleTemplate: '{title} - {site_title}' },
  ]);
  await h.db.insert(schema.settings).values([
    { key: 'site.title', value: 'Sito sintetico', label: 'Titolo' },
    { key: 'site.home_content_id', value: ids.home ?? '', label: 'Pagina iniziale' },
  ]);
  await h.db.insert(schema.redirects).values({
    sourcePath: '/pagina-sintetica/',
    targetPath: '/altrove/',
    origin: 'manual',
  });
}, 120_000);

afterAll(async () => {
  await h?.teardown();
});

describe('accesso', () => {
  it('un anonimo riceve 401', async () => {
    expect((await preview('pagina', null)).statusCode).toBe(401);
  });

  it('una sessione dell’area Impostazioni riceve 403', async () => {
    expect((await preview('pagina', impostazioni)).statusCode).toBe(403);
  });

  it('un id inesistente risponde 404 e uno malformato 400', async () => {
    const assente = '00000000-0000-4000-8000-000000000000';
    expect((await preview('pagina', redazione, assente)).statusCode).toBe(404);
    expect((await preview('pagina', redazione, 'non-un-id')).statusCode).toBe(400);
  });

  it('la risposta non si conserva: Cache-Control no-store', async () => {
    const response = await preview('pagina', redazione);
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('senza copia di lavoro', () => {
  it('un pubblicato ha lo stesso corpo di /public/content, anche con un redirect sul suo indirizzo', async () => {
    const pubblica = await h.app.inject({
      method: 'GET',
      url: '/public/content?path=/pagina-sintetica/',
    });
    expect(pubblica.statusCode).toBe(200);
    const anteprima = await preview('pagina', redazione);
    const { publicPath, ...corpo } = anteprima.json();
    expect(corpo).toEqual(pubblica.json());
    expect(publicPath).toBe('/pagina-sintetica/');
  });

  it('la pagina iniziale ha lo stesso corpo di /public/content a «/»', async () => {
    const pubblica = await h.app.inject({ method: 'GET', url: '/public/content?path=/' });
    expect(pubblica.statusCode).toBe(200);
    const { publicPath, ...corpo } = (await preview('home', redazione)).json();
    expect(corpo).toEqual(pubblica.json());
    // Il corpo porta l'indirizzo proprio della pagina iniziale; `publicPath` dice dove il sito la serve.
    expect(corpo.content.path).toBe('/casa-sintetica/');
    expect(publicPath).toBe('/');
  });

  it('GET /public/content non porta publicPath', async () => {
    const pubblica = await h.app.inject({ method: 'GET', url: '/public/content?path=/' });
    expect(pubblica.json()).not.toHaveProperty('publicPath');
  });

  it('i media riservati restano esclusi', async () => {
    const body = (await preview('pagina', redazione)).json();
    expect(Object.keys(body.media)).toContain(ids.pubblico);
    expect(Object.keys(body.media)).not.toContain(ids.riservato);
  });

  it('una bozza mai pubblicata ha come data il momento della richiesta', async () => {
    const prima = Date.now();
    const body = (await preview('bozza', redazione)).json();
    const data = Date.parse(body.content.publishedAt);
    expect(data).toBeGreaterThanOrEqual(prima - 1000);
    expect(data).toBeLessThanOrEqual(Date.now() + 1000);
    expect(body.content.path).toBe('/bozza-sintetica/');
  });
});

describe('con la copia di lavoro', () => {
  beforeAll(async () => {
    await draftOf('pagina', TEST_EMAIL, {
      title: 'Titolo della copia',
      excerpt: 'Estratto della copia.',
      blocks: doc([paragraph('c1', '<p>Testo soltanto della copia.</p>')]),
    });
    await draftOf('pagina', BOTH_EMAIL, {
      title: 'Titolo di un’altra persona',
      excerpt: 'Estratto di un’altra persona.',
      blocks: doc([paragraph('e1', '<p>Testo di un’altra persona.</p>')]),
    });
  });

  it('titolo, estratto e blocchi sono quelli della copia di chi chiede', async () => {
    const { content: c } = (await preview('pagina', redazione)).json();
    expect(c.title).toBe('Titolo della copia');
    expect(c.excerpt).toBe('Estratto della copia.');
    expect(JSON.stringify(c.blocks)).toContain('Testo soltanto della copia.');
    expect(JSON.stringify(c.blocks)).not.toContain('di un’altra persona');
  });

  it('la copia di un’altra persona non si applica a chi non la ha', async () => {
    await draftOf('bozza', BOTH_EMAIL, { title: 'Solo di altra persona' });
    const { content: c } = (await preview('bozza', redazione)).json();
    expect(c.title).toBe('Titolo bozza');
  });

  it('la meta description è ricalcolata dalla copia, non quella importata', async () => {
    const { seo } = (await preview('pagina', redazione)).json();
    expect(seo.description).toContain('Testo soltanto della copia.');
    expect(seo.description).not.toBe('Descrizione importata.');
    expect(seo.title).toBe('Titolo della copia - Sito sintetico');
  });

  it('con testo ed estratto invariati la description importata resta', async () => {
    await content('uguale', {
      path: '/uguale-sintetica/',
      status: 'published',
      excerpt: null,
      text: 'Testo uguale.',
      blocks: [paragraph('a1', '<p>Testo uguale.</p>')],
      descriptionSource: 'Descrizione importata da conservare.',
    });
    await draftOf('uguale', TEST_EMAIL, {
      title: 'Solo il titolo cambia',
      blocks: doc([paragraph('a1', '<p>Testo   uguale.</p>')]),
    });
    const { seo } = (await preview('uguale', redazione)).json();
    expect(seo.description).toBe('Descrizione importata da conservare.');
  });
});

/** Lo stato che l'anteprima non deve toccare. */
async function stato() {
  return {
    audit: (await h.db.select({ n: count() }).from(schema.auditLog))[0]?.n,
    drafts: await h.db.select().from(schema.contentDrafts),
    contents: await h.db.select().from(schema.contents),
  };
}

describe('copia di lavoro non valida', () => {
  it('risponde 422 con codice e messaggio in italiano, senza scrivere nulla', async () => {
    await content('invalida', { path: '/invalida-sintetica/', status: 'published' });
    await draftOf('invalida', TEST_EMAIL, {
      blocks: { schema: 1, blocks: [{ type: 'non-esiste', id: 'b_00000000000a' }] },
    });
    const prima = await stato();
    const response = await preview('invalida', redazione);
    expect(response.statusCode).toBe(422);
    expect(response.json().error).toMatchObject({
      code: 'CONTENT_PREVIEW_DRAFT_INVALID',
      message: 'La copia di lavoro contiene un blocco non valido.',
    });
    expect(await stato()).toEqual(prima);
  });
});

describe('stessa regola del salvataggio (descrizione e estratto)', () => {
  /** Anteprima prima, poi il salvataggio vero degli stessi dati: devono coincidere. */
  async function agree(
    key: string,
    storedText: string,
    html: string,
    storedExcerpt: string | null,
  ) {
    await content(key, {
      path: `/${key}-sintetica/`,
      status: 'published',
      excerpt: storedExcerpt,
      text: storedText,
      blocks: [paragraph('a2', `<p>${storedText}</p>`)],
      descriptionSource: 'Descrizione importata.',
    });
    const blocks = doc([paragraph('a3', html)]);
    await draftOf(key, TEST_EMAIL, { title: `Titolo ${key}`, excerpt: '', blocks });
    const anteprima = (await preview(key, redazione)).json();
    const saved = await h.app.inject({
      method: 'PATCH',
      url: `/contents/${ids[key]}`,
      headers: redazione.writeHeaders,
      payload: {
        title: `Titolo ${key}`,
        excerpt: '',
        blocks,
        contentHtml: html,
        contentText: extractContentText(html),
      },
    });
    expect(saved.statusCode).toBe(200);
    const pubblica = (
      await h.app.inject({ method: 'GET', url: `/public/content?path=/${key}-sintetica/` })
    ).json();
    expect(anteprima.seo.description).toBe(pubblica.seo.description);
    expect(anteprima.content.excerpt).toBe(pubblica.content.excerpt);
    return anteprima;
  }

  it('testo importato con spazi ai bordi: come il salvataggio, la description importata cade', async () => {
    const body = await agree('bordi', ' Testo uguale. ', '<p>Testo uguale.</p>', null);
    expect(body.seo.description).not.toBe('Descrizione importata.');
  });

  it('testo importato con uno spazio non separabile: anteprima e salvataggio concordano', async () => {
    await agree('nbsp', 'Testo uguale.', '<p>Testo uguale.</p>', null);
  });

  it('un estratto salvato vuoto diventa NULL: l’anteprima restituisce lo stesso estratto', async () => {
    const body = await agree('vuoto', 'Testo uguale.', '<p>Testo uguale.</p>', '');
    expect(body.content.excerpt).toBeNull();
  });
});

describe('nessuna scrittura', () => {
  it('non aggiunge righe al registro e non tocca contenuti né copie', async () => {
    const stato = async () => ({
      audit: (await h.db.select({ n: count() }).from(schema.auditLog))[0]?.n,
      drafts: await h.db.select().from(schema.contentDrafts),
      contents: await h.db.select().from(schema.contents),
    });
    const prima = await stato();
    expect((await preview('pagina', redazione)).statusCode).toBe(200);
    expect((await preview('bozza', redazione)).statusCode).toBe(200);
    expect(await stato()).toEqual(prima);
  });
});
