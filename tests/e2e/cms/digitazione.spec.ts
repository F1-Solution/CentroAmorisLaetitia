import { expect, test, type Page } from '@playwright/test';
import { API_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * W9-N2 (collaudo della 1G-W9, DR-324): scrivendo nel blocco «Testo» mentre
 * arrivava il salvataggio automatico della copia di lavoro, una parte dei
 * tasti andava persa e il testo salvato era diverso da quello voluto, senza
 * alcun avviso.
 *
 * Le prove scrivono mentre una copia di lavoro è in viaggio verso il servizio
 * (parte 1,5 s dopo l'ultima battuta) e confrontano il testo atteso con lo
 * schermo, con la copia di lavoro salvata e con il contenuto salvato. I titoli
 * delle pagine sono inventati.
 */

interface Blocco {
  type: string;
  props: Record<string, unknown>;
  children: Blocco[];
}

async function leggi<T>(page: Page, percorso: string): Promise<T> {
  const risposta = await page.request.get(`${API_URL}${percorso}`, {
    headers: await intestazioniApi(page),
  });
  expect(risposta.ok(), `${percorso}: ${risposta.status()}`).toBeTruthy();
  return (await risposta.json()) as T;
}

/** Il testo del primo blocco «Testo», senza marcatura. */
function testoDi(blocchi: readonly Blocco[]): string {
  const html = String(blocchi.find((b) => b.type === 'rich_text')?.props.html ?? '');
  return html.replace(/<[^>]+>/g, '').trim();
}

/** Crea una pagina in bozza con un blocco «Testo» vuoto e mette il cursore dentro. */
async function paginaConTesto(page: Page, titolo: string): Promise<string> {
  await entra(page, 'Redazione');
  await page.getByRole('button', { name: 'Nuova pagina' }).click();
  await page.getByLabel('Titolo').fill(titolo);
  await page.getByRole('button', { name: 'Crea in bozza' }).click();
  await page.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
  const id = page.url().split('/').pop() ?? '';
  await page.getByRole('button', { name: 'Aggiungi blocco', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Testo/ })
    .click();
  await page.locator('.amoris-rich-text__surface [contenteditable="true"]').click();
  await page.keyboard.press('ControlOrMeta+A');
  return id;
}

const PARTENZA = 'Frase di partenza scritta dalla prova di digitazione.';
const superficie = (page: Page) =>
  page.locator('.amoris-rich-text__surface [contenteditable="true"]');

test('W9-N2: ciò che si scrive mentre la copia di lavoro viaggia finisce nella copia successiva', async ({
  page,
}) => {
  // Ogni copia di lavoro resta in viaggio 1,2 s: abbastanza per scriverci dentro, come su una rete lenta.
  await page.route(`${API_URL}/contents/*/draft`, async (route) => {
    if (route.request().method() === 'PUT') await new Promise((fine) => setTimeout(fine, 1200));
    await route.continue();
  });
  const id = await paginaConTesto(page, `Pagina copia in viaggio ${Date.now()}`);

  const inViaggio = page.waitForRequest(
    (richiesta) => richiesta.url().endsWith('/draft') && richiesta.method() === 'PUT',
  );
  await page.keyboard.type(PARTENZA);
  await inViaggio;
  const aggiunta = ' Seconda frase, scritta mentre la copia viaggia.';
  await page.keyboard.type(aggiunta);
  const atteso = PARTENZA + aggiunta;

  await expect.poll(async () => (await superficie(page).innerText()).trim()).toBe(atteso);
  await expect(page.getByText(/^Copia di lavoro salvata alle/)).toBeVisible({ timeout: 15_000 });
  const copia = await leggi<{ blocks: { blocks: Blocco[] } }>(page, `/contents/${id}/draft`);
  expect(testoDi(copia.blocks.blocks)).toBe(atteso);
});

/**
 * Frecce, Inizio e Fine li gestisce il browser, e l'editor legge il cursore spostato solo
 * all'evento `selectionchange`. Nel collaudo (T11b, DR-326) quell'evento arrivava dopo i tasti
 * successivi quando la pagina era occupata: i «Canc» subito dopo Ctrl+Home trovavano l'editor
 * col cursore ancora in fondo e venivano ignorati. Qui l'evento si trattiene per qualche tasto,
 * così il ritardo si ripete a ogni esecuzione.
 */
async function trattieniSelectionchange(page: Page, attivo: boolean): Promise<void> {
  await page.evaluate((attivo) => {
    const w = window as unknown as { __trattieni?: boolean; __trappola?: boolean };
    if (!w.__trappola) {
      w.__trappola = true;
      document.addEventListener(
        'selectionchange',
        (evento) => {
          if (w.__trattieni) evento.stopImmediatePropagation();
        },
        true,
      );
    }
    w.__trattieni = attivo;
    // Rilasciato, l'editor riceve l'evento rimasto indietro.
    if (!attivo) document.dispatchEvent(new Event('selectionchange'));
  }, attivo);
}

test('W9-N2: i tasti premuti prima che l’editor legga il cursore spostato dal browser lavorano dove si trova', async ({
  page,
}) => {
  await paginaConTesto(page, `Pagina cursore ${Date.now()}`);
  await page.keyboard.type(PARTENZA);
  await page.keyboard.press('Enter');
  // Corta, così sta su una riga sola dello schermo e «Inizio» porta al suo inizio.
  const seconda = 'Riga corta inventata.';
  await page.keyboard.type(seconda);
  const paragrafi = () => superficie(page).locator('p').allInnerTexts();
  await expect.poll(paragrafi).toEqual([PARTENZA, seconda]);

  // «Canc» subito dopo Ctrl+Home: l'editor crede ancora il cursore in fondo.
  await trattieniSelectionchange(page, true);
  await page.keyboard.press('ControlOrMeta+Home');
  for (let tasto = 0; tasto < 4; tasto++) await page.keyboard.press('Delete');
  await trattieniSelectionchange(page, false);
  await expect.poll(paragrafi).toEqual([PARTENZA.slice(4), seconda]);

  // «Backspace» dopo qualche freccia: l'editor crede il cursore a inizio riga e unirebbe le due righe.
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.press('Home');
  // Qui l'evento passa: anche l'editor sa che il cursore è all'inizio della seconda riga.
  await expect
    .poll(() =>
      page.evaluate(() => {
        type Testa = { parentOffset: number; parent: { textContent: string } };
        const sup = document.querySelector('.amoris-rich-text__surface .ProseMirror') as
          (Element & { editor?: { state: { selection: { $head: Testa } } } }) | null;
        const testa = sup?.editor?.state.selection.$head;
        return testa ? `${testa.parentOffset}:${testa.parent.textContent}` : null;
      }),
    )
    .toBe(`0:${seconda}`);
  await trattieniSelectionchange(page, true);
  for (let tasto = 0; tasto < 7; tasto++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Backspace');
  await trattieniSelectionchange(page, false);
  await expect.poll(paragrafi).toEqual([PARTENZA.slice(4), seconda.slice(0, 6) + seconda.slice(7)]);
});

test('W9-N2: nessun tasto si perde scrivendo a raffiche attraverso il salvataggio automatico', async ({
  page,
}) => {
  const id = await paginaConTesto(page, `Pagina digitazione ${Date.now()}`);
  await page.keyboard.type(PARTENZA);

  let atteso = PARTENZA;
  for (let giro = 0; giro < 6; giro++) {
    // Ogni raffica comincia quando il salvataggio automatico sta per partire.
    await page.waitForTimeout(1450);
    const parola = ` giro${giro} ventidue lettere`;
    await page.keyboard.type(parola);
    atteso += parola;
    for (let tasto = 0; tasto < 8; tasto++) await page.keyboard.press('Backspace');
    atteso = atteso.slice(0, -8);

    // In testa, come nel collaudo: «Canc» di seguito.
    await page.keyboard.press('ControlOrMeta+Home');
    await page.waitForTimeout(1450);
    await page.keyboard.type(`[${giro}] `);
    for (let tasto = 0; tasto < 4; tasto++) await page.keyboard.press('Delete');
    atteso = `[${giro}] ${atteso.slice(4)}`;
    await page.keyboard.press('ControlOrMeta+End');
  }

  await expect.poll(async () => (await superficie(page).innerText()).trim()).toBe(atteso);
  await expect(page.getByText(/^Copia di lavoro salvata alle/)).toBeVisible({ timeout: 15_000 });
  const copia = await leggi<{ blocks: { blocks: Blocco[] } }>(page, `/contents/${id}/draft`);
  expect(testoDi(copia.blocks.blocks)).toBe(atteso);

  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect
    .poll(async () => {
      const contenuto = await leggi<{ blocks: { blocks: Blocco[] } }>(page, `/contents/${id}`);
      return testoDi(contenuto.blocks.blocks);
    })
    .toBe(atteso);
});

/**
 * W9-N7 (DR-330, DR-350): su una rete lenta un salvataggio della copia di lavoro ancora in
 * viaggio arrivava al servizio dopo «Scarta la copia di lavoro» e la copia rinasceva: alla
 * riapertura l'editor la riprendeva. Qui dal secondo salvataggio in poi ogni PUT resta in
 * viaggio 3 s.
 */
test('W9-N7: dopo «Scarta la copia di lavoro» un salvataggio in viaggio non fa rinascere la copia', async ({
  page,
}) => {
  let salvataggi = 0;
  await page.route(`${API_URL}/contents/*/draft`, async (route) => {
    if (route.request().method() === 'PUT') {
      salvataggi += 1;
      if (salvataggi > 1) await new Promise((fine) => setTimeout(fine, 3000));
    }
    await route.continue();
  });
  const id = await paginaConTesto(page, `Pagina copia scartata ${Date.now()}`);

  await page.keyboard.type(PARTENZA);
  await expect(page.getByText(/^Copia di lavoro salvata alle/)).toBeVisible({ timeout: 15_000 });

  const inViaggio = page.waitForRequest(
    (richiesta) => richiesta.url().endsWith('/draft') && richiesta.method() === 'PUT',
  );
  await page.keyboard.type(' Frase che resta in viaggio.');
  await inViaggio;
  await page.getByRole('button', { name: 'Scarta la copia di lavoro' }).click();
  await expect(
    page.getByText('Copia di lavoro scartata: è tornato il contenuto salvato.'),
  ).toBeVisible();

  // Il PUT trattenuto ha il tempo di arrivare, poi si riapre il contenuto.
  await page.waitForTimeout(4000);
  const riletta = page.waitForResponse(
    (risposta) =>
      risposta.url().endsWith(`/contents/${id}/draft`) && risposta.request().method() === 'GET',
  );
  await page.reload();
  // 204: alla riapertura il contenuto non ha più una copia di lavoro da riprendere.
  expect((await riletta).status()).toBe(204);
  await expect(page.getByLabel('Titolo')).toBeVisible();
  await expect(page.getByText(/^Ripresa la copia di lavoro/)).toHaveCount(0);
});

/**
 * W9-N8 (DR-336, DR-351): nel collaudo «Ctrl+Home» premuto subito dopo il clic a volte non
 * spostava il cursore, e i «Canc» cadevano in fondo al paragrafo senza togliere nulla. Qui il
 * browser non sposta il cursore a quel tasto, come quando lo spostamento arriva in ritardo:
 * l'editor lo deve fare da sé.
 */
test('W9-N8: «Ctrl+Home» sposta il cursore anche se il browser non lo fa', async ({ page }) => {
  await paginaConTesto(page, `Pagina inizio del testo ${Date.now()}`);
  await page.keyboard.type(PARTENZA);
  await expect.poll(async () => (await superficie(page).innerText()).trim()).toBe(PARTENZA);

  await page.evaluate(() => {
    window.addEventListener('keydown', (evento) => {
      if (evento.key === 'Home' && (evento.ctrlKey || evento.metaKey)) evento.preventDefault();
    });
  });
  await superficie(page).click();
  await page.keyboard.press('ControlOrMeta+Home');
  for (let tasto = 0; tasto < 22; tasto++) await page.keyboard.press('Delete');

  await expect
    .poll(async () => (await superficie(page).innerText()).trim())
    .toBe(PARTENZA.slice(22));
});
