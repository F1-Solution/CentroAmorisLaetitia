import { expect, test, type Page } from '@playwright/test';
import { ADMIN_URL, API_URL, WEB_URL } from '../support/ambiente';
import { ROSSO, pngTintaUnita } from '../support/immagini';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * DR-278 (1G-W7, T2e): «Mostra il titolo della pagina» e l'immagine in evidenza di una pagina
 * si cambiano dall'editor. Sul sito il titolo spento lascia il solo `h1` per i lettori di
 * schermo; l'immagine in evidenza non compare nel testo della pagina (come il tema della
 * sorgente, `divi_page_thumbnails` spento) ma nei dati strutturati, come `primaryImageOfPage`.
 * Dati sintetici.
 */

interface Nodo {
  readonly '@type'?: string;
  readonly image?: { readonly url?: string };
  readonly primaryImageOfPage?: unknown;
}

/** Il nodo WebPage del JSON-LD della pagina aperta. */
async function webPageDi(pagina: Page): Promise<Nodo | undefined> {
  const testo = await pagina.locator('script[type="application/ld+json"]').first().textContent();
  const grafo = JSON.parse(testo ?? '{}') as { '@graph'?: Nodo[] };
  return grafo['@graph']?.find((n) => n['@type'] === 'WebPage');
}

test('titolo spento e immagine in evidenza di una pagina hanno effetto sul sito', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const nomeFile = `evidenza-${stamp}.png`;
  const titolo = `Pagina con evidenza ${stamp}`;

  const redazione = await browser.newPage();
  await entra(redazione, 'Redazione');
  const caricamento = await redazione.request.post(`${API_URL}/media`, {
    headers: await intestazioniApi(redazione),
    multipart: {
      file: { name: nomeFile, mimeType: 'image/png', buffer: pngTintaUnita(40, 30, ROSSO) },
    },
  });
  expect(caricamento.status(), await caricamento.text()).toBe(201);
  const { publicPath } = (await caricamento.json()) as { publicPath: string };

  await redazione.goto(`${ADMIN_URL}/admin/redazione/pagine`);
  await redazione.getByRole('button', { name: 'Nuova pagina' }).click();
  await redazione.getByLabel('Titolo').fill(titolo);
  await redazione.getByRole('button', { name: 'Crea in bozza' }).click();
  await redazione.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
  const idPagina = redazione.url().split('/').pop() ?? '';
  await redazione.getByRole('button', { name: 'Pubblica' }).click();

  let percorso = '';
  await expect
    .poll(async () => {
      const risposta = await redazione.request.get(`${API_URL}/contents/${idPagina}`, {
        headers: await intestazioniApi(redazione),
      });
      const corpo = (await risposta.json()) as { status: string; path: string };
      percorso = corpo.path;
      return corpo.status;
    })
    .toBe('published');

  const visitatore = await browser.newPage();
  await visitatore.goto(`${WEB_URL}${percorso}`);
  // Prima: il titolo del tema, visibile, e nei dati strutturati nessuna immagine.
  await expect(visitatore.locator('h1.entry-title.main_title')).toHaveText(titolo);
  const webPagePrima = (await webPageDi(visitatore)) ?? {};
  expect(webPagePrima['@type']).toBe('WebPage');
  expect(webPagePrima.image).toBeUndefined();
  expect(webPagePrima.primaryImageOfPage).toBeUndefined();

  // Scheda «Pagina»: il titolo si spegne e si salva da solo.
  await redazione.getByRole('tab', { name: 'Pagina' }).click();
  await redazione.getByLabel('Mostra il titolo della pagina').uncheck();
  const titoloSalvato = redazione.waitForResponse(
    (r) => r.url() === `${API_URL}/contents/${idPagina}` && r.request().method() === 'PATCH',
  );
  await redazione.getByRole('button', { name: 'Salva titolo e colonne' }).click();
  expect((await titoloSalvato).ok(), 'salvataggio del titolo').toBe(true);

  // Scheda «Immagine in evidenza»: la stessa scelta delle notizie.
  await redazione.getByRole('tab', { name: 'Immagine in evidenza' }).click();
  await redazione.getByRole('button', { name: 'Scegli un’immagine' }).click();
  await redazione.getByLabel('Cerca media').fill(nomeFile);
  const opzioni = redazione.getByRole('option');
  await expect(opzioni).toHaveCount(1);
  await opzioni.first().click();
  const immagineSalvata = redazione.waitForResponse(
    (r) => r.url() === `${API_URL}/contents/${idPagina}` && r.request().method() === 'PATCH',
  );
  await redazione.getByRole('button', { name: 'Usa questo media' }).click();
  expect((await immagineSalvata).ok(), 'salvataggio dell’immagine').toBe(true);

  // Dopo: il sito rende a ogni richiesta (DR-105).
  await visitatore.reload();
  await expect(visitatore.locator('h1.entry-title.main_title')).toHaveCount(0);
  await expect(visitatore.locator('h1.screen-reader-text')).toHaveText(titolo);
  // Nel testo della pagina l'immagine non c'è, come nella sorgente.
  await expect(visitatore.locator('#left-area img')).toHaveCount(0);

  const webPage = await webPageDi(visitatore);
  expect(webPage?.image?.url, 'immagine nei dati strutturati').toContain(publicPath);
  expect(webPage?.primaryImageOfPage).toBeTruthy();

  await visitatore.close();
  await redazione.close();
});
