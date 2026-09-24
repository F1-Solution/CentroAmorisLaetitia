import { expect, test } from '@playwright/test';
import { API_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * I flussi del corredo: media, menu, redirect e impostazioni — criteri 1D-31,
 * 1D-32, 1D-34 e 1D-35 **eseguiti nel browser**.
 *
 * Il caricamento di un file è il caso che solo qui si prova davvero: passa da
 * un `input[type=file]`, da una richiesta `multipart` e dall'archivio a
 * oggetti. Le prove del servizio usano un archivio finto, e quelle
 * dell'interfaccia non hanno un file.
 *
 * Il file caricato è **un PNG di un pixel**: esiste, non raffigura nulla.
 */

/** Un PNG di un pixel, trasparente. Nessun soggetto, nessun dato. */
const UN_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('media', () => {
  test('criterio 1D-31: caricare un file, poi dargli un testo alternativo', async ({ page }) => {
    await entra(page, 'Redazione');
    await page.getByRole('link', { name: 'Media' }).click();
    await page.waitForURL(/\/admin\/redazione\/media/);

    const nomeFile = `caricato-${Date.now()}.png`;
    await page.getByLabel('Scegli i file da caricare').setInputFiles({
      name: nomeFile,
      mimeType: 'image/png',
      buffer: UN_PIXEL_PNG,
    });

    // Il file compare nella **tabella** dell'archivio, non solo nell'elenco
    // dei caricamenti in corso: è il servizio ad averlo accettato.
    const riga = page.getByRole('button', { name: nomeFile });
    await expect(riga).toBeVisible({ timeout: 30_000 });

    await riga.click();
    await page.getByLabel('Testo alternativo').fill('Un quadrato di un solo pixel.');
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page.getByText('Fatto')).toBeVisible();

    // Verifica dal servizio, non dalla schermata che l'ha appena scritto.
    const elenco = await page.request.get(
      `${API_URL}/media?search=${encodeURIComponent(nomeFile)}`,
      {
        headers: await intestazioniApi(page),
      },
    );
    expect(elenco.ok()).toBeTruthy();
    const corpo = (await elenco.json()) as {
      items: { fileName: string; altText: string | null }[];
    };
    const caricato = corpo.items.find((item) => item.fileName === nomeFile);
    expect(caricato?.altText).toBe('Un quadrato di un solo pixel.');
  });
});

test.describe('menu', () => {
  test('criterio 1D-32: aggiungere una voce e cambiarne la visibilità', async ({ page }) => {
    await entra(page, 'Redazione');
    await page.getByRole('link', { name: 'Menu' }).click();
    await page.waitForURL(/\/admin\/redazione\/menu/);

    const etichetta = `Voce end-to-end ${Date.now()}`;
    await page.getByRole('button', { name: 'Aggiungi una voce' }).click();
    await page.getByLabel('La voce punta a').selectOption('custom');
    await page.getByLabel('Etichetta').fill(etichetta);
    await page.getByLabel('Indirizzo').fill('/indirizzo-inventato/');
    await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();

    await expect(page.getByText(etichetta).first()).toBeVisible();

    // La voce nasce pubblica; la si porta a «solo chi ha fatto accesso».
    await page.getByText(etichetta).first().click();
    await page.getByRole('radio', { name: 'Solo a chi ha fatto accesso' }).check();
    await page.getByRole('button', { name: 'Salva la voce' }).click();

    // La verifica è sul servizio, non sul messaggio a schermo: il pannello si
    // richiude quando l'elenco si ricarica, e un avviso che scompare non è
    // ciò che il criterio 1D-32 chiede.
    await expect
      .poll(async () => {
        const menu = await page.request.get(`${API_URL}/menus/principale/items`, {
          headers: await intestazioniApi(page),
        });
        if (!menu.ok()) return `errore ${menu.status()}`;
        const voci = (await menu.json()) as { label: string; visibility: string }[];
        return voci.find((item) => item.label === etichetta)?.visibility;
      })
      .toBe('authenticated');
  });
});

test.describe('redirect', () => {
  test('criterio 1D-34: crearne uno, e poi spegnerlo', async ({ page }) => {
    await entra(page, 'Redazione');
    await page.getByRole('link', { name: 'SEO e indirizzi' }).click();
    await page.waitForURL(/\/admin\/redazione\/seo/);
    await page.getByRole('tab', { name: 'Redirect' }).click();

    const partenza = `/vecchio-indirizzo-${Date.now()}/`;
    await page.getByRole('button', { name: 'Nuovo redirect' }).click();
    await page.getByLabel('Indirizzo di partenza').fill(partenza);
    await page.getByLabel('Indirizzo di arrivo').fill('/pagina-di-prova/');
    await page.getByRole('button', { name: 'Crea il redirect' }).click();

    await expect(page.getByRole('button', { name: partenza })).toBeVisible();

    await page.getByRole('button', { name: partenza }).click();
    await page.getByLabel('Attivo').uncheck();
    await page.getByRole('button', { name: 'Salva il redirect' }).click();

    await expect
      .poll(async () => {
        const risposta = await page.request.get(
          `${API_URL}/redirects?search=${encodeURIComponent(partenza)}`,
          { headers: await intestazioniApi(page) },
        );
        const corpo = (await risposta.json()) as {
          items: { sourcePath: string; isActive: boolean }[];
        };
        return corpo.items.find((item) => item.sourcePath === partenza)?.isActive;
      })
      .toBe(false);
  });
});

test.describe('impostazioni', () => {
  test('criterio 1D-35: cambiare il titolo del sito e ritrovarlo salvato', async ({ page }) => {
    await entra(page, 'Impostazioni');

    const titolo = `Sito di prova ${Date.now()}`;
    await page.getByLabel('Titolo del sito').fill(titolo);
    await page.getByRole('button', { name: 'Salva «Titolo del sito»' }).click();
    await expect(page.getByText('Salvata.')).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Titolo del sito')).toHaveValue(titolo);
  });

  test('un valore riservato non si modifica da questa schermata', async ({ page }) => {
    await entra(page, 'Impostazioni');
    await expect(
      page.getByText(
        'Il valore è riservato: non esce dal servizio e non si modifica da questa schermata.',
      ),
    ).toBeVisible();
  });
});
