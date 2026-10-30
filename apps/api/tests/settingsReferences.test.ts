import { schema } from '@amoris/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../src/auth/permissions.js';
import {
  ADMIN_EMAIL,
  createHarness,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W9, T7.
 *
 * W8-38: «Logo del sito» e «Pagina iniziale» indicano un media e un contenuto. Prima il
 * servizio accettava qualunque testo, e un valore che non è un identificativo avrebbe fatto
 * fallire la lettura della pagina iniziale nel database. Ora il logo dev'essere un'immagine
 * pubblica esistente (o nessun logo) e la pagina iniziale una pagina pubblicata; il resto è
 * rifiutato con 400 e un motivo in italiano. L'area sceglie i valori da due elenchi che il
 * servizio offre dentro «Impostazioni», dove media e contenuti di Redazione non si leggono.
 *
 * W8-37: un'impostazione di testo svuotata torna `null`, come era nata, quando la sua forma
 * ammette `null` o non è vincolata; il sito legge già `""` e `null` allo stesso modo.
 *
 * Media, contenuti e testi sono inventati.
 */

let harness: Harness;
let signed: Signed;
const ids: Record<string, string> = {};

async function addMedia(key: string, mimeType: string, isPrivate = false): Promise<string> {
  const storageKey = `2026/01/${key}`;
  const [row] = await harness.db
    .insert(schema.media)
    .values({
      storageKey,
      publicPath: `/media/${storageKey}`,
      fileName: key,
      mimeType,
      byteSize: 10,
      checksum: Buffer.from(key.padEnd(32, '0')),
      title: `Media ${key}`,
      isPrivate,
      uploadedAt: new Date('2026-01-01T00:00:00Z'),
    })
    .returning({ id: schema.media.id });
  if (!row) throw new Error('media non creato');
  ids[key] = row.id;
  return row.id;
}

async function addContent(
  key: string,
  type: 'page' | 'post',
  status: 'draft' | 'published' | 'archived',
): Promise<string> {
  const [row] = await harness.db
    .insert(schema.contents)
    .values({
      type,
      status,
      slug: key,
      path: `/${key}/`,
      title: `Titolo ${key}`,
      publishedAt: status === 'published' ? new Date('2026-02-01T10:00:00Z') : null,
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('contenuto non creato');
  ids[key] = row.id;
  return row.id;
}

beforeAll(async () => {
  harness = await createHarness('api_impostazioni_riferimenti');
  signed = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
  await addMedia('logo.png', 'image/png');
  await addMedia('altro.jpg', 'image/jpeg');
  await addMedia('riservata.png', 'image/png', true);
  await addMedia('documento.pdf', 'application/pdf');
  await addContent('casa', 'page', 'published');
  await addContent('chi-siamo', 'page', 'published');
  await addContent('bozza', 'page', 'draft');
  await addContent('ritirata', 'page', 'archived');
  await addContent('notizia', 'post', 'published');
  await harness.db.insert(schema.settings).values([
    { key: 'site.logo_media_id', value: ids['logo.png'] ?? '', label: 'Logo del sito' },
    { key: 'site.home_content_id', value: ids['casa'] ?? '', label: 'Pagina iniziale' },
    { key: 'analytics.ga4_measurement_id', value: sql`'null'::jsonb`, label: 'GA4' },
    { key: 'contact.address', value: sql`'null'::jsonb`, label: 'Indirizzo' },
    { key: 'contact.phone', value: '', label: 'Telefono' },
  ]);
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const put = (key: string, value: unknown) =>
  harness.app.inject({
    method: 'PUT',
    url: `/settings/${key}`,
    headers: signed.writeHeaders,
    payload: { value },
  });

const get = (url: string) =>
  harness.app.inject({ method: 'GET', url, headers: { cookie: signed.cookie } });

async function stored(key: string): Promise<unknown> {
  const [row] = await harness.db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, key));
  return row?.value;
}

describe('W8-38: «Logo del sito»', () => {
  it('accetta un’immagine pubblica esistente', async () => {
    const response = await put('site.logo_media_id', ids['altro.jpg']);
    expect(response.statusCode).toBe(200);
    expect(await stored('site.logo_media_id')).toBe(ids['altro.jpg']);
  });

  it('accetta di togliere il logo: vuoto e null diventano null', async () => {
    expect((await put('site.logo_media_id', '')).statusCode).toBe(200);
    expect(await stored('site.logo_media_id')).toBeNull();
    expect((await put('site.logo_media_id', null)).statusCode).toBe(200);
    expect(await stored('site.logo_media_id')).toBeNull();
    expect((await put('site.logo_media_id', ids['logo.png'])).statusCode).toBe(200);
  });

  it('prova negativa: testo qualunque, media inesistente, riservato o non immagine → 400', async () => {
    const message = '«Logo del sito» deve essere un’immagine pubblica scelta fra i media.';
    for (const value of [
      'non-un-identificativo',
      '00000000-0000-4000-8000-000000000000',
      ids['riservata.png'],
      ids['documento.pdf'],
      42,
      { id: ids['logo.png'] },
    ]) {
      const response = await put('site.logo_media_id', value);
      expect(response.statusCode, String(value)).toBe(400);
      expect(response.json().error.message).toBe(message);
    }
    expect(await stored('site.logo_media_id')).toBe(ids['logo.png']);
  });
});

describe('W8-38: «Pagina iniziale»', () => {
  it('accetta una pagina pubblicata', async () => {
    expect((await put('site.home_content_id', ids['chi-siamo'])).statusCode).toBe(200);
    expect(await stored('site.home_content_id')).toBe(ids['chi-siamo']);
    expect((await put('site.home_content_id', ids['casa'])).statusCode).toBe(200);
  });

  it('prova negativa: testo, vuoto, bozza, ritirata, notizia o inesistente → 400', async () => {
    const message = '«Pagina iniziale» deve essere una pagina pubblicata.';
    for (const value of [
      'non-un-identificativo',
      '',
      null,
      '00000000-0000-4000-8000-000000000000',
      ids['bozza'],
      ids['ritirata'],
      ids['notizia'],
    ]) {
      const response = await put('site.home_content_id', value);
      expect(response.statusCode, String(value)).toBe(400);
      expect(response.json().error.message).toBe(message);
    }
    expect(await stored('site.home_content_id')).toBe(ids['casa']);
    // La home del sito resta leggibile.
    const home = await harness.app.inject({ method: 'GET', url: '/public/content?path=/' });
    expect(home.statusCode).toBe(200);
    expect(home.json().content.title).toBe('Titolo casa');
  });
});

describe('W8-38: elenchi da cui l’area sceglie', () => {
  it('le immagini pubbliche, con il logo attuale', async () => {
    const response = await get('/settings/choices/logo');
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      current: { id: string } | null;
      items: { id: string; title: string | null; fileName: string; publicPath: string }[];
    };
    const found = body.items.map((item) => item.id);
    expect(found).toEqual(expect.arrayContaining([ids['logo.png'], ids['altro.jpg']]));
    expect(found).not.toContain(ids['riservata.png']);
    expect(found).not.toContain(ids['documento.pdf']);
    expect(body.current?.id).toBe(ids['logo.png']);
  });

  it('la ricerca restringe le immagini', async () => {
    const body = (await get('/settings/choices/logo?search=altro')).json() as {
      items: { id: string }[];
    };
    expect(body.items.map((item) => item.id)).toEqual([ids['altro.jpg']]);
  });

  it('le pagine pubblicate, senza bozze, ritirate né notizie', async () => {
    const response = await get('/settings/choices/home');
    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: { id: string; title: string; path: string }[] };
    expect(body.items.map((item) => item.id).sort()).toEqual(
      [ids['casa'], ids['chi-siamo']].sort(),
    );
    expect(body.items.find((item) => item.id === ids['casa'])?.title).toBe('Titolo casa');
  });

  it('prova negativa: in Redazione gli elenchi si rifiutano anche a chi ha il permesso delle impostazioni', async () => {
    // Il ruolo di prova «Redazione» riceve qui anche `site.settings.write`: la stessa persona
    // legge gli elenchi entrando in Impostazioni, e in Redazione riceve 403. Il rifiuto viene
    // quindi dal legame d'area (DR-067), non da un permesso mancante.
    const [editorRole] = await harness.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.key, 'editor'));
    if (!editorRole) throw new Error('ruolo di prova mancante');
    const grant = { roleId: editorRole.id, permissionKey: PERMISSIONS.siteSettingsWrite };
    await harness.db.insert(schema.rolePermissions).values(grant);
    try {
      const inSettings = await signIn(harness, { area: 'impostazioni' });
      const inEditing = await signIn(harness, { area: 'redazione' });
      const me = await harness.app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie: inEditing.cookie },
      });
      expect(me.json().permissions).toContain(PERMISSIONS.siteSettingsWrite);
      for (const url of ['/settings/choices/logo', '/settings/choices/home']) {
        const allowed = await harness.app.inject({
          method: 'GET',
          url,
          headers: { cookie: inSettings.cookie },
        });
        expect(allowed.statusCode, url).toBe(200);
        const refused = await harness.app.inject({
          method: 'GET',
          url,
          headers: { cookie: inEditing.cookie },
        });
        expect(refused.statusCode, url).toBe(403);
      }
    } finally {
      await harness.db
        .delete(schema.rolePermissions)
        .where(
          and(
            eq(schema.rolePermissions.roleId, grant.roleId),
            eq(schema.rolePermissions.permissionKey, grant.permissionKey),
          ),
        );
    }
  });

  it('prova negativa: senza sessione gli elenchi rispondono 401', async () => {
    for (const url of ['/settings/choices/logo', '/settings/choices/home']) {
      const response = await harness.app.inject({ method: 'GET', url });
      expect(response.statusCode, url).toBe(401);
    }
  });
});

describe('W8-37: un testo svuotato torna null', () => {
  it('un’impostazione libera nata null, svuotata, resta null', async () => {
    expect((await put('analytics.ga4_measurement_id', 'G-INVENTATO1')).statusCode).toBe(200);
    expect((await put('analytics.ga4_measurement_id', '')).statusCode).toBe(200);
    expect(await stored('analytics.ga4_measurement_id')).toBeNull();
  });

  it('anche quando la forma ammette null, e anche con soli spazi', async () => {
    expect((await put('contact.address', 'Via Sintetica 1')).statusCode).toBe(200);
    expect((await put('contact.address', '   ')).statusCode).toBe(200);
    expect(await stored('contact.address')).toBeNull();
  });

  it('una forma che non ammette null conserva il testo vuoto', async () => {
    expect((await put('contact.phone', '')).statusCode).toBe(200);
    expect(await stored('contact.phone')).toBe('');
  });
});

describe('M2: l’elenco delle pagine ha un tetto', () => {
  it('al massimo 200 pagine, e la pagina iniziale attuale anche se resta fuori', async () => {
    // 200 pagine il cui titolo viene prima di «Titolo casa»: la pagina iniziale esce dal tetto.
    const extra = Array.from({ length: 200 }, (_, index) => {
      const slug = `aaa-sintetica-${String(index).padStart(3, '0')}`;
      return {
        type: 'page' as const,
        status: 'published' as const,
        slug,
        path: `/${slug}/`,
        title: `Aaa sintetica ${String(index).padStart(3, '0')}`,
        publishedAt: new Date('2026-02-01T10:00:00Z'),
      };
    });
    const inserted = await harness.db
      .insert(schema.contents)
      .values(extra)
      .returning({ id: schema.contents.id });
    try {
      const body = (await get('/settings/choices/home')).json() as {
        items: { id: string }[];
        current: { id: string; title: string; path: string } | null;
      };
      expect(body.items).toHaveLength(200);
      expect(body.items.map((item) => item.id)).not.toContain(ids['casa']);
      expect(body.current).toEqual({ id: ids['casa'], title: 'Titolo casa', path: '/casa/' });
    } finally {
      await harness.db.delete(schema.contents).where(
        inArray(
          schema.contents.id,
          inserted.map((row) => row.id),
        ),
      );
    }
  });
});

describe('I1: un identificativo scritto in maiuscolo', () => {
  it('logo e pagina iniziale si salvano in minuscolo', async () => {
    const logo = ids['altro.jpg'] ?? '';
    expect((await put('site.logo_media_id', logo.toUpperCase())).statusCode).toBe(200);
    expect(await stored('site.logo_media_id')).toBe(logo);
    const home = ids['chi-siamo'] ?? '';
    expect((await put('site.home_content_id', home.toUpperCase())).statusCode).toBe(200);
    expect(await stored('site.home_content_id')).toBe(home);
  });

  it('la pagina iniziale scritta in maiuscolo resta riconosciuta e non si elimina', async () => {
    // Prima si salvava com'era scritta e il confronto come testo non la riconosceva più:
    // l'eliminazione passava e «/» rispondeva 404. Questa prova è l'ultima del file perché,
    // senza la correzione, elimina davvero la pagina.
    const home = ids['casa'] ?? '';
    expect((await put('site.home_content_id', home.toUpperCase())).statusCode).toBe(200);
    const editor = await signIn(harness, { area: 'redazione' });
    const response = await harness.app.inject({
      method: 'DELETE',
      url: `/contents/${home}`,
      headers: editor.writeHeaders,
    });
    expect(response.statusCode, response.body).toBe(409);
    expect(response.json().error.code).toBe('CONTENT_IS_HOME');
    const page = await harness.app.inject({ method: 'GET', url: '/public/content?path=/' });
    expect(page.statusCode).toBe(200);
    expect(page.json().content.title).toBe('Titolo casa');
  });
});
