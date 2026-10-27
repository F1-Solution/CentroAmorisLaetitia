import { schema } from '@amoris/db';
import { and, asc, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../src/auth/permissions.js';
import { inRace, signInWithPermissions } from './_support/contentAddress.js';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Wave 1G-W7, T2g (DR-280, D176=C): categorie complete. Descrizione, categoria
 * genitore con indirizzo dell'archivio che discende dal genitore e redirect 301
 * automatici dal vecchio, SEO dell'archivio come All in One SEO (titolo,
 * `#taxonomy_description` come ripiego della descrizione, robots), eliminazione
 * con rifiuto spiegato. Nomi, slug e testi sono inventati.
 */

let harness: Harness;
let signed: Signed;
let sola: Signed;
let senzaRedirect: Signed;
let senzaPubblica: Signed;

beforeAll(async () => {
  harness = await createHarness('api_terms_complete');
  signed = await signIn(harness, { area: 'redazione' });
  sola = await signInWithPermissions(harness, 'sola-lettura-t2g', [PERMISSIONS.contentRead]);
  senzaRedirect = await signInWithPermissions(harness, 'scrittura-t2g', [
    PERMISSIONS.contentRead,
    PERMISSIONS.contentWrite,
    PERMISSIONS.contentPublish,
  ]);
  senzaPubblica = await signInWithPermissions(harness, 'senza-pubblica-t2g', [
    PERMISSIONS.contentRead,
    PERMISSIONS.contentWrite,
    PERMISSIONS.settingsWrite,
  ]);
  await harness.db
    .insert(schema.seoTemplates)
    .values({ scope: 'category', titleTemplate: '{term_title} - {site_title}' })
    .onConflictDoNothing();
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const send = (
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
  who: Signed = signed,
) => harness.app.inject({ method, url, headers: who.writeHeaders, payload });

const get = (url: string, who: Signed = signed) =>
  harness.app.inject({ method: 'GET', url, headers: { cookie: who.cookie } });

const publicGet = (url: string) => harness.app.inject({ method: 'GET', url });

interface Err {
  error: { code: string; message: string };
}

let counter = 0;

async function newCategory(
  name = 'Categoria',
  parentId: string | null = null,
): Promise<{ id: string; slug: string; path: string }> {
  counter += 1;
  const slug = `cat-t2g-${counter}`;
  const risposta = await send('POST', '/terms', { taxonomy: 'category', slug, name, parentId });
  expect(risposta.statusCode, risposta.body).toBe(201);
  const corpo = risposta.json() as { id: string; path: string };
  return { id: corpo.id, slug, path: corpo.path };
}

async function newPost(): Promise<string> {
  counter += 1;
  const [row] = await harness.db
    .insert(schema.contents)
    .values({
      type: 'post',
      status: 'published',
      slug: `notizia-t2g-${counter}`,
      path: `/notizia-t2g-${counter}/`,
      title: `Notizia ${counter}`,
      publishedAt: new Date(),
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('notizia di prova non creata');
  return row.id;
}

async function pathOf(id: string): Promise<string | undefined> {
  const [row] = await harness.db
    .select({ path: schema.terms.path })
    .from(schema.terms)
    .where(eq(schema.terms.id, id));
  return row?.path;
}

async function rulesFrom(source: string) {
  return harness.db
    .select({
      targetPath: schema.redirects.targetPath,
      statusCode: schema.redirects.statusCode,
      origin: schema.redirects.origin,
      isActive: schema.redirects.isActive,
    })
    .from(schema.redirects)
    .where(eq(schema.redirects.sourcePath, source));
}

async function tables() {
  return {
    terms: await harness.db.select().from(schema.terms).orderBy(asc(schema.terms.id)),
    redirects: await harness.db.select().from(schema.redirects).orderBy(asc(schema.redirects.id)),
  };
}

async function auditRows(action: string, entityId: string) {
  return harness.db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.action, action), eq(schema.auditLog.entityId, entityId)));
}

describe('descrizione (DR-280 punto 1)', () => {
  it('si salva e diventa la meta description dell’archivio, come #taxonomy_description', async () => {
    const cat = await newCategory('Con descrizione');
    const risposta = await send('PATCH', `/terms/${cat.id}`, {
      description: 'Descrizione sintetica della categoria.',
    });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().description).toBe('Descrizione sintetica della categoria.');

    const archivio = await publicGet(`/public/terms?path=${cat.path}`);
    expect(archivio.statusCode).toBe(200);
    expect(archivio.json().seo.description).toBe('Descrizione sintetica della categoria.');
  });

  it('senza descrizione né SEO propria la meta description resta assente', async () => {
    const cat = await newCategory('Senza descrizione');
    const archivio = (await publicGet(`/public/terms?path=${cat.path}`)).json();
    expect(archivio.seo.description).toBeNull();
    expect(archivio.seo.robots).toBe('max-image-preview:large');
  });

  it('una descrizione di soli spazi conta come vuota', async () => {
    const cat = await newCategory('Spazi');
    await send('PATCH', `/terms/${cat.id}`, { description: '   ' });
    expect((await publicGet(`/public/terms?path=${cat.path}`)).json().seo.description).toBeNull();
  });

  it('la categoria dei download non prende la descrizione come meta description', async () => {
    const [term] = await harness.db
      .insert(schema.terms)
      .values({
        taxonomy: 'wpdmcategory',
        slug: 'moduli-t2g',
        name: 'Moduli sintetici',
        description: 'Testo sintetico dei moduli.',
        path: '/download-category/moduli-t2g/',
      })
      .returning({ id: schema.terms.id });
    expect(term).toBeDefined();
    const seo = await harness.app.inject({
      method: 'GET',
      url: `/terms/${term?.id}/seo`,
      headers: { cookie: signed.cookie },
    });
    expect(seo.statusCode).toBe(404);
  });
});

describe('categoria genitore (DR-280 punto 2)', () => {
  it('alla creazione l’indirizzo discende dal genitore: /category/genitore/figlia/', async () => {
    const genitore = await newCategory('Genitore');
    const figlia = await newCategory('Figlia', genitore.id);
    expect(figlia.path).toBe(`/category/${genitore.slug}/${figlia.slug}/`);
    expect((await publicGet(`/public/terms?path=${figlia.path}`)).statusCode).toBe(200);
  });

  it('spostarla cambia l’indirizzo suo e delle figlie, con 301 automatici in un passo', async () => {
    const madre = await newCategory('Madre');
    const sposta = await newCategory('Si sposta');
    const nipote = await newCategory('Nipote', sposta.id);
    const vecchio = sposta.path;
    const vecchioNipote = nipote.path;

    const risposta = await send('PATCH', `/terms/${sposta.id}`, { parentId: madre.id });
    expect(risposta.statusCode, risposta.body).toBe(200);
    const nuovo = `${madre.path}${sposta.slug}/`;
    expect(risposta.json()).toMatchObject({ parentId: madre.id, path: nuovo });
    expect(await pathOf(nipote.id)).toBe(`${nuovo}${nipote.slug}/`);

    expect(await rulesFrom(vecchio)).toEqual([
      { targetPath: nuovo, statusCode: 301, origin: 'automatic', isActive: true },
    ]);
    expect(await rulesFrom(vecchioNipote)).toEqual([
      {
        targetPath: `${nuovo}${nipote.slug}/`,
        statusCode: 301,
        origin: 'automatic',
        isActive: true,
      },
    ]);
    const redirect = await publicGet(`/public/redirect?path=${encodeURIComponent(vecchio)}`);
    expect(redirect.json()).toMatchObject({ targetPath: nuovo, statusCode: 301 });
    // Un passo: la destinazione non è a sua volta un redirect, ed è un archivio vero.
    expect((await publicGet(`/public/redirect?path=${encodeURIComponent(nuovo)}`)).statusCode).toBe(
      404,
    );
    expect((await publicGet(`/public/terms?path=${nuovo}`)).statusCode).toBe(200);
    expect((await publicGet(`/public/terms?path=${vecchio}`)).statusCode).toBe(404);

    const riga = await auditRows('term.update', sposta.id);
    expect(riga.at(-1)).toMatchObject({ entityType: 'term', outcome: 'success' });
    // Il nome del campo nel registro è quello della schermata.
    expect((riga.at(-1)?.detail as { fields?: string[] }).fields).toEqual(['Categoria genitrice']);
  });

  it('riportata al primo livello: niente catene né cicli, la regola in arrivo si toglie', async () => {
    const madre = await newCategory('Madre 2');
    const va = await newCategory('Va e torna');
    const primo = va.path;
    expect((await send('PATCH', `/terms/${va.id}`, { parentId: madre.id })).statusCode).toBe(200);
    const secondo = `${madre.path}${va.slug}/`;

    const ritorno = await send('PATCH', `/terms/${va.id}`, { parentId: null });
    expect(ritorno.statusCode, ritorno.body).toBe(200);
    expect(ritorno.json().path).toBe(primo);
    expect(await rulesFrom(primo)).toEqual([]);
    expect(await rulesFrom(secondo)).toEqual([
      { targetPath: primo, statusCode: 301, origin: 'automatic', isActive: true },
    ]);
  });

  it.each([
    ['sé stessa', 'self'],
    ['una sua discendente', 'child'],
    ['una categoria inesistente', 'missing'],
    ['un termine di un’altra tassonomia', 'other'],
  ])('rifiuta come genitore %s con 400 TERM_PARENT_INVALID, senza scrivere', async (_e, kind) => {
    const cat = await newCategory('Ferma');
    const figlia = await newCategory('Figlia ferma', cat.id);
    const [altro] = await harness.db
      .insert(schema.terms)
      .values({
        taxonomy: 'wpdmcategory',
        slug: `altro-${counter}`,
        name: 'Altro',
        path: `/download-category/altro-${counter}/`,
      })
      .returning({ id: schema.terms.id });
    const parentId = {
      self: cat.id,
      child: figlia.id,
      missing: '00000000-0000-4000-8000-000000000000',
      other: altro?.id,
    }[kind];
    const prima = await tables();
    const risposta = await send('PATCH', `/terms/${cat.id}`, { parentId });
    expect(risposta.statusCode, risposta.body).toBe(400);
    const errore = (risposta.json() as Err).error;
    expect(errore.code).toBe('TERM_PARENT_INVALID');
    expect(errore.message).toMatch(/categoria/);
    expect(await tables()).toEqual(prima);
  });

  it('una regola manuale all’indirizzo d’arrivo fa rifiutare con 409, senza scrivere', async () => {
    const madre = await newCategory('Madre 3');
    const cat = await newCategory('Bloccata');
    await harness.db.insert(schema.redirects).values({
      sourcePath: `${madre.path}${cat.slug}/`,
      targetPath: '/altrove/',
      origin: 'manual',
      kind: 'exact',
      statusCode: 301,
      isActive: true,
    });
    const prima = await tables();
    const risposta = await send('PATCH', `/terms/${cat.id}`, { parentId: madre.id });
    expect(risposta.statusCode, risposta.body).toBe(409);
    expect((risposta.json() as Err).error.code).toBe('REDIRECT_AT_DESTINATION');
    expect(await tables()).toEqual(prima);
  });

  it('riscrivere una regola esistente chiede settings.write, come per i contenuti (DR-242)', async () => {
    const madre = await newCategory('Madre 4');
    const cat = await newCategory('Con regola verso');
    await harness.db.insert(schema.redirects).values({
      sourcePath: `/vecchio-t2g-${counter}/`,
      targetPath: cat.path,
      origin: 'manual',
      kind: 'exact',
      statusCode: 301,
      isActive: true,
    });
    const prima = await tables();
    const risposta = await send('PATCH', `/terms/${cat.id}`, { parentId: madre.id }, senzaRedirect);
    expect(risposta.statusCode, risposta.body).toBe(403);
    expect(await tables()).toEqual(prima);

    // Con il permesso la regola punta al nuovo indirizzo, in un passo.
    expect((await send('PATCH', `/terms/${cat.id}`, { parentId: madre.id })).statusCode).toBe(200);
    expect(await rulesFrom(`/vecchio-t2g-${counter}/`)).toEqual([
      {
        targetPath: `${madre.path}${cat.slug}/`,
        statusCode: 301,
        origin: 'manual',
        isActive: true,
      },
    ]);
  });

  it('senza content.write: 403 e nulla cambia', async () => {
    const madre = await newCategory('Madre 5');
    const cat = await newCategory('Protetta');
    const risposta = await send('PATCH', `/terms/${cat.id}`, { parentId: madre.id }, sola);
    expect(risposta.statusCode).toBe(403);
    expect(await pathOf(cat.id)).toBe(cat.path);
  });

  it('lo slug resta fisso e la posizione non si invia', async () => {
    const cat = await newCategory('Slug fisso');
    expect((await send('PATCH', `/terms/${cat.id}`, { slug: 'altro' })).statusCode).toBe(400);
    expect((await send('PATCH', `/terms/${cat.id}`, { position: 3 })).statusCode).toBe(400);
  });
});

describe('SEO dell’archivio (DR-280 punto 3)', () => {
  it('senza sovrascrittura la lettura dà campi vuoti', async () => {
    const cat = await newCategory('SEO vuota');
    const risposta = await get(`/terms/${cat.id}/seo`);
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json()).toMatchObject({
      termId: cat.id,
      title: null,
      description: null,
      robotsNoindex: false,
      robotsNofollow: false,
    });
  });

  it('titolo, descrizione e robots si applicano all’archivio; la sitemap toglie il noindex', async () => {
    const cat = await newCategory('SEO piena');
    await send('PATCH', `/terms/${cat.id}`, { description: 'Descrizione della categoria.' });
    await send('PUT', `/contents/${await newPost()}/terms`, { termIds: [cat.id] });
    const inSitemap = async () =>
      ((await publicGet('/public/sitemap')).json().entries as { path: string }[]).some(
        (entry) => entry.path === cat.path,
      );
    expect(await inSitemap()).toBe(true);

    const risposta = await send('PUT', `/terms/${cat.id}/seo`, {
      title: 'Titolo SEO di {term_title}',
      description: 'Descrizione SEO sintetica.',
      robotsNoindex: true,
      robotsNofollow: true,
    });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json()).toMatchObject({ title: 'Titolo SEO di {term_title}' });

    const seo = (await publicGet(`/public/terms?path=${cat.path}`)).json().seo;
    expect(seo).toEqual({
      title: 'Titolo SEO di SEO piena',
      description: 'Descrizione SEO sintetica.',
      robots: 'noindex, nofollow, max-image-preview:large',
    });
    expect(await inSitemap()).toBe(false);

    const righe = await auditRows('term.seo.update', cat.id);
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({ entityType: 'term_seo', outcome: 'success' });
    expect((righe[0]?.detail as { fields?: string[] }).fields).toEqual([
      'Titolo SEO',
      'Descrizione',
      'Non indicizzare',
      'Non seguire i collegamenti',
    ]);
  });

  it('svuotata la descrizione SEO si torna alla descrizione della categoria', async () => {
    const cat = await newCategory('Ripiego');
    await send('PATCH', `/terms/${cat.id}`, { description: 'Descrizione propria.' });
    await send('PUT', `/terms/${cat.id}/seo`, { description: 'Sovrascritta.' });
    expect((await publicGet(`/public/terms?path=${cat.path}`)).json().seo.description).toBe(
      'Sovrascritta.',
    );
    await send('PUT', `/terms/${cat.id}/seo`, { description: null });
    expect((await publicGet(`/public/terms?path=${cat.path}`)).json().seo.description).toBe(
      'Descrizione propria.',
    );
  });

  it('serve content.write; una categoria inesistente è 404', async () => {
    const cat = await newCategory('SEO protetta');
    expect((await send('PUT', `/terms/${cat.id}/seo`, { title: 'X' }, sola)).statusCode).toBe(403);
    expect(
      (await send('PUT', '/terms/00000000-0000-4000-8000-000000000000/seo', { title: 'X' }))
        .statusCode,
    ).toBe(404);
  });
});

describe('eliminazione (DR-280 punto 4)', () => {
  it('con notizie è rifiutata con 409 TERM_HAS_CONTENTS spiegato, e l’anteprima lo dice', async () => {
    const cat = await newCategory('Con notizie');
    await send('PUT', `/contents/${await newPost()}/terms`, { termIds: [cat.id] });

    const anteprima = await get(`/terms/${cat.id}/deletion`);
    expect(anteprima.statusCode, anteprima.body).toBe(200);
    expect(anteprima.json()).toMatchObject({ blocked: true, contentCount: 1, children: [] });

    const risposta = await send('DELETE', `/terms/${cat.id}`);
    expect(risposta.statusCode, risposta.body).toBe(409);
    const errore = (risposta.json() as Err).error;
    expect(errore.code).toBe('TERM_HAS_CONTENTS');
    expect(errore.message).toContain('1 notizia');
    expect(await pathOf(cat.id)).toBe(cat.path);
  });

  it('con figlie è rifiutata con 409 TERM_HAS_CHILDREN, con i nomi', async () => {
    const cat = await newCategory('Con figlie');
    await newCategory('Figlia nominata', cat.id);
    const risposta = await send('DELETE', `/terms/${cat.id}`);
    expect(risposta.statusCode, risposta.body).toBe(409);
    const errore = (risposta.json() as Err).error;
    expect(errore.code).toBe('TERM_HAS_CHILDREN');
    expect(errore.message).toContain('«Figlia nominata»');
  });

  it('in un menu è rifiutata con 409 TERM_IN_MENU, con voce e menu', async () => {
    const cat = await newCategory('Nel menu');
    const [menu] = await harness.db
      .insert(schema.menus)
      .values({ key: `menu-t2g-${counter}`, label: 'Menu sintetico' })
      .returning({ id: schema.menus.id });
    await harness.db.insert(schema.menuItems).values({
      menuId: menu?.id ?? '',
      kind: 'term',
      label: 'Voce sintetica',
      termId: cat.id,
    });
    const anteprima = (await get(`/terms/${cat.id}/deletion`)).json();
    expect(anteprima.menuItems).toEqual([
      expect.objectContaining({ label: 'Voce sintetica', menu: 'Menu sintetico' }),
    ]);
    const risposta = await send('DELETE', `/terms/${cat.id}`);
    expect(risposta.statusCode, risposta.body).toBe(409);
    expect((risposta.json() as Err).error.code).toBe('TERM_IN_MENU');
  });

  it('libera: 204, l’archivio risponde 404, la SEO se ne va, i redirect verso restano', async () => {
    const cat = await newCategory('Da eliminare');
    await send('PUT', `/terms/${cat.id}/seo`, { title: 'Titolo' });
    await harness.db.insert(schema.redirects).values({
      sourcePath: `/verso-t2g-${counter}/`,
      targetPath: cat.path,
      origin: 'manual',
      kind: 'exact',
      statusCode: 301,
      isActive: true,
    });
    const anteprima = (await get(`/terms/${cat.id}/deletion`)).json();
    expect(anteprima).toMatchObject({
      blocked: false,
      redirectsToPath: [{ source: `/verso-t2g-${counter}/` }],
    });

    expect((await send('DELETE', `/terms/${cat.id}`, undefined, sola)).statusCode).toBe(403);
    const risposta = await send('DELETE', `/terms/${cat.id}`);
    expect(risposta.statusCode, risposta.body).toBe(204);
    expect((await publicGet(`/public/terms?path=${cat.path}`)).statusCode).toBe(404);
    expect(
      await harness.db.select().from(schema.termSeo).where(eq(schema.termSeo.termId, cat.id)),
    ).toEqual([]);
    expect(await rulesFrom(`/verso-t2g-${counter}/`)).toHaveLength(1);

    // Il rifiuto per permesso ha la sua riga: si guarda quella riuscita.
    const riga = (await auditRows('term.delete', cat.id)).find((r) => r.outcome === 'success');
    expect(riga?.detail).toMatchObject({ name: 'Da eliminare', path: cat.path });
  });
});

/*
 * Giro 1 della revisione: permessi come per i contenuti (DR-242, DR-246), corse
 * con il blocco dei percorsi, errori di chiave esterna tradotti, avvisi D132-A,
 * REDIRECT_CYCLE. Le corse sono deterministiche: un'altra transazione tiene la
 * riga o il blocco e la richiesta deve aspettarla (`inRace`).
 */
describe('giro 1: permessi di spostamento ed eliminazione (DR-242, DR-246)', () => {
  it('senza content.publish lo spostamento è 403 generico e nulla cambia', async () => {
    const madre = await newCategory('Madre senza pubblica');
    const cat = await newCategory('Ferma senza pubblica');
    const prima = await tables();
    const risposta = await send('PATCH', `/terms/${cat.id}`, { parentId: madre.id }, senzaPubblica);
    expect(risposta.statusCode, risposta.body).toBe(403);
    expect((risposta.json() as Err).error.message).toBe('Operazione non consentita.');
    expect(await tables()).toEqual(prima);
  });

  it('senza content.publish nome e descrizione si cambiano ancora', async () => {
    const cat = await newCategory('Nome senza pubblica');
    const risposta = await send(
      'PATCH',
      `/terms/${cat.id}`,
      { name: 'Nome cambiato', description: 'Testo' },
      senzaPubblica,
    );
    expect(risposta.statusCode, risposta.body).toBe(200);
  });

  it('senza content.publish l’eliminazione è 403 generico e la categoria resta', async () => {
    const cat = await newCategory('Resta senza pubblica');
    const risposta = await send('DELETE', `/terms/${cat.id}`, undefined, senzaPubblica);
    expect(risposta.statusCode, risposta.body).toBe(403);
    expect((risposta.json() as Err).error.message).toBe('Operazione non consentita.');
    expect(await pathOf(cat.id)).toBe(cat.path);
  });
});

describe('giro 1: corse e chiavi esterne', () => {
  it('la creazione aspetta uno spostamento in corso e legge la genitrice nuova', async () => {
    const madre = await newCategory('Madre in corsa');
    const altrove = `/category/altrove-${counter}/${madre.slug}/`;
    counter += 1;
    const slug = `figlia-corsa-${counter}`;
    const risposta = await inRace(
      harness,
      async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('contents.paths'))`);
        await tx.update(schema.terms).set({ path: altrove }).where(eq(schema.terms.id, madre.id));
      },
      () =>
        send('POST', '/terms', { taxonomy: 'category', slug, name: 'Figlia', parentId: madre.id }),
    );
    expect(risposta.statusCode, risposta.body).toBe(201);
    expect(risposta.json().path).toBe(`${altrove}${slug}/`);
  });

  it('la genitrice eliminata durante la creazione dà 400 TERM_PARENT_INVALID, non 500', async () => {
    const madre = await newCategory('Madre che sparisce');
    counter += 1;
    const risposta = await inRace(
      harness,
      async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('contents.paths'))`);
        await tx.delete(schema.terms).where(eq(schema.terms.id, madre.id));
      },
      () =>
        send('POST', '/terms', {
          taxonomy: 'category',
          slug: `orfana-${counter}`,
          name: 'Orfana',
          parentId: madre.id,
        }),
    );
    expect(risposta.statusCode, risposta.body).toBe(400);
    expect((risposta.json() as Err).error.code).toBe('TERM_PARENT_INVALID');
  });

  it('una figlia nata durante l’eliminazione (23503) dà 409 TERM_HAS_CHILDREN, non 500', async () => {
    const madre = await newCategory('Madre contesa');
    counter += 1;
    const risposta = await inRace(
      harness,
      (tx) =>
        tx.insert(schema.terms).values({
          taxonomy: 'category',
          slug: `figlia-contesa-${counter}`,
          name: 'Figlia contesa',
          parentId: madre.id,
          path: `${madre.path}figlia-contesa-${counter}/`,
        }),
      () => send('DELETE', `/terms/${madre.id}`),
    );
    expect(risposta.statusCode, risposta.body).toBe(409);
    expect((risposta.json() as Err).error.code).toBe('TERM_HAS_CHILDREN');
    expect(await pathOf(madre.id)).toBe(madre.path);
  });

  it('la SEO di una categoria eliminata nel frattempo dà 404, non 500', async () => {
    const cat = await newCategory('SEO contesa');
    const risposta = await inRace(
      harness,
      (tx) => tx.delete(schema.terms).where(eq(schema.terms.id, cat.id)),
      () => send('PUT', `/terms/${cat.id}/seo`, { title: 'Titolo' }),
    );
    expect(risposta.statusCode, risposta.body).toBe(404);
  });
});

describe('giro 1: avvisi D132-A e REDIRECT_CYCLE', () => {
  it('la risposta della PATCH segnala canonical e voci di menu scritti a mano verso il vecchio indirizzo', async () => {
    const madre = await newCategory('Madre avvisi');
    const cat = await newCategory('Con avvisi');
    const post = await newPost();
    await harness.db.insert(schema.contentSeo).values({ contentId: post, canonicalUrl: cat.path });
    const [menu] = await harness.db
      .insert(schema.menus)
      .values({ key: `menu-avvisi-${counter}`, label: 'Menu avvisi' })
      .returning({ id: schema.menus.id });
    const [voce] = await harness.db
      .insert(schema.menuItems)
      .values({ menuId: menu?.id ?? '', kind: 'custom', label: 'Voce', url: cat.path })
      .returning({ id: schema.menuItems.id });

    const risposta = await send('PATCH', `/terms/${cat.id}`, { parentId: madre.id });
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().warnings).toEqual([
      { kind: 'canonical', id: post, value: cat.path },
      { kind: 'menu', id: voce?.id, value: cat.path },
    ]);
    // Senza spostamento non ci sono avvisi.
    const nome = await send('PATCH', `/terms/${cat.id}`, { name: 'Altro nome' });
    expect(nome.json().warnings).toEqual([]);
  });

  it('una regola a prefisso sull’indirizzo d’arrivo farebbe una catena: 409 REDIRECT_CYCLE, nulla cambia', async () => {
    const madre = await newCategory('Madre prefisso');
    const cat = await newCategory('Verso il prefisso');
    await harness.db.insert(schema.redirects).values({
      sourcePath: madre.path,
      targetPath: '/altrove-prefisso/',
      origin: 'manual',
      kind: 'prefix',
      statusCode: 301,
      isActive: true,
    });
    const prima = await tables();
    const risposta = await send('PATCH', `/terms/${cat.id}`, { parentId: madre.id });
    expect(risposta.statusCode, risposta.body).toBe(409);
    expect((risposta.json() as Err).error.code).toBe('REDIRECT_CYCLE');
    expect(await tables()).toEqual(prima);
  });

  it('nome e spostamento vanno insieme: un rifiuto dello spostamento non salva il nome', async () => {
    const madre = await newCategory('Madre insieme');
    const cat = await newCategory('Insieme');
    const prima = await tables();
    const risposta = await send(
      'PATCH',
      `/terms/${cat.id}`,
      { name: 'Nome che non deve restare', parentId: madre.id },
      senzaPubblica,
    );
    expect(risposta.statusCode).toBe(403);
    expect(await tables()).toEqual(prima);
  });
});
