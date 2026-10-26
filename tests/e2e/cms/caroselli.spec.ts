import { expect, test, type Page } from '@playwright/test';
import { ADMIN_URL, API_URL, WEB_URL } from '../support/ambiente';
import { BLU, pngTintaUnita } from '../support/immagini';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * I caroselli dalla redazione al sito (1G-W6, T7): il blocco «Presentazione a scorrimento» si
 * inserisce da una pagina scegliendo il carosello del seme; dalla schermata «Caroselli» si
 * riordinano, tolgono, aggiungono e rititolano le immagini, e la pagina pubblicata segue subito;
 * un'immagine usata da una slide non si elimina dalla libreria.
 *
 * I tre test condividono la pagina del primo: si eseguono in fila.
 */

const TITOLO_CAROSELLO = 'Carosello di prova';
const PRIMA = 'Prima slide di prova';
const SECONDA = 'Seconda slide di prova';
const TERZA = 'Terza slide di prova';

test.describe.configure({ mode: 'serial' });

/** I testi alternativi delle immagini del carosello, nell'ordine in cui il sito le mette. */
async function slideDelSito(page: Page, percorso: string) {
  await page.goto(`${WEB_URL}${percorso}`);
  const immagini = page.locator('.blk-slider-slide img');
  await expect(immagini.first()).toBeAttached();
  return {
    alt: await immagini.evaluateAll((nodi) => nodi.map((nodo) => nodo.getAttribute('alt'))),
    punti: await page.locator('.blk-slider-dot').count(),
  };
}

/** Un comando della slide indicata (da 1). */
const comando = (page: Page, numero: number, nome: string) =>
  page
    .getByRole('group', { name: `Slide ${numero}`, exact: true })
    .getByRole('button', { name: nome, exact: true });

/** Sposta in giù la slide indicata (da 1) dalla tastiera: il comando prende il focus e riceve Invio. */
async function spostaGiu(page: Page, numero: number) {
  await comando(page, numero, 'Sposta giù').press('Enter');
}

/** Preme «Salva» e attende la risposta del servizio al salvataggio delle slide. */
async function salvaCarosello(page: Page, idCarosello: string) {
  const risposta = page.waitForResponse(
    (candidata) =>
      candidata.url() === `${API_URL}/sliders/${idCarosello}/slides` &&
      candidata.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  expect((await risposta).ok(), 'salvataggio del carosello').toBe(true);
  await expect(page.getByText('Modifiche salvate.')).toBeVisible();
}

test.describe('caroselli', () => {
  let percorsoPagina = '';
  let idCarosello = '';
  const stamp = Date.now();

  test('il blocco «Presentazione a scorrimento» inserito da una pagina mostra le 3 immagini del carosello nell’ordine', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');

    await redazione.goto(`${ADMIN_URL}/admin/redazione/pagine`);
    await redazione.getByRole('button', { name: 'Nuova pagina' }).click();
    await redazione.getByLabel('Titolo').fill(`Pagina con carosello ${stamp}`);
    await redazione.getByRole('button', { name: 'Crea in bozza' }).click();
    await redazione.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
    const idPagina = redazione.url().split('/').pop() ?? '';

    await redazione.getByRole('button', { name: 'Aggiungi blocco', exact: true }).click();
    await redazione
      .getByRole('dialog')
      .getByRole('button', { name: /^Presentazione a scorrimento/ })
      .click();
    await redazione.getByLabel('Quale carosello?').selectOption({ label: TITOLO_CAROSELLO });
    await redazione.getByRole('button', { name: 'Inserisci', exact: true }).click();

    // Il pannello del blocco offre la scelta del carosello e il rimando alle sue immagini.
    await expect(
      redazione.getByRole('link', { name: 'Modifica le immagini del carosello' }),
    ).toBeVisible();
    const rimando = await redazione
      .getByRole('link', { name: 'Modifica le immagini del carosello' })
      .getAttribute('href');
    idCarosello = rimando?.split('/').pop() ?? '';
    expect(idCarosello).toMatch(/^[0-9a-f-]{36}$/);

    const contenutoSalvato = redazione.waitForResponse(
      (risposta) =>
        risposta.url().startsWith(`${API_URL}/contents/${idPagina}`) &&
        ['PATCH', 'PUT'].includes(risposta.request().method()),
    );
    await redazione.getByRole('button', { name: 'Salva', exact: true }).click();
    expect((await contenutoSalvato).ok(), 'salvataggio della pagina').toBe(true);
    await redazione.getByRole('button', { name: 'Pubblica' }).click();
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
    const sito = await slideDelSito(visitatore, percorsoPagina);
    expect(sito.alt).toEqual([PRIMA, SECONDA, TERZA]);
    expect(sito.punti).toBe(3);

    await visitatore.close();
    await redazione.close();
  });

  test('dalla schermata «Caroselli» ordine, titoli e numero delle slide cambiano subito sulla pagina', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const titoloNuovo = `Titolo nuovo ${stamp}`;
    const titoloAggiunta = `Slide aggiunta ${stamp}`;
    const nomeImmagine = `slide-${stamp}.png`;

    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const aggiunta = await redazione.request.post(`${API_URL}/media`, {
      headers: await intestazioniApi(redazione),
      multipart: {
        file: { name: nomeImmagine, mimeType: 'image/png', buffer: pngTintaUnita(40, 30, BLU) },
      },
    });
    expect(aggiunta.status(), await aggiunta.text()).toBe(201);

    await redazione.goto(`${ADMIN_URL}/admin/redazione/caroselli`);
    await redazione.getByRole('link', { name: TITOLO_CAROSELLO, exact: true }).click();
    await redazione.waitForURL(/\/admin\/redazione\/caroselli\/[0-9a-f-]{36}/);
    await expect(
      redazione.getByRole('link', { name: `Pagina con carosello ${stamp}` }),
    ).toBeVisible();

    // Ordine invertito, primo titolo cambiato, una slide tolta: [Terza, Seconda, Prima] → 2 slide.
    // Il focus della tastiera segue la slide spostata (A2): lo stesso comando, o l'opposto al bordo.
    await spostaGiu(redazione, 1);
    await expect(comando(redazione, 2, 'Sposta giù')).toBeFocused();
    await spostaGiu(redazione, 2);
    await expect(comando(redazione, 3, 'Sposta giù')).toBeDisabled();
    await expect(comando(redazione, 3, 'Sposta su')).toBeFocused();
    await spostaGiu(redazione, 1);
    await expect(comando(redazione, 2, 'Sposta giù')).toBeFocused();
    await redazione
      .getByRole('group', { name: 'Slide 1', exact: true })
      .getByRole('textbox', { name: 'Titolo' })
      .fill(titoloNuovo);
    // Dopo «Togli» il focus va al primo comando attivo della slide che ne prende il posto.
    await comando(redazione, 2, 'Togli').press('Enter');
    await expect(redazione.getByRole('group', { name: /^Slide \d+$/ })).toHaveCount(2);
    await expect(comando(redazione, 2, 'Sposta su')).toBeFocused();
    await salvaCarosello(redazione, idCarosello);

    const visitatore = await browser.newPage();
    const dopoLaRimozione = await slideDelSito(visitatore, percorsoPagina);
    expect(dopoLaRimozione.alt).toEqual([titoloNuovo, PRIMA]);
    expect(dopoLaRimozione.punti).toBe(2);

    // Una slide aggiunta in coda, con un'immagine nuova scelta dalla libreria.
    await redazione.getByRole('button', { name: 'Aggiungi un’immagine' }).click();
    await redazione.getByLabel('Cerca media').fill(nomeImmagine);
    await redazione.getByRole('option', { name: nomeImmagine }).click();
    await redazione.getByRole('button', { name: 'Usa questo media' }).click();
    await redazione
      .getByRole('group', { name: 'Slide 3', exact: true })
      .getByRole('textbox', { name: 'Titolo' })
      .fill(titoloAggiunta);
    await salvaCarosello(redazione, idCarosello);

    const dopoLaAggiunta = await slideDelSito(visitatore, percorsoPagina);
    expect(dopoLaAggiunta.alt).toEqual([titoloNuovo, PRIMA, titoloAggiunta]);
    expect(dopoLaAggiunta.punti).toBe(3);

    await visitatore.close();
    await redazione.close();
  });

  test('un’immagine usata da una slide non si elimina dalla libreria e il rifiuto dice dove è usata', async ({
    browser,
  }) => {
    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const intestazioni = await intestazioniApi(redazione);

    const elenco = await redazione.request.get(`${API_URL}/media?search=slide-${stamp}`, {
      headers: intestazioni,
    });
    const [immagine] = ((await elenco.json()) as { items: { id: string }[] }).items;
    expect(immagine, 'l’immagine aggiunta al carosello').toBeDefined();

    const rifiuto = await redazione.request.delete(`${API_URL}/media/${immagine?.id}`, {
      headers: intestazioni,
    });
    expect(rifiuto.status()).toBe(409);
    const errore = ((await rifiuto.json()) as { error: { code: string; message: string } }).error;
    expect(errore.code).toBe('MEDIA_IN_USE');
    expect(errore.message).toContain(TITOLO_CAROSELLO);

    // Il carosello non è stato toccato dal rifiuto.
    const carosello = await redazione.request.get(`${API_URL}/sliders/${idCarosello}`, {
      headers: intestazioni,
    });
    expect(((await carosello.json()) as { slides: unknown[] }).slides).toHaveLength(3);
    await redazione.close();
  });
});
