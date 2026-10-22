import { schema } from '@amoris/db';
import { sql } from 'drizzle-orm';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { AUTH_ACTIONS } from '../src/auth/audit.js';
import { CHANGE_ACTIONS, DEFAULT_VIEW_ACTIONS } from '../src/modules/audit/actions.js';
import {
  ADMIN_EMAIL,
  BOTH_EMAIL,
  createHarness,
  fakeObjectStore,
  signIn,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W2, T1: `GET /audit` (area Impostazioni, permesso `audit.read`) e i
 * casi di attenzione del §6. Solo dati sintetici `*@esempio.invalid`.
 */

let harness: Harness;
let admin: Signed;

beforeAll(async () => {
  harness = await createHarness('api_audit');
  admin = await signIn(harness, { email: ADMIN_EMAIL, area: 'impostazioni' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

interface Item {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorLabel: string | null;
  actorRoleLabel: string | null;
  actorArea: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  entityLabel: string | null;
  contentType: 'page' | 'post' | null;
  outcome: 'success' | 'failure';
}

interface Page {
  items: Item[];
  nextCursor: string | null;
}

type Query = Record<string, string | number>;

async function get(query: Query = {}, signed: Signed = admin) {
  const qs = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
  return harness.app.inject({
    method: 'GET',
    url: `/audit?${qs.toString()}`,
    headers: { cookie: signed.cookie },
  });
}

async function page(query: Query = {}): Promise<Page> {
  const risposta = await get(query);
  expect(risposta.statusCode, risposta.body).toBe(200);
  return risposta.json() as Page;
}

type NewRow = Partial<typeof schema.auditLog.$inferInsert> & { action: string };

async function seed(row: NewRow): Promise<void> {
  await harness.db.insert(schema.auditLog).values(row);
}

describe('elenco chiuso delle azioni', () => {
  it('coincide con le azioni dichiarate dai moduli più le tre scelte a runtime', () => {
    const modules = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/modules');
    const declared = new Set<string>();
    for (const dir of readdirSync(modules)) {
      let source = '';
      try {
        source = readFileSync(path.join(modules, dir, 'routes.ts'), 'utf8');
      } catch {
        continue;
      }
      for (const match of source.matchAll(/audit:\s*\{\s*action:\s*'([^']+)'/g)) {
        declared.add(match[1] ?? '');
      }
    }
    expect(declared.size).toBe(28);
    const runtime = ['account.deactivate', 'account.reactivate', 'account.roles'];
    expect([...CHANGE_ACTIONS].sort()).toEqual([...declared, ...runtime].sort());
  });
});

describe('ordine e paginazione', () => {
  it('righe nello stesso istante non si perdono né si ripetono fra le pagine', async () => {
    const instant = new Date('2026-03-01T10:00:00.123Z');
    for (let n = 0; n < 5; n += 1) {
      await seed({
        action: 'content.update',
        entityType: 'content',
        entityId: 'sync',
        occurredAt: instant,
      });
    }
    const first = await page({ entityId: 'sync', limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await page({ entityId: 'sync', limit: 2, cursor: first.nextCursor ?? '' });
    expect(second.items).toHaveLength(2);
    const third = await page({ entityId: 'sync', limit: 2, cursor: second.nextCursor ?? '' });
    expect(third.items).toHaveLength(1);
    expect(third.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items, ...third.items].map((item) => BigInt(item.id));
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? 1 : -1)));
  });

  it('il cursore regge istanti che differiscono sotto il millisecondo', async () => {
    // Microsecondi distinti: il cursore non deve troncarli al millisecondo.
    for (const micros of ['100', '200', '300', '400']) {
      await harness.db.execute(
        sql`insert into audit_log (action, entity_id, occurred_at) values ('content.update', 'micro', ${`2026-03-05T10:00:00.123${micros}Z`}::timestamptz)`,
      );
    }
    const first = await page({ entityId: 'micro', limit: 3 });
    const second = await page({ entityId: 'micro', limit: 3, cursor: first.nextCursor ?? '' });
    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(second.nextCursor).toBeNull();
  });

  it('dalla più recente: occurred_at decrescente', async () => {
    for (const day of ['02', '04', '03']) {
      await seed({
        action: 'content.update',
        entityId: 'ord',
        occurredAt: new Date(`2026-03-${day}T10:00:00Z`),
      });
    }
    const { items } = await page({ entityId: 'ord' });
    expect(items.map((item) => item.occurredAt.slice(0, 10))).toEqual([
      '2026-03-04',
      '2026-03-03',
      '2026-03-02',
    ]);
  });

  it('limite predefinito 50', async () => {
    for (let n = 0; n < 55; n += 1) await seed({ action: 'content.update', entityId: 'molte' });
    const { items, nextCursor } = await page({ entityId: 'molte' });
    expect(items).toHaveLength(50);
    expect(nextCursor).not.toBeNull();
  });
});

describe('vista e filtri', () => {
  it('la vista predefinita è «changes»: niente accessi né invii dei form', async () => {
    await seed({ action: AUTH_ACTIONS.login, entityId: 'vista' });
    await seed({ action: 'POST /forms/:slug/submissions', entityId: 'vista' });
    await seed({ action: 'content.create', entityId: 'vista' });
    const predefinita = await page({ entityId: 'vista' });
    expect(predefinita.items.map((item) => item.action)).toEqual(['content.create']);
    const esplicita = await page({ entityId: 'vista', view: 'changes' });
    expect(esplicita.items).toHaveLength(1);
    const tutto = await page({ entityId: 'vista', view: 'all' });
    expect(tutto.items.map((item) => item.action).sort()).toEqual(
      ['POST /forms/:slug/submissions', 'auth.login', 'content.create'].sort(),
    );
  });

  it('DR-233: la vista predefinita non mostra le copie di lavoro, «all» e il filtro per azione sì', async () => {
    await seed({ action: 'content.draft.save', entityType: 'content', entityId: 'copie' });
    await seed({ action: 'content.draft.discard', entityType: 'content', entityId: 'copie' });
    await seed({ action: 'content.update', entityType: 'content', entityId: 'copie' });
    const predefinita = await page({ entityId: 'copie' });
    expect(predefinita.items.map((item) => item.action)).toEqual(['content.update']);
    const esplicita = await page({ entityId: 'copie', view: 'changes' });
    expect(esplicita.items.map((item) => item.action)).toEqual(['content.update']);
    const tutto = await page({ entityId: 'copie', view: 'all' });
    expect(tutto.items.map((item) => item.action).sort()).toEqual([
      'content.draft.discard',
      'content.draft.save',
      'content.update',
    ]);
    // Un'azione esplicita prevale sulla vista, anche senza `view`.
    const salvataggi = await page({ entityId: 'copie', action: 'content.draft.save' });
    expect(salvataggi.items.map((item) => item.action)).toEqual(['content.draft.save']);
    const scarti = await page({ entityId: 'copie', action: 'content.draft.discard' });
    expect(scarti.items.map((item) => item.action)).toEqual(['content.draft.discard']);
  });

  it('DR-233: la vista predefinita deriva da CHANGE_ACTIONS meno le due copie di lavoro', () => {
    expect([...DEFAULT_VIEW_ACTIONS].sort()).toEqual(
      CHANGE_ACTIONS.filter(
        (a) => a !== 'content.draft.save' && a !== 'content.draft.discard',
      ).sort(),
    );
    expect(DEFAULT_VIEW_ACTIONS).toHaveLength(CHANGE_ACTIONS.length - 2);
  });

  it('S5: il cambio d’indirizzo è una modifica al sito e compare nella vista predefinita', async () => {
    await seed({ action: 'content.address.update', entityType: 'content', entityId: 'indirizzo' });
    const predefinita = await page({ entityId: 'indirizzo' });
    expect(predefinita.items.map((item) => item.action)).toEqual(['content.address.update']);
    const filtrata = await page({ action: 'content.address.update', entityId: 'indirizzo' });
    expect(filtrata.items).toHaveLength(1);
  });

  it('la vista «all» include anche le azioni non dichiarate', async () => {
    await seed({ action: 'POST /qualcosa-di-nuovo', entityId: 'vista-all' });
    expect((await page({ entityId: 'vista-all' })).items).toHaveLength(0);
    expect((await page({ entityId: 'vista-all', view: 'all' })).items).toHaveLength(1);
  });

  it('filtra per tipo e id di oggetto; «content» include «content_seo»', async () => {
    await seed({ action: 'content.update', entityType: 'content', entityId: 'cx' });
    await seed({ action: 'seo.content.update', entityType: 'content_seo', entityId: 'cx' });
    await seed({ action: 'media.update', entityType: 'media', entityId: 'cx' });
    const contenuto = await page({ entityType: 'content', entityId: 'cx' });
    expect(contenuto.items.map((item) => item.entityType).sort()).toEqual([
      'content',
      'content_seo',
    ]);
    const media = await page({ entityType: 'media', entityId: 'cx' });
    expect(media.items.map((item) => item.entityType)).toEqual(['media']);
    const seo = await page({ entityType: 'content_seo', entityId: 'cx' });
    expect(seo.items.map((item) => item.entityType)).toEqual(['content_seo']);
  });

  it('filtra per persona', async () => {
    await seed({
      action: 'content.update',
      entityId: 'pers',
      actorUserId: harness.userId,
      actorLabel: 'A',
    });
    await seed({ action: 'content.update', entityId: 'pers', actorLabel: 'B' });
    const { items } = await page({ entityId: 'pers', actorUserId: harness.userId });
    expect(items).toHaveLength(1);
    expect(items[0]?.actorUserId).toBe(harness.userId);
  });

  it('filtra per azione, anche di accesso, e per esito', async () => {
    await seed({ action: 'content.update', entityId: 'az', outcome: 'failure' });
    await seed({ action: 'content.create', entityId: 'az' });
    await seed({ action: AUTH_ACTIONS.login, entityId: 'az' });
    expect((await page({ entityId: 'az', action: 'content.create' })).items).toHaveLength(1);
    expect((await page({ entityId: 'az', action: AUTH_ACTIONS.login })).items).toHaveLength(1);
    const falliti = await page({ entityId: 'az', outcome: 'failure' });
    expect(falliti.items.map((item) => item.action)).toEqual(['content.update']);
    expect((await page({ entityId: 'az', outcome: 'success' })).items).toHaveLength(1);
  });

  it('accetta il letterale degli invii dei form come azione', async () => {
    await seed({ action: 'POST /forms/:slug/submissions', entityId: 'form-az' });
    const { items } = await page({ entityId: 'form-az', action: 'POST /forms/:slug/submissions' });
    expect(items).toHaveLength(1);
  });

  it('«to» con la sola data è escluso: mezzanotte UTC di quel giorno', async () => {
    for (const day of ['01', '02', '03']) {
      await seed({
        action: 'content.update',
        entityId: 'per-data',
        occurredAt: new Date(`2026-06-${day}T12:00:00Z`),
      });
    }
    const { items } = await page({ entityId: 'per-data', to: '2026-06-03' });
    expect(items.map((item) => item.occurredAt.slice(0, 10))).toEqual(['2026-06-02', '2026-06-01']);
  });

  it('periodo: chiuso a sinistra, aperto a destra', async () => {
    for (const day of ['01', '02', '03']) {
      await seed({
        action: 'content.update',
        entityId: 'per',
        occurredAt: new Date(`2026-04-${day}T00:00:00Z`),
      });
    }
    const { items } = await page({
      entityId: 'per',
      from: '2026-04-01T00:00:00.000Z',
      to: '2026-04-03T00:00:00.000Z',
    });
    expect(items.map((item) => item.occurredAt.slice(0, 10))).toEqual(['2026-04-02', '2026-04-01']);
    const giorni = await page({ entityId: 'per', from: '2026-04-02' });
    expect(giorni.items).toHaveLength(2);
  });
});

describe('etichetta dell’oggetto', () => {
  it('titolo del contenuto, del media e della voce di menu; null se eliminati', async () => {
    const [contenuto] = await harness.db
      .insert(schema.contents)
      .values({
        type: 'page',
        status: 'draft',
        slug: 'etichetta',
        path: '/etichetta/',
        title: 'Titolo vivo',
        blocks: { schema: 1, blocks: [] },
      })
      .returning({ id: schema.contents.id });
    const [conTitolo, senzaTitolo] = await harness.db
      .insert(schema.media)
      .values([
        {
          storageKey: 'e/uno.png',
          publicPath: '/media/e/uno.png',
          fileName: 'uno.png',
          title: 'Media titolato',
          mimeType: 'image/png',
          byteSize: 1,
          checksum: Buffer.from('a'.repeat(32)),
          uploadedAt: new Date(),
        },
        {
          storageKey: 'e/due.png',
          publicPath: '/media/e/due.png',
          fileName: 'due.png',
          mimeType: 'image/png',
          byteSize: 1,
          checksum: Buffer.from('b'.repeat(32)),
          uploadedAt: new Date(),
        },
      ])
      .returning({ id: schema.media.id });
    const [menu] = await harness.db
      .insert(schema.menus)
      .values({ key: 'principale', label: 'Principale' })
      .returning({ id: schema.menus.id });
    if (!contenuto || !conTitolo || !senzaTitolo || !menu) throw new Error('dati di prova');
    const [voce] = await harness.db
      .insert(schema.menuItems)
      .values({ menuId: menu.id, kind: 'custom', label: 'Voce viva', url: '/x/' })
      .returning({ id: schema.menuItems.id });
    if (!voce) throw new Error('voce non creata');
    const gone = '00000000-0000-4000-8000-000000000001';
    await seed({ action: 'content.update', entityType: 'content', entityId: contenuto.id });
    await seed({ action: 'seo.content.update', entityType: 'content_seo', entityId: contenuto.id });
    await seed({ action: 'media.update', entityType: 'media', entityId: conTitolo.id });
    await seed({ action: 'media.update', entityType: 'media', entityId: senzaTitolo.id });
    await seed({ action: 'menu.item.update', entityType: 'menu_item', entityId: voce.id });
    await seed({ action: 'content.delete', entityType: 'content', entityId: gone });
    await seed({ action: 'term.update', entityType: 'term', entityId: gone });
    await seed({ action: 'setting.update', entityType: 'setting', entityId: 'site_title' });
    const { items } = await page({ limit: 100 });
    const labelOf = (type: string, id: string) =>
      items.find((i) => i.entityType === type && i.entityId === id)?.entityLabel;
    expect(labelOf('content', contenuto.id)).toBe('Titolo vivo');
    expect(labelOf('content_seo', contenuto.id)).toBe('Titolo vivo');
    expect(labelOf('media', conTitolo.id)).toBe('Media titolato');
    expect(labelOf('media', senzaTitolo.id)).toBe('due.png');
    expect(labelOf('menu_item', voce.id)).toBe('Voce viva');
    expect(labelOf('content', gone)).toBeNull();
    expect(labelOf('term', gone)).toBeNull();
    expect(labelOf('setting', 'site_title')).toBeNull();
    const typeOf = (type: string, id: string) =>
      items.find((i) => i.entityType === type && i.entityId === id)?.contentType;
    expect(typeOf('content', contenuto.id)).toBe('page');
    expect(typeOf('content_seo', contenuto.id)).toBe('page');
    expect(typeOf('content', gone)).toBeNull();
    expect(typeOf('media', conTitolo.id)).toBeNull();
  });

  it('contenuto dal titolo vuoto: l’etichetta è il percorso; eliminato resta null (anche content_seo)', async () => {
    const [home] = await harness.db
      .insert(schema.contents)
      .values({
        type: 'page',
        status: 'draft',
        slug: 'home-vuota',
        path: '/home-vuota/',
        title: '',
        blocks: { schema: 1, blocks: [] },
      })
      .returning({ id: schema.contents.id });
    if (!home) throw new Error('home non creata');
    const gone = '00000000-0000-4000-8000-0000000000aa';
    await seed({ action: 'content.update', entityType: 'content', entityId: home.id });
    await seed({ action: 'seo.content.update', entityType: 'content_seo', entityId: home.id });
    await seed({ action: 'seo.content.update', entityType: 'content_seo', entityId: gone });
    const { items } = await page({ limit: 100 });
    const find = (type: string, id: string) =>
      items.find((i) => i.entityType === type && i.entityId === id);
    expect(find('content', home.id)).toMatchObject({
      entityLabel: '/home-vuota/',
      contentType: 'page',
    });
    expect(find('content_seo', home.id)?.entityLabel).toBe('/home-vuota/');
    expect(find('content_seo', gone)).toMatchObject({ entityLabel: null, contentType: null });
  });

  it('contentType distingue le notizie dalle pagine', async () => {
    const [notizia] = await harness.db
      .insert(schema.contents)
      .values({
        type: 'post',
        status: 'draft',
        slug: 'una-notizia',
        path: '/una-notizia/',
        title: 'Notizia viva',
        blocks: { schema: 1, blocks: [] },
      })
      .returning({ id: schema.contents.id });
    if (!notizia) throw new Error('notizia non creata');
    await seed({ action: 'content.update', entityType: 'content', entityId: notizia.id });
    const { items } = await page({ entityType: 'content', entityId: notizia.id });
    expect(items[0]?.contentType).toBe('post');
  });
});

describe('GET /audit/contents', () => {
  async function search(query: string, signed: Signed = admin) {
    return harness.app.inject({
      method: 'GET',
      url: `/audit/contents?search=${encodeURIComponent(query)}`,
      headers: { cookie: signed.cookie },
    });
  }

  it('cerca per titolo, al massimo dieci, con id, titolo e tipo', async () => {
    await harness.db.insert(schema.contents).values(
      Array.from({ length: 12 }, (_, n) => ({
        type: n === 0 ? ('post' as const) : ('page' as const),
        status: 'draft' as const,
        slug: `cercami-${n}`,
        path: `/cercami-${n}/`,
        title: `Cercami ${n}`,
        blocks: { schema: 1, blocks: [] },
      })),
    );
    const risposta = await search('cercami');
    expect(risposta.statusCode, risposta.body).toBe(200);
    expect(risposta.headers['cache-control']).toBe('no-store');
    const { items } = risposta.json() as {
      items: { id: string; title: string; type: string }[];
    };
    expect(items).toHaveLength(10);
    expect(Object.keys(items[0] ?? {}).sort()).toEqual(['id', 'title', 'type']);
    const unico = (await search('Cercami 0')).json() as { items: { type: string }[] };
    expect(unico.items[0]?.type).toBe('post');
  });

  it('trova anche per percorso e restituisce il percorso se il titolo è vuoto', async () => {
    await harness.db.insert(schema.contents).values({
      type: 'page',
      status: 'draft',
      slug: 'senza-titolo',
      path: '/senza-titolo-xyz/',
      title: '',
      blocks: { schema: 1, blocks: [] },
    });
    const { items } = (await search('senza-titolo-xyz')).json() as {
      items: { title: string; type: string }[];
    };
    expect(items).toEqual([expect.objectContaining({ title: '/senza-titolo-xyz/', type: 'page' })]);
  });

  it('i caratteri jolly valgono come lettere anche nel percorso', async () => {
    expect(((await search('_')).json() as { items: unknown[] }).items).toHaveLength(0);
  });

  it('caratteri di controllo nel testo cercato: 400', async () => {
    expect((await search('a\u0000b')).statusCode).toBe(400);
  });

  it('i caratteri jolly del testo cercato valgono come lettere', async () => {
    const { items } = (await search('%')).json() as { items: unknown[] };
    expect(items).toHaveLength(0);
  });

  it('senza testo 400; la redazione 403; senza sessione 401', async () => {
    expect((await search('')).statusCode).toBe(400);
    const redazione = await signIn(harness);
    expect((await search('cercami', redazione)).statusCode).toBe(403);
    const anonimo = await harness.app.inject({ method: 'GET', url: '/audit/contents?search=x' });
    expect(anonimo.statusCode).toBe(401);
  });
});

describe('persona assente e campi riservati', () => {
  it('mostra l’etichetta registrata allora, o nulla se non c’è persona', async () => {
    await seed({
      action: 'content.update',
      entityId: 'chi',
      actorUserId: null,
      actorLabel: 'Rosalba',
      actorRoleLabel: 'Tesoreria',
      actorArea: 'redazione',
    });
    await seed({ action: 'POST /forms/:slug/submissions', entityId: 'chi2' });
    const [con] = (await page({ entityId: 'chi' })).items;
    expect(con).toMatchObject({
      actorLabel: 'Rosalba',
      actorRoleLabel: 'Tesoreria',
      actorArea: 'redazione',
    });
    const [senza] = (await page({ entityId: 'chi2', view: 'all' })).items;
    expect(senza).toMatchObject({ actorLabel: null, actorUserId: null });
  });

  it('l’impronta dell’identificativo di un accesso fallito non esce', async () => {
    const fingerprint = 'impronta-identificativo-sintetica-0123456789';
    await seed({
      action: AUTH_ACTIONS.login,
      outcome: 'failure',
      entityType: 'auth.identifier',
      entityId: fingerprint,
    });
    for (const query of [{ view: 'all' }, { action: AUTH_ACTIONS.login }] as const) {
      const risposta = await get({ ...query, outcome: 'failure' });
      expect(risposta.statusCode).toBe(200);
      expect(risposta.body).not.toContain(fingerprint);
      const riga = (risposta.json() as Page).items.find((i) => i.entityType === 'auth.identifier');
      expect(riga?.entityId).toBeNull();
    }
    // Filtrando per l'impronta non si ritrova nulla: le righe `auth.identifier` restano escluse.
    const perImpronta = await get({ view: 'all', entityId: fingerprint });
    expect(perImpronta.statusCode).toBe(200);
    expect((perImpronta.json() as Page).items).toHaveLength(0);
  });

  it('W2-7: la risposta ha solo i campi dell’elenco chiuso', async () => {
    await seed({
      action: 'content.update',
      entityId: 'campi',
      ipHash: Buffer.from('impronta-sintetica'),
      sessionId: null,
      detail: { segreto: 'non-deve-uscire' },
    });
    const risposta = await get({ entityId: 'campi' });
    expect(risposta.body).not.toMatch(/ipHash|sessionId|detail|segreto|impronta/i);
    expect(risposta.headers['cache-control']).toBe('no-store');
    const [item] = (risposta.json() as Page).items;
    expect(Object.keys(item ?? {}).sort()).toEqual(
      [
        'action',
        'actorArea',
        'actorLabel',
        'actorRoleLabel',
        'actorUserId',
        'entityId',
        'contentType',
        'entityLabel',
        'entityType',
        'id',
        'occurredAt',
        'outcome',
      ].sort(),
    );
  });
});

const cursorOf = (raw: string): string => Buffer.from(raw, 'utf8').toString('base64url');

describe('filtri incoerenti: 400 in italiano', () => {
  const cases: [string, Query][] = [
    ['from dopo to', { from: '2026-05-02T00:00:00Z', to: '2026-05-01T00:00:00Z' }],
    ['limit 0', { limit: 0 }],
    ['limit 1000', { limit: 1000 }],
    ['azione sconosciuta', { action: 'content.inventata' }],
    ['esito sconosciuto', { outcome: 'forse' }],
    ['vista sconosciuta', { view: 'niente' }],
    ['persona non uuid', { actorUserId: 'non-un-uuid' }],
    ['data non ISO', { from: 'ieri' }],
    ['cursore non valido', { cursor: 'spazzatura' }],
    ['cursore con data impossibile', { cursor: cursorOf('2026-13-45T10:00:00.123456Z|5') }],
    ['cursore con 30 febbraio', { cursor: cursorOf('2026-02-30T10:00:00.123456Z|5') }],
    ['cursore con 31 febbraio', { cursor: cursorOf('2026-02-31T10:00:00.123456Z|5') }],
    ['from con anno 0000', { from: '0000-01-01T00:00:00Z' }],
    ['to con anno 0000', { to: '0000-01-01' }],
    ['cursore con anno 0000', { cursor: cursorOf('0000-01-01T10:00:00.123456Z|5') }],
    ['entityType con byte NUL', { entityType: 'content\u0000x' }],
    ['entityId con byte NUL', { entityId: 'a\u0000b' }],
    ['entityId con carattere di controllo', { entityId: 'a\u0007b' }],
    [
      'cursore con id oltre bigint',
      { cursor: cursorOf('2026-03-01T10:00:00.123456Z|9223372036854775808') },
    ],
  ];
  for (const [nome, query] of cases) {
    it(nome, async () => {
      const risposta = await get(query);
      expect(risposta.statusCode, risposta.body).toBe(400);
      const { error } = risposta.json() as { error: { code: string; message: string } };
      expect(error.code).toMatch(/^[A-Z][A-Z_]+$/);
      expect(error.message).toMatch(/non è valida/);
    });
  }
});

describe('accesso', () => {
  it('senza sessione 401; la redazione 403 (W2-4)', async () => {
    const anonimo = await harness.app.inject({ method: 'GET', url: '/audit' });
    expect(anonimo.statusCode).toBe(401);
    const redazione = await signIn(harness);
    expect((await get({}, redazione)).statusCode).toBe(403);
  });

  it('chi ha entrambi i ruoli: 403 in Redazione, 200 in Impostazioni', async () => {
    const inRedazione = await signIn(harness, { email: BOTH_EMAIL, area: 'redazione' });
    expect((await get({}, inRedazione)).statusCode).toBe(403);
    const inImpostazioni = await signIn(harness, { email: BOTH_EMAIL, area: 'impostazioni' });
    expect((await get({}, inImpostazioni)).statusCode).toBe(200);
  });

  it('S13: un rifiuto non lascia partire il gestore', async () => {
    const probe = await buildApp(harness.config, { objectStore: fakeObjectStore() });
    let reached = false;
    await probe.register(async (scoped) => {
      scoped.route({
        method: 'GET',
        url: '/__audit/probe',
        config: { area: 'impostazioni' },
        onRequest: probe.requirePermission('audit.read'),
        handler: () => {
          reached = true;
          return { ok: true };
        },
      });
    });
    await probe.ready();
    const redazione = await signIn(harness);
    const risposta = await probe.inject({
      method: 'GET',
      url: '/__audit/probe',
      headers: { cookie: redazione.cookie },
    });
    expect(risposta.statusCode).toBe(403);
    expect(reached).toBe(false);
    await probe.close();
  });

  it('la lettura del registro non scrive nel registro', async () => {
    const prima = await harness.db.select({ id: schema.auditLog.id }).from(schema.auditLog);
    await get({ view: 'all' });
    const dopo = await harness.db.select({ id: schema.auditLog.id }).from(schema.auditLog);
    expect(dopo.length).toBe(prima.length);
  });
});
