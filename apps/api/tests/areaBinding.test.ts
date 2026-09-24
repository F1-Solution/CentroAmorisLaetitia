import { schema } from '@amoris/db';
import { desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, signIn, type Harness } from './_support/harness.js';

/**
 * Criterio di uscita 24, riscritto il 2026-09-20 da **DR-067**, che attua
 * DR-050 per intero.
 *
 * La cosa da provare non è che manchi un permesso: è che il permesso **non
 * basti**. `ux-proposals.md` §4.4 punto 2: finché si lavora in un'area il
 * sistema rifiuta i dati di un'altra area *anche se l'account avrebbe il
 * permesso*. È questo che rende la separazione non aggirabile per distrazione,
 * ed è la ragione per cui la riservatezza torna a essere una separazione di
 * ambiente e non un filtro.
 *
 * La persona di prova possiede il solo ruolo `editor` con tutti e cinque i
 * permessi di ADR-007 §3.2, `settings.write` compreso: ogni rifiuto qui sotto
 * è dovuto all'**area**, mai a un permesso mancante.
 */

let harness: Harness;

beforeAll(async () => {
  harness = await createHarness('api_area_binding');
}, 120_000);

afterAll(async () => {
  await harness?.teardown();
});

describe('la sessione è vincolata all’area', () => {
  it('in Redazione le impostazioni sono respinte, pur avendone il permesso', async () => {
    const signed = await signIn(harness, { area: 'redazione' });

    const permessi = await harness.app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: signed.cookie },
    });
    // Il permesso c'è: è il presupposto del test, non un dettaglio.
    expect(permessi.json().permissions).toContain('settings.write');

    const risposta = await harness.app.inject({
      method: 'GET',
      url: '/settings',
      headers: { cookie: signed.cookie },
    });
    expect(risposta.statusCode).toBe(403);
  });

  it('in Impostazioni le stesse impostazioni si leggono', async () => {
    const signed = await signIn(harness, { area: 'impostazioni' });
    const risposta = await harness.app.inject({
      method: 'GET',
      url: '/settings',
      headers: { cookie: signed.cookie },
    });
    expect(risposta.statusCode).toBe(200);
  });

  it('e in Impostazioni i contenuti sono respinti, sempre con il permesso in mano', async () => {
    const signed = await signIn(harness, { area: 'impostazioni' });
    const risposta = await harness.app.inject({
      method: 'GET',
      url: '/contents',
      headers: { cookie: signed.cookie },
    });
    expect(risposta.statusCode).toBe(403);
  });

  it('il rifiuto non dice **perché**: area sbagliata e permesso mancante si somigliano', async () => {
    const signed = await signIn(harness, { area: 'redazione' });
    const risposta = await harness.app.inject({
      method: 'GET',
      url: '/settings',
      headers: { cookie: signed.cookie },
    });
    // Stesso codice e stesso messaggio del permesso mancante: distinguere i due
    // casi sarebbe la mappa dei permessi che il controllo 9 vieta di rivelare.
    expect(risposta.json().error.code).toBe('NOT_AUTHORIZED');
    expect(risposta.json().error.message).toBe('Operazione non consentita.');
  });
});

describe('finché la veste non è scelta, non si autorizza nulla', () => {
  it('senza area attiva nessuna rotta di dominio risponde', async () => {
    const signed = await signIn(harness, { area: null });
    for (const url of ['/contents', '/settings', '/media']) {
      const risposta = await harness.app.inject({
        method: 'GET',
        url,
        headers: { cookie: signed.cookie },
      });
      expect(risposta.statusCode, url).toBe(403);
    }
  });

  it('ma la schermata di scelta sa già che cosa offrire', async () => {
    const signed = await signIn(harness, { area: null });
    const risposta = await harness.app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { cookie: signed.cookie },
    });
    const corpo = risposta.json();
    expect(corpo.activeArea).toBeNull();
    expect(corpo.permissions).toEqual([]);
    // Un ruolo, due aree: due vesti, quindi la scelta esiste davvero.
    expect(corpo.rolesHeld).toHaveLength(1);
    expect(corpo.rolesHeld[0].areas).toEqual(['impostazioni', 'redazione']);
  });

  it('una veste che non si possiede non si indossa', async () => {
    const signed = await signIn(harness, { area: null });
    const risposta = await harness.app.inject({
      method: 'POST',
      url: '/auth/context',
      headers: signed.writeHeaders,
      // Un identificatore ben formato ma di nessun ruolo posseduto.
      payload: { roleId: '00000000-0000-4000-8000-000000000000', area: 'redazione' },
    });
    expect(risposta.statusCode).toBe(403);
  });
});

describe('il registro delle operazioni dice in quale veste', () => {
  it('ogni scrittura porta ruolo e area con cui è stata compiuta', async () => {
    const signed = await signIn(harness, { area: 'redazione' });
    const creata = await harness.app.inject({
      method: 'POST',
      url: '/contents',
      headers: signed.writeHeaders,
      payload: { type: 'page', slug: 'veste-dichiarata', title: 'Veste dichiarata' },
    });
    expect(creata.statusCode).toBe(201);

    const [riga] = await harness.db
      .select({
        action: schema.auditLog.action,
        actorRoleId: schema.auditLog.actorRoleId,
        actorRoleLabel: schema.auditLog.actorRoleLabel,
        actorArea: schema.auditLog.actorArea,
      })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'content.create'))
      .orderBy(desc(schema.auditLog.id))
      .limit(1);

    expect(riga?.actorArea).toBe('redazione');
    expect(riga?.actorRoleLabel).toBe('Redattore');
    expect(riga?.actorRoleId).not.toBeNull();
  });

  it('il cambio di veste lascia la sua riga', async () => {
    await signIn(harness, { area: 'impostazioni' });
    const [riga] = await harness.db
      .select({ actorArea: schema.auditLog.actorArea })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, 'auth.context_changed'))
      .orderBy(desc(schema.auditLog.id))
      .limit(1);
    expect(riga?.actorArea).toBe('impostazioni');
  });
});
