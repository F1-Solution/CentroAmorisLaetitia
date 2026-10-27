import { expect, test } from '@playwright/test';
import { ADMIN_URL, API_URL, WEB_URL } from '../support/ambiente';
import { BLU, pngTintaUnita } from '../support/immagini';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Il blocco «Immagine» inserito dall'editor (1G-W7, T2d, DR-283): si sceglie un media pubblico,
 * si scrive il testo alternativo, si salva e si pubblica; il sito mostra l'immagine con l'`alt`.
 */

test('un’immagine nuova inserita in una pagina si vede sul sito con il suo testo alternativo', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const nomeFile = `immagine-${stamp}.png`;
  const alt = `Quadro blu di prova ${stamp}`;

  const redazione = await browser.newPage();
  await entra(redazione, 'Redazione');
  const caricamento = await redazione.request.post(`${API_URL}/media`, {
    headers: await intestazioniApi(redazione),
    multipart: {
      file: { name: nomeFile, mimeType: 'image/png', buffer: pngTintaUnita(40, 30, BLU) },
    },
  });
  expect(caricamento.status(), await caricamento.text()).toBe(201);

  await redazione.goto(`${ADMIN_URL}/admin/redazione/pagine`);
  await redazione.getByRole('button', { name: 'Nuova pagina' }).click();
  await redazione.getByLabel('Titolo').fill(`Pagina con immagine ${stamp}`);
  await redazione.getByRole('button', { name: 'Crea in bozza' }).click();
  await redazione.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
  const idPagina = redazione.url().split('/').pop() ?? '';

  await redazione.getByRole('button', { name: 'Aggiungi blocco', exact: true }).click();
  await redazione
    .getByRole('dialog')
    .getByRole('button', { name: /^Immagine/ })
    .click();
  await redazione.getByLabel('Cerca media').fill(nomeFile);
  // La ricerca per il nome unico lascia un solo media: lo si sceglie senza dipendere dal titolo mostrato.
  const opzioni = redazione.getByRole('option');
  await expect(opzioni).toHaveCount(1);
  await opzioni.first().click();
  await redazione.getByRole('textbox', { name: 'Testo alternativo' }).fill(alt);
  await redazione.getByRole('button', { name: 'Usa questo media' }).click();

  const salvato = redazione.waitForResponse(
    (risposta) =>
      risposta.url().startsWith(`${API_URL}/contents/${idPagina}`) &&
      ['PATCH', 'PUT'].includes(risposta.request().method()),
  );
  await redazione.getByRole('button', { name: 'Salva', exact: true }).click();
  expect((await salvato).ok(), 'salvataggio della pagina').toBe(true);
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
  const immagine = visitatore.locator(`img[alt="${alt}"]`);
  await expect(immagine).toBeAttached();
  await expect(immagine).toHaveAttribute('src', /.+/);
  // Il file arriva davvero: un'immagine rotta ha larghezza naturale zero.
  await immagine.scrollIntoViewIfNeeded();
  await expect
    .poll(() => immagine.evaluate((nodo) => (nodo as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  await visitatore.close();
  await redazione.close();
});
