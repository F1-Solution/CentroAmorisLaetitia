import { expect, test } from '@playwright/test';
import { buildPdf } from '../../../apps/api/tests/_support/syntheticFiles';
import { ADMIN_URL, WEB_URL } from '../support/ambiente';
import { entra } from '../support/sessione';

/**
 * Creare ed eliminare un documento dalla schermata «Documenti» (1G-W7, T2h, DR-281): la
 * redazione crea un documento con un PDF sintetico nella categoria dei download del seme, il
 * sito lo mostra nella scheda e nell'elenco della categoria; dopo l'eliminazione scheda e file
 * rispondono 404 e l'elenco non lo mostra più.
 */

const CATEGORIA = '/download-category/moduli-di-prova/';

test('la redazione crea un documento, il sito lo mostra, poi lo elimina e il sito risponde 404', async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const titolo = `Documento creato ${stamp}`;
  const slug = `documento-creato-${stamp}`;

  const redazione = await browser.newPage();
  await entra(redazione, 'Redazione');
  await redazione.goto(`${ADMIN_URL}/admin/redazione/documenti`);
  await redazione.getByRole('button', { name: 'Nuovo documento' }).click();

  const finestra = redazione.getByRole('dialog', { name: 'Nuovo documento' });
  await finestra.getByRole('textbox', { name: 'Titolo' }).fill(titolo);
  await finestra.getByLabel('Descrizione').fill(`Descrizione sintetica ${stamp}`);
  await finestra.getByLabel('File PDF').setInputFiles({
    name: `modulo-creato-${stamp}.pdf`,
    mimeType: 'application/pdf',
    buffer: buildPdf({ pages: 1, visibleText: `creato ${stamp}` }),
  });
  await finestra.getByLabel('Categoria dei download').selectOption({ label: 'Moduli di prova' });
  await finestra.getByRole('button', { name: 'Crea il documento' }).click();
  await redazione.waitForURL(/\/admin\/redazione\/documenti\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  await expect(redazione.getByRole('textbox', { name: 'Titolo' })).toHaveValue(titolo);

  // La scheda sul sito, con il collegamento al file, e l'elenco della categoria.
  const scheda = await request.get(`${WEB_URL}/download/${slug}/`);
  expect(scheda.status()).toBe(200);
  const html = await scheda.text();
  expect(html).toContain(titolo);
  expect(html).toContain(`Descrizione sintetica ${stamp}`);
  const file = /href="(\/media\/[^"]+\.pdf)"/.exec(html)?.[1];
  expect(file, 'collegamento «Download» al PDF').toBeDefined();
  const scaricato = await request.get(`${WEB_URL}${file}`);
  expect(scaricato.status()).toBe(200);
  expect((await scaricato.body()).subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const categoria = await request.get(`${WEB_URL}${CATEGORIA}`);
  expect(categoria.status()).toBe(200);
  expect(await categoria.text()).toContain(titolo);

  // Eliminazione scrivendo il titolo.
  await redazione.getByRole('button', { name: 'Elimina', exact: true }).click();
  const conferma = redazione.getByRole('dialog', { name: 'Elimina il documento' });
  await conferma.getByLabel(`Digita «${titolo}» per confermare`).fill(titolo);
  await conferma.getByRole('button', { name: 'Elimina definitivamente' }).click();
  await redazione.waitForURL(/\/admin\/redazione\/documenti$/);
  await expect(redazione.getByRole('link', { name: titolo, exact: true })).toHaveCount(0);

  expect((await request.get(`${WEB_URL}/download/${slug}/`)).status()).toBe(404);
  expect((await request.get(`${WEB_URL}${file}`)).status()).toBe(404);
  expect(await (await request.get(`${WEB_URL}${CATEGORIA}`)).text()).not.toContain(titolo);
  await redazione.close();
});
