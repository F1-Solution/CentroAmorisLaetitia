import { schema } from '@amoris/db';
import { count } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  parentOptions,
  planAddressChange,
  RESERVED_SLUGS,
} from '../src/modules/content/address.js';
import { addressFixtures, createAddressBench } from './_support/contentAddress.js';
import { BOTH_EMAIL, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Wave 1G-W3, T2: piano del cambio d'indirizzo, opzioni del genitore e anteprima,
 * tutti in sola lettura (W3-PLAN §5-§6). Ogni prova costruisce la propria
 * gerarchia sintetica a tre livelli con un prefisso diverso, così che le regole
 * create da una prova non tocchino il piano di un'altra. Dati sintetici.
 * L'applicazione in transazione sta in `contentAddressApply.test.ts`.
 */

let harness: Harness;
let signed: Signed;
let homeId: string;

const { insertContent, tree, rule, tables, plan } = addressFixtures(() => harness);

const moveOf = (id: string, from: string, to: string, published: boolean, slug: string) => ({
  id,
  title: `Titolo ${slug}`,
  from,
  to,
  published,
});

beforeAll(async () => {
  ({ harness, signed, homeId } = await createAddressBench('api_content_address'));
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

describe('planAddressChange: percorsi nuovi e redirect (W3-2, S1)', () => {
  it('cambiando lo slug di B si spostano B, C e D; i redirect nascono solo per B e C', async () => {
    const t = await tree('pianta-uno');
    const piano = await plan(t.b, 'b2', t.a);

    expect(piano?.path).toBe('/pianta-uno/b2/');
    expect(piano?.moves).toEqual([
      moveOf(t.b, '/pianta-uno/b/', '/pianta-uno/b2/', true, 'b'),
      moveOf(t.c, '/pianta-uno/b/c/', '/pianta-uno/b2/c/', true, 'c'),
      moveOf(t.d, '/pianta-uno/b/d/', '/pianta-uno/b2/d/', false, 'd'),
    ]);
    // D è in bozza: un indirizzo mai servito non ha visitatori da portare altrove.
    expect(piano?.redirectsCreated).toEqual([
      { from: '/pianta-uno/b/', to: '/pianta-uno/b2/' },
      { from: '/pianta-uno/b/c/', to: '/pianta-uno/b2/c/' },
    ]);
    expect(piano?.redirectsRetargeted).toEqual([]);
    expect(piano?.redirectsRemoved).toEqual([]);
    expect(piano?.warnings).toEqual([]);
  });

  it('cambiando il genitore di B, B e le figlie passano sotto il nuovo genitore', async () => {
    const t = await tree('pianta-due');
    const altrove = await insertContent({ slug: 'altrove-due', path: '/altrove-due/' });
    const piano = await plan(t.b, 'b', altrove);

    expect(piano?.path).toBe('/altrove-due/b/');
    expect(piano?.moves.map((move) => move.to)).toEqual([
      '/altrove-due/b/',
      '/altrove-due/b/c/',
      '/altrove-due/b/d/',
    ]);
    expect(piano?.redirectsCreated).toEqual([
      { from: '/pianta-due/b/', to: '/altrove-due/b/' },
      { from: '/pianta-due/b/c/', to: '/altrove-due/b/c/' },
    ]);
  });

  it('con B in bozza nasce il redirect solo per la figlia pubblicata C (§6 caso 3)', async () => {
    const t = await tree('pianta-bozza', 'draft');
    const piano = await plan(t.b, 'b2', t.a);

    expect(piano?.moves.map((move) => [move.from, move.published])).toEqual([
      ['/pianta-bozza/b/', false],
      ['/pianta-bozza/b/c/', true],
      ['/pianta-bozza/b/d/', false],
    ]);
    expect(piano?.redirectsCreated).toEqual([
      { from: '/pianta-bozza/b/c/', to: '/pianta-bozza/b2/c/' },
    ]);
  });

  it('una notizia cambia slug restando senza genitore', async () => {
    const notizia = await insertContent({
      slug: 'notizia-sintetica',
      path: '/notizia-sintetica/',
      type: 'post',
    });
    const piano = await plan(notizia, 'notizia-rinominata', null);

    expect(piano?.path).toBe('/notizia-rinominata/');
    expect(piano?.redirectsCreated).toEqual([
      { from: '/notizia-sintetica/', to: '/notizia-rinominata/' },
    ]);
  });

  it('con lo stesso slug e lo stesso genitore il piano non sposta nulla', async () => {
    const t = await tree('pianta-ferma');
    const piano = await plan(t.b, 'b', t.a);

    expect(piano).toEqual({
      path: '/pianta-ferma/b/',
      moves: [],
      redirectsCreated: [],
      redirectsRetargeted: [],
      redirectsRemoved: [],
      warnings: [],
    });
  });

  it('per la home redirect e riscritture portano a «/» (S3)', async () => {
    await rule('/vecchia-casa/', '/casa-sintetica/');
    const piano = await plan(homeId, 'casa-rinominata', null);

    expect(piano?.path).toBe('/casa-rinominata/');
    expect(piano?.moves.map((move) => move.to)).toEqual(['/casa-rinominata/']);
    // Il percorso della home risponde già 301 verso «/»: puntare al nuovo percorso sarebbe una catena.
    expect(piano?.redirectsCreated).toEqual([{ from: '/casa-sintetica/', to: '/' }]);
    expect(piano?.redirectsRetargeted).toEqual([
      { source: '/vecchia-casa/', from: '/casa-sintetica/', to: '/', origin: 'manual' },
    ]);
  });

  it('un contenuto inesistente non ha piano', async () => {
    expect(await plan('00000000-0000-4000-8000-000000000000', 'nulla', null)).toBeNull();
  });

  it('si può calcolare dentro una transazione, come farà la scrittura', async () => {
    const t = await tree('pianta-transazione');
    const piano = await harness.db.transaction((tx) =>
      planAddressChange(tx, t.b, { slug: 'b2', parentId: t.a }),
    );
    expect(piano?.path).toBe('/pianta-transazione/b2/');
  });
});

describe('regole che puntano ai vecchi indirizzi (D130-A, S4)', () => {
  it('una regola manuale verso il vecchio percorso di C punta al nuovo', async () => {
    const t = await tree('riscrivi-uno');
    await rule('/scorciatoia-uno/', '/riscrivi-uno/b/c/');
    await rule('/storico-uno/', '/riscrivi-uno/b/', { origin: 'migration' });
    const piano = await plan(t.b, 'b2', t.a);

    expect(piano?.redirectsRetargeted).toEqual([
      {
        source: '/scorciatoia-uno/',
        from: '/riscrivi-uno/b/c/',
        to: '/riscrivi-uno/b2/c/',
        origin: 'manual',
      },
      {
        source: '/storico-uno/',
        from: '/riscrivi-uno/b/',
        to: '/riscrivi-uno/b2/',
        origin: 'migration',
      },
    ]);
  });

  it('le regole esatte disattivate si riscrivono, quelle a prefisso e verso altri indirizzi no', async () => {
    const t = await tree('riscrivi-due');
    await rule('/spenta-due/', '/riscrivi-due/b/c/', { isActive: false });
    await rule('/prefisso-due/', '/riscrivi-due/b/c/', { kind: 'prefix' });
    await rule('/esterna-due/', 'https://esempio.invalid/riscrivi-due/b/c/');
    const piano = await plan(t.b, 'b2', t.a);

    // Una riattivazione della regola spenta non deve creare una catena.
    expect(piano?.redirectsRetargeted).toEqual([
      {
        source: '/spenta-due/',
        from: '/riscrivi-due/b/c/',
        to: '/riscrivi-due/b2/c/',
        origin: 'manual',
      },
    ]);
  });
});

describe('regole sugli indirizzi coinvolti (D131-A)', () => {
  it('la regola nascosta in partenza prende come destinazione il nuovo indirizzo (§6 caso 5)', async () => {
    // Come `/pronti-a-ripartire/`: la regola sul percorso di B è nascosta da B pubblicata,
    // e una seconda regola della migrazione punta a quel percorso.
    const t = await tree('nascosta');
    await rule('/nascosta/b/', '/media/immagine-sintetica.png', { origin: 'migration' });
    await rule('/numero-sintetico/', '/nascosta/b/', { origin: 'migration' });
    const piano = await plan(t.b, 'b2', t.a);

    expect(piano?.redirectsRetargeted).toEqual([
      {
        source: '/nascosta/b/',
        from: '/media/immagine-sintetica.png',
        to: '/nascosta/b2/',
        origin: 'migration',
      },
      {
        source: '/numero-sintetico/',
        from: '/nascosta/b/',
        to: '/nascosta/b2/',
        origin: 'migration',
      },
    ]);
    // La regola esistente si riusa: l'origine di una regola è unica.
    expect(piano?.redirectsCreated).toEqual([{ from: '/nascosta/b/c/', to: '/nascosta/b2/c/' }]);
  });

  it('con il contenuto in bozza la regola in partenza resta com’è: era già lei a rispondere', async () => {
    const t = await tree('nascosta-bozza', 'draft');
    await rule('/nascosta-bozza/b/', '/altro-sintetico/');
    const piano = await plan(t.b, 'b2', t.a);

    expect(piano?.redirectsRetargeted).toEqual([]);
    expect(piano?.redirectsCreated).toEqual([
      { from: '/nascosta-bozza/b/c/', to: '/nascosta-bozza/b2/c/' },
    ]);
  });

  it('una regola automatica in arrivo si toglie: A → B → A non lascia cicli (§6 caso 1)', async () => {
    // Stato dopo un primo spostamento da `b0` a `b`: le regole automatiche b0 → b.
    const t = await tree('ritorno');
    await rule('/ritorno/b0/', '/ritorno/b/', { origin: 'automatic' });
    await rule('/ritorno/b0/c/', '/ritorno/b/c/', { origin: 'automatic' });
    const piano = await plan(t.b, 'b0', t.a);

    expect(piano?.redirectsRemoved).toEqual([
      { source: '/ritorno/b0/', target: '/ritorno/b/' },
      { source: '/ritorno/b0/c/', target: '/ritorno/b/c/' },
    ]);
    expect(piano?.redirectsCreated).toEqual([
      { from: '/ritorno/b/', to: '/ritorno/b0/' },
      { from: '/ritorno/b/c/', to: '/ritorno/b0/c/' },
    ]);
    // Le regole tolte puntano al vecchio indirizzo, ma riscriverle le farebbe tornare su sé stesse.
    expect(piano?.redirectsRetargeted).toEqual([]);
  });

  it('una regola automatica in arrivo di un contenuto in bozza resta com’è, anche verso il suo vecchio indirizzo (D135-A)', async () => {
    const t = await tree('arrivo-bozza-piano', 'draft');
    await rule('/arrivo-bozza-piano/b2/', '/arrivo-bozza-piano/b/', { origin: 'automatic' });
    const piano = await plan(t.b, 'b2', t.a);

    expect(piano?.redirectsRemoved).toEqual([]);
    // Riscritta tornerebbe su sé stessa: resta, e alla pubblicazione il contenuto la copre.
    expect(piano?.redirectsRetargeted).toEqual([]);
    expect(piano?.redirectsCreated).toEqual([
      { from: '/arrivo-bozza-piano/b/c/', to: '/arrivo-bozza-piano/b2/c/' },
    ]);
  });

  it('una regola manuale in arrivo fa rifiutare lo spostamento, citandola', async () => {
    const t = await tree('arrivo');
    await rule('/arrivo/b2/', '/da-qualche-parte/');
    await expect(plan(t.b, 'b2', t.a)).rejects.toMatchObject({
      statusCode: 409,
      code: 'REDIRECT_AT_DESTINATION',
      message: expect.stringContaining('/arrivo/b2/'),
    });
  });

  it('anche una regola della migrazione, disattivata, sull’arrivo di una figlia', async () => {
    const t = await tree('arrivo-figlia');
    await rule('/arrivo-figlia/b2/c/', '/da-qualche-parte/', {
      origin: 'migration',
      isActive: false,
    });
    await expect(plan(t.b, 'b2', t.a)).rejects.toMatchObject({
      statusCode: 409,
      code: 'REDIRECT_AT_DESTINATION',
      message: expect.stringContaining('/arrivo-figlia/b2/c/'),
    });
  });

  it('una regola a prefisso sul vecchio indirizzo di un contenuto pubblicato fa rifiutare', async () => {
    // Il redirect automatico non può nascere (origine unica) e una regola a prefisso non si riscrive (S4).
    const t = await tree('partenza-prefisso');
    await rule('/partenza-prefisso/b/c/', '/altro-sintetico/', { kind: 'prefix' });
    await expect(plan(t.b, 'b2', t.a)).rejects.toMatchObject({
      statusCode: 409,
      code: 'REDIRECT_AT_DESTINATION',
      message: expect.stringContaining('/partenza-prefisso/b/c/'),
    });
  });
});

describe('rifiuti senza scritture (W3-4)', () => {
  it('collisione su una figlia, non sul contenuto spostato → CONTENT_PATH_TAKEN', async () => {
    const t = await tree('collisione');
    // Una notizia con un percorso annidato e senza genitore: la forma che `POST /contents` produceva.
    await insertContent({ slug: 'c', path: '/collisione/b2/c/', type: 'post' });
    await expect(plan(t.b, 'b2', t.a)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONTENT_PATH_TAKEN',
      message: expect.stringContaining('/collisione/b2/c/'),
    });
  });

  it('collisione sul contenuto stesso → CONTENT_PATH_TAKEN', async () => {
    const t = await tree('collisione-due');
    await expect(plan(t.c, 'd', t.b)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONTENT_PATH_TAKEN',
      message: expect.stringContaining('/collisione-due/b/d/'),
    });
  });

  it('genitore uguale a sé, a una discendente, a una notizia o inesistente → CONTENT_PARENT_INVALID', async () => {
    const t = await tree('genitore');
    const notizia = await insertContent({
      slug: 'notizia-genitore',
      path: '/notizia-genitore/',
      type: 'post',
    });
    for (const parentId of [t.b, t.c, notizia, '00000000-0000-4000-8000-000000000000']) {
      await expect(plan(t.b, 'b2', parentId), parentId).rejects.toMatchObject({
        statusCode: 400,
        code: 'CONTENT_PARENT_INVALID',
      });
    }
  });

  it('una notizia non riceve un genitore → CONTENT_PARENT_INVALID', async () => {
    const t = await tree('genitore-notizia');
    const notizia = await insertContent({
      slug: 'notizia-orfana',
      path: '/notizia-orfana/',
      type: 'post',
    });
    await expect(plan(notizia, 'notizia-orfana', t.a)).rejects.toMatchObject({
      statusCode: 400,
      code: 'CONTENT_PARENT_INVALID',
    });
  });

  it('`media` al primo livello → CONTENT_SLUG_RESERVED; sotto A è ammesso (D133-A)', async () => {
    const t = await tree('riservati');
    await expect(plan(t.b, 'media', null)).rejects.toMatchObject({
      statusCode: 400,
      code: 'CONTENT_SLUG_RESERVED',
      message: expect.stringContaining('/media/'),
    });
    expect((await plan(t.b, 'media', t.a))?.path).toBe('/riservati/media/');
  });

  it('gli slug riservati sono quelli di D133, alla lettera', () => {
    expect([...RESERVED_SLUGS]).toEqual([
      'category',
      'download',
      'download-category',
      'media',
      'forms',
      'feed',
      'wp-content',
      'page',
      'fonts',
      'admin',
      'api',
      '_next',
      'wp-sitemap.xml',
      'sitemap.xml',
      'robots.txt',
      'favicon.ico',
      'anteprima',
    ]);
  });
});

describe('riferimenti scritti a mano (D132-A)', () => {
  it('canonical e voce di menu personalizzata uguali a un vecchio percorso → warnings', async () => {
    const t = await tree('avvisi');
    await harness.db
      .insert(schema.contentSeo)
      .values({ contentId: t.c, canonicalUrl: '/avvisi/b/c/' });
    const [menu] = await harness.db
      .insert(schema.menus)
      .values({ key: 'menu-avvisi', label: 'Menu sintetico' })
      .returning({ id: schema.menus.id });
    const voci = await harness.db
      .insert(schema.menuItems)
      .values([
        { menuId: menu?.id ?? '', kind: 'custom', url: '/avvisi/b/', label: 'Voce scritta' },
        { menuId: menu?.id ?? '', kind: 'content', contentId: t.b, label: 'Voce collegata' },
        { menuId: menu?.id ?? '', kind: 'custom', url: '/altro-sintetico/', label: 'Altra' },
      ])
      .returning({ id: schema.menuItems.id });
    const piano = await plan(t.b, 'b2', t.a);

    // La voce di tipo contenuto segue lo spostamento da sola: non si segnala.
    expect(piano?.warnings).toEqual([
      { kind: 'canonical', id: t.c, value: '/avvisi/b/c/' },
      { kind: 'menu', id: voci[0]?.id, value: '/avvisi/b/' },
    ]);
  });
});

describe('parentOptions', () => {
  it('esclude il contenuto, le sue discendenti e le notizie; ordina per percorso', async () => {
    const t = await tree('opzioni');
    const notizia = await insertContent({
      slug: 'notizia-opzioni',
      path: '/notizia-opzioni/',
      type: 'post',
    });
    // Uno slug con una lettera accentata codificata: la collazione italiana lo metterebbe dopo `/opzioni/`.
    await insertContent({ slug: 'opzioni%c3%a0', path: '/opzioni%c3%a0/' });
    const opzioni = (await parentOptions(harness.db, t.b)) ?? [];
    const ids = opzioni.map((option) => option.id);

    expect(ids).toContain(t.a);
    expect(ids).toContain(homeId);
    for (const escluso of [t.b, t.c, t.d, notizia]) expect(ids).not.toContain(escluso);
    expect(opzioni.find((option) => option.id === t.a)).toEqual({
      id: t.a,
      title: 'Titolo opzioni',
      path: '/opzioni/',
    });
    const percorsi = opzioni.map((option) => option.path);
    expect(percorsi).toEqual([...percorsi].sort());
  });

  it('una notizia non ha genitori possibili', async () => {
    const notizia = await insertContent({
      slug: 'notizia-senza-opzioni',
      path: '/notizia-senza-opzioni/',
      type: 'post',
    });
    expect(await parentOptions(harness.db, notizia)).toEqual([]);
  });

  it('un contenuto inesistente non ha opzioni', async () => {
    expect(await parentOptions(harness.db, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('rotte GET …/address/options e …/address/preview', () => {
  const get = (url: string, cookie = signed.cookie) =>
    harness.app.inject({ method: 'GET', url, headers: { cookie } });

  it('in Redazione le opzioni rispondono 200', async () => {
    const t = await tree('rotta-opzioni');
    const risposta = await get(`/contents/${t.b}/address/options`);
    expect(risposta.statusCode, risposta.body).toBe(200);
    const ids = (risposta.json().items as { id: string }[]).map((item) => item.id);
    expect(ids).toContain(t.a);
    expect(ids).not.toContain(t.c);
  });

  it('in Redazione l’anteprima risponde 200 con il piano', async () => {
    const t = await tree('rotta-anteprima');
    const risposta = await get(`/contents/${t.b}/address/preview?slug=b2&parentId=${t.a}`);
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json()).toEqual(await plan(t.b, 'b2', t.a));
  });

  it('senza genitore l’anteprima calcola il primo livello', async () => {
    const t = await tree('rotta-primo-livello');
    for (const query of [
      'slug=primo-livello-sintetico',
      'slug=primo-livello-sintetico&parentId=',
    ]) {
      const risposta = await get(`/contents/${t.b}/address/preview?${query}`);
      expect(risposta.statusCode, risposta.body).toBe(200);
      expect(risposta.json().path).toBe('/primo-livello-sintetico/');
    }
  });

  it('in Impostazioni entrambe le rotte sono respinte, anche a chi ha tutti i permessi', async () => {
    const t = await tree('rotta-area');
    const impostazioni = await signIn(harness, { email: BOTH_EMAIL, area: 'impostazioni' });
    for (const url of [
      `/contents/${t.b}/address/options`,
      `/contents/${t.b}/address/preview?slug=b2&parentId=${t.a}`,
    ]) {
      expect((await get(url, impostazioni.cookie)).statusCode, url).toBe(403);
    }
  });

  it('l’anteprima non scrive: né contenuti, né regole, né registro', async () => {
    const t = await tree('rotta-nessuna-scrittura');
    await rule('/rotta-nessuna-scrittura/b2/', '/rotta-nessuna-scrittura/b/', {
      origin: 'automatic',
    });
    await rule('/scorciatoia-rotta/', '/rotta-nessuna-scrittura/b/c/');
    const fotografia = async () => ({
      ...(await tables()),
      audit: (await harness.db.select({ value: count() }).from(schema.auditLog))[0]?.value,
    });
    const prima = await fotografia();

    const risposta = await get(`/contents/${t.b}/address/preview?slug=b2&parentId=${t.a}`);
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().redirectsRemoved).toHaveLength(1);
    expect(risposta.json().redirectsRetargeted).toHaveLength(1);
    const rifiutata = await get(`/contents/${t.c}/address/preview?slug=d&parentId=${t.b}`);
    expect(rifiutata.statusCode).toBe(409);

    expect(await fotografia()).toEqual(prima);
  });

  it('i rifiuti arrivano nell’involucro con il codice stabile', async () => {
    const t = await tree('rotta-rifiuti');
    const casi = [
      [`slug=d&parentId=${t.b}`, t.c, 409, 'CONTENT_PATH_TAKEN'],
      [`slug=b2&parentId=${t.c}`, t.b, 400, 'CONTENT_PARENT_INVALID'],
      ['slug=feed', t.b, 400, 'CONTENT_SLUG_RESERVED'],
      ['slug=Non%20Valido', t.b, 400, 'VALIDATION_FAILED'],
      ['parentId=', t.b, 400, 'VALIDATION_FAILED'],
    ] as const;
    for (const [query, id, status, code] of casi) {
      const risposta = await get(`/contents/${id}/address/preview?${query}`);
      expect(risposta.statusCode, query).toBe(status);
      expect(risposta.json().error.code, query).toBe(code);
    }
  });

  it('la lettura di un contenuto dice se è la pagina iniziale, che il sito serve a «/» (S3)', async () => {
    const t = await tree('rotta-casa');
    expect((await get(`/contents/${homeId}`)).json()).toMatchObject({ isHome: true });
    expect((await get(`/contents/${t.b}`)).json()).toMatchObject({ isHome: false });
  });

  it('un contenuto inesistente risponde 404 su entrambe le rotte', async () => {
    const assente = '00000000-0000-4000-8000-000000000000';
    expect((await get(`/contents/${assente}/address/options`)).statusCode).toBe(404);
    expect((await get(`/contents/${assente}/address/preview?slug=nulla`)).statusCode).toBe(404);
  });
});
