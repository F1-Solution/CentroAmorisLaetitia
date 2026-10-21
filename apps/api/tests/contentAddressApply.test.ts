import { schema } from '@amoris/db';
import { and, eq, or, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addressFixtures, createAddressBench, inRace } from './_support/contentAddress.js';
import {
  BOTH_EMAIL,
  signIn,
  TEST_FULL_NAME,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W3, T3: `PUT /contents/:id/address` applica il piano in una transazione,
 * e le correzioni di `PATCH` e `POST /contents` (W3-PLAN §5-§6). Gerarchie e regole
 * sintetiche, un prefisso diverso per prova; il piano in sola lettura sta in
 * `contentAddress.test.ts`.
 */

let harness: Harness;
let signed: Signed;
let homeId: string;

const { insertContent, tree, rule, tables, plan } = addressFixtures(() => harness);

beforeAll(async () => {
  ({ harness, signed, homeId } = await createAddressBench('api_content_address_apply'));
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const ABSENT = '00000000-0000-4000-8000-000000000000';

const putAddress = (id: string, payload: Record<string, unknown>, headers = signed.writeHeaders) =>
  harness.app.inject({ method: 'PUT', url: `/contents/${id}/address`, headers, payload });

const put = (id: string, slug: string, parentId: string | null, headers = signed.writeHeaders) =>
  putAddress(id, { slug, parentId }, headers);

const publicGet = (route: 'redirect' | 'content', path: string) =>
  harness.app.inject({ method: 'GET', url: `/public/${route}?path=${encodeURIComponent(path)}` });

const read = (url: string) =>
  harness.app.inject({ method: 'GET', url, headers: { cookie: signed.cookie } });

async function pathsOf(ids: readonly string[]): Promise<string[]> {
  const paths: string[] = [];
  for (const id of ids) {
    const [row] = await harness.db
      .select({ path: schema.contents.path })
      .from(schema.contents)
      .where(eq(schema.contents.id, id));
    paths.push(row?.path ?? '');
  }
  return paths;
}

/** Le regole che partono da `/<prefix>/…` o vi arrivano, in ordine di byte dell'origine. */
function rulesOf(prefix: string) {
  const r = schema.redirects;
  const under = `/${prefix}/`;
  return harness.db
    .select({
      source: r.sourcePath,
      target: r.targetPath,
      origin: r.origin,
      kind: r.kind,
      active: r.isActive,
      status: r.statusCode,
    })
    .from(r)
    .where(
      or(sql`starts_with(${r.sourcePath}, ${under})`, sql`starts_with(${r.targetPath}, ${under})`),
    )
    .orderBy(sql`${r.sourcePath} collate "C"`);
}

const auto = (source: string, target: string) => ({
  source,
  target,
  origin: 'automatic',
  kind: 'exact',
  active: true,
  status: 301,
});

/** Una home provvisoria per la durata della prova; poi torna quella del banco. */
async function withHome(id: string, run: () => Promise<void>): Promise<void> {
  const setHome = (value: string) =>
    harness.db
      .update(schema.settings)
      .set({ value })
      .where(eq(schema.settings.key, 'site.home_content_id'));
  await setHome(id);
  try {
    await run();
  } finally {
    await setHome(homeId);
  }
}

describe('PUT /contents/:id/address: applicazione (W3-2, W3-3)', () => {
  it('applica il piano dell’anteprima: percorsi, redirect 301 e sito pubblico', async () => {
    const t = await tree('applica');
    const anteprima = await plan(t.b, 'b2', t.a);
    const risposta = await put(t.b, 'b2', t.a);

    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().plan).toEqual(anteprima);
    expect(risposta.json().content).toMatchObject({
      id: t.b,
      slug: 'b2',
      parentId: t.a,
      path: '/applica/b2/',
      isHome: false,
    });
    expect(await pathsOf([t.b, t.c, t.d])).toEqual([
      '/applica/b2/',
      '/applica/b2/c/',
      '/applica/b2/d/',
    ]);
    expect(await rulesOf('applica')).toEqual([
      auto('/applica/b/', '/applica/b2/'),
      auto('/applica/b/c/', '/applica/b2/c/'),
    ]);

    const vecchio = await publicGet('redirect', '/applica/b/');
    expect(vecchio.statusCode).toBe(200);
    expect(vecchio.json()).toEqual({ targetPath: '/applica/b2/', statusCode: 301 });
    expect((await publicGet('content', '/applica/b2/c/')).statusCode).toBe(200);
    // D è in bozza: il vecchio indirizzo non aveva visitatori e non riceve un redirect.
    expect((await publicGet('redirect', '/applica/b/d/')).statusCode).toBe(404);
  });

  it('una notizia cambia slug: nuovo percorso e redirect dal vecchio', async () => {
    const notizia = await insertContent({
      slug: 'notizia-scritta',
      path: '/notizia-scritta/',
      type: 'post',
    });
    const risposta = await put(notizia, 'notizia-riscritta', null);

    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(await pathsOf([notizia])).toEqual(['/notizia-riscritta/']);
    expect((await publicGet('redirect', '/notizia-scritta/')).json()).toEqual({
      targetPath: '/notizia-riscritta/',
      statusCode: 301,
    });
  });

  it('con lo stesso indirizzo non scrive nulla', async () => {
    const t = await tree('fermo-scritto');
    const prima = await tables();
    const risposta = await put(t.b, 'b', t.a);

    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().plan.moves).toEqual([]);
    expect(await tables()).toEqual(prima);
  });

  it('A → B → A: resta una sola regola B → A, nessun ciclo (§6 caso 1)', async () => {
    const t = await tree('andata');
    expect((await put(t.b, 'b2', t.a)).statusCode).toBe(200);
    const ritorno = await put(t.b, 'b', t.a);

    expect(ritorno.statusCode, ritorno.body).toBe(200);
    expect(await rulesOf('andata')).toEqual([
      auto('/andata/b2/', '/andata/b/'),
      auto('/andata/b2/c/', '/andata/b/c/'),
    ]);
    // Il contenuto pubblicato è tornato al suo indirizzo, che non è rediretto.
    expect((await publicGet('redirect', '/andata/b/')).statusCode).toBe(404);
    expect((await publicGet('content', '/andata/b/c/')).statusCode).toBe(200);
  });

  it('genitore cambiato e poi ripristinato: nessuna regola resta verso il genitore provvisorio (§6 caso 1)', async () => {
    const t = await tree('ripristino');
    const altrove = await insertContent({
      slug: 'ripristino-altrove',
      path: '/ripristino-altrove/',
    });
    expect((await put(t.b, 'b', altrove)).statusCode).toBe(200);
    const ritorno = await put(t.b, 'b', t.a);

    expect(ritorno.statusCode, ritorno.body).toBe(200);
    expect(ritorno.json().content.parentId).toBe(t.a);
    expect(await pathsOf([t.b, t.c, t.d])).toEqual([
      '/ripristino/b/',
      '/ripristino/b/c/',
      '/ripristino/b/d/',
    ]);
    expect(await rulesOf('ripristino')).toEqual([
      auto('/ripristino-altrove/b/', '/ripristino/b/'),
      auto('/ripristino-altrove/b/c/', '/ripristino/b/c/'),
    ]);
  });

  it('A → B → C: la regola automatica A → B diventa A → C, nessuna catena', async () => {
    const t = await tree('tappe');
    expect((await put(t.b, 'b2', t.a)).statusCode).toBe(200);
    expect((await put(t.b, 'b3', t.a)).statusCode).toBe(200);

    expect(await rulesOf('tappe')).toEqual([
      auto('/tappe/b/', '/tappe/b3/'),
      auto('/tappe/b/c/', '/tappe/b3/c/'),
      auto('/tappe/b2/', '/tappe/b3/'),
      auto('/tappe/b2/c/', '/tappe/b3/c/'),
    ]);
    for (const vecchio of ['/tappe/b/', '/tappe/b2/']) {
      expect((await publicGet('redirect', vecchio)).json().targetPath, vecchio).toBe('/tappe/b3/');
    }
  });

  it('la home discendente del contenuto spostato: il suo vecchio percorso porta a «/» (S3)', async () => {
    const t = await tree('casa-figlia');
    await withHome(t.c, async () => {
      const risposta = await put(t.b, 'b2', t.a);

      expect(risposta.statusCode, risposta.body).toBe(200);
      expect(await rulesOf('casa-figlia')).toEqual([
        auto('/casa-figlia/b/', '/casa-figlia/b2/'),
        auto('/casa-figlia/b/c/', '/'),
      ]);
      for (const percorso of ['/casa-figlia/b/c/', '/casa-figlia/b2/c/']) {
        expect((await publicGet('redirect', percorso)).json(), percorso).toEqual({
          targetPath: '/',
          statusCode: 301,
        });
      }
    });
  });

  it('la regola nascosta in partenza porta al contenuto spostato; la catena si chiude in un passo (§6 caso 5)', async () => {
    const t = await tree('nascosta-scritta');
    await rule('/nascosta-scritta/b/', '/media/immagine-sintetica.png', { origin: 'migration' });
    await rule('/numero-scritto/', '/nascosta-scritta/b/', { origin: 'migration' });
    expect((await put(t.b, 'b2', t.a)).statusCode).toBe(200);

    for (const percorso of ['/nascosta-scritta/b/', '/numero-scritto/']) {
      expect((await publicGet('redirect', percorso)).json(), percorso).toEqual({
        targetPath: '/nascosta-scritta/b2/',
        statusCode: 301,
      });
    }
  });

  it('una regola disattivata sul vecchio indirizzo di un contenuto pubblicato si riscrive e si riattiva con 301', async () => {
    // Ruling del controller: fa da redirect automatico, perché l'origine di una regola è unica;
    // da D134-A (DR-238) ne prende anche l'origine.
    const t = await tree('partenza-spenta');
    await rule('/partenza-spenta/b/', '/altro-sintetico/', { isActive: false, statusCode: 302 });
    // Una regola disattivata che punta al vecchio indirizzo si riscrive ma resta disattivata (S4).
    await rule('/spenta-scritta/', '/partenza-spenta/b/c/', { isActive: false });
    const risposta = await put(t.b, 'b2', t.a);

    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().plan.redirectsCreated).toEqual([
      { from: '/partenza-spenta/b/c/', to: '/partenza-spenta/b2/c/' },
    ]);
    expect(await rulesOf('partenza-spenta')).toEqual([
      auto('/partenza-spenta/b/', '/partenza-spenta/b2/'),
      auto('/partenza-spenta/b/c/', '/partenza-spenta/b2/c/'),
      { ...auto('/spenta-scritta/', '/partenza-spenta/b2/c/'), origin: 'manual', active: false },
    ]);
  });

  it('il registro scrive content.address.update con l’id del contenuto e i soli conteggi', async () => {
    const t = await tree('registro-indirizzo');
    await rule('/scorciatoia-registro/', '/registro-indirizzo/b/c/');
    await rule('/registro-indirizzo/b2/', '/registro-indirizzo/b/', { origin: 'automatic' });
    expect((await put(t.b, 'b2', t.a)).statusCode).toBe(200);

    const righe = await harness.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.action, 'content.address.update'),
          eq(schema.auditLog.entityId, t.b),
        ),
      );
    expect(righe).toHaveLength(1);
    expect(righe[0]).toMatchObject({
      entityType: 'content',
      outcome: 'success',
      actorLabel: TEST_FULL_NAME,
    });
    // Nessun indirizzo nel dettaglio: i percorsi stanno in contenuti e regole.
    expect(righe[0]?.detail).toEqual({
      moved: 3,
      redirectsCreated: 2,
      redirectsRetargeted: 1,
      redirectsRemoved: 1,
      status: 200,
      method: 'PUT',
    });
  });

  it('un rifiuto lascia la riga di fallimento del registro, senza conteggi', async () => {
    const t = await tree('registro-rifiuto');
    expect((await put(t.b, 'feed', null)).statusCode).toBe(400);

    const [riga] = await harness.db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.action, 'content.address.update'),
          eq(schema.auditLog.entityId, t.b),
        ),
      );
    expect(riga).toMatchObject({ entityType: 'content', outcome: 'failure' });
    expect(riga?.detail).toEqual({ status: 400, method: 'PUT' });
  });

  it('«Ultima modifica» passa a chi ha cambiato l’indirizzo (W3-8, S5)', async () => {
    const t = await tree('ultima-indirizzo');
    const altra = await signIn(harness, { email: BOTH_EMAIL, area: 'redazione' });
    const risposta = await put(t.b, 'b2', t.a, altra.writeHeaders);

    expect(risposta.statusCode, risposta.body).toBe(200);
    const letta = await read(`/contents/${t.b}`);
    expect(letta.json().lastChange).toMatchObject({ actorLabel: 'Entrambi Sintetici' });
    expect(risposta.json().content.lastChange).toMatchObject({ actorLabel: 'Entrambi Sintetici' });
  });

  it('la copia di lavoro aperta prima del cambio d’indirizzo resta da riprendere (§6 caso 4)', async () => {
    const t = await tree('copia-indirizzo');
    const letto = (await read(`/contents/${t.b}`)).json();
    const copia = await harness.app.inject({
      method: 'PUT',
      url: `/contents/${t.b}/draft`,
      headers: signed.writeHeaders,
      payload: {
        title: 'Titolo non ancora salvato',
        excerpt: null,
        blocks: letto.blocks,
        baseUpdatedAt: letto.updatedAt,
      },
    });
    expect(copia.statusCode, copia.body).toBe(200);
    expect((await put(t.b, 'b2', t.a)).statusCode).toBe(200);

    expect((await read(`/contents/${t.b}/draft`)).json()).toMatchObject({
      title: 'Titolo non ancora salvato',
      stillCurrent: true,
    });
    expect((await read(`/contents/${t.b}`)).json()).toMatchObject({
      title: 'Titolo b',
      path: '/copia-indirizzo/b2/',
      updatedAt: letto.updatedAt,
    });
  });

  it('un contenuto inesistente risponde 404; in Impostazioni la rotta è respinta', async () => {
    expect((await put(ABSENT, 'nulla', null)).statusCode).toBe(404);
    // Una bozza sola, senza regole né discendenti pubblicate: il controllo dei permessi la lascerebbe passare.
    const sola = await insertContent({
      slug: 'scrittura-area',
      path: '/scrittura-area/',
      status: 'draft',
    });
    const impostazioni = await signIn(harness, { email: BOTH_EMAIL, area: 'impostazioni' });
    // L4: il gestore non deve girare, quindi nessuna riga cambia (S13).
    const prima = await tables();
    expect(
      (await put(sola, 'scrittura-area-due', null, impostazioni.writeHeaders)).statusCode,
    ).toBe(403);
    expect(await tables()).toEqual(prima);
    // Controprova: dall'area giusta la stessa mossa riesce, quindi il 403 viene solo dall'area.
    expect((await put(sola, 'scrittura-area-due', null)).statusCode).toBe(200);
  });

  it('senza il token anti-CSRF la scrittura è rifiutata come ogni altra (L4)', async () => {
    const t = await tree('scrittura-csrf');
    const prima = await tables();
    const risposta = await put(t.b, 'b2', t.a, { cookie: signed.cookie });

    expect(risposta.statusCode, risposta.body).toBe(403);
    expect(risposta.json().error.code).toBe('CSRF_TOKEN_INVALID');
    expect(await tables()).toEqual(prima);
  });
});

describe('regola nascosta riusata in partenza: diventa automatica (D134-A, DR-238)', () => {
  it.each([
    ['della migrazione', 'riuso-migrazione', { origin: 'migration' }],
    ['manuale', 'riuso-manuale', { origin: 'manual' }],
    ['disattivata', 'riuso-spenta', { origin: 'manual', isActive: false, statusCode: 302 }],
  ] as const)(
    'regola %s: A → B la rende automatica e attiva; B → A la toglie, senza cicli',
    async (_label, prefix, seed) => {
      const t = await tree(prefix);
      await rule(`/${prefix}/b/`, '/media/immagine-sintetica.png', seed);
      const andata = await put(t.b, 'b2', t.a);

      expect(andata.statusCode, andata.body).toBe(200);
      expect(await rulesOf(prefix)).toEqual([
        auto(`/${prefix}/b/`, `/${prefix}/b2/`),
        auto(`/${prefix}/b/c/`, `/${prefix}/b2/c/`),
      ]);

      const ritorno = await put(t.b, 'b', t.a);
      expect(ritorno.statusCode, ritorno.body).toBe(200);
      // Resta una sola regola per indirizzo, dal secondo al primo: nessuna A → B.
      expect(await rulesOf(prefix)).toEqual([
        auto(`/${prefix}/b2/`, `/${prefix}/b/`),
        auto(`/${prefix}/b2/c/`, `/${prefix}/b/c/`),
      ]);
      expect((await publicGet('redirect', `/${prefix}/b/`)).statusCode).toBe(404);
      expect((await publicGet('content', `/${prefix}/b/`)).statusCode).toBe(200);
    },
  );
});

describe('regola automatica in arrivo: si toglie solo per un contenuto pubblicato (D135-A, DR-239)', () => {
  const publish = (id: string) =>
    harness.app.inject({
      method: 'POST',
      url: `/contents/${id}/publish`,
      headers: signed.writeHeaders,
    });

  it('una bozza rinominata sul vecchio indirizzo di un’altra pagina lascia il redirect, che la pubblicazione copre', async () => {
    const corsi = await insertContent({ slug: 'corsi-sintetici', path: '/corsi-sintetici/' });
    expect((await put(corsi, 'corsi-sintetici-2024', null)).statusCode).toBe(200);
    const bozza = await insertContent({
      slug: 'corsi-sintetici-2025',
      path: '/corsi-sintetici-2025/',
      status: 'draft',
    });
    const risposta = await put(bozza, 'corsi-sintetici', null);

    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().plan.redirectsRemoved).toEqual([]);
    expect((await publicGet('redirect', '/corsi-sintetici/')).json()).toEqual({
      targetPath: '/corsi-sintetici-2024/',
      statusCode: 301,
    });
    // Pubblicata, la bozza vince sulla regola con lo stesso indirizzo (resolveRedirect).
    expect((await publish(bozza)).statusCode).toBe(200);
    expect((await publicGet('redirect', '/corsi-sintetici/')).statusCode).toBe(404);
    expect((await publicGet('content', '/corsi-sintetici/')).statusCode).toBe(200);
  });

  it('un contenuto pubblicato che arriva su quell’indirizzo toglie la regola', async () => {
    const corsi = await insertContent({ slug: 'corsi-bis', path: '/corsi-bis/' });
    expect((await put(corsi, 'corsi-bis-2024', null)).statusCode).toBe(200);
    const nuova = await insertContent({ slug: 'corsi-bis-2025', path: '/corsi-bis-2025/' });
    const risposta = await put(nuova, 'corsi-bis', null);

    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().plan.redirectsRemoved).toEqual([
      { source: '/corsi-bis/', target: '/corsi-bis-2024/' },
    ]);
    expect((await publicGet('redirect', '/corsi-bis/')).statusCode).toBe(404);
    expect((await publicGet('content', '/corsi-bis/')).statusCode).toBe(200);
  });

  it('una figlia in bozza che arriva su un indirizzo con regola automatica la lascia; una pubblicata no', async () => {
    const t = await tree('arrivo-bozza');
    await rule('/arrivo-bozza/b2/c/', '/altro-sintetico/', { origin: 'automatic' });
    await rule('/arrivo-bozza/b2/d/', '/altro-sintetico/', { origin: 'automatic' });
    const risposta = await put(t.b, 'b2', t.a);

    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().plan.redirectsRemoved).toEqual([
      { source: '/arrivo-bozza/b2/c/', target: '/altro-sintetico/' },
    ]);
    expect(await rulesOf('arrivo-bozza')).toEqual([
      auto('/arrivo-bozza/b/', '/arrivo-bozza/b2/'),
      auto('/arrivo-bozza/b/c/', '/arrivo-bozza/b2/c/'),
      auto('/arrivo-bozza/b2/d/', '/altro-sintetico/'),
    ]);
  });

  it('una bozza che torna su una regola automatica verso il proprio vecchio indirizzo: riesce, la regola resta com’è', async () => {
    const t = await tree('ritorno-bozza', 'draft');
    await rule('/ritorno-bozza/b2/', '/ritorno-bozza/b/', { origin: 'automatic' });
    const risposta = await put(t.b, 'b2', t.a);

    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(await rulesOf('ritorno-bozza')).toEqual([
      auto('/ritorno-bozza/b/c/', '/ritorno-bozza/b2/c/'),
      auto('/ritorno-bozza/b2/', '/ritorno-bozza/b/'),
    ]);
  });

  it('una regola verso il vecchio indirizzo della bozza che finirebbe sulla regola rimasta → REDIRECT_CYCLE, con un messaggio chiaro', async () => {
    // Ruling del controller: oggi quella regola porta già a un 404 (la bozza non si vede).
    const corsi = await insertContent({ slug: 'corsi-limite', path: '/corsi-limite/' });
    expect((await put(corsi, 'corsi-limite-2024', null)).statusCode).toBe(200);
    const bozza = await insertContent({
      slug: 'corsi-limite-2025',
      path: '/corsi-limite-2025/',
      status: 'draft',
    });
    await rule('/vecchio-link-limite/', '/corsi-limite-2025/');
    const prima = await tables();
    const risposta = await put(bozza, 'corsi-limite', null);

    expect(risposta.statusCode, risposta.body).toBe(409);
    expect(risposta.json().error).toMatchObject({
      code: 'REDIRECT_CYCLE',
      message:
        'Il redirect da /vecchio-link-limite/ verso /corsi-limite/ porterebbe a un altro redirect, da /corsi-limite/ verso /corsi-limite-2024/: lo spostamento è stato annullato. Togli o cambia uno dei due dalla pagina dei redirect, poi riprova.',
    });
    expect(await tables()).toEqual(prima);
  });
});

describe('PUT …/address: ogni rifiuto lascia contenuti e regole com’erano (W3-4)', () => {
  it('collisione, genitore non valido, slug riservato o malformato, regole in arrivo e in partenza', async () => {
    const t = await tree('rifiuti-scritti');
    const p = await tree('rifiuti-prefisso');
    const notizia = await insertContent({
      slug: 'notizia-rifiuti',
      path: '/notizia-rifiuti/',
      type: 'post',
    });
    await insertContent({ slug: 'c', path: '/rifiuti-scritti/b2/c/', type: 'post' });
    await rule('/rifiuti-scritti/b3/', '/da-qualche-parte/');
    await rule('/rifiuti-prefisso/b/c/', '/altro-sintetico/', { kind: 'prefix' });
    const prima = await tables();

    const casi = [
      [t.b, { slug: 'b2', parentId: t.a }, 409, 'CONTENT_PATH_TAKEN', '/rifiuti-scritti/b2/c/'],
      [t.b, { slug: 'b3', parentId: t.a }, 409, 'REDIRECT_AT_DESTINATION', '/rifiuti-scritti/b3/'],
      [
        p.b,
        { slug: 'b2', parentId: p.a },
        409,
        'REDIRECT_AT_DESTINATION',
        '/rifiuti-prefisso/b/c/',
      ],
      [t.b, { slug: 'b4', parentId: t.c }, 400, 'CONTENT_PARENT_INVALID', null],
      [t.b, { slug: 'b4', parentId: t.b }, 400, 'CONTENT_PARENT_INVALID', null],
      [t.b, { slug: 'b4', parentId: notizia }, 400, 'CONTENT_PARENT_INVALID', null],
      [t.b, { slug: 'b4', parentId: ABSENT }, 400, 'CONTENT_PARENT_INVALID', null],
      [notizia, { slug: 'notizia-rifiuti', parentId: t.a }, 400, 'CONTENT_PARENT_INVALID', null],
      [t.b, { slug: 'feed', parentId: null }, 400, 'CONTENT_SLUG_RESERVED', '/feed/'],
      [t.b, { slug: 'Non Valido', parentId: t.a }, 400, 'VALIDATION_FAILED', null],
      [t.b, { slug: 'b4' }, 400, 'VALIDATION_FAILED', null],
    ] as const;
    for (const [id, payload, status, code, address] of casi) {
      const risposta = await putAddress(id, payload);
      const caso = JSON.stringify(payload);
      expect(risposta.statusCode, caso).toBe(status);
      expect(risposta.json().error.code, caso).toBe(code);
      if (address) expect(risposta.json().error.message, caso).toContain(address);
      expect(await tables(), caso).toEqual(prima);
    }
  });
});

describe('controllo finale nella transazione: catene e cicli (W3-3)', () => {
  it('una regola riscritta verso un indirizzo coperto da un prefisso farebbe una catena → REDIRECT_CYCLE', async () => {
    // Preparata ad arte: la bozza va sotto l'origine di una regola a prefisso. Il piano non
    // lo vede, ma `/scorciatoia-catena/` porterebbe a un indirizzo che è a sua volta rediretto.
    const sopra = await insertContent({ slug: 'sotto-prefisso', path: '/sotto-prefisso/' });
    const bozza = await insertContent({
      slug: 'bozza-catena',
      path: '/bozza-catena/',
      status: 'draft',
    });
    await rule('/sotto-prefisso/', '/destinazione-prefisso/', { kind: 'prefix' });
    await rule('/scorciatoia-catena/', '/bozza-catena/');
    expect((await plan(bozza, 'bozza-catena', sopra))?.redirectsRetargeted).toEqual([
      {
        source: '/scorciatoia-catena/',
        from: '/bozza-catena/',
        to: '/sotto-prefisso/bozza-catena/',
        origin: 'manual',
      },
    ]);
    const prima = await tables();
    const risposta = await put(bozza, 'bozza-catena', sopra);

    expect(risposta.statusCode, risposta.body).toBe(409);
    expect(risposta.json().error).toMatchObject({
      code: 'REDIRECT_CYCLE',
      message: expect.stringContaining('/scorciatoia-catena/'),
    });
    expect(await tables()).toEqual(prima);
  });

  it('una regola che tornerebbe su sé stessa → REDIRECT_CYCLE, non il vincolo del database', async () => {
    // Dato patologico: una regola su «/» verso il percorso della home, che riscritta sarebbe «/» → «/».
    const casa = await insertContent({ slug: 'casa-anello', path: '/casa-anello/' });
    await withHome(casa, async () => {
      await rule('/', '/casa-anello/');
      try {
        const prima = await tables();
        const risposta = await put(casa, 'casa-anello-due', null);

        expect(risposta.statusCode, risposta.body).toBe(409);
        expect(risposta.json().error.code).toBe('REDIRECT_CYCLE');
        expect(await tables()).toEqual(prima);
      } finally {
        await harness.db.delete(schema.redirects).where(eq(schema.redirects.sourcePath, '/'));
      }
    });
  });
});

describe('collisioni nate durante lo spostamento (23505 → 409)', () => {
  it('un contenuto nato sull’indirizzo d’arrivo → 409 CONTENT_PATH_TAKEN, nulla scritto', async () => {
    const t = await tree('corsa');
    const prima = await tables();
    const risposta = await inRace(
      harness,
      (tx) =>
        tx.insert(schema.contents).values({
          type: 'post',
          slug: 'b2',
          path: '/corsa/b2/',
          title: 'Titolo concorrente',
        }),
      () => put(t.b, 'b2', t.a),
    );

    expect(risposta.statusCode, risposta.body).toBe(409);
    expect(risposta.json().error).toMatchObject({
      code: 'CONTENT_PATH_TAKEN',
      message: expect.stringContaining('/corsa/b2/'),
    });
    const dopo = await tables();
    expect(dopo.contents.filter((row) => row.title !== 'Titolo concorrente')).toEqual(
      prima.contents,
    );
    expect(dopo.redirects).toEqual(prima.redirects);
  });

  it('una regola nata sul vecchio indirizzo → 409 REDIRECT_AT_DESTINATION, nulla scritto', async () => {
    const t = await tree('corsa-regola');
    const prima = await tables();
    const risposta = await inRace(
      harness,
      (tx) =>
        tx
          .insert(schema.redirects)
          .values({ sourcePath: '/corsa-regola/b/', targetPath: '/altro-sintetico/' }),
      () => put(t.b, 'b2', t.a),
    );

    expect(risposta.statusCode, risposta.body).toBe(409);
    expect(risposta.json().error).toMatchObject({
      code: 'REDIRECT_AT_DESTINATION',
      message: expect.stringContaining('/corsa-regola/b/'),
    });
    const dopo = await tables();
    expect(dopo.contents).toEqual(prima.contents);
    expect(dopo.redirects.filter((row) => row.sourcePath !== '/corsa-regola/b/')).toEqual(
      prima.redirects,
    );
  });

  it('la pagina genitore eliminata fra il piano e la scrittura → 400 CONTENT_PARENT_INVALID, nulla scritto (m-5)', async () => {
    const t = await tree('genitore-sparito');
    const altrove = await insertContent({ slug: 'sparito-altrove', path: '/sparito-altrove/' });
    const prima = await tables();
    // Il piano vede ancora il genitore; la scrittura di `parent_id` aspetta l'eliminazione.
    const risposta = await inRace(
      harness,
      (tx) => tx.delete(schema.contents).where(eq(schema.contents.id, altrove)),
      () => put(t.b, 'b', altrove),
    );

    expect(risposta.statusCode, risposta.body).toBe(400);
    expect(risposta.json().error.code).toBe('CONTENT_PARENT_INVALID');
    const dopo = await tables();
    expect(dopo.contents).toEqual(prima.contents.filter((row) => row.id !== altrove));
    expect(dopo.redirects).toEqual(prima.redirects);
  });
});

describe('PATCH /contents/:id non cambia più l’indirizzo (W3-5)', () => {
  it('slug o parentId nel corpo → 400, e il contenuto resta com’era', async () => {
    const t = await tree('patch-indirizzo');
    const altrove = await insertContent({ slug: 'patch-altrove', path: '/patch-altrove/' });
    const prima = await tables();

    for (const payload of [
      { slug: 'b2' },
      { parentId: altrove },
      { parentId: null },
      { title: 'Titolo nuovo', slug: 'b2' },
    ]) {
      const risposta = await harness.app.inject({
        method: 'PATCH',
        url: `/contents/${t.b}`,
        headers: signed.writeHeaders,
        payload,
      });
      expect(risposta.statusCode, JSON.stringify(payload)).toBe(400);
      expect(risposta.json().error.code).toBe('VALIDATION_FAILED');
    }
    expect(await tables()).toEqual(prima);
  });
});

describe('POST /contents (W3-5, D133-A)', () => {
  const post = (payload: Record<string, unknown>) =>
    harness.app.inject({ method: 'POST', url: '/contents', headers: signed.writeHeaders, payload });

  it('rifiuta il genitore di una notizia, un genitore inesistente o non pagina, uno slug riservato, un percorso occupato', async () => {
    const t = await tree('crea');
    const notizia = await insertContent({
      slug: 'notizia-crea',
      path: '/notizia-crea/',
      type: 'post',
    });
    const prima = await tables();

    const casi = [
      [
        { type: 'post', slug: 'notizia-figlia', parentId: t.a },
        400,
        'CONTENT_PARENT_INVALID',
        null,
      ],
      [{ type: 'page', slug: 'orfana', parentId: ABSENT }, 400, 'CONTENT_PARENT_INVALID', null],
      [
        { type: 'page', slug: 'sotto-notizia', parentId: notizia },
        400,
        'CONTENT_PARENT_INVALID',
        null,
      ],
      [{ type: 'page', slug: 'media' }, 400, 'CONTENT_SLUG_RESERVED', '/media/'],
      [{ type: 'post', slug: 'crea' }, 409, 'CONTENT_PATH_TAKEN', '/crea/'],
      [{ type: 'page', slug: 'b', parentId: t.a }, 409, 'CONTENT_PATH_TAKEN', '/crea/b/'],
    ] as const;
    for (const [payload, status, code, address] of casi) {
      const risposta = await post({ ...payload, title: 'Titolo sintetico' });
      const caso = JSON.stringify(payload);
      expect(risposta.statusCode, caso).toBe(status);
      expect(risposta.json().error.code, caso).toBe(code);
      if (address) expect(risposta.json().error.message, caso).toContain(address);
    }
    expect(await tables()).toEqual(prima);
  });

  it('una pagina sotto un genitore prende il suo percorso; «media» sotto una pagina è ammesso', async () => {
    const t = await tree('crea-ammessa');
    const risposta = await post({ type: 'page', slug: 'media', title: 'Titolo', parentId: t.a });

    expect(risposta.statusCode, risposta.body).toBe(201);
    expect(risposta.json()).toMatchObject({ path: '/crea-ammessa/media/', parentId: t.a });
  });
});
