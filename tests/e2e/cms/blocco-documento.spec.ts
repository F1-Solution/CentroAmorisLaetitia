import { expect, test } from '@playwright/test';
import { ADMIN_URL, API_URL, WEB_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Il blocco «Documento» dalla redazione al sito (1G-W7, T2k, DR-287): si inserisce in una pagina
 * sintetica scegliendo il documento pubblico del seme, la pagina si salva e si pubblica, e il sito
 * mostra un collegamento che apre la scheda `/download/<slug>/`. Il documento riservato del seme
 * non è fra quelli che il selettore offre. Giro 1: un secondo blocco, con etichetta, sta dentro
 * «media e testo» e anche lì diventa un collegamento.
 *
 * Il titolo del documento pubblico può essere già stato cambiato da `documenti.spec.ts`: la prova
 * lo legge dal servizio invece di presupporlo.
 */

const SLUG_PUBBLICO = 'documento-di-prova-pubblico';
const SLUG_RISERVATO = 'documento-di-prova-riservato';

interface DocumentoElencato {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

test('il blocco «Documento» inserito da una pagina apre la scheda del documento sul sito', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const redazione = await browser.newPage();
  await entra(redazione, 'Redazione');

  const elenco = await redazione.request.get(`${API_URL}/documents`, {
    headers: await intestazioniApi(redazione),
  });
  expect(elenco.ok(), 'elenco dei documenti').toBe(true);
  const documenti = (await elenco.json()) as DocumentoElencato[];
  const pubblico = documenti.find((documento) => documento.slug === SLUG_PUBBLICO);
  expect(pubblico, 'il documento pubblico del seme').toBeDefined();
  expect(documenti.some((documento) => documento.slug === SLUG_RISERVATO)).toBe(false);
  if (!pubblico) return;

  await redazione.goto(`${ADMIN_URL}/admin/redazione/pagine`);
  await redazione.getByRole('button', { name: 'Nuova pagina' }).click();
  await redazione.getByLabel('Titolo').fill(`Pagina con documento ${stamp}`);
  await redazione.getByRole('button', { name: 'Crea in bozza' }).click();
  await redazione.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
  const idPagina = redazione.url().split('/').pop() ?? '';

  await redazione.getByRole('button', { name: 'Aggiungi blocco', exact: true }).click();
  await redazione
    .getByRole('dialog')
    .getByRole('button', { name: /^Documento/ })
    .click();
  const scelta = redazione.getByLabel('Quale documento?');
  await expect(scelta.locator('option')).toHaveCount(documenti.length + 1);
  await scelta.selectOption(pubblico.id);
  await redazione.getByRole('button', { name: 'Inserisci', exact: true }).click();
  // Il blocco nato è selezionato e il pannello mostra il documento scelto.
  await expect(redazione.getByRole('combobox', { name: 'Documento', exact: true })).toHaveValue(
    pubblico.id,
  );

  // Lo stesso documento dentro «media e testo», con un'etichetta propria.
  const etichetta = `Scarica in media e testo ${stamp}`;
  await redazione.getByRole('button', { name: 'Aggiungi blocco', exact: true }).click();
  await redazione
    .getByRole('dialog')
    .getByRole('button', { name: /^Media e testo/ })
    .click();
  await redazione.getByRole('button', { name: 'Aggiungi blocco in «media e testo»' }).click();
  await redazione
    .getByRole('dialog')
    .getByRole('button', { name: /^Documento/ })
    .click();
  await redazione.getByLabel('Quale documento?').selectOption(pubblico.id);
  await redazione.getByRole('button', { name: 'Inserisci', exact: true }).click();
  await redazione.getByRole('textbox', { name: 'Etichetta' }).fill(etichetta);

  const contenutoSalvato = redazione.waitForResponse(
    (risposta) =>
      risposta.url().startsWith(`${API_URL}/contents/${idPagina}`) &&
      ['PATCH', 'PUT'].includes(risposta.request().method()),
  );
  await redazione.getByRole('button', { name: 'Salva', exact: true }).click();
  expect((await contenutoSalvato).ok(), 'salvataggio della pagina').toBe(true);
  await redazione.getByRole('button', { name: 'Pubblica' }).click();
  let percorsoPagina = '';
  await expect
    .poll(async () => {
      const risposta = await redazione.request.get(`${API_URL}/contents/${idPagina}`, {
        headers: await intestazioniApi(redazione),
      });
      const corpo = (await risposta.json()) as { status: string; path: string };
      percorsoPagina = corpo.path;
      return corpo.status;
    })
    .toBe('published');

  const visitatore = await browser.newPage();
  await visitatore.goto(`${WEB_URL}${percorsoPagina}`);
  await expect(visitatore.locator('.blk-document a')).toHaveCount(2);
  const dentro = visitatore.locator('.blk-media-text-content .blk-document a');
  await expect(dentro).toHaveText(etichetta);
  await expect(dentro).toHaveAttribute('href', `/download/${SLUG_PUBBLICO}/`);
  const collegamento = visitatore.locator('.entry-content > .blk-document a');
  await expect(collegamento).toHaveCount(1);
  // Senza etichetta il testo è il titolo del documento.
  await expect(collegamento).toHaveText(pubblico.title);
  await expect(collegamento).toHaveAttribute('href', `/download/${SLUG_PUBBLICO}/`);
  await collegamento.click();
  await visitatore.waitForURL(`${WEB_URL}/download/${SLUG_PUBBLICO}/`);
  await expect(visitatore.locator('article.wpdmpro')).toBeVisible();

  await visitatore.close();
  await redazione.close();
});
