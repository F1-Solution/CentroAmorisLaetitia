import { schema } from '@amoris/db';
import { eq, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { updateFieldLabels } from '../src/modules/content/schemas.js';
import {
  ADMIN_EMAIL,
  createHarness,
  signIn,
  TEST_PASSWORD,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W9, T6: il registro nomina l'oggetto (W8-20, W8-29), non scrive un cambio
 * password quando la password sbagliata arriva da una modifica del proprio account
 * (W8-30) e dà una riga a ogni redirect creato, ridiretto o tolto (W8-31). Dati sintetici.
 */

let harness: Harness;
let editor: Signed;
let admin: Signed;

beforeAll(async () => {
  harness = await createHarness('api_audit_w9', { LOGIN_MAX_PER_IP: '1000' });
  editor = await signIn(harness, { area: 'redazione' });
  admin = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

interface Item {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  outcome: 'success' | 'failure';
  occurredAt: string;
}

async function listAll(query = ''): Promise<Item[]> {
  const risposta = await harness.app.inject({
    method: 'GET',
    url: `/audit?view=all&limit=100${query}`,
    headers: { cookie: admin.cookie },
  });
  expect(risposta.statusCode, risposta.body).toBe(200);
  return (risposta.json() as { items: Item[] }).items;
}

async function insertContent(slug: string, status: 'draft' | 'published' = 'published') {
  const [row] = await harness.db
    .insert(schema.contents)
    .values({
      type: 'page',
      status,
      slug,
      path: `/${slug}/`,
      title: `Titolo ${slug}`,
      publishedAt: status === 'published' ? new Date() : null,
    })
    .returning({ id: schema.contents.id });
  if (!row) throw new Error('contenuto di prova non creato');
  return row.id;
}

function multipart(fileName: string, body: Buffer) {
  const boundary = '----prova-w9';
  const head = Buffer.from(
    `--${boundary}\r\ncontent-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      'content-type: image/png\r\n\r\n',
  );
  return {
    payload: Buffer.concat([head, body, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    headers: {
      ...editor.writeHeaders,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
  };
}

describe('W8-20: l’oggetto si nomina anche per i media, i redirect, i modelli SEO e le voci di menu', () => {
  it('caricamento ed eliminazione di un media: il nome del file', async () => {
    const png = await sharp({
      create: { width: 20, height: 20, channels: 3, background: { r: 10, g: 80, b: 200 } },
    })
      .png()
      .toBuffer();
    const { payload, headers } = multipart('immagine-w9.png', png);
    const creato = await harness.app.inject({ method: 'POST', url: '/media', headers, payload });
    expect(creato.statusCode, creato.body).toBe(201);
    const id = (creato.json() as { id: string }).id;

    const eliminato = await harness.app.inject({
      method: 'DELETE',
      url: `/media/${id}`,
      headers: editor.writeHeaders,
    });
    expect(eliminato.statusCode, eliminato.body).toBe(204);

    const righe = (await listAll()).filter((i) => i.entityType === 'media');
    const upload = righe.find((i) => i.action === 'media.upload');
    const remove = righe.find((i) => i.action === 'media.delete');
    expect(upload?.entityLabel).toBe('immagine-w9.png');
    expect(remove?.entityLabel).toBe('immagine-w9.png');
  });

  it('redirect creato, modificato ed eliminato: l’indirizzo di partenza', async () => {
    const creato = await harness.app.inject({
      method: 'POST',
      url: '/redirects',
      headers: editor.writeHeaders,
      payload: { sourcePath: '/partenza-w9/', targetPath: '/arrivo-w9/' },
    });
    expect(creato.statusCode, creato.body).toBe(201);
    const id = (creato.json() as { id: string }).id;
    const eliminato = await harness.app.inject({
      method: 'DELETE',
      url: `/redirects/${id}`,
      headers: editor.writeHeaders,
    });
    expect(eliminato.statusCode, eliminato.body).toBe(204);

    const righe = (await listAll()).filter((i) => i.entityId === id);
    expect(righe.find((i) => i.action === 'redirect.create')?.entityLabel).toBe('/partenza-w9/');
    expect(righe.find((i) => i.action === 'redirect.delete')?.entityLabel).toBe('/partenza-w9/');
  });

  it('modello SEO: l’ambito, nel nome che usa l’area', async () => {
    const risposta = await harness.app.inject({
      method: 'PUT',
      url: '/seo/templates/post',
      headers: editor.writeHeaders,
      payload: { titleTemplate: '{title} - {site_title}' },
    });
    expect(risposta.statusCode, risposta.body).toBe(200);
    const riga = (await listAll()).find((i) => i.action === 'seo.template.update');
    expect(riga?.entityLabel).toBe('Notizie');
  });

  it('voce di menu senza etichetta: il titolo del contenuto a cui punta, anche dopo l’eliminazione', async () => {
    const contenuto = await insertContent('voce-w9');
    await harness.db.insert(schema.menus).values({ key: 'w9', label: 'Menu W9' });
    const creata = await harness.app.inject({
      method: 'POST',
      url: '/menus/w9/items',
      headers: editor.writeHeaders,
      payload: { kind: 'content', label: 'Voce W9', contentId: contenuto },
    });
    expect(creata.statusCode, creata.body).toBe(201);
    const id = (creata.json() as { id: string }).id;
    // Una voce importata può avere l'etichetta vuota: si nomina dal contenuto.
    await harness.db.update(schema.menuItems).set({ label: '' }).where(eq(schema.menuItems.id, id));
    const eliminata = await harness.app.inject({
      method: 'DELETE',
      url: `/menu-items/${id}`,
      headers: editor.writeHeaders,
    });
    expect(eliminata.statusCode, eliminata.body).toBe(204);

    const righe = (await listAll()).filter((i) => i.entityId === id);
    expect(righe.find((i) => i.action === 'menu.item.create')?.entityLabel).toBe('Voce W9');
    expect(righe.find((i) => i.action === 'menu.item.delete')?.entityLabel).toBe('Titolo voce-w9');
  });

  it('una modifica con il solo testo del contenuto ha un’etichetta di campo', () => {
    expect(updateFieldLabels({ contentHtml: '<p>x</p>' })).toEqual(['Contenuto']);
    expect(
      updateFieldLabels({ contentHtml: '<p>x</p>', contentText: 'x', blocks: undefined }),
    ).toEqual(['Contenuto']);
  });
});

describe('W8-29: un contenuto eliminato mantiene il titolo su tutte le sue righe', () => {
  it('le righe precedenti all’eliminazione mostrano il titolo salvato in «Ha eliminato»', async () => {
    const creato = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: editor.writeHeaders,
      payload: { type: 'page', slug: 'da-eliminare-w9', title: 'Pagina destinata a sparire' },
    });
    expect(creato.statusCode, creato.body).toBe(201);
    const id = (creato.json() as { id: string }).id;
    const eliminato = await harness.app.inject({
      method: 'DELETE',
      url: `/contents/${id}`,
      headers: editor.writeHeaders,
    });
    expect(eliminato.statusCode, eliminato.body).toBe(204);

    const righe = (await listAll()).filter((i) => i.entityId === id);
    expect(righe.map((i) => i.action).sort()).toEqual(['content.create', 'content.delete']);
    for (const riga of righe) expect(riga.entityLabel).toBe('Pagina destinata a sparire');
  });
});

describe('W8-30: una password attuale errata non è un cambio password', () => {
  it('nessuna riga «auth.password_changed» dalla modifica del proprio account, e il conteggio resta', async () => {
    const [self] = await harness.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, ADMIN_EMAIL));
    if (!self) throw new Error('account di prova non trovato');
    const rifiuto = await harness.app.inject({
      method: 'PATCH',
      url: `/accounts/${self.id}`,
      headers: admin.writeHeaders,
      payload: { fullName: 'Nome nuovo sintetico', currentPassword: 'password-sbagliata-w9' },
    });
    expect(rifiuto.statusCode, rifiuto.body).toBe(403);

    const righe = await listAll();
    expect(righe.filter((i) => i.action === 'auth.password_changed')).toEqual([]);
    expect(
      righe.filter((i) => i.action === 'account.update' && i.outcome === 'failure'),
    ).toHaveLength(1);

    // Il conteggio dei tentativi vede ancora il fallimento: troppi errori bloccano.
    const bloccante = await createHarness('api_audit_w9_limit', {
      LOGIN_MAX_PER_IP: '1000',
      LOGIN_MAX_PER_ACCOUNT: '2',
    });
    try {
      const sessione = await signIn(bloccante, { email: ADMIN_EMAIL, area: 'impostazioni' });
      const [mia] = await bloccante.db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, ADMIN_EMAIL));
      const prova = (password: string) =>
        bloccante.app.inject({
          method: 'PATCH',
          url: `/accounts/${mia?.id}`,
          headers: sessione.writeHeaders,
          payload: { fullName: 'Altro nome', currentPassword: password },
        });
      expect((await prova('sbagliata-1')).statusCode).toBe(403);
      expect((await prova('sbagliata-2')).statusCode).toBe(403);
      expect((await prova(TEST_PASSWORD)).statusCode).toBe(429);
    } finally {
      await bloccante.teardown();
    }
  });

  it('una password errata nel cambio della password resta registrata come tale', async () => {
    const rifiuto = await harness.app.inject({
      method: 'POST',
      url: '/auth/password',
      headers: admin.writeHeaders,
      payload: {
        currentPassword: 'password-sbagliata-w9',
        newPassword: 'nuova-password-sintetica-1',
      },
    });
    expect(rifiuto.statusCode).toBe(403);
    const righe = await listAll();
    expect(
      righe.filter((i) => i.action === 'auth.password_changed' && i.outcome === 'failure'),
    ).toHaveLength(1);
  });
});

describe('W8-31: ogni redirect nato da un cambio d’indirizzo o di categoria ha la sua riga', () => {
  it('cambio di indirizzo: una riga «redirect.create» per ogni redirect creato', async () => {
    const a = await insertContent('w9-a');
    const [b] = await harness.db
      .insert(schema.contents)
      .values({
        type: 'page',
        status: 'published',
        slug: 'b',
        path: '/w9-a/b/',
        parentId: a,
        title: 'Titolo b',
        publishedAt: new Date(),
      })
      .returning({ id: schema.contents.id });
    if (!b) throw new Error('figlia non creata');
    const spostato = await harness.app.inject({
      method: 'PUT',
      url: `/contents/${b.id}/address`,
      headers: editor.writeHeaders,
      payload: { slug: 'b2', parentId: a },
    });
    expect(spostato.statusCode, spostato.body).toBe(200);

    const righe = (await listAll()).filter((i) => i.action === 'redirect.create');
    const labels = righe.map((i) => i.entityLabel);
    expect(labels).toContain('/w9-a/b/');
    const riga = righe.find((i) => i.entityLabel === '/w9-a/b/');
    expect(riga).toMatchObject({ entityType: 'redirect', outcome: 'success' });
    expect(riga?.entityId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('una regola automatica in arrivo che si toglie lascia «redirect.delete», una riscritta «redirect.update»', async () => {
    const a = await insertContent('w9-c');
    const [b] = await harness.db
      .insert(schema.contents)
      .values({
        type: 'page',
        status: 'published',
        slug: 'b',
        path: '/w9-c/b/',
        parentId: a,
        title: 'Titolo b',
        publishedAt: new Date(),
      })
      .returning({ id: schema.contents.id });
    if (!b) throw new Error('figlia non creata');
    const vai = (slug: string) =>
      harness.app.inject({
        method: 'PUT',
        url: `/contents/${b.id}/address`,
        headers: editor.writeHeaders,
        payload: { slug, parentId: a },
      });
    expect((await vai('b2')).statusCode).toBe(200);
    // Una regola manuale verso il vecchio indirizzo: la seconda mossa la riscrive.
    await harness.db.insert(schema.redirects).values({
      sourcePath: '/w9-c/vecchia/',
      targetPath: '/w9-c/b2/',
      origin: 'manual',
    });
    expect((await vai('b3')).statusCode).toBe(200);
    // Tornando a «b» la regola automatica in arrivo si toglie.
    expect((await vai('b')).statusCode).toBe(200);

    const righe = await listAll();
    expect(
      righe.some((i) => i.action === 'redirect.update' && i.entityLabel === '/w9-c/vecchia/'),
    ).toBe(true);
    expect(righe.some((i) => i.action === 'redirect.delete' && i.entityLabel === '/w9-c/b/')).toBe(
      true,
    );
  });

  it('spostare una categoria: una riga per ogni redirect creato', async () => {
    const madre = await harness.app.inject({
      method: 'POST',
      url: '/terms',
      headers: editor.writeHeaders,
      payload: { taxonomy: 'category', slug: 'madre-w9', name: 'Madre W9' },
    });
    const figlia = await harness.app.inject({
      method: 'POST',
      url: '/terms',
      headers: editor.writeHeaders,
      payload: { taxonomy: 'category', slug: 'figlia-w9', name: 'Figlia W9' },
    });
    expect(madre.statusCode, madre.body).toBe(201);
    expect(figlia.statusCode, figlia.body).toBe(201);
    const madreId = (madre.json() as { id: string }).id;
    const figliaId = (figlia.json() as { id: string }).id;
    // Una notizia pubblicata nella categoria rende l'archivio pubblico: serve un redirect.
    const [notizia] = await harness.db
      .insert(schema.contents)
      .values({
        type: 'post',
        status: 'published',
        slug: 'notizia-w9',
        path: '/notizia-w9/',
        title: 'Notizia W9',
        publishedAt: new Date(),
      })
      .returning({ id: schema.contents.id });
    if (!notizia) throw new Error('notizia non creata');
    await harness.db
      .insert(schema.contentTerms)
      .values({ contentId: notizia.id, termId: figliaId });

    const spostata = await harness.app.inject({
      method: 'PATCH',
      url: `/terms/${figliaId}`,
      headers: editor.writeHeaders,
      payload: { parentId: madreId },
    });
    expect(spostata.statusCode, spostata.body).toBe(200);
    const righe = (await listAll()).filter((i) => i.action === 'redirect.create');
    expect(righe.map((i) => i.entityLabel).join(' ')).toContain('figlia-w9');
  });
});

describe('Giro 1 della revisione', () => {
  /** Una madre pubblicata con una figlia pubblicata: spostarla crea due redirect. */
  async function family(slug: string): Promise<string> {
    const madre = await insertContent(slug);
    await harness.db.insert(schema.contents).values({
      type: 'page',
      status: 'published',
      slug: 'figlia',
      path: `/${slug}/figlia/`,
      parentId: madre,
      title: `Figlia ${slug}`,
      publishedAt: new Date(),
    });
    return madre;
  }

  it('I1: una regola scritta da altri durante il cambio d’indirizzo non diventa una riga di chi sposta', async () => {
    const madre = await family('w9-i1');
    // Il trigger simula un'altra richiesta che scrive una regola fra la fotografia di prima
    // e quella di dopo: corre dentro la transazione dello spostamento, quindi sempre.
    await harness.db.execute(sql`
      create function w9_estranea() returns trigger language plpgsql as $$
      begin
        insert into redirects (source_path, target_path)
        select '/estranea-w9/', '/altrove-w9/'
        where not exists (select 1 from redirects where source_path = '/estranea-w9/');
        return null;
      end $$`);
    await harness.db.execute(
      sql`create trigger w9_estranea after update on contents for each statement execute function w9_estranea()`,
    );
    try {
      const spostata = await harness.app.inject({
        method: 'PUT',
        url: `/contents/${madre}/address`,
        headers: editor.writeHeaders,
        payload: { slug: 'w9-i1-nuova', parentId: null },
      });
      expect(spostata.statusCode, spostata.body).toBe(200);
    } finally {
      await harness.db.execute(sql`drop trigger w9_estranea on contents`);
      await harness.db.execute(sql`drop function w9_estranea()`);
    }
    const etichette = (await listAll('&entityType=redirect')).map((i) => i.entityLabel);
    expect(etichette).toContain('/w9-i1/');
    expect(etichette).toContain('/w9-i1/figlia/');
    expect(etichette).not.toContain('/estranea-w9/');
  });

  it('M3: le righe dei redirect di una richiesta nascono da un solo inserimento', async () => {
    const madre = await family('w9-m3');
    const spostata = await harness.app.inject({
      method: 'PUT',
      url: `/contents/${madre}/address`,
      headers: editor.writeHeaders,
      payload: { slug: 'w9-m3-nuova', parentId: null },
    });
    expect(spostata.statusCode, spostata.body).toBe(200);
    const righe = (await listAll('&entityType=redirect')).filter((i) =>
      i.entityLabel?.startsWith('/w9-m3/'),
    );
    expect(righe).toHaveLength(2);
    // Un solo `insert` assegna a tutte le righe lo stesso istante della sua transazione.
    expect(new Set(righe.map((i) => i.occurredAt)).size).toBe(1);
  });

  it('M1: una riga di un’altra azione con «source: account» resta visibile', async () => {
    await harness.db.insert(schema.auditLog).values({
      action: 'media.upload',
      entityType: 'media',
      outcome: 'success',
      detail: { source: 'account', label: 'sorgente-m1.png' },
    });
    const righe = await listAll('&action=media.upload');
    expect(righe.map((i) => i.entityLabel)).toContain('sorgente-m1.png');
  });

  it('M2: il titolo di un contenuto eliminato si prende solo da una riga di contenuto', async () => {
    const id = '00000000-0000-4000-8000-0000000000a2';
    await harness.db.insert(schema.auditLog).values([
      {
        action: 'content.delete',
        entityType: 'term',
        entityId: id,
        outcome: 'success',
        detail: { title: 'Titolo di un altro tipo' },
      },
      { action: 'content.update', entityType: 'content', entityId: id, outcome: 'success' },
    ]);
    const riga = (await listAll(`&entityId=${id}`)).find((i) => i.action === 'content.update');
    expect(riga).toBeDefined();
    expect(riga?.entityLabel).toBeNull();
  });

  it('M4: una voce di menu senza etichetta non è nominata col suo indirizzo', async () => {
    await harness.db.insert(schema.menus).values({ key: 'w9-m4', label: 'Menu M4' });
    const [menu] = await harness.db
      .select({ id: schema.menus.id })
      .from(schema.menus)
      .where(eq(schema.menus.key, 'w9-m4'));
    if (!menu) throw new Error('menu non creato');
    const [voce] = await harness.db
      .insert(schema.menuItems)
      .values({ menuId: menu.id, kind: 'custom', label: '', url: 'mailto:m4@esempio.invalid' })
      .returning({ id: schema.menuItems.id });
    if (!voce) throw new Error('voce non creata');
    const eliminata = await harness.app.inject({
      method: 'DELETE',
      url: `/menu-items/${voce.id}`,
      headers: editor.writeHeaders,
    });
    expect(eliminata.statusCode, eliminata.body).toBe(204);
    const riga = (await listAll()).find(
      (i) => i.entityId === voce.id && i.action === 'menu.item.delete',
    );
    expect(riga?.entityLabel).toBe('voce senza nome');
  });
});
