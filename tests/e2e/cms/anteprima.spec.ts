import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { formaConfrontabile, primaDifferenza } from '../../visual/confrontoHtml';
import { ACCESSO_ENTRAMBI, ADMIN_URL, API_URL, WEB_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * L'anteprima delle bozze sul sito (1G-W5, T7): `/anteprima/<id>/` si vede solo con la sessione
 * di Redazione, mostra la copia di lavoro di chi guarda, non si indicizza né si conserva, e dopo
 * la pubblicazione ha lo stesso HTML della pagina pubblica con la regola di DR-202.
 *
 * Titoli e indirizzi sono inventati e unici nell'esecuzione. Il seme dell'e2e non ha un menu
 * nella testata: l'identità con menu e media riservati la prova `tests/visual/prova-anteprima.ts`.
 */

const INTESTAZIONI_ANTEPRIMA = {
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
} as const;

type Tipo = 'page' | 'post';

/** L'intestazione `cookie` della sessione del browser, per leggere l'HTML grezzo dal sito. */
async function cookieDi(page: Page): Promise<string> {
  return (await intestazioniApi(page))['cookie'] ?? '';
}

/** Un corpo di testo con tutte le proprietà dello schema, perché l'editor rifiuta un blocco incompleto. */
function corpoDiProva(testo: string) {
  const spaziatura = { base: null, tablet: null, phone: null };
  return {
    schema: 1,
    blocks: [
      {
        type: 'rich_text',
        id: 'b_5e6d0000aa02',
        props: {
          html: `<p>${testo}</p>`,
          textAlign: null,
          backgroundLayout: null,
          border: null,
          padding: spaziatura,
          margin: spaziatura,
          classes: [],
        },
        children: [],
      },
    ],
  };
}

interface Creato {
  id: string;
  updatedAt: string;
}

/** Crea un contenuto in bozza con un testo suo; una notizia entra anche in una categoria. */
async function creaContenuto(
  page: Page,
  tipo: Tipo,
  slug: string,
  titolo: string,
  testo: string,
): Promise<Creato> {
  const risposta = await page.request.post(`${API_URL}/contents`, {
    headers: await intestazioniApi(page),
    data: { type: tipo, slug, title: titolo, blocks: corpoDiProva(testo) },
  });
  expect(risposta.ok(), await risposta.text()).toBeTruthy();
  const creato = (await risposta.json()) as Creato;
  if (tipo === 'post') {
    const categorie = await page.request.get(`${API_URL}/terms?taxonomy=category`, {
      headers: await intestazioniApi(page),
    });
    const [prima] = (await categorie.json()) as { id: string }[];
    expect(prima, 'una categoria del seme').toBeDefined();
    const assegnata = await page.request.put(`${API_URL}/contents/${creato.id}/terms`, {
      headers: await intestazioniApi(page),
      data: { termIds: [prima?.id] },
    });
    expect(assegnata.ok(), await assegnata.text()).toBeTruthy();
  }
  return creato;
}

async function pubblica(page: Page, id: string): Promise<string> {
  const risposta = await page.request.post(`${API_URL}/contents/${id}/publish`, {
    headers: await intestazioniApi(page),
  });
  expect(risposta.ok(), await risposta.text()).toBeTruthy();
  return ((await risposta.json()) as { path: string }).path;
}

/** Salva la copia di lavoro di chi è entrato, come fa l'editor da solo. */
async function salvaCopia(
  page: Page,
  id: string,
  titolo: string,
  testo: string,
  baseUpdatedAt: string,
): Promise<void> {
  const risposta = await page.request.put(`${API_URL}/contents/${id}/draft`, {
    headers: await intestazioniApi(page),
    data: { title: titolo, blocks: corpoDiProva(testo), baseUpdatedAt },
  });
  expect(risposta.ok(), await risposta.text()).toBeTruthy();
}

async function leggiAggiornamento(page: Page, id: string): Promise<string> {
  const risposta = await page.request.get(`${API_URL}/contents/${id}`, {
    headers: await intestazioniApi(page),
  });
  expect(risposta.ok(), await risposta.text()).toBeTruthy();
  return ((await risposta.json()) as Creato).updatedAt;
}

/** Stato, intestazioni e HTML grezzo di una pagina del sito, senza seguire i redirect. */
async function leggiSito(request: APIRequestContext, percorso: string, cookie?: string) {
  const risposta = await request.get(`${WEB_URL}${percorso}`, {
    maxRedirects: 0,
    ...(cookie ? { headers: { cookie } } : {}),
  });
  return { status: risposta.status(), headers: risposta.headers(), html: await risposta.text() };
}

function attendiIntestazioniDiAnteprima(headers: Record<string, string>, dove: string): void {
  for (const [nome, valore] of Object.entries(INTESTAZIONI_ANTEPRIMA)) {
    expect(headers[nome], `${dove}: ${nome}`).toBe(valore);
  }
  // Next può scrivere una propria forma di Cache-Control sulle pagine dinamiche: contano i due termini.
  const cache = (headers['cache-control'] ?? '').split(',').map((termine) => termine.trim());
  expect(cache, `${dove}: cache-control`).toEqual(expect.arrayContaining(['private', 'no-store']));
}

/** Entra come la persona con entrambi i ruoli, scegliendo Redazione: è un'altra persona rispetto alla redazione del seme. */
async function entraComeAltraRedazione(page: Page): Promise<void> {
  await page.goto(`${ADMIN_URL}/admin/accesso`);
  await page.getByLabel('Indirizzo di posta').fill(ACCESSO_ENTRAMBI.email);
  await page.getByLabel('Password').fill(ACCESSO_ENTRAMBI.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await page.waitForURL(/\/admin\/(scelta-area|redazione|impostazioni)/);
  if (page.url().includes('scelta-area')) {
    await page.getByRole('button', { name: 'Redazione', exact: false }).first().click();
  }
  await expect(page.getByText('Stai lavorando come Redazione')).toBeVisible();
}

test.describe('anteprima', () => {
  test('anonimo e Impostazioni ricevono 404, la Redazione vede la propria copia di lavoro e un’altra persona no', async ({
    browser,
    request,
  }) => {
    const stamp = Date.now();
    const titolo = `Pagina in anteprima ${stamp}`;
    const titoloCopia = `Titolo della copia ${stamp}`;
    const percorsoAnteprima = (id: string) => `/anteprima/${id}/`;

    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const cookieRedazione = await cookieDi(redazione);
    const pagina = await creaContenuto(
      redazione,
      'page',
      `in-anteprima-${stamp}`,
      titolo,
      `Testo sintetico ${stamp}.`,
    );

    // 1. Da anonimo: 404 come per una pagina che non esiste, con le intestazioni di S16.
    const anonimo = await leggiSito(request, percorsoAnteprima(pagina.id));
    expect(anonimo.status).toBe(404);
    expect(anonimo.html).not.toContain(titolo);
    attendiIntestazioniDiAnteprima(anonimo.headers, 'anonimo');

    // 2. Con una sessione dell'area Impostazioni: 404, perché manca il permesso di leggere i contenuti.
    const impostazioni = await browser.newPage();
    await entra(impostazioni, 'Impostazioni');
    const daImpostazioni = await leggiSito(
      request,
      percorsoAnteprima(pagina.id),
      await cookieDi(impostazioni),
    );
    expect(daImpostazioni.status).toBe(404);
    expect(daImpostazioni.html).not.toContain(titolo);
    attendiIntestazioniDiAnteprima(daImpostazioni.headers, 'Impostazioni');
    await impostazioni.close();

    // 3. Una bozza mai pubblicata la vede la Redazione, con le intestazioni di S16 (anche il Referrer-Policy).
    const bozza = await leggiSito(request, percorsoAnteprima(pagina.id), cookieRedazione);
    expect(bozza.status).toBe(200);
    expect(bozza.html).toContain(titolo);
    attendiIntestazioniDiAnteprima(bozza.headers, 'Redazione');

    // 4. Un identificativo inesistente è un 404 anche per la Redazione.
    const inesistente = await leggiSito(
      request,
      percorsoAnteprima('00000000-0000-4000-8000-000000000000'),
      cookieRedazione,
    );
    expect(inesistente.status).toBe(404);

    // 5. Pubblicata la pagina, la Redazione cambia il titolo nella copia di lavoro: l'anteprima lo mostra, il sito no.
    const percorso = await pubblica(redazione, pagina.id);
    await salvaCopia(
      redazione,
      pagina.id,
      titoloCopia,
      `Testo della copia ${stamp}.`,
      await leggiAggiornamento(redazione, pagina.id),
    );
    const conCopia = await leggiSito(request, percorsoAnteprima(pagina.id), cookieRedazione);
    expect(conCopia.status).toBe(200);
    expect(conCopia.html).toContain(titoloCopia);
    expect(conCopia.html).not.toContain(titolo);
    const pubblica1 = await leggiSito(request, percorso);
    expect(pubblica1.status).toBe(200);
    expect(pubblica1.html).toContain(titolo);
    expect(pubblica1.html).not.toContain(titoloCopia);

    // 6. Un'altra persona della Redazione non vede la copia di lavoro altrui: la sua anteprima è il contenuto pubblicato.
    const altra = await browser.newPage();
    await entraComeAltraRedazione(altra);
    const dellAltra = await leggiSito(request, percorsoAnteprima(pagina.id), await cookieDi(altra));
    expect(dellAltra.status).toBe(200);
    expect(dellAltra.html).toContain(titolo);
    expect(dellAltra.html).not.toContain(titoloCopia);
    await altra.close();

    // 7. L'indirizzo dell'anteprima non è nella mappa del sito né in `robots.txt`.
    const mappa = await leggiSito(request, '/sitemap.xml');
    expect(mappa.status).toBe(200);
    expect(mappa.html).toContain(percorso);
    expect(mappa.html).not.toContain('/anteprima/');
    expect(mappa.html).not.toContain(pagina.id);
    const robots = await leggiSito(request, '/robots.txt');
    expect(robots.html).not.toContain('anteprima');
    await redazione.close();
  });

  test('dopo la pubblicazione anteprima e pagina pubblica hanno lo stesso HTML, per una pagina e per una notizia', async ({
    browser,
    request,
  }) => {
    const stamp = Date.now();
    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const cookie = await cookieDi(redazione);

    for (const tipo of ['page', 'post'] as const) {
      const contenuto = await creaContenuto(
        redazione,
        tipo,
        `identica-${tipo}-${stamp}`,
        `Identità ${tipo} ${stamp}`,
        `Testo sintetico di ${tipo}, ${stamp}.`,
      );
      const percorso = await pubblica(redazione, contenuto.id);

      const pubblicata = await leggiSito(request, percorso);
      const anteprima = await leggiSito(request, `/anteprima/${contenuto.id}/`, cookie);
      expect(pubblicata.status, `${tipo}: pagina pubblica`).toBe(200);
      expect(anteprima.status, `${tipo}: anteprima`).toBe(200);
      expect(
        primaDifferenza(
          formaConfrontabile(pubblicata.status, pubblicata.html),
          formaConfrontabile(anteprima.status, anteprima.html),
        ),
        `${tipo}: HTML dell'anteprima e della pagina pubblica`,
      ).toBeNull();
      attendiIntestazioniDiAnteprima(anteprima.headers, tipo);
    }
    await redazione.close();
  });

  test('«Anteprima sul sito» salva la copia di lavoro in sospeso e apre in una scheda nuova l’anteprima con il titolo cambiato', async ({
    browser,
  }) => {
    const stamp = Date.now();
    const contesto = await browser.newContext();
    const redazione = await contesto.newPage();
    await entra(redazione, 'Redazione');
    const pagina = await creaContenuto(
      redazione,
      'page',
      `da-editor-${stamp}`,
      `Titolo di partenza ${stamp}`,
      `Testo sintetico ${stamp}.`,
    );

    await redazione.goto(`${ADMIN_URL}/admin/redazione/pagine/${pagina.id}`);
    const nuovoTitolo = `Titolo dall’editor ${stamp}`;
    await redazione.getByLabel('Titolo', { exact: true }).first().fill(nuovoTitolo);

    // La scheda si apre subito e, a salvataggio finito, va sull'anteprima del sito.
    const [scheda] = await Promise.all([
      contesto.waitForEvent('page'),
      redazione.getByRole('button', { name: 'Anteprima sul sito' }).click(),
    ]);
    await scheda.waitForURL(`${WEB_URL}/anteprima/${pagina.id}/`);
    await expect(scheda.getByRole('heading', { name: nuovoTitolo })).toBeVisible();
    await contesto.close();
  });
});
