import { schema } from '@amoris/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../src/auth/permissions.js';
import { signInWithPermissions } from './_support/contentAddress.js';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Wave 1G-W4, T2: categorie nell'API (D140-A, D141-A, S4, S5). Slug e nome delle
 * categorie, assegnazione alle notizie, regola «una notizia pubblicata ha almeno
 * una categoria». Dati sintetici.
 */

let harness: Harness;
let signed: Signed;
let sola: Signed;

beforeAll(async () => {
  harness = await createHarness('api_terms');
  signed = await signIn(harness, { area: 'redazione' });
  sola = await signInWithPermissions(harness, 'solo-lettura', [PERMISSIONS.contentRead]);
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const send = (
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
) => harness.app.inject({ method, url, headers: signed.writeHeaders, payload });

const get = (url: string, cookie = signed.cookie) =>
  harness.app.inject({ method: 'GET', url, headers: { cookie } });

const publicGet = (url: string) => harness.app.inject({ method: 'GET', url });

interface Err {
  error: { code: string; message: string };
}

let counter = 0;

async function newCategory(name = 'Categoria'): Promise<{ id: string; slug: string }> {
  counter += 1;
  const slug = `cat-${counter}`;
  const risposta = await send('POST', '/terms', { taxonomy: 'category', slug, name });
  expect(risposta.statusCode, risposta.body).toBe(201);
  return { id: risposta.json().id as string, slug };
}

async function newPost(status: 'draft' | 'published' = 'draft'): Promise<string> {
  counter += 1;
  const [row] = await harness.db
    .insert(schema.contents)
    .values({
      type: 'post',
      status,
      slug: `notizia-${counter}`,
      path: `/notizia-${counter}/`,
      title: `Notizia ${counter}`,
      publishedAt: status === 'published' ? new Date() : null,
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('notizia di prova non creata');
  return row.id;
}

async function newPage(status: 'draft' | 'published' = 'draft'): Promise<string> {
  counter += 1;
  const [row] = await harness.db
    .insert(schema.contents)
    .values({
      type: 'page',
      status,
      slug: `pagina-${counter}`,
      path: `/pagina-${counter}/`,
      title: `Pagina ${counter}`,
      publishedAt: status === 'published' ? new Date() : null,
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('pagina di prova non creata');
  return row.id;
}

/** Un termine di un'altra tassonomia legato direttamente, come lo lascerebbe un import futuro. */
async function linkTag(contentId: string): Promise<string> {
  counter += 1;
  const [tag] = await harness.db
    .insert(schema.terms)
    .values({
      taxonomy: 'post_tag',
      slug: `etichetta-${counter}`,
      name: `Etichetta ${counter}`,
      path: `/tag/etichetta-${counter}/`,
    })
    .returning({ id: schema.terms.id });
  if (!tag) throw new Error('etichetta di prova non creata');
  await harness.db.insert(schema.contentTerms).values({ contentId, termId: tag.id });
  return tag.id;
}

const setTerms = (id: string, termIds: string[]) =>
  send('PUT', `/contents/${id}/terms`, { termIds });

async function linkedTermIds(contentId: string): Promise<string[]> {
  const rows = await harness.db
    .select({ id: schema.contentTerms.termId })
    .from(schema.contentTerms)
    .where(eq(schema.contentTerms.contentId, contentId));
  return rows.map((row) => row.id).sort();
}

describe('GET /terms con il conteggio delle notizie (S5)', () => {
  it('contentCount conta le notizie legate alla categoria, bozze comprese', async () => {
    const cat = await newCategory('Con notizie');
    const vuota = await newCategory('Vuota');
    const a = await newPost('published');
    const b = await newPost('draft');
    expect((await setTerms(a, [cat.id])).statusCode).toBe(200);
    expect((await setTerms(b, [cat.id])).statusCode).toBe(200);

    const risposta = await get('/terms?taxonomy=category');
    expect(risposta.statusCode, risposta.body).toBe(200);
    const items = risposta.json() as { id: string; contentCount: number }[];
    expect(items.find((item) => item.id === cat.id)?.contentCount).toBe(2);
    expect(items.find((item) => item.id === vuota.id)?.contentCount).toBe(0);
  });
});

describe('POST /terms per una categoria (D140-A, DR-240)', () => {
  it('uno slug duplicato è 409 TERM_SLUG_TAKEN e non 500', async () => {
    const cat = await newCategory();
    const risposta = await send('POST', '/terms', {
      taxonomy: 'category',
      slug: cat.slug,
      name: 'Altro nome',
    });
    expect(risposta.statusCode, risposta.body).toBe(409);
    expect((risposta.json() as Err).error.code).toBe('TERM_SLUG_TAKEN');
  });

  it.each([
    ['maiuscole', 'Maiuscole'],
    ['spazio', 'con spazio'],
    ['codifica incompleta', 'cat%zz'],
    ['solo punto', '.'],
    ['barra codificata', 'a%2fb'],
  ])('lo slug malformato (%s) è 400', async (_etichetta, slug) => {
    const risposta = await send('POST', '/terms', { taxonomy: 'category', slug, name: 'X' });
    expect(risposta.statusCode, risposta.body).toBe(400);
  });

  it('la creazione valida restituisce contentCount 0', async () => {
    const risposta = await send('POST', '/terms', {
      taxonomy: 'category',
      slug: 'nuova-valida',
      name: 'Nuova valida',
    });
    expect(risposta.statusCode, risposta.body).toBe(201);
    expect(risposta.json()).toMatchObject({ path: '/category/nuova-valida/', contentCount: 0 });
  });
});

describe('PATCH /terms/:id per una categoria (D140-A)', () => {
  it('il nome cambia e l’archivio pubblico lo mostra all’indirizzo di prima', async () => {
    const cat = await newCategory('Nome vecchio');
    const prima = await publicGet(`/public/terms?path=/category/${cat.slug}/`);
    expect(prima.statusCode).toBe(200);

    const risposta = await send('PATCH', `/terms/${cat.id}`, { name: 'Nome nuovo' });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json()).toMatchObject({ name: 'Nome nuovo', path: `/category/${cat.slug}/` });

    const dopo = await publicGet(`/public/terms?path=/category/${cat.slug}/`);
    expect(dopo.statusCode).toBe(200);
    expect(dopo.json().term.name).toBe('Nome nuovo');
    expect(dopo.json().seo.title).toContain('Nome nuovo');
  });

  it('lo slug è rifiutato con 400 e non cambia nulla', async () => {
    const cat = await newCategory('Fissa');
    const risposta = await send('PATCH', `/terms/${cat.id}`, { slug: 'altro-slug' });
    expect(risposta.statusCode, risposta.body).toBe(400);
    const [riga] = await harness.db
      .select({ slug: schema.terms.slug, path: schema.terms.path })
      .from(schema.terms)
      .where(eq(schema.terms.id, cat.id));
    expect(riga).toEqual({ slug: cat.slug, path: `/category/${cat.slug}/` });
  });

  it('anche lo stesso slug è rifiutato: per le categorie la chiave non si invia', async () => {
    const cat = await newCategory('Stesso');
    const risposta = await send('PATCH', `/terms/${cat.id}`, { slug: cat.slug, name: 'Cambiato' });
    expect(risposta.statusCode, risposta.body).toBe(400);
  });
});

describe('categorie: la posizione resta fissa (D140-A; il genitore è ammesso da DR-280)', () => {
  it('PATCH con position è 400 TERM_FIELD_FIXED e non cambia nulla', async () => {
    const cat = await newCategory('Ferma');
    const prima = await harness.db.select().from(schema.terms).where(eq(schema.terms.id, cat.id));
    const risposta = await send('PATCH', `/terms/${cat.id}`, { position: 5 });
    expect(risposta.statusCode, risposta.body).toBe(400);
    expect((risposta.json() as Err).error.code).toBe('TERM_FIELD_FIXED');
    const dopo = await harness.db.select().from(schema.terms).where(eq(schema.terms.id, cat.id));
    expect(dopo).toEqual(prima);
  });

  it('PATCH di nome e descrizione resta ammesso', async () => {
    const cat = await newCategory('Con descrizione');
    const risposta = await send('PATCH', `/terms/${cat.id}`, {
      name: 'Nome 2',
      description: 'Testo sintetico',
    });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json()).toMatchObject({
      name: 'Nome 2',
      description: 'Testo sintetico',
      path: `/category/${cat.slug}/`,
    });
  });

  it('POST con parentId di una categoria la crea sotto la genitrice; con null al primo livello', async () => {
    const madre = await newCategory('Madre');
    const figlia = await send('POST', '/terms', {
      taxonomy: 'category',
      slug: 'figlia-sintetica',
      name: 'Figlia',
      parentId: madre.id,
    });
    expect(figlia.statusCode, figlia.body).toBe(201);
    expect(figlia.json().path).toBe(`/category/${madre.slug}/figlia-sintetica/`);

    const ammessa = await send('POST', '/terms', {
      taxonomy: 'category',
      slug: 'senza-genitore',
      name: 'Senza genitore',
      parentId: null,
    });
    expect(ammessa.statusCode, ammessa.body).toBe(201);
  });
});

describe('PUT /contents/:id/terms (S4)', () => {
  it('assegna e toglie, e l’archivio pubblico segue alla richiesta successiva', async () => {
    const uno = await newCategory();
    const due = await newCategory();
    const id = await newPost('published');

    expect((await setTerms(id, [uno.id])).statusCode).toBe(200);
    const inUno = (await publicGet(`/public/posts?termIds=${uno.id}`)).json();
    expect(inUno.items.map((i: { path: string }) => i.path)).toContain(
      (await harness.db.select().from(schema.contents).where(eq(schema.contents.id, id)))[0]?.path,
    );

    const spostata = await setTerms(id, [due.id]);
    expect(spostata.statusCode, spostata.body).toBe(200);
    expect(spostata.json().termIds).toEqual([due.id]);
    expect((await publicGet(`/public/posts?termIds=${uno.id}`)).json().meta.total).toBe(0);
    expect((await publicGet(`/public/posts?termIds=${due.id}`)).json().meta.total).toBe(1);
    expect(await linkedTermIds(id)).toEqual([due.id]);
  });

  it('più categorie, ripetizioni ignorate; la risposta porta termIds e lastChange', async () => {
    const uno = await newCategory();
    const due = await newCategory();
    const id = await newPost('draft');
    const risposta = await setTerms(id, [uno.id, due.id, uno.id]);
    expect(risposta.statusCode, risposta.body).toBe(200);
    const corpo = risposta.json() as { termIds: string[]; lastChange: { actorLabel: string } };
    expect([...corpo.termIds].sort()).toEqual([uno.id, due.id].sort());
    expect(corpo.lastChange.actorLabel).toBe('Redattore Sintetico');
    expect(await linkedTermIds(id)).toEqual([uno.id, due.id].sort());
  });

  it('un termine di un’altra tassonomia è 400 CONTENT_TERMS_INVALID, senza scrivere', async () => {
    const cat = await newCategory();
    const [tag] = await harness.db
      .insert(schema.terms)
      .values({
        taxonomy: 'post_tag',
        slug: 'etichetta',
        name: 'Etichetta',
        path: '/post_tag/etichetta/',
      })
      .returning({ id: schema.terms.id });
    const id = await newPost('draft');
    expect((await setTerms(id, [cat.id])).statusCode).toBe(200);

    const risposta = await setTerms(id, [cat.id, tag?.id ?? '']);
    expect(risposta.statusCode, risposta.body).toBe(400);
    expect((risposta.json() as Err).error.code).toBe('CONTENT_TERMS_INVALID');
    expect(await linkedTermIds(id)).toEqual([cat.id]);
  });

  it('sostituisce solo le categorie: il legame a un termine di un’altra tassonomia resta (m-1)', async () => {
    const uno = await newCategory();
    const due = await newCategory();
    const id = await newPost('draft');
    const tag = await linkTag(id);

    expect((await setTerms(id, [uno.id])).statusCode).toBe(200);
    expect(await linkedTermIds(id)).toEqual([uno.id, tag].sort());

    const cambiata = await setTerms(id, [due.id]);
    expect(cambiata.statusCode, cambiata.body).toBe(200);
    expect(cambiata.json().termIds).toEqual([due.id]);
    expect(await linkedTermIds(id)).toEqual([due.id, tag].sort());

    // Una bozza può restare senza categorie: l'etichetta non se ne va con loro.
    expect((await setTerms(id, [])).statusCode).toBe(200);
    expect(await linkedTermIds(id)).toEqual([tag]);
  });

  it('un termine inesistente è 400 CONTENT_TERMS_INVALID', async () => {
    const id = await newPost('draft');
    const risposta = await setTerms(id, ['00000000-0000-4000-8000-000000000000']);
    expect(risposta.statusCode, risposta.body).toBe(400);
    expect((risposta.json() as Err).error.code).toBe('CONTENT_TERMS_INVALID');
  });

  it('un contenuto pagina è 400 CONTENT_TERMS_INVALID', async () => {
    const cat = await newCategory();
    const pagina = await newPage();
    const risposta = await setTerms(pagina, [cat.id]);
    expect(risposta.statusCode, risposta.body).toBe(400);
    expect((risposta.json() as Err).error.code).toBe('CONTENT_TERMS_INVALID');
    expect(await linkedTermIds(pagina)).toEqual([]);
  });

  it('un contenuto inesistente è 404', async () => {
    const risposta = await setTerms('00000000-0000-4000-8000-000000000000', []);
    expect(risposta.statusCode).toBe(404);
  });

  it('lista vuota: per una notizia pubblicata è 400 CONTENT_CATEGORY_REQUIRED, per una bozza è ammessa (D141-A)', async () => {
    const cat = await newCategory();
    const pubblicata = await newPost('published');
    const bozza = await newPost('draft');
    expect((await setTerms(pubblicata, [cat.id])).statusCode).toBe(200);
    expect((await setTerms(bozza, [cat.id])).statusCode).toBe(200);

    const rifiutata = await setTerms(pubblicata, []);
    expect(rifiutata.statusCode, rifiutata.body).toBe(400);
    expect((rifiutata.json() as Err).error.code).toBe('CONTENT_CATEGORY_REQUIRED');
    expect(await linkedTermIds(pubblicata)).toEqual([cat.id]);

    const ammessa = await setTerms(bozza, []);
    expect(ammessa.statusCode, ammessa.body).toBe(200);
    expect(ammessa.json().termIds).toEqual([]);
    expect(await linkedTermIds(bozza)).toEqual([]);
  });

  it('serve content.write: chi può solo leggere riceve 403 e nulla cambia', async () => {
    const cat = await newCategory();
    const id = await newPost('draft');
    const risposta = await harness.app.inject({
      method: 'PUT',
      url: `/contents/${id}/terms`,
      headers: { cookie: sola.cookie, 'x-csrf-token': sola.writeHeaders['x-csrf-token'] ?? '' },
      payload: { termIds: [cat.id] },
    });
    expect(risposta.statusCode).toBe(403);
    expect(await linkedTermIds(id)).toEqual([]);
  });

  it('scrive la riga content.terms.update e «Ultima modifica» la segue', async () => {
    const cat = await newCategory();
    const id = await newPost('draft');
    const prima = (await get(`/contents/${id}`)).json().lastChange;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await setTerms(id, [cat.id])).statusCode).toBe(200);

    const righe = await harness.db
      .select()
      .from(schema.auditLog)
      .where(
        and(eq(schema.auditLog.action, 'content.terms.update'), eq(schema.auditLog.entityId, id)),
      );
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ entityType: 'content', outcome: 'success' });

    const dopo = (await get(`/contents/${id}`)).json().lastChange as {
      actorLabel: string;
      occurredAt: string;
    };
    expect(dopo.actorLabel).toBe('Redattore Sintetico');
    const prevTime = prima && 'occurredAt' in prima ? Date.parse(prima.occurredAt) : 0;
    expect(Date.parse(dopo.occurredAt)).toBeGreaterThan(prevTime);
  });
});

describe('POST /contents/:id/publish e la categoria (D141-A)', () => {
  it('una notizia senza categoria non si pubblica: 400 CONTENT_CATEGORY_REQUIRED, resta in bozza', async () => {
    const id = await newPost('draft');
    const risposta = await send('POST', `/contents/${id}/publish`);
    expect(risposta.statusCode, risposta.body).toBe(400);
    expect((risposta.json() as Err).error.code).toBe('CONTENT_CATEGORY_REQUIRED');
    const [riga] = await harness.db
      .select({ status: schema.contents.status })
      .from(schema.contents)
      .where(eq(schema.contents.id, id));
    expect(riga?.status).toBe('draft');
  });

  it('un legame a un termine di un’altra tassonomia non basta per pubblicare (m-1)', async () => {
    const id = await newPost('draft');
    await linkTag(id);
    const risposta = await send('POST', `/contents/${id}/publish`);
    expect(risposta.statusCode, risposta.body).toBe(400);
    expect((risposta.json() as Err).error.code).toBe('CONTENT_CATEGORY_REQUIRED');
    const [riga] = await harness.db
      .select({ status: schema.contents.status })
      .from(schema.contents)
      .where(eq(schema.contents.id, id));
    expect(riga?.status).toBe('draft');
  });

  it('con una categoria la notizia si pubblica', async () => {
    const cat = await newCategory();
    const id = await newPost('draft');
    expect((await setTerms(id, [cat.id])).statusCode).toBe(200);
    const risposta = await send('POST', `/contents/${id}/publish`);
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().status).toBe('published');
  });

  it('una pagina si pubblica senza categorie', async () => {
    const id = await newPage('draft');
    const risposta = await send('POST', `/contents/${id}/publish`);
    expect(risposta.statusCode, risposta.body).toBe(200);
  });
});
