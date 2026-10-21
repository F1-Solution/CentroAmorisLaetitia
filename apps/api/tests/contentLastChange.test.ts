import { schema } from '@amoris/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createHarness,
  signIn,
  TEST_FULL_NAME,
  type Harness,
  type Signed,
} from './_support/harness.js';

/**
 * Wave 1G-W2, T2: la creazione registra l'id del contenuto (W2-6) e
 * `lastChange` di `GET /contents/:id` segue D127. Dati sintetici.
 */

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_last_change');
  signed = await signIn(harness, { area: 'redazione' });
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

async function create(slug: string): Promise<string> {
  const risposta = await harness.app.inject({
    method: 'POST',
    url: '/contents',
    headers: signed.writeHeaders,
    payload: { type: 'page', slug, title: `Titolo ${slug}` },
  });
  expect(risposta.statusCode, risposta.body).toBe(201);
  return risposta.json().id as string;
}

async function read(id: string) {
  const risposta = await harness.app.inject({
    method: 'GET',
    url: `/contents/${id}`,
    headers: { cookie: signed.cookie },
  });
  expect(risposta.statusCode).toBe(200);
  return risposta.json() as { updatedAt: string; blocks: unknown; lastChange: unknown };
}

const send = (method: 'PATCH' | 'PUT' | 'POST', url: string, payload?: Record<string, unknown>) =>
  harness.app.inject({ method, url, headers: signed.writeHeaders, payload });

describe('POST /contents registra l’id creato (W2-6)', () => {
  it('la riga di content.create porta l’entityId del contenuto nato', async () => {
    const id = await create('registra-id');
    const [riga] = await harness.db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.action, 'content.create'), eq(schema.auditLog.entityId, id)));
    expect(riga?.entityType).toBe('content');
    expect(riga?.outcome).toBe('success');
  });
});

describe('GET /contents/:id porta un nome di persona', () => {
  it('non resta in cache (no-store)', async () => {
    const id = await create('no-store');
    const risposta = await harness.app.inject({
      method: 'GET',
      url: `/contents/${id}`,
      headers: { cookie: signed.cookie },
    });
    expect(risposta.headers['cache-control']).toBe('no-store');
  });
});

describe('lastChange (D127)', () => {
  it('dopo la creazione: la persona e l’ora della creazione', async () => {
    const id = await create('ultima-uno');
    const { lastChange } = await read(id);
    expect(lastChange).toMatchObject({ actorLabel: TEST_FULL_NAME });
    expect(Date.parse((lastChange as { occurredAt: string }).occurredAt)).not.toBeNaN();
  });

  it('una modifica riuscita sposta la data', async () => {
    const id = await create('ultima-due');
    const prima = (await read(id)).lastChange as { occurredAt: string };
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await send('PATCH', `/contents/${id}`, { excerpt: 'nuovo' })).statusCode).toBe(200);
    const dopo = (await read(id)).lastChange as { occurredAt: string };
    expect(Date.parse(dopo.occurredAt)).toBeGreaterThan(Date.parse(prima.occurredAt));
  });

  it('una copia di lavoro salvata non la cambia', async () => {
    const id = await create('ultima-bozza');
    const letto = await read(id);
    const prima = letto.lastChange;
    const bozza = await send('PUT', `/contents/${id}/draft`, {
      title: 'Titolo in bozza',
      excerpt: null,
      blocks: letto.blocks as Record<string, unknown>,
      baseUpdatedAt: letto.updatedAt,
    });
    expect(bozza.statusCode, bozza.body).toBe(200);
    expect((await read(id)).lastChange).toEqual(prima);
  });

  it('un tentativo fallito non la cambia', async () => {
    const id = await create('ultima-fallita');
    const prima = (await read(id)).lastChange;
    const fallito = await send('PATCH', `/contents/${id}`, { title: '' });
    expect(fallito.statusCode).toBe(400);
    // Riga di fallimento esplicita, successiva a quella di creazione.
    await harness.db.insert(schema.auditLog).values({
      action: 'content.update',
      entityType: 'content',
      entityId: id,
      outcome: 'failure',
      actorLabel: 'Altra Persona',
      occurredAt: new Date(Date.now() + 60_000),
    });
    expect((await read(id)).lastChange).toEqual(prima);
  });

  it('il titolo SEO la cambia', async () => {
    const id = await create('ultima-seo');
    const prima = (await read(id)).lastChange as { occurredAt: string };
    await new Promise((resolve) => setTimeout(resolve, 20));
    const seo = await send('PUT', `/seo/contents/${id}`, { title: 'Titolo SEO' });
    expect(seo.statusCode, seo.body).toBe(200);
    const dopo = (await read(id)).lastChange as { occurredAt: string };
    expect(Date.parse(dopo.occurredAt)).toBeGreaterThan(Date.parse(prima.occurredAt));
  });

  it('pubblicazione e ritiro contano', async () => {
    const id = await create('ultima-pubblica');
    const prima = (await read(id)).lastChange as { occurredAt: string };
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await send('POST', `/contents/${id}/publish`)).statusCode).toBe(200);
    const dopo = (await read(id)).lastChange as { occurredAt: string };
    expect(Date.parse(dopo.occurredAt)).toBeGreaterThan(Date.parse(prima.occurredAt));
  });

  it('senza righe: importedAt da modified_at', async () => {
    const id = await create('ultima-importata');
    await harness.db
      .delete(schema.auditLog)
      .where(and(eq(schema.auditLog.entityType, 'content'), eq(schema.auditLog.entityId, id)));
    const modifiedAt = new Date('2025-06-15T08:30:00.000Z');
    await harness.db.update(schema.contents).set({ modifiedAt }).where(eq(schema.contents.id, id));
    expect((await read(id)).lastChange).toEqual({ importedAt: modifiedAt.toISOString() });
  });

  it('senza righe e senza modified_at: null', async () => {
    const id = await create('ultima-nulla');
    await harness.db
      .delete(schema.auditLog)
      .where(and(eq(schema.auditLog.entityType, 'content'), eq(schema.auditLog.entityId, id)));
    expect((await read(id)).lastChange).toBeNull();
  });
});
