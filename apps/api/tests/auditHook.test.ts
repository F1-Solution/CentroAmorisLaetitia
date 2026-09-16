import { schema } from '@amoris/db';
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness, type Signed } from './_support/harness.js';

/**
 * Criterio di uscita 20 e ADR-001 §3 punto 3: **ogni** richiesta che modifica
 * dati produce una riga di registro, scritta da un **hook unico**.
 *
 * Il criterio dice «ogni», quindi il test non ne prova una: le prova tutte,
 * scorrendo le rotte di scrittura dei moduli di dominio.
 */

let harness: Harness;
let signed: Signed;

beforeAll(async () => {
  harness = await createHarness('api_audit_hook');
  signed = await signIn(harness);
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

async function auditRows(): Promise<number> {
  const [row] = await harness.db.select({ value: count() }).from(schema.auditLog);
  return row?.value ?? 0;
}

describe('registro delle operazioni', () => {
  it('una scrittura riuscita produce esattamente una riga', async () => {
    const prima = await auditRows();
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: signed.writeHeaders,
      payload: { type: 'page', slug: 'con-registro', title: 'Con registro' },
    });
    expect(risposta.statusCode).toBe(201);
    expect(await auditRows()).toBe(prima + 1);
  });

  it('la riga dice chi ha agito, che cosa e su quale entità', async () => {
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/terms',
      headers: signed.writeHeaders,
      payload: { taxonomy: 'category', slug: 'registrata', name: 'Registrata' },
    });
    expect(risposta.statusCode).toBe(201);

    const [riga] = await harness.db
      .select({
        action: schema.auditLog.action,
        actorUserId: schema.auditLog.actorUserId,
        entityType: schema.auditLog.entityType,
        outcome: schema.auditLog.outcome,
        ipHash: schema.auditLog.ipHash,
      })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'term.create'));

    expect(riga?.actorUserId).toBe(harness.userId);
    expect(riga?.entityType).toBe('term');
    expect(riga?.outcome).toBe('success');
    // L'indirizzo c'è come digest, mai in chiaro.
    expect(riga?.ipHash).toBeInstanceOf(Buffer);
  });

  it('anche una scrittura **fallita** lascia la sua riga, con esito di fallimento', async () => {
    const prima = await auditRows();
    const risposta = await harness.app.inject({
      method: 'PATCH',
      url: '/contents/00000000-0000-4000-8000-000000000000',
      headers: signed.writeHeaders,
      payload: { title: 'Contenuto inesistente' },
    });
    expect(risposta.statusCode).toBe(404);
    expect(await auditRows()).toBe(prima + 1);

    const righe = await harness.db
      .select({ outcome: schema.auditLog.outcome })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'content.update'));
    expect(righe.some((riga) => riga.outcome === 'failure')).toBe(true);
  });

  it('una lettura non sporca il registro', async () => {
    const prima = await auditRows();
    await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: signed.cookie },
    });
    await harness.app.inject({
      method: 'GET',
      url: '/settings',
      headers: { cookie: signed.cookie },
    });
    expect(await auditRows()).toBe(prima);
  });

  it('ogni rotta di scrittura dei moduli di dominio lascia la sua riga', async () => {
    const [content] = await harness.db
      .select({ id: schema.contents.id })
      .from(schema.contents)
      .limit(1);
    if (!content) throw new Error('serve almeno un contenuto');

    const [menu] = await harness.db
      .insert(schema.menus)
      .values({ key: 'principale', label: 'Principale' })
      .returning({ id: schema.menus.id });
    if (!menu) throw new Error('menu di prova non creato');

    await harness.db.insert(schema.settings).values({
      key: 'sito.titolo',
      value: 'Titolo sintetico',
      label: 'Titolo del sito',
    });

    const scritture = [
      {
        method: 'POST' as const,
        url: '/media',
        azione: 'media.upload',
        payload: undefined,
      },
      {
        method: 'POST' as const,
        url: '/redirects',
        azione: 'redirect.create',
        payload: { sourcePath: '/vecchio/', targetPath: '/nuovo/' },
      },
      {
        method: 'PUT' as const,
        url: '/settings/sito.titolo',
        azione: 'setting.update',
        payload: { value: 'Altro titolo' },
      },
      {
        method: 'PUT' as const,
        url: '/seo/templates/page',
        azione: 'seo.template.update',
        payload: { titleTemplate: '{title} - {site_title}' },
      },
      {
        method: 'PUT' as const,
        url: `/seo/contents/${content.id}`,
        azione: 'seo.content.update',
        payload: { title: 'Titolo SEO' },
      },
      {
        method: 'POST' as const,
        url: '/menus/principale/items',
        azione: 'menu.item.create',
        payload: { kind: 'custom', label: 'Esterno', url: 'https://esempio.invalid/' },
      },
      {
        method: 'POST' as const,
        url: `/contents/${content.id}/publish`,
        azione: 'content.publish',
        payload: undefined,
      },
    ];

    for (const scrittura of scritture) {
      await harness.app.inject({
        method: scrittura.method,
        url: scrittura.url,
        headers: signed.writeHeaders,
        ...(scrittura.payload ? { payload: scrittura.payload } : {}),
      });

      const righe = await harness.db
        .select({ id: schema.auditLog.id })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, scrittura.azione));
      expect(righe.length, `manca la riga di registro per ${scrittura.azione}`).toBeGreaterThan(0);
    }
  });
});
