import { expect, test } from '@playwright/test';
import { buildMp4 } from '../../../apps/api/tests/_support/syntheticFiles';
import { ADMIN_URL, API_URL, WEB_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Il blocco «Video» configurato dall'editor (1G-W7, T2f, DR-279): una pagina di prova nasce con
 * un video YouTube; dall'editor lo si cambia con un MP4 caricato nella libreria, si salva, e il
 * sito mostra il video della libreria al posto di YouTube. Il blocco non si inserisce
 * dall'editor, quindi la pagina nasce dal servizio con il blocco già presente.
 *
 * Il video è generato nella prova; titoli e nomi sono unici nell'esecuzione.
 */

const YOUTUBE = 'https://www.youtube.com/watch?v=aBcDeFgHi_-';

test('il video di un blocco si cambia con un MP4 della libreria e il sito lo mostra', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const nomeFile = `video-blocco-${stamp}.mp4`;

  const redazione = await browser.newPage();
  await entra(redazione, 'Redazione');
  const intestazioni = await intestazioniApi(redazione);

  const caricato = await redazione.request.post(`${API_URL}/media`, {
    headers: intestazioni,
    multipart: {
      file: {
        name: nomeFile,
        mimeType: 'video/mp4',
        buffer: await buildMp4({ withMetadata: false }),
      },
    },
  });
  expect(caricato.status(), await caricato.text()).toBe(201);
  const { publicPath } = (await caricato.json()) as { publicPath: string };

  const creata = await redazione.request.post(`${API_URL}/contents`, {
    headers: intestazioni,
    data: {
      type: 'page',
      slug: `pagina-con-video-${stamp}`,
      title: `Pagina con video ${stamp}`,
      blocks: {
        schema: 1,
        blocks: [
          {
            type: 'video',
            id: 'b_0000000e2e01',
            // Proprietà complete: il servizio conserva il documento così come arriva.
            props: {
              src: YOUTUBE,
              provider: 'youtube',
              posterMediaId: null,
              posterSrc: null,
              classes: [],
            },
            children: [],
          },
        ],
      },
    },
  });
  expect(creata.ok(), await creata.text()).toBeTruthy();
  const { id: idPagina } = (await creata.json()) as { id: string };
  const pubblicata = await redazione.request.post(`${API_URL}/contents/${idPagina}/publish`, {
    headers: intestazioni,
  });
  expect(pubblicata.ok(), await pubblicata.text()).toBeTruthy();
  const { path: percorso } = (await pubblicata.json()) as { path: string };

  // Prima: il sito mostra il video YouTube.
  const visitatore = await browser.newPage();
  await visitatore.goto(`${WEB_URL}${percorso}`);
  await expect(visitatore.locator('.blk-video')).toHaveAttribute('data-provider', 'youtube');

  await redazione.goto(`${ADMIN_URL}/admin/redazione/pagine/${idPagina}`);
  await redazione.getByRole('button', { name: /^Video — / }).click();
  await redazione.getByRole('radio', { name: 'Video della libreria (MP4)' }).check();
  const scelta = redazione.getByRole('combobox', { name: 'Video della libreria' });
  await expect(scelta.locator(`option[value="${publicPath}"]`)).toHaveCount(1);
  await scelta.selectOption(publicPath);

  const salvato = redazione.waitForResponse(
    (risposta) =>
      risposta.url() === `${API_URL}/contents/${idPagina}` &&
      risposta.request().method() === 'PATCH',
  );
  await redazione.getByRole('button', { name: 'Salva e aggiorna il sito', exact: true }).click();
  expect((await salvato).ok(), 'salvataggio della pagina').toBe(true);

  // Dopo: il blocco porta il file della libreria e, al clic, il lettore lo carica.
  await expect
    .poll(
      async () => {
        await visitatore.goto(`${WEB_URL}${percorso}`);
        return visitatore.locator('.blk-video').getAttribute('data-src');
      },
      { timeout: 30_000 },
    )
    .toBe(publicPath);
  await expect(visitatore.locator('.blk-video')).toHaveAttribute('data-provider', 'file');
  await visitatore.getByRole('button', { name: 'Riproduci video' }).click();
  await expect(visitatore.locator(`.blk-video video[src="${publicPath}"]`)).toBeAttached();
  await expect(visitatore.locator('.blk-video iframe')).toHaveCount(0);

  await visitatore.close();
  await redazione.close();
});
