import { schema } from '@amoris/db';
import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../src/auth/permissions.js';
import {
  addressFixtures,
  createAddressBench,
  signInWithPermissions,
} from './_support/contentAddress.js';
import { ADMIN_EMAIL, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Wave 1G-W4, T1: eliminazione di un contenuto (D142-A, D143-A, S8). Rifiuti con codice
 * stabile e messaggio che nomina le dipendenze, nessuna scrittura nei rifiuti,
 * anteprima senza effetti, titolo conservato nel registro. Dati sintetici.
 */

let harness: Harness;
let signed: Signed;
let homeId: string;
let writeOnly: Signed;

const { insertContent } = addressFixtures(() => harness);

beforeAll(async () => {
  ({ harness, signed, homeId } = await createAddressBench('api_content_deletion'));
  writeOnly = await signInWithPermissions(harness, 'solo-scrittura', [
    PERMISSIONS.contentRead,
    PERMISSIONS.contentWrite,
  ]);
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

const del = (id: string, headers = signed.writeHeaders) =>
  harness.app.inject({ method: 'DELETE', url: `/contents/${id}`, headers });
const preview = (id: string, cookie = signed.cookie) =>
  harness.app.inject({ method: 'GET', url: `/contents/${id}/deletion`, headers: { cookie } });

interface Err {
  error: { code: string; message: string };
}

/** Le tabelle che un rifiuto non deve toccare. */
async function tables() {
  const { db } = harness;
  return {
    contents: await db.select().from(schema.contents).orderBy(asc(schema.contents.id)),
    menuItems: await db.select().from(schema.menuItems).orderBy(asc(schema.menuItems.id)),
    redirects: await db.select().from(schema.redirects).orderBy(asc(schema.redirects.id)),
    contentTerms: await db.select().from(schema.contentTerms),
  };
}

async function menuWithItem(contentId: string, label: string, menuLabel: string) {
  const [menu] = await harness.db
    .insert(schema.menus)
    .values({ key: `menu-${label}`.toLowerCase().replace(/\s+/g, '-'), label: menuLabel })
    .returning({ id: schema.menus.id });
  if (!menu) throw new Error('menu di prova non creato');
  await harness.db
    .insert(schema.menuItems)
    .values({ menuId: menu.id, kind: 'content', label, contentId });
}

describe('DELETE /contents/:id (S8)', () => {
  it('contenuto senza dipendenze: 204, e spariscono copia di lavoro, SEO e legami alle categorie', async () => {
    const id = await insertContent({ slug: 'pulita', path: '/pulita/', type: 'post' });
    const [term] = await harness.db
      .insert(schema.terms)
      .values({
        taxonomy: 'category',
        slug: 'cat-del',
        name: 'Categoria',
        path: '/category/cat-del/',
      })
      .returning({ id: schema.terms.id });
    if (!term) throw new Error('termine non creato');
    await harness.db.insert(schema.contentTerms).values({ contentId: id, termId: term.id });
    await harness.db.insert(schema.contentSeo).values({ contentId: id, title: 'Titolo SEO' });
    await harness.db.insert(schema.contentDrafts).values({
      contentId: id,
      authorId: harness.userId,
      title: 'Copia',
      blocks: { schema: 1, blocks: [] },
      baseUpdatedAt: new Date(),
    });

    const risposta = await del(id);
    expect(risposta.statusCode, risposta.body).toBe(204);

    const { db } = harness;
    expect(await db.select().from(schema.contents).where(eq(schema.contents.id, id))).toEqual([]);
    expect(
      await db.select().from(schema.contentSeo).where(eq(schema.contentSeo.contentId, id)),
    ).toEqual([]);
    expect(
      await db.select().from(schema.contentDrafts).where(eq(schema.contentDrafts.contentId, id)),
    ).toEqual([]);
    expect(
      await db.select().from(schema.contentTerms).where(eq(schema.contentTerms.contentId, id)),
    ).toEqual([]);
  });

  it('contenuto inesistente: 404', async () => {
    const risposta = await del('00000000-0000-4000-8000-0000000000f1');
    expect(risposta.statusCode).toBe(404);
  });

  it('figlia: 409 CONTENT_HAS_CHILDREN che nomina il titolo della figlia', async () => {
    const padre = await insertContent({ slug: 'padre', path: '/padre/' });
    await insertContent({ slug: 'figlia-uno', path: '/padre/figlia-uno/', parentId: padre });
    const prima = await tables();

    const risposta = await del(padre);
    expect(risposta.statusCode, risposta.body).toBe(409);
    const { error } = risposta.json<Err>();
    expect(error.code).toBe('CONTENT_HAS_CHILDREN');
    expect(error.message).toContain('Titolo figlia-uno');
    expect(await tables()).toEqual(prima);
  });

  it('voce di menu: 409 CONTENT_IN_MENU con etichetta e menu, e nessuna scrittura (oggi 500)', async () => {
    const id = await insertContent({ slug: 'nel-menu', path: '/nel-menu/' });
    await menuWithItem(id, 'Voce sintetica', 'Menu principale sintetico');
    const prima = await tables();

    const risposta = await del(id);
    expect(risposta.statusCode, risposta.body).toBe(409);
    const { error } = risposta.json<Err>();
    expect(error.code).toBe('CONTENT_IN_MENU');
    expect(error.message).toContain('Voce sintetica');
    expect(error.message).toContain('Menu principale sintetico');
    expect(await tables()).toEqual(prima);
  });

  it('pagina iniziale: 409 CONTENT_IS_HOME', async () => {
    const prima = await tables();
    const risposta = await del(homeId);
    expect(risposta.statusCode, risposta.body).toBe(409);
    const { error } = risposta.json<Err>();
    expect(error.code).toBe('CONTENT_IS_HOME');
    expect(error.message).toMatch(/pagina iniziale/i);
    expect(await tables()).toEqual(prima);
  });

  it('pubblicato senza content.publish: 403 NOT_AUTHORIZED generico e nessuna scrittura; bozza con content.write: 204 (D142-A)', async () => {
    const pubblicato = await insertContent({ slug: 'pubblicato', path: '/pubblicato/' });
    const bozza = await insertContent({ slug: 'bozza', path: '/bozza/', status: 'draft' });
    const prima = await tables();

    const rifiuto = await del(pubblicato, writeOnly.writeHeaders);
    expect(rifiuto.statusCode, rifiuto.body).toBe(403);
    expect(rifiuto.json<Err>().error).toMatchObject({
      code: 'NOT_AUTHORIZED',
      message: 'Operazione non consentita.',
    });
    expect(await tables()).toEqual(prima);

    const ammessa = await del(bozza, writeOnly.writeHeaders);
    expect(ammessa.statusCode, ammessa.body).toBe(204);
  });

  it('una regola di redirect verso l’indirizzo non blocca e resta intatta (D143-A)', async () => {
    const id = await insertContent({ slug: 'con-regola', path: '/con-regola/' });
    await harness.db
      .insert(schema.redirects)
      .values({ sourcePath: '/vecchio-sintetico/', targetPath: '/con-regola/' });
    const risposta = await del(id);
    expect(risposta.statusCode, risposta.body).toBe(204);
    const [regola] = await harness.db
      .select()
      .from(schema.redirects)
      .where(eq(schema.redirects.sourcePath, '/vecchio-sintetico/'));
    expect(regola?.targetPath).toBe('/con-regola/');
  });

  it('sessione dell’area Impostazioni: 403', async () => {
    const id = await insertContent({ slug: 'area-sbagliata', path: '/area-sbagliata/' });
    const impostazioni = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
    const risposta = await del(id, impostazioni.writeHeaders);
    expect(risposta.statusCode).toBe(403);
    expect(
      await harness.db.select().from(schema.contents).where(eq(schema.contents.id, id)),
    ).toHaveLength(1);
  });
});

describe('GET /contents/:id/deletion', () => {
  it('elenca figlie, voci, home e regole verso l’indirizzo, senza scrivere nulla nemmeno nel registro', async () => {
    const id = await insertContent({ slug: 'anteprima', path: '/anteprima/' });
    await insertContent({ slug: 'figlia', path: '/anteprima/figlia/', parentId: id });
    await menuWithItem(id, 'Voce anteprima', 'Menu anteprima');
    await harness.db
      .insert(schema.redirects)
      .values({ sourcePath: '/da-anteprima/', targetPath: '/anteprima/' });
    const prima = await tables();
    const righe = (await harness.db.select().from(schema.auditLog)).length;

    const risposta = await preview(id);
    expect(risposta.statusCode, risposta.body).toBe(200);
    const corpo = risposta.json<{
      blocked: boolean;
      children: { id: string; title: string; path: string }[];
      menuItems: { id: string; label: string; menu: string }[];
      isHome: boolean;
      redirectsToPath: { source: string }[];
    }>();
    expect(corpo.blocked).toBe(true);
    expect(corpo.children).toEqual([
      { id: expect.any(String), title: 'Titolo figlia', path: '/anteprima/figlia/' },
    ]);
    expect(corpo.menuItems).toEqual([
      { id: expect.any(String), label: 'Voce anteprima', menu: 'Menu anteprima' },
    ]);
    expect(corpo.isHome).toBe(false);
    expect(corpo.redirectsToPath).toEqual([{ source: '/da-anteprima/' }]);

    expect(await tables()).toEqual(prima);
    expect((await harness.db.select().from(schema.auditLog)).length).toBe(righe);
  });

  it('pagina iniziale: isHome e blocked; contenuto libero: blocked false; inesistente: 404', async () => {
    expect(await preview(homeId).then((r) => r.json())).toMatchObject({
      isHome: true,
      blocked: true,
    });
    const libero = await insertContent({ slug: 'libera', path: '/libera/' });
    expect(await preview(libero).then((r) => r.json())).toMatchObject({
      blocked: false,
      children: [],
      menuItems: [],
      isHome: false,
      redirectsToPath: [],
    });
    expect((await preview('00000000-0000-4000-8000-0000000000f2')).statusCode).toBe(404);
  });
});

describe('registro dell’eliminazione', () => {
  it('la riga content.delete conserva titolo e percorso, e l’etichetta resta leggibile dopo l’eliminazione', async () => {
    const id = await insertContent({ slug: 'da-ricordare', path: '/da-ricordare/' });
    expect((await del(id)).statusCode).toBe(204);

    const [riga] = await harness.db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.action, 'content.delete'), eq(schema.auditLog.entityId, id)));
    expect(riga?.outcome).toBe('success');
    expect(riga?.detail).toMatchObject({ title: 'Titolo da-ricordare', path: '/da-ricordare/' });

    const impostazioni = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
    const lista = await harness.app.inject({
      method: 'GET',
      url: `/audit?entityId=${id}`,
      headers: { cookie: impostazioni.cookie },
    });
    expect(lista.statusCode, lista.body).toBe(200);
    const { items } = lista.json<{ items: { action: string; entityLabel: string | null }[] }>();
    expect(items.find((i) => i.action === 'content.delete')?.entityLabel).toBe(
      'Titolo da-ricordare',
    );
  });
});
