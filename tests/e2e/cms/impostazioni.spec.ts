import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, WEB_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Le impostazioni generali arrivano al sito (DR-270): l'amministrazione cambia
 * «Formato data» e «Articoli per pagina» dall'API, e il sito ne mostra l'effetto
 * dove la sorgente le usava — le date della scheda di un documento
 * (`date_format` di Download Manager) e il numero di articoli di un elenco
 * Category Posts senza numero proprio (`posts_per_page`). Alla fine i valori di
 * partenza tornano al loro posto, anche se la prova fallisce.
 *
 * Il documento pubblico del seme è del 5 gennaio 2026; notizie, categoria e
 * pagina sono inventate e uniche nell'esecuzione.
 */

const DOCUMENTO = '/download/documento-di-prova-pubblico/';
const ID_ELENCO = 'b_e1e1c0000001';

async function html(request: APIRequestContext, percorso: string): Promise<string> {
  const risposta = await request.get(`${WEB_URL}${percorso}`, { maxRedirects: 0 });
  expect(risposta.status(), `${percorso} deve rispondere 200`).toBe(200);
  return risposta.text();
}

const dataDiCreazione = (pagina: string) =>
  /Data di creazione\s*(?:<!-- -->)?\s*<span class="badge">([^<]*)<\/span>/.exec(pagina)?.[1];
const articoliInElenco = (pagina: string) => pagina.match(/class="cat-post-item"/g)?.length ?? 0;

async function leggiImpostazione(page: Page, chiave: string): Promise<unknown> {
  const risposta = await page.request.get(`${API_URL}/settings`, {
    headers: await intestazioniApi(page),
  });
  expect(risposta.ok(), await risposta.text()).toBeTruthy();
  const voce = ((await risposta.json()) as { key: string; value: unknown }[]).find(
    (riga) => riga.key === chiave,
  );
  expect(voce, `l’impostazione ${chiave} esiste`).toBeDefined();
  return voce?.value;
}

async function scriviImpostazione(page: Page, chiave: string, valore: unknown): Promise<void> {
  const risposta = await page.request.put(`${API_URL}/settings/${chiave}`, {
    headers: await intestazioniApi(page),
    data: { value: valore },
  });
  expect(risposta.ok(), `${chiave}: ${await risposta.text()}`).toBeTruthy();
}

/** Una notizia pubblicata nella categoria indicata. */
async function notizia(page: Page, termId: string, slug: string): Promise<void> {
  const headers = await intestazioniApi(page);
  const creata = await page.request.post(`${API_URL}/contents`, {
    headers,
    data: { type: 'post', slug, title: `Notizia ${slug}` },
  });
  expect(creata.ok(), await creata.text()).toBeTruthy();
  const { id } = (await creata.json()) as { id: string };
  const categorie = await page.request.put(`${API_URL}/contents/${id}/terms`, {
    headers,
    data: { termIds: [termId] },
  });
  expect(categorie.ok(), await categorie.text()).toBeTruthy();
  const pubblicata = await page.request.post(`${API_URL}/contents/${id}/publish`, { headers });
  expect(pubblicata.ok(), await pubblicata.text()).toBeTruthy();
}

/** Una pagina pubblicata con un solo elenco Category Posts della categoria, senza numero proprio. */
async function paginaConElenco(page: Page, termId: string, slug: string): Promise<string> {
  const headers = await intestazioniApi(page);
  const creata = await page.request.post(`${API_URL}/contents`, {
    headers,
    data: {
      type: 'page',
      slug,
      title: `Pagina ${slug}`,
      blocks: {
        schema: 1,
        blocks: [
          {
            type: 'post_list',
            id: ID_ELENCO,
            props: {
              termIds: [termId],
              limit: null,
              offset: 0,
              showThumbnail: false,
              showDate: false,
              showExcerpt: false,
              order: 'date_desc',
              classes: [],
            },
            children: [],
          },
        ],
      },
    },
  });
  expect(creata.ok(), await creata.text()).toBeTruthy();
  const { id } = (await creata.json()) as { id: string };
  const pubblicata = await page.request.post(`${API_URL}/contents/${id}/publish`, { headers });
  expect(pubblicata.ok(), await pubblicata.text()).toBeTruthy();
  return ((await pubblicata.json()) as { path: string }).path;
}

test.describe('impostazioni lette dal sito', () => {
  test('«Formato data» e «Articoli per pagina» cambiano il sito dove li usava la sorgente', async ({
    browser,
    request,
  }) => {
    const stamp = Date.now();

    // La redazione prepara tre notizie in una categoria sua e una pagina con l'elenco.
    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const categoria = await redazione.request.post(`${API_URL}/terms`, {
      headers: await intestazioniApi(redazione),
      data: { taxonomy: 'category', name: `Impostazioni ${stamp}`, slug: `impostazioni-${stamp}` },
    });
    expect(categoria.ok(), await categoria.text()).toBeTruthy();
    const termId = ((await categoria.json()) as { id: string }).id;
    for (const n of [1, 2, 3]) await notizia(redazione, termId, `impostazioni-${stamp}-${n}`);
    const percorso = await paginaConElenco(redazione, termId, `elenco-${stamp}`);

    const amministrazione = await browser.newPage();
    await entra(amministrazione, 'Impostazioni');
    const formatoDiPartenza = await leggiImpostazione(amministrazione, 'site.date_format');
    const articoliDiPartenza = await leggiImpostazione(amministrazione, 'content.posts_per_page');

    try {
      // Con i valori di partenza: la data come la sorgente, tutte e tre le notizie.
      expect(dataDiCreazione(await html(request, DOCUMENTO))).toBe('5 Gennaio 2026');
      expect(articoliInElenco(await html(request, percorso))).toBe(3);

      await scriviImpostazione(amministrazione, 'site.date_format', 'd/m/Y');
      await scriviImpostazione(amministrazione, 'content.posts_per_page', 2);

      // Nessuna cache: l'effetto si vede alla richiesta successiva, come le altre impostazioni.
      expect(dataDiCreazione(await html(request, DOCUMENTO))).toBe('05/01/2026');
      expect(articoliInElenco(await html(request, percorso))).toBe(2);

      // Un valore assurdo è rifiutato in italiano e il sito resta com'era.
      const rifiuto = await amministrazione.request.put(
        `${API_URL}/settings/content.posts_per_page`,
        { headers: await intestazioniApi(amministrazione), data: { value: 0 } },
      );
      expect(rifiuto.status()).toBe(400);
      expect(((await rifiuto.json()) as { error: { message: string } }).error.message).toBe(
        '«Articoli per pagina» deve essere un numero intero da 1 a 50.',
      );
      expect(articoliInElenco(await html(request, percorso))).toBe(2);
    } finally {
      await scriviImpostazione(amministrazione, 'site.date_format', formatoDiPartenza);
      await scriviImpostazione(amministrazione, 'content.posts_per_page', articoliDiPartenza);
    }

    expect(dataDiCreazione(await html(request, DOCUMENTO))).toBe('5 Gennaio 2026');
    expect(articoliInElenco(await html(request, percorso))).toBe(3);
  });
});
