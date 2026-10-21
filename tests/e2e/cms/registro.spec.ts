import { expect, test, type Page } from '@playwright/test';
import { ADMIN_URL, API_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Registro delle operazioni (1G-W2): la redazione modifica un contenuto e
 * l'editor dice chi e quando; l'amministrazione lo ritrova nel registro
 * (compito 1G-9); la redazione non raggiunge il registro (W2-4); nessuna voce
 * di navigazione risponde 404 (W2-5). Contenuti e persone sono inventati.
 */

const PERSONA_REDAZIONE = 'Redazione di prova';

/** Crea una pagina in bozza dall'editor e ne restituisce l'identificativo. */
async function nuovaPagina(page: Page, titolo: string): Promise<string> {
  await page.goto(`${ADMIN_URL}/admin/redazione/pagine`);
  await page.getByRole('button', { name: 'Nuova pagina' }).click();
  await page.getByLabel('Titolo').fill(titolo);
  await page.getByRole('button', { name: 'Crea in bozza' }).click();
  await page.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
  return page.url().split('/').pop() ?? '';
}

/** Gli indirizzi delle voci di navigazione dell'area in cui si è entrati. */
async function vociDiNavigazione(page: Page, prefisso: string): Promise<string[]> {
  const indirizzi = await page
    .locator(`nav a[href^="${prefisso}"]`)
    .evaluateAll((ancore) => ancore.map((ancora) => ancora.getAttribute('href') ?? ''));
  return [...new Set(indirizzi)];
}

async function rispondeSenza404(page: Page, indirizzo: string): Promise<void> {
  // `href` porta già il prefisso `/admin` quando il collegamento è quello di Next.
  const percorso = indirizzo.startsWith('/admin') ? indirizzo : `/admin${indirizzo}`;
  const risposta = await page.goto(`${ADMIN_URL}${percorso}`);
  expect(risposta?.status(), `${percorso} deve rispondere`).toBeLessThan(400);
  await expect(page.getByRole('heading', { level: 1 }).first(), percorso).toBeVisible();
  await expect(page.getByText('This page could not be found'), percorso).toHaveCount(0);
}

test.describe('registro delle operazioni', () => {
  test('la modifica si legge nell’editor e l’amministrazione la ritrova nel registro', async ({
    browser,
  }) => {
    // 1. La redazione modifica il titolo di una pagina e salva.
    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const titolo = `Pagina del registro ${Date.now()}`;
    const id = await nuovaPagina(redazione, titolo);

    const titoloModificato = `${titolo} — rivista`;
    await redazione.getByRole('textbox', { name: 'Titolo' }).fill(titoloModificato);
    await redazione.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect
      .poll(async () => {
        const risposta = await redazione.request.get(`${API_URL}/contents/${id}`, {
          headers: await intestazioniApi(redazione),
        });
        return ((await risposta.json()) as { title: string }).title;
      })
      .toBe(titoloModificato);

    // 2. Riaperto, l'editor dice chi ha modificato per ultimo.
    await redazione.reload();
    await expect(
      redazione.getByText(new RegExp(`^Ultima modifica di ${PERSONA_REDAZIONE} il `)),
    ).toBeVisible();
    await redazione.close();

    // 3. L'amministrazione apre il registro e filtra per quel contenuto.
    const amministrazione = await browser.newPage();
    await entra(amministrazione, 'Impostazioni');
    await amministrazione.goto(`${ADMIN_URL}/admin/impostazioni/registro`);
    await expect(
      amministrazione.getByRole('heading', { name: 'Registro delle operazioni', level: 1 }),
    ).toBeVisible();

    // Si sceglie scrivendo una parte del titolo, come farebbe una persona.
    await amministrazione.getByLabel('Contenuto', { exact: true }).fill(titolo.slice(0, -4));
    await amministrazione
      .getByRole('button', { name: `${titoloModificato} (Pagina)`, exact: true })
      .click();
    await amministrazione.getByRole('button', { name: 'Applica i filtri' }).click();

    const modifica = amministrazione
      .getByRole('row')
      .filter({ has: amministrazione.getByRole('cell', { name: 'Ha modificato', exact: true }) });
    await expect(modifica).toHaveCount(1);
    await expect(modifica.getByRole('cell', { name: PERSONA_REDAZIONE })).toBeVisible();
    await expect(modifica.getByText(/Redazione, area Redazione/)).toBeVisible();
    await expect(modifica.getByText(titoloModificato)).toBeVisible();
    await expect(modifica.getByText('Riuscita')).toBeVisible();
    await expect(modifica.getByText(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/)).toBeVisible();

    // La creazione registra l'id del contenuto nato (W2-6): sta fra le righe filtrate.
    await expect(
      amministrazione.getByRole('cell', { name: 'Ha creato', exact: true }),
    ).toBeVisible();
    await amministrazione.close();
  });

  test('chi ha solo il ruolo di redazione non raggiunge il registro né l’API', async ({ page }) => {
    await entra(page, 'Redazione');

    await page.goto(`${ADMIN_URL}/admin/impostazioni/registro`);
    await page.waitForURL(/\/admin\/(scelta-area|redazione)/);
    await expect(page.getByRole('heading', { name: 'Registro delle operazioni' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Registro delle operazioni' })).toHaveCount(0);

    const risposta = await page.request.get(`${API_URL}/audit`, {
      headers: await intestazioniApi(page),
    });
    expect(risposta.status()).toBe(403);
  });

  test('ogni voce di navigazione delle due aree risponde senza 404', async ({ browser }) => {
    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const vociRedazione = await vociDiNavigazione(redazione, '/admin/redazione');
    expect(vociRedazione.length).toBeGreaterThanOrEqual(5);
    for (const voce of vociRedazione) await rispondeSenza404(redazione, voce);
    await redazione.close();

    const amministrazione = await browser.newPage();
    await entra(amministrazione, 'Impostazioni');
    const vociImpostazioni = await vociDiNavigazione(amministrazione, '/admin/impostazioni');
    expect(vociImpostazioni.length).toBeGreaterThanOrEqual(3);
    for (const voce of vociImpostazioni) await rispondeSenza404(amministrazione, voce);
    await amministrazione.close();
  });
});
