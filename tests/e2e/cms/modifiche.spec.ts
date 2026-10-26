import { expect, test, type Page } from '@playwright/test';
import { API_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Le parti dei criteri 1D-29…1D-34 che mancavano nel browser (DR-100): testo
 * e immagini dentro i blocchi, aggiungere ed eliminare un blocco, sostituire
 * ed eliminare un media, SEO di un contenuto e template globali, modificare un
 * redirect. Ogni esito si legge dal servizio, non dalla schermata.
 *
 * Tutto ciò che la prova crea ha un nome inventato; l'immagine della pagina
 * del seme sintetico è il solo oggetto preesistente che si modifica.
 */

/** Un PNG di un pixel e uno di quattro: dimensioni diverse, nessun soggetto. */
const UN_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const QUATTRO_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAC0lEQVR4nGNgQAcAABIAAXfx+gAAAAAASUVORK5CYII=',
  'base64',
);

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

async function blocchiDi(page: Page, id: string): Promise<Blocco[]> {
  const contenuto = await leggi<{ blocks: { blocks: Blocco[] } }>(page, `/contents/${id}`);
  return contenuto.blocks.blocks;
}

/** Crea una pagina in bozza dall'interfaccia e ne restituisce l'identificativo. */
async function nuovaPagina(page: Page, titolo: string): Promise<string> {
  await page.getByRole('button', { name: 'Nuova pagina' }).click();
  await page.getByLabel('Titolo').fill(titolo);
  await page.getByRole('button', { name: 'Crea in bozza' }).click();
  await page.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
  return page.url().split('/').pop() ?? '';
}

async function aggiungiBlocco(page: Page, tipo: string): Promise<void> {
  await page.getByRole('button', { name: 'Aggiungi blocco', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(`^${tipo}`) })
    .click();
}

test.describe('blocchi', () => {
  test.beforeEach(async ({ page }) => {
    await entra(page, 'Redazione');
  });

  test('criterio 1D-29: modificare il testo dentro un blocco', async ({ page }) => {
    const id = await nuovaPagina(page, `Pagina testo ${Date.now()}`);
    await aggiungiBlocco(page, 'Testo');

    const frase = `Frase scritta dalla prova ${Date.now()}`;
    const superficie = page.locator('.amoris-rich-text__surface [contenteditable="true"]');
    await superficie.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(frase);
    await page.getByRole('button', { name: 'Salva', exact: true }).click();

    await expect
      .poll(async () => {
        const testo = (await blocchiDi(page, id)).find((b) => b.type === 'rich_text');
        return String(testo?.props.html ?? '');
      })
      .toContain(frase);
  });

  test('criterio 1D-29: modificare testo alternativo e didascalia di un’immagine', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'Pagina di prova' }).click();
    await page.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
    const id = page.url().split('/').pop() ?? '';

    await page.getByRole('button', { name: /^Immagine — / }).click();
    const alternativo = `Quadrato descritto dalla prova ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Testo alternativo', exact: true }).fill(alternativo);
    await page
      .getByRole('textbox', { name: 'Didascalia', exact: true })
      .fill('Didascalia scritta dalla prova.');
    await page.getByRole('button', { name: 'Salva', exact: true }).click();

    await expect
      .poll(async () => {
        const immagine = (await blocchiDi(page, id)).find((b) => b.type === 'image');
        return [immagine?.props.alt, immagine?.props.caption];
      })
      .toEqual([alternativo, 'Didascalia scritta dalla prova.']);
  });

  test('criterio 1D-30: aggiungere, spostare ed eliminare un blocco', async ({ page }) => {
    const id = await nuovaPagina(page, `Pagina blocchi ${Date.now()}`);
    await aggiungiBlocco(page, 'Separatore');
    await aggiungiBlocco(page, 'Testo');

    await page.getByRole('button', { name: 'Sposta su: Nuovo testo' }).click();
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect
      .poll(async () => (await blocchiDi(page, id)).map((b) => b.type))
      .toEqual(['rich_text', 'separator']);

    // Nessuna attesa della fine del salvataggio: una modifica fatta nel frattempo
    // deve restare (DR-102), ed è ciò che questo passo prova.
    await page.getByRole('button', { name: 'Elimina: separatore' }).click();
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect
      .poll(async () => (await blocchiDi(page, id)).map((b) => b.type))
      .toEqual(['rich_text']);
  });
});

test.describe('media', () => {
  test('criterio 1D-31: didascalia, sostituzione ed eliminazione di un media', async ({ page }) => {
    await entra(page, 'Redazione');
    await page.getByRole('link', { name: 'Media' }).click();
    await page.waitForURL(/\/admin\/redazione\/media/);

    const nomeFile = `da-sostituire-${Date.now()}.png`;
    await page.getByLabel('Scegli i file da caricare').setInputFiles({
      name: nomeFile,
      mimeType: 'image/png',
      buffer: UN_PIXEL_PNG,
    });
    await page.getByRole('button', { name: nomeFile }).click({ timeout: 30_000 });

    const cerca = async () => {
      const corpo = await leggi<{
        items: {
          fileName: string;
          caption: string | null;
          width: number | null;
          height: number | null;
          publicPath: string;
        }[];
      }>(page, `/media?search=${encodeURIComponent(nomeFile)}`);
      return corpo.items.find((item) => item.fileName === nomeFile);
    };

    await page.getByLabel('Didascalia').fill('Didascalia del media di prova.');
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect.poll(async () => (await cerca())?.caption).toBe('Didascalia del media di prova.');

    const prima = await cerca();
    expect([prima?.width, prima?.height]).toEqual([1, 1]);
    await page.getByLabel('Scegli il file che sostituisce questo').setInputFiles({
      name: 'sostituto.png',
      mimeType: 'image/png',
      buffer: QUATTRO_PIXEL_PNG,
    });
    // Dalla 1G-W5 la sostituzione chiede conferma; le misure si leggono dal file, che il servizio rielabora.
    await page.getByRole('button', { name: 'Sostituisci', exact: true }).click();
    // La sostituzione conserva l'indirizzo (DR-074) e cambia il file.
    await expect
      .poll(async () => [(await cerca())?.width, (await cerca())?.height])
      .toEqual([2, 2]);
    expect((await cerca())?.publicPath).toBe(prima?.publicPath);

    await page.getByRole('button', { name: 'Elimina', exact: true }).click();
    await page.getByLabel(`Digita «${nomeFile}» per confermare`).fill(nomeFile);
    await page.getByRole('button', { name: 'Elimina definitivamente' }).click();
    await expect.poll(async () => await cerca()).toBeUndefined();
  });
});

test.describe('SEO', () => {
  test.beforeEach(async ({ page }) => {
    await entra(page, 'Redazione');
  });

  test('criterio 1D-33: modificare i metadati SEO di un contenuto', async ({ page }) => {
    const id = await nuovaPagina(page, `Pagina SEO ${Date.now()}`);
    await page.getByRole('tab', { name: 'SEO' }).click();
    // Si scrive senza aspettare il caricamento: la lettura non tocca i campi già
    // scritti (DR-102).

    const titoloSeo = `Titolo SEO della prova ${Date.now()}`;
    await page.getByLabel('Titolo SEO').fill(titoloSeo);
    await page.getByLabel('Descrizione SEO').fill('Descrizione SEO scritta dalla prova.');
    await page.getByRole('button', { name: 'Salva i metadati SEO' }).click();
    await expect(page.getByText('Fatto', { exact: true })).toBeVisible();

    await expect
      .poll(async () => {
        // 404 finché la riga SEO non esiste: si riprova, non si fallisce.
        const risposta = await page.request.get(`${API_URL}/seo/contents/${id}`, {
          headers: await intestazioniApi(page),
        });
        if (!risposta.ok()) return [`stato ${risposta.status()}`];
        const seo = (await risposta.json()) as { title: string | null; description: string | null };
        return [seo.title, seo.description];
      })
      .toEqual([titoloSeo, 'Descrizione SEO scritta dalla prova.']);
  });

  test('criterio 1D-33: modificare un template globale', async ({ page }) => {
    await page.getByRole('link', { name: 'SEO e indirizzi' }).click();
    await page.waitForURL(/\/admin\/redazione\/seo/);
    await page.getByRole('tab', { name: 'Template globali' }).click();

    const modello = `{term_title} — prova ${Date.now()} - {site_title}`;
    await page.getByRole('button', { name: 'Categorie', exact: true }).click();
    await page.getByLabel('Template del titolo').fill(modello);
    await page.getByRole('button', { name: 'Salva il template' }).click();

    await expect
      .poll(async () => {
        const modelli = await leggi<{ scope: string; titleTemplate: string }[]>(
          page,
          '/seo/templates',
        );
        return modelli.find((voce) => voce.scope === 'category')?.titleTemplate;
      })
      .toBe(modello);
  });

  test('criterio 1D-34: modificare la destinazione di un redirect', async ({ page }) => {
    await page.getByRole('link', { name: 'SEO e indirizzi' }).click();
    await page.waitForURL(/\/admin\/redazione\/seo/);
    await page.getByRole('tab', { name: 'Redirect' }).click();

    const partenza = `/da-modificare-${Date.now()}/`;
    await page.getByRole('button', { name: 'Nuovo redirect' }).click();
    await page.getByLabel('Indirizzo di partenza').fill(partenza);
    await page.getByLabel('Indirizzo di arrivo').fill('/pagina-di-prova/');
    await page.getByRole('button', { name: 'Crea il redirect' }).click();

    await page.getByRole('button', { name: partenza }).click();
    await page.getByLabel('Indirizzo di arrivo').fill('/notizia-di-prova/');
    await page.getByRole('button', { name: 'Salva il redirect' }).click();

    await expect
      .poll(async () => {
        const corpo = await leggi<{ items: { sourcePath: string; targetPath: string }[] }>(
          page,
          `/redirects?search=${encodeURIComponent(partenza)}`,
        );
        return corpo.items.find((item) => item.sourcePath === partenza)?.targetPath;
      })
      .toBe('/notizia-di-prova/');
  });
});
