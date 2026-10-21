import { schema } from '@amoris/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../src/auth/permissions.js';
import {
  addressFixtures,
  createAddressBench,
  signInWithPermissions,
} from './_support/contentAddress.js';
import type { Harness, Signed } from './_support/harness.js';

/**
 * Wave 1G-W3, ondata finale: i rifiuti di sicurezza del cambio d'indirizzo. Slug con
 * segmenti di punto e codifiche percentuali (D136-A, DR-240) alla creazione,
 * nell'anteprima e nella scrittura; permessi oltre a `content.write` (D138-A,
 * DR-242). Persone, ruoli e indirizzi sintetici.
 */

let harness: Harness;
let signed: Signed;

const { insertContent, tree, rule, tables } = addressFixtures(() => harness);

beforeAll(async () => {
  ({ harness, signed } = await createAddressBench('api_content_address_guards'));
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const post = (slug: string) =>
  harness.app.inject({
    method: 'POST',
    url: '/contents',
    headers: signed.writeHeaders,
    payload: { type: 'page', slug, title: 'Titolo sintetico' },
  });

const preview = (id: string, query: Record<string, string>, cookie = signed.cookie) =>
  harness.app.inject({
    method: 'GET',
    url: `/contents/${id}/address/preview?${new URLSearchParams(query).toString()}`,
    headers: { cookie },
  });

const put = (id: string, slug: string, parentId: string | null, headers = signed.writeHeaders) =>
  harness.app.inject({
    method: 'PUT',
    url: `/contents/${id}/address`,
    headers,
    payload: { slug, parentId },
  });

describe('slug con segmenti di punto e codifiche percentuali (D136-A, DR-240)', () => {
  const REFUSED = ['.', '..', '%2e%2e', '%2f', '%5c', '%zz', 'a%00b'];

  it.each(REFUSED)(
    '«%s» → 400 alla creazione, nell’anteprima e nella scrittura, con un motivo in italiano',
    async (slug) => {
      const n = REFUSED.indexOf(slug);
      const pagina = await insertContent({ slug: `punti-${n}`, path: `/punti-${n}/` });
      const prima = await tables();

      for (const risposta of [
        await post(slug),
        await preview(pagina, { slug }),
        await put(pagina, slug, null),
      ]) {
        expect(risposta.statusCode, `${slug}: ${risposta.body}`).toBe(400);
        const { error } = risposta.json() as {
          error: { code: string; details: { message: string }[] };
        };
        expect(error.code).toBe('VALIDATION_FAILED');
        for (const detail of error.details) expect(detail.message, slug).toMatch(/^lo slug /);
      }
      expect(await tables()).toEqual(prima);
    },
  );

  it('«%6d%65%64%69%61», cioè «media», al primo livello → 400 CONTENT_SLUG_RESERVED ovunque', async () => {
    const slug = '%6d%65%64%69%61';
    const pagina = await insertContent({
      slug: 'riservato-codificato',
      path: '/riservato-codificato/',
    });
    const prima = await tables();

    for (const risposta of [
      await post(slug),
      await preview(pagina, { slug }),
      await put(pagina, slug, null),
    ]) {
      expect(risposta.statusCode, risposta.body).toBe(400);
      expect(risposta.json().error).toMatchObject({
        code: 'CONTENT_SLUG_RESERVED',
        message: expect.stringContaining('/media/'),
      });
    }
    expect(await tables()).toEqual(prima);
  });

  it.each([
    ['%4d%45%44%49%41', '/media/'],
    ['%41%50%49', '/api/'],
    ['%41dmin', '/admin/'],
  ])(
    '«%s», cioè %s con lettere maiuscole, al primo livello → 400 CONTENT_SLUG_RESERVED; sotto una pagina è ammesso',
    async (slug) => {
      const n = slug.length;
      const pagina = await insertContent({ slug: `maiuscole-${n}`, path: `/maiuscole-${n}/` });
      const prima = await tables();

      for (const risposta of [await post(slug), await put(pagina, slug, null)]) {
        expect(risposta.statusCode, `${slug}: ${risposta.body}`).toBe(400);
        expect(risposta.json().error.code).toBe('CONTENT_SLUG_RESERVED');
      }
      expect(await tables()).toEqual(prima);

      // Il riservato vale solo al primo livello.
      const figlia = await insertContent({
        slug: `figlia-${n}`,
        path: `/maiuscole-${n}/figlia-${n}/`,
        parentId: pagina,
      });
      const spostata = await put(figlia, slug, pagina);
      expect(spostata.statusCode, spostata.body).toBe(200);
    },
  );

  it('uno slug con una codifica completa e non riservata resta ammesso', async () => {
    const creata = await post('caff%c3%a8-sintetico');
    expect(creata.statusCode, creata.body).toBe(201);
    expect(creata.json().path).toBe('/caff%c3%a8-sintetico/');

    const pagina = await insertContent({ slug: 'da-codificare', path: '/da-codificare/' });
    expect((await preview(pagina, { slug: 'citt%c3%a0-sintetica' })).statusCode).toBe(200);
    const spostata = await put(pagina, 'citt%c3%a0-sintetica', null);
    expect(spostata.statusCode, spostata.body).toBe(200);
    expect(spostata.json().content.path).toBe('/citt%c3%a0-sintetica/');
  });

  it('lo scenario della revisione di sicurezza §3.1 si ferma al primo passo; un «..» già scritto non apre un anello', async () => {
    expect((await post('..')).statusCode).toBe(400);

    // Difesa in profondità: una pagina «..» scritta da fuori, e la regola /y/ → /c/.
    const puntini = await insertContent({ slug: '..', path: '/../' });
    const c = await insertContent({ slug: 'c-anello', path: '/c-anello/' });
    await rule('/y-anello/', '/c-anello/');
    const prima = await tables();
    // /y-anello/ porterebbe a /../y-anello/, che il browser legge /y-anello/.
    const risposta = await put(c, 'y-anello', puntini);

    expect(risposta.statusCode, risposta.body).toBe(409);
    expect(risposta.json().error.code).toBe('REDIRECT_CYCLE');
    expect(await tables()).toEqual(prima);
  });
});

describe('permessi del cambio d’indirizzo oltre a content.write (D138-A, DR-242)', () => {
  // Lo stesso involucro di `requirePermission`: il messaggio non dice quale permesso manchi.
  const REFUSED = { code: 'NOT_AUTHORIZED', message: 'Operazione non consentita.' };
  let withoutRedirects: Signed;
  let withoutPublish: Signed;

  beforeAll(async () => {
    withoutRedirects = await signInWithPermissions(harness, 'scrittura-e-pubblicazione', [
      PERMISSIONS.contentRead,
      PERMISSIONS.contentWrite,
      PERMISSIONS.contentPublish,
    ]);
    withoutPublish = await signInWithPermissions(harness, 'scrittura-e-redirect', [
      PERMISSIONS.contentRead,
      PERMISSIONS.contentWrite,
      PERMISSIONS.settingsWrite,
    ]);
  });

  it('senza settings.write: 403 se il piano tocca regole esistenti, 200 se non ne tocca', async () => {
    const riscritta = await tree('permesso-riscritta');
    await rule('/scorciatoia-permesso/', '/permesso-riscritta/b/c/');
    const nascosta = await tree('permesso-nascosta');
    await rule('/permesso-nascosta/b/', '/media/immagine-sintetica.png', { origin: 'migration' });
    const arrivo = await tree('permesso-arrivo');
    await rule('/permesso-arrivo/b2/', '/altro-sintetico/', { origin: 'automatic' });
    const prima = await tables();

    // Riscrittura (D130-A), riuso e riattivazione in partenza (D134-A), rimozione in arrivo (D135-A).
    for (const t of [riscritta, nascosta, arrivo]) {
      const risposta = await put(t.b, 'b2', t.a, withoutRedirects.writeHeaders);
      expect(risposta.statusCode, risposta.body).toBe(403);
      expect(risposta.json().error).toMatchObject(REFUSED);
    }
    expect(await tables()).toEqual(prima);

    // Nessuna regola esistente toccata: nascono solo i redirect nuovi.
    const libero = await tree('permesso-libero');
    const risposta = await put(libero.b, 'b2', libero.a, withoutRedirects.writeHeaders);
    expect(risposta.statusCode, risposta.body).toBe(200);
  });

  it('senza content.publish: 403 spostando un contenuto pubblicato, 200 spostando una bozza', async () => {
    const t = await tree('permesso-pubblicato');
    const prima = await tables();
    const negata = await put(t.b, 'b2', t.a, withoutPublish.writeHeaders);

    expect(negata.statusCode, negata.body).toBe(403);
    expect(negata.json().error).toMatchObject(REFUSED);
    expect(await tables()).toEqual(prima);
    // Come ogni operazione rifiutata, una riga di fallimento senza conteggi.
    const righe = await harness.db
      .select({ outcome: schema.auditLog.outcome, detail: schema.auditLog.detail })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.action, 'content.address.update'),
          eq(schema.auditLog.entityId, t.b),
        ),
      );
    expect(righe).toEqual([{ outcome: 'failure', detail: { status: 403, method: 'PUT' } }]);

    const bozza = await insertContent({
      slug: 'permesso-bozza',
      path: '/permesso-bozza/',
      status: 'draft',
    });
    const risposta = await put(bozza, 'permesso-bozza-due', null, withoutPublish.writeHeaders);
    expect(risposta.statusCode, risposta.body).toBe(200);
  });

  it('l’anteprima resta con content.read e con lo stesso contratto', async () => {
    const t = await tree('permesso-anteprima');
    await rule('/scorciatoia-anteprima/', '/permesso-anteprima/b/c/');
    const lettore = await signInWithPermissions(harness, 'sola-lettura', [PERMISSIONS.contentRead]);
    const risposta = await preview(t.b, { slug: 'b2', parentId: t.a }, lettore.cookie);

    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.json().redirectsRetargeted).toHaveLength(1);
  });
});
