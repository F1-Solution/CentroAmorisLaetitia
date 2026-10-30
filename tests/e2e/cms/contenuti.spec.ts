import { expect, test } from '@playwright/test';
import { API_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * I flussi sui contenuti: elenco, creazione, modifica, pubblicazione, ritiro, e
 * **l'andata e ritorno nell'applicazione vera** (criterio 1D-36).
 *
 * L'andata e ritorno è già provata dentro l'editor
 * (`apps/admin/tests/roundtrip-corpus.test.ts`) e al confine del servizio
 * (`apps/api/tests/roundTripCorpus.test.ts`). Qui si prova la terza cosa, che
 * le altre due non toccano: che il **gesto** di aprire una pagina e premere
 * «Salva» non cambi ciò che il pubblico legge. È la catena intera, dal clic
 * alla riga di database.
 */

/** Legge un contenuto dal servizio riusando i cookie del browser. */
async function leggiContenuto(
  page: import('@playwright/test').Page,
  id: string,
): Promise<{ blocks: unknown; contentHtml: string; status: string; title: string }> {
  const risposta = await page.request.get(`${API_URL}/contents/${id}`, {
    headers: await intestazioniApi(page),
  });
  expect(
    risposta.ok(),
    `lettura del contenuto ${id}: ${risposta.status()} ${await risposta.text()}`,
  ).toBeTruthy();
  return risposta.json();
}

function idDallUrl(url: string): string {
  const id = url.split('/').pop() ?? '';
  expect(id, 'l’indirizzo dell’editor deve finire con l’identificativo').toMatch(/^[0-9a-f-]{36}$/);
  return id;
}

test.describe('contenuti', () => {
  test.beforeEach(async ({ page }) => {
    await entra(page, 'Redazione');
  });

  test('l’elenco mostra i contenuti seminati e il filtro di ricerca li restringe', async ({
    page,
  }) => {
    await expect(page.getByRole('link', { name: 'Pagina di prova' })).toBeVisible();

    await page.getByLabel('Cerca fra le pagine').fill('non-esiste-questa-pagina');
    await expect(page.getByText('Nessuna pagina corrisponde a questi filtri.')).toBeVisible();

    await page.getByLabel('Cerca fra le pagine').fill('');
    await expect(page.getByRole('link', { name: 'Pagina di prova' })).toBeVisible();
  });

  test('criterio 1D-36: aprire una pagina e salvarla senza modifiche non cambia nulla', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Pagina di prova' }).click();
    await page.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
    const id = idDallUrl(page.url());

    const prima = await leggiContenuto(page, id);

    // Nessuna modifica: si preme «Salva e aggiorna il sito» e basta. L'editor lo dichiara, e
    // quello che dichiara è la cosa che il criterio pretende: il contenuto
    // **non viene riscritto**, non «viene riscritto uguale».
    await page.getByRole('button', { name: 'Salva e aggiorna il sito', exact: true }).click();
    await expect(
      page.getByText('Nessuna modifica: il contenuto non è stato riscritto.'),
    ).toBeVisible();

    const dopo = await leggiContenuto(page, id);
    expect(dopo.blocks).toEqual(prima.blocks);
    expect(dopo.contentHtml).toBe(prima.contentHtml);
    expect(dopo.title).toBe(prima.title);
  });

  test('criterio 1D-28: creare una pagina, modificarla, pubblicarla e ritirarla', async ({
    page,
  }) => {
    const titolo = `Pagina end-to-end ${Date.now()}`;

    await page.getByRole('button', { name: 'Nuova pagina' }).click();
    await page.getByLabel('Titolo').fill(titolo);
    await page.getByRole('button', { name: 'Crea in bozza' }).click();

    await page.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
    const id = idDallUrl(page.url());

    const appenaCreata = await leggiContenuto(page, id);
    expect(appenaCreata.status, 'nasce in bozza: creare e pubblicare sono due gesti').toBe('draft');

    // Modifica del titolo dentro l'editor.
    const titoloModificato = `${titolo} — rivista`;
    await page.getByRole('textbox', { name: 'Titolo' }).fill(titoloModificato);
    await page.getByRole('button', { name: 'Salva', exact: true }).click();

    // La verifica è sul servizio. L'avviso «Contenuto salvato.» compare e poi
    // scompare da sé quando l'editor rilegge il contenuto: aspettarlo
    // proverebbe la fortuna del cronometro, non il salvataggio.
    await expect.poll(async () => (await leggiContenuto(page, id)).title).toBe(titoloModificato);

    // Pubblicazione.
    await page.getByRole('button', { name: 'Pubblica' }).click();
    await expect.poll(async () => (await leggiContenuto(page, id)).status).toBe('published');

    // Ritiro.
    await page.getByRole('button', { name: 'Ritira' }).click();
    await expect.poll(async () => (await leggiContenuto(page, id)).status).toBe('draft');
  });

  test('le notizie hanno il loro elenco, distinto da quello delle pagine', async ({ page }) => {
    await page.getByRole('link', { name: 'Notizie' }).click();
    await page.waitForURL(/\/admin\/redazione\/notizie/);
    await expect(page.getByRole('link', { name: 'Notizia di prova' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pagina di prova' })).toHaveCount(0);
  });
});
