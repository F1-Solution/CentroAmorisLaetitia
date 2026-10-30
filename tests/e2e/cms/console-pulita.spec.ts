import { expect, test, type Page } from '@playwright/test';
import { ADMIN_URL, API_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Criterio 1G-24 (wave 1G-W9, T8): nei percorsi dell'area nessun errore in
 * console per risposte attese.
 *
 * Il collaudo della 1G-W8 annotava come errori rossi quattro risposte che non
 * erano guasti (W8-09, W8-32):
 *
 * - `GET /auth/me` 401 sulla schermata di accesso, cioè «nessuna sessione»;
 * - `GET /contents/:id/draft` 404 all'apertura dell'editor senza copia di lavoro;
 * - `GET /seo/contents/:id` 404 nella scheda SEO senza sovrascrittura;
 * - `GET /accounts`, `GET /audit…`, `GET /settings` 401 o 403 aprendo un
 *   indirizzo di Impostazioni da Redazione o senza accesso, prima del rinvio.
 *
 * Chromium scrive in console «Failed to load resource» per ogni risposta 4xx:
 * qui si ascoltano i messaggi di tipo `error` e gli errori della pagina, e la
 * prova fallisce se ce n'è anche uno solo. Il contenuto è inventato e unico
 * nell'esecuzione.
 */

interface Ascolto {
  readonly errori: string[];
}

/** Raccoglie ogni errore di console e ogni eccezione della pagina, con l'indirizzo in cui è nato. */
function ascolta(page: Page): Ascolto {
  const errori: string[] = [];
  page.on('console', (messaggio) => {
    if (messaggio.type() === 'error') {
      const dove = messaggio.location().url;
      errori.push(`console: ${messaggio.text()}${dove ? ` (${dove})` : ''}`);
    }
  });
  page.on('pageerror', (errore) => errori.push(`pageerror: ${errore.message}`));
  return { errori };
}

const IMPOSTAZIONI = [
  '/admin/impostazioni',
  '/admin/impostazioni/persone',
  '/admin/impostazioni/registro',
];

test.describe('console pulita nell’area (1G-24)', () => {
  test('accesso, editor senza copia di lavoro, SEO senza sovrascrittura e Impostazioni da Redazione', async ({
    page,
  }) => {
    const ascolto = ascolta(page);

    // Schermata di accesso senza sessione: `/auth/me` dice l'assenza senza errore.
    await page.goto(`${ADMIN_URL}/admin/accesso`);
    await expect(page.getByRole('button', { name: 'Entra' })).toBeVisible();

    await entra(page, 'Redazione');

    // Un contenuto appena creato non ha copia di lavoro né sovrascrittura SEO.
    const slug = `console-pulita-${Date.now()}`;
    const creata = await page.request.post(`${API_URL}/contents`, {
      headers: await intestazioniApi(page),
      data: { type: 'page', slug, title: `Pagina ${slug}` },
    });
    expect(creata.ok(), await creata.text()).toBeTruthy();
    const { id } = (await creata.json()) as { id: string };

    await page.goto(`${ADMIN_URL}/admin/redazione/pagine/${id}`);
    await expect(page.getByRole('region', { name: 'Struttura del contenuto' })).toBeVisible();
    await expect(page.getByText('Il contenuto non si apre')).toHaveCount(0);

    await page.getByRole('tab', { name: 'SEO' }).click();
    await expect(page.getByText(/usa i template globali/)).toBeVisible();

    // Impostazioni da Redazione: rinvio senza chiamate che l'API rifiuterebbe.
    for (const percorso of IMPOSTAZIONI) {
      await page.goto(`${ADMIN_URL}${percorso}`);
      await page.waitForURL((url) => !url.pathname.startsWith('/admin/impostazioni'));
      await expect(page.getByText('Stai lavorando come Redazione')).toBeVisible();
    }

    expect(ascolto.errori, ascolto.errori.join('\n')).toEqual([]);
  });

  test('Impostazioni senza accesso: rinvio all’accesso senza errori', async ({ page }) => {
    const ascolto = ascolta(page);

    for (const percorso of IMPOSTAZIONI) {
      await page.goto(`${ADMIN_URL}${percorso}`);
      await page.waitForURL(/\/admin\/accesso/);
      await expect(page.getByRole('button', { name: 'Entra' })).toBeVisible();
    }

    expect(ascolto.errori, ascolto.errori.join('\n')).toEqual([]);
  });
});
