import { expect, test } from '@playwright/test';

const ADMIN = 'http://127.0.0.1:3001';

/**
 * Le quattro regole di ADR-008 §3.3 che si possono verificare a servizio acceso.
 * Non sono preferenze: sono i vincoli su cui poggia la parità visiva della Fase
 * 1E e la riservatezza dell'area amministrativa.
 */

test.describe('sito pubblico', () => {
  test('risponde e dichiara di essere una fondazione, non il sito', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Centro per la Famiglia Amoris Laetitia',
    );
  });

  test('non registra alcun service worker (ADR-008 §3.3 regola 1)', async ({ page }) => {
    await page.goto('/');
    const registrazioni = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 0;
      const elenco = await navigator.serviceWorker.getRegistrations();
      return elenco.length;
    });
    expect(
      registrazioni,
      'un service worker sul sito pubblico falsa i confronti visivi della Fase 1E',
    ).toBe(0);
  });

  test('non serve alcun manifest: la PWA riguarda solo il backend (DR-030)', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(0);

    for (const percorso of ['/manifest.webmanifest', '/manifest.json', '/sw.js']) {
      const risposta = await request.get(percorso);
      expect(risposta.status(), `${percorso} non deve esistere`).toBe(404);
    }
  });

  test('esclude l’area amministrativa dai motori di ricerca', async ({ request }) => {
    const risposta = await request.get('/robots.txt');
    expect(risposta.ok()).toBeTruthy();
    expect(await risposta.text()).toContain('Disallow: /admin');
  });
});

test.describe('area amministrativa', () => {
  test('risponde con noindex su ogni risposta (ADR-008 §3.3 regola 2)', async ({ request }) => {
    const risposta = await request.get(`${ADMIN}/admin`);
    expect(risposta.ok()).toBeTruthy();
    expect(risposta.headers()['x-robots-tag']).toContain('noindex');
  });

  test('il suo robots.txt vieta tutto', async ({ request }) => {
    const risposta = await request.get(`${ADMIN}/admin/robots.txt`);
    expect(await risposta.text()).toContain('Disallow: /');
  });
});
