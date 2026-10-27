import { expect, test, type Locator, type Page } from '@playwright/test';
import { API_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Trascinamento a due esiti (DR-082, DR-084, DR-085, DR-097) **nel browser**:
 * il calcolo della fascia dipende dalle misure vere delle righe, che le prove
 * unitarie non hanno. Ogni prova guarda la frase che dice, **prima** del
 * rilascio, dove finirà l'elemento, e poi il risultato.
 *
 * Voci e blocchi sono creati dalla prova stessa, con nomi inventati.
 */

type Fascia = 'before' | 'inside' | 'after';

const QUOTA: Readonly<Record<Fascia, number>> = { before: 0.1, inside: 0.5, after: 0.9 };

function maniglia(scope: Page | Locator, etichetta: string): Locator {
  return scope.getByRole('button', { name: `Prendi «${etichetta}» per spostarlo` });
}

function rigaDi(page: Page, etichetta: string): Locator {
  return page.locator('.amoris-tree-drop').filter({ has: maniglia(page, etichetta) });
}

function stato(page: Page): Locator {
  return page.locator('.amoris-tree-drop__status');
}

/** Prende la maniglia e porta il puntatore sulla fascia scelta, **senza** rilasciare. */
async function portaSopra(page: Page, presa: Locator, arrivo: Locator, fascia: Fascia) {
  await presa.scrollIntoViewIfNeeded();
  const da = await presa.boundingBox();
  if (!da) throw new Error('maniglia non visibile');
  await page.mouse.move(da.x + da.width / 2, da.y + da.height / 2);
  await page.mouse.down();
  // Oltre gli 8 pixel della soglia.
  await page.mouse.move(da.x + da.width / 2, da.y + da.height / 2 + 14, { steps: 4 });
  // La riga di arrivo si misura **dopo** l'avvio: all'inizio del trascinamento
  // la pagina può scorrere, e una misura presa prima punterebbe alla fascia sbagliata.
  await arrivo.scrollIntoViewIfNeeded();
  const a = await arrivo.boundingBox();
  if (!a) throw new Error('riga di arrivo non visibile');
  await page.mouse.move(a.x + a.width / 2, a.y + a.height * QUOTA[fascia], { steps: 15 });
}

interface Voce {
  readonly id: string;
  readonly label: string;
  readonly parentId: string | null;
}

async function vociDelMenu(page: Page): Promise<Voce[]> {
  const risposta = await page.request.get(`${API_URL}/menus/principale/items`, {
    headers: await intestazioniApi(page),
  });
  expect(risposta.ok()).toBeTruthy();
  return (await risposta.json()) as Voce[];
}

async function aggiungiVoce(page: Page, etichetta: string): Promise<void> {
  await page.getByRole('button', { name: 'Aggiungi una voce' }).click();
  await page.getByLabel('La voce punta a').selectOption('custom');
  await page.getByLabel('Etichetta').fill(etichetta);
  await page.getByLabel('Indirizzo').fill('/indirizzo-inventato/');
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(maniglia(page, etichetta)).toBeVisible();
}

test.describe('menu', () => {
  test.beforeEach(async ({ page }) => {
    await entra(page, 'Redazione');
    await page.getByRole('link', { name: 'Menu' }).click();
    await page.waitForURL(/\/admin\/redazione\/menu/);
  });

  test('DR-082: lasciata al centro, una voce diventa sottovoce; dentro una propria sottovoce è rifiutata', async ({
    page,
  }) => {
    const ora = Date.now();
    const genitore = `Genitore ${ora}`;
    const figlio = `Figlio ${ora}`;
    await aggiungiVoce(page, genitore);
    await aggiungiVoce(page, figlio);

    await portaSopra(page, maniglia(page, figlio), rigaDi(page, genitore), 'inside');
    await expect(stato(page)).toHaveText(`«${figlio}» andrà dentro «${genitore}».`);
    await expect(rigaDi(page, genitore)).toHaveClass(/amoris-tree-drop--inside/);
    await page.mouse.up();

    await expect
      .poll(async () => {
        const voci = await vociDelMenu(page);
        const g = voci.find((voce) => voce.label === genitore);
        return voci.find((voce) => voce.label === figlio)?.parentId === g?.id;
      })
      .toBe(true);

    // Il genitore dentro il proprio figlio: si vede il rifiuto, e nulla cambia.
    await portaSopra(page, maniglia(page, genitore), rigaDi(page, figlio), 'inside');
    await expect(stato(page)).toContainText('non può andare qui');
    await expect(rigaDi(page, figlio)).toHaveClass(/amoris-tree-drop--refused/);
    await page.mouse.up();
    const dopo = await vociDelMenu(page);
    expect(dopo.find((voce) => voce.label === genitore)?.parentId).toBeNull();
  });

  test('DR-082: da tastiera, freccia su e freccia destra annidano la voce in quella sopra', async ({
    page,
  }) => {
    const ora = Date.now();
    const sopra = `Sopra ${ora}`;
    const sotto = `Sotto ${ora}`;
    await aggiungiVoce(page, sopra);
    await aggiungiVoce(page, sotto);

    await maniglia(page, sotto).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    // Prima che la freccia su sia annunciata, la freccia destra non troverebbe ancora la voce sopra.
    await expect(stato(page)).toContainText(`«${sopra}»`);
    await page.keyboard.press('ArrowRight');
    await expect(stato(page)).toHaveText(`«${sotto}» andrà dentro «${sopra}».`);
    await page.keyboard.press('Space');

    await expect
      .poll(async () => {
        const voci = await vociDelMenu(page);
        const s = voci.find((voce) => voce.label === sopra);
        return voci.find((voce) => voce.label === sotto)?.parentId === s?.id;
      })
      .toBe(true);
  });
});

test.describe('blocchi', () => {
  test('DR-085, DR-097: un blocco entra in «Media e testo»; «Media e testo» dentro un separatore è rifiutato', async ({
    page,
  }) => {
    await entra(page, 'Redazione');
    await page.getByRole('button', { name: 'Nuova pagina' }).click();
    await page.getByLabel('Titolo').fill(`Pagina trascinamento ${Date.now()}`);
    await page.getByRole('button', { name: 'Crea in bozza' }).click();
    await page.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);

    for (const tipo of ['Separatore', 'Media e testo']) {
      await page.getByRole('button', { name: 'Aggiungi blocco', exact: true }).click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: new RegExp(`^${tipo}`) })
        .click();
    }

    await expect(page.getByRole('button', { name: /^Prendi «.+» per spostarlo$/ })).toHaveCount(2);
    const separatore = maniglia(page, 'separatore');
    const mediaTesto = maniglia(page, 'media e testo');
    const rigaSeparatore = rigaDi(page, 'separatore');
    const rigaMediaTesto = rigaDi(page, 'media e testo');

    // «Media e testo» dentro il separatore: il separatore non ha figli, quindi
    // la fascia centrale non esiste e il rilascio resta «accanto».
    await portaSopra(page, mediaTesto, rigaSeparatore, 'inside');
    await expect(stato(page)).toContainText('allo stesso livello');
    await page.keyboard.press('Escape');
    await page.mouse.up();

    // Il separatore dentro «Media e testo».
    await portaSopra(page, separatore, rigaMediaTesto, 'inside');
    await expect(stato(page)).toContainText('andrà dentro');
    await page.mouse.up();

    await expect(page.locator('.amoris-block-tree__nested .amoris-tree-drop')).toHaveCount(1);
  });
});
