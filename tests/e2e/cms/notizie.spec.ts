import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ADMIN_URL, API_URL, WEB_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Le notizie dalla redazione al sito (1G-W4, T6): estratto, immagine in evidenza
 * e categorie cambiano dall'editor e il sito li mostra (D139 = B: l'estratto al
 * posto dell'inizio del testo in archivio e ricerca); la schermata «Categorie»
 * crea e rinomina senza cambiare l'indirizzo dell'archivio; «Elimina» rifiuta
 * ciò che dipende dal contenuto e, quando è libero, lo elimina e il sito risponde
 * 404; il registro dell'amministrazione ritrova le operazioni.
 *
 * Titoli, slug, estratti e categorie sono inventati e unici nell'esecuzione: la
 * prova non dipende dal seme, e si può rieseguire senza ricrearlo.
 */

const PERSONA_REDAZIONE = 'Redazione di prova';
const URL_NOTIZIA = /\/admin\/redazione\/notizie\/[0-9a-f-]{36}/;
const IMMAGINE_PUBBLICA = '/media/2026/01/immagine-di-prova.png';

interface Notizia {
  status: string;
  path: string;
  excerpt: string | null;
  featuredMedia: { id: string } | null;
  termIds: string[];
}

function idDallUrl(url: string): string {
  return url.split('/').pop() ?? '';
}

/** Legge una notizia dal servizio con i cookie della sessione del browser. */
async function leggi(page: Page, id: string): Promise<Notizia> {
  const risposta = await page.request.get(`${API_URL}/contents/${id}`, {
    headers: await intestazioniApi(page),
  });
  expect(risposta.ok(), `lettura del contenuto ${id}: ${risposta.status()}`).toBeTruthy();
  return (await risposta.json()) as Notizia;
}

/** Crea una notizia in bozza dall'elenco e resta nel suo editor. */
async function nuovaNotizia(page: Page, titolo: string, slug: string): Promise<string> {
  await page.goto(`${ADMIN_URL}/admin/redazione/notizie`);
  await page.getByRole('button', { name: 'Nuova notizia' }).click();
  const finestra = page.getByRole('dialog');
  await finestra.getByLabel('Titolo').fill(titolo);
  await finestra.getByLabel('Indirizzo', { exact: true }).fill(slug);
  await finestra.getByRole('button', { name: 'Crea in bozza' }).click();
  await page.waitForURL(URL_NOTIZIA);
  return idDallUrl(page.url());
}

/** Sceglie le categorie dalla scheda «Elenchi e archivi» e le salva. */
async function cambiaCategorie(page: Page, togli: string[], aggiungi: string[]): Promise<void> {
  await page.getByRole('tab', { name: 'Elenchi e archivi' }).click();
  for (const nome of togli) await page.getByLabel(nome, { exact: true }).uncheck();
  for (const nome of aggiungi) await page.getByLabel(nome, { exact: true }).check();
  await page.getByRole('button', { name: 'Salva le categorie' }).click();
  await expect(page.getByText('Categorie salvate.')).toBeVisible();
}

/** Il sito risponde a quell'indirizzo direttamente, senza redirect, e restituisce l'HTML. */
async function paginaSito(request: APIRequestContext, percorso: string): Promise<string> {
  const risposta = await request.get(`${WEB_URL}${percorso}`, { maxRedirects: 0 });
  expect(risposta.status(), `${percorso} deve rispondere 200`).toBe(200);
  return risposta.text();
}

/** Il `<title>` della pagina, che per un archivio porta il nome della categoria. */
function titoloPagina(html: string): string {
  return /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
}

/**
 * Un corpo di testo per la notizia: l'inizio che l'estratto deve sostituire in archivio.
 * Le proprietà sono tutte quelle dello schema, perché l'editor rifiuta un blocco incompleto.
 */
function corpoDiProva(stamp: number, inizio: string) {
  const spaziatura = { base: null, tablet: null, phone: null };
  return {
    schema: 1,
    blocks: [
      {
        type: 'rich_text',
        id: 'b_5e6d0000aa01',
        props: {
          html: `<p>${inizio} ${stamp}.</p>`,
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

test.describe('notizie', () => {
  test('estratto, immagine e categoria si cambiano dall’editor e il sito li mostra dove dice D139', async ({
    browser,
    request,
  }) => {
    const stamp = Date.now();
    const titolo = `Girasoli di prova ${stamp}`;
    const inizio = 'Testo di apertura sintetico, che il riassunto sostituisce';
    const righe = [`Estratto sintetico ${stamp}, prima riga.`, `Seconda riga del riassunto.`];
    const vecchia = { nome: `Vecchia categoria ${stamp}`, slug: `vecchia-${stamp}` };
    const nuova = { nome: `Nuova categoria ${stamp}`, slug: `nuova-${stamp}` };

    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');

    // Due categorie di prova, create con l'API: la schermata si prova a parte.
    for (const categoria of [vecchia, nuova]) {
      const risposta = await redazione.request.post(`${API_URL}/terms`, {
        headers: await intestazioniApi(redazione),
        data: { taxonomy: 'category', name: categoria.nome, slug: categoria.slug },
      });
      expect(risposta.ok(), await risposta.text()).toBeTruthy();
    }

    const id = await nuovaNotizia(redazione, titolo, `girasoli-${stamp}`);

    // Il testo della notizia si scrive con l'API: l'editor dei blocchi non è il tema di questa prova.
    const scrittura = await redazione.request.patch(`${API_URL}/contents/${id}`, {
      headers: await intestazioniApi(redazione),
      data: { blocks: corpoDiProva(stamp, inizio) },
    });
    expect(scrittura.ok(), await scrittura.text()).toBeTruthy();
    await redazione.reload();

    // 1. La categoria vecchia si assegna prima della pubblicazione (D141-A).
    await cambiaCategorie(redazione, [], [vecchia.nome]);

    // 2. L'estratto nella scheda «Contenuto», poi «Salva».
    await redazione.getByRole('tab', { name: 'Contenuto', exact: true }).click();
    await redazione.getByLabel('Estratto', { exact: true }).fill(righe.join('\n'));
    await redazione.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect.poll(async () => (await leggi(redazione, id)).excerpt).toBe(righe.join('\n'));

    // 3. L'immagine in evidenza, scelta fra quelle pubbliche.
    await redazione.getByRole('tab', { name: 'Elenchi e archivi' }).click();
    await redazione.getByRole('button', { name: 'Scegli un’immagine' }).click();
    const scelta = redazione.getByRole('dialog', { name: 'Scegli un media' });
    await scelta.getByRole('option', { name: 'Immagine di prova', exact: true }).click();
    await scelta.getByRole('button', { name: 'Usa questo media' }).click();
    await expect(redazione.getByRole('img', { name: 'Immagine di prova' })).toBeVisible();
    await expect.poll(async () => (await leggi(redazione, id)).featuredMedia).not.toBeNull();

    // 4. Pubblicazione.
    await redazione.getByRole('button', { name: 'Pubblica' }).click();
    await expect.poll(async () => (await leggi(redazione, id)).status).toBe('published');
    const { path } = await leggi(redazione, id);
    expect(path).toMatch(/^\/.+\/$/);

    // Sul sito, nell'archivio vecchio: estratto intero, immagine, niente inizio del testo.
    const archivioVecchio = `/category/${vecchia.slug}/`;
    const prima = await paginaSito(request, archivioVecchio);
    expect(prima).toContain(titolo);
    for (const riga of righe) expect(prima).toContain(riga);
    expect(prima).not.toContain(inizio);
    expect(prima).toContain(IMMAGINE_PUBBLICA);

    // La ricerca mostra lo stesso estratto. Il numero del titolo è unico nell'esecuzione.
    const ricerca = await paginaSito(request, `/?s=${stamp}`);
    expect(ricerca).toContain(titolo);
    for (const riga of righe) expect(ricerca).toContain(riga);
    expect(ricerca).not.toContain(inizio);

    // 5. Cambio di categoria: la notizia passa dalla vecchia alla nuova.
    await cambiaCategorie(redazione, [vecchia.nome], [nuova.nome]);

    const archivioNuovo = await paginaSito(request, `/category/${nuova.slug}/`);
    expect(archivioNuovo).toContain(titolo);
    for (const riga of righe) expect(archivioNuovo).toContain(riga);
    expect(archivioNuovo).toContain(IMMAGINE_PUBBLICA);

    // Il vecchio archivio non mostra più l'estratto della notizia.
    const archivioVecchioDopo = await paginaSito(request, archivioVecchio);
    expect(archivioVecchioDopo).not.toContain(righe[0] ?? '');
    await redazione.close();

    // 6. L'amministrazione ritrova i due cambi di categoria nel registro.
    const amministrazione = await browser.newPage();
    await entra(amministrazione, 'Impostazioni');
    await amministrazione.goto(`${ADMIN_URL}/admin/impostazioni/registro`);
    await expect(
      amministrazione.getByRole('heading', { name: 'Registro delle operazioni', level: 1 }),
    ).toBeVisible();
    await amministrazione
      .getByLabel('Operazione', { exact: true })
      .selectOption({ label: 'Ha cambiato le categorie' });
    await amministrazione.getByRole('button', { name: 'Applica i filtri' }).click();

    const cambi = amministrazione
      .getByRole('row')
      .filter({
        has: amministrazione.getByRole('cell', { name: 'Ha cambiato le categorie', exact: true }),
      })
      .filter({ hasText: titolo });
    await expect(cambi).toHaveCount(2);
    for (const riga of await cambi.all()) {
      await expect(riga.getByRole('cell', { name: PERSONA_REDAZIONE })).toBeVisible();
      await expect(riga.getByText('Riuscita')).toBeVisible();
    }
    await amministrazione.close();
  });

  test('una categoria si crea, si assegna a una notizia e si rinomina: l’archivio mostra il nome nuovo allo stesso indirizzo', async ({
    browser,
    request,
  }) => {
    const stamp = Date.now();
    const nome = `Cronaca di prova ${stamp}`;
    const nomeNuovo = `Cronaca rinnovata ${stamp}`;
    const titolo = `Notizia di cronaca ${stamp}`;

    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');

    // 1. Creazione dalla schermata «Categorie»: l'indirizzo si propone dal nome.
    await redazione.goto(`${ADMIN_URL}/admin/redazione/categorie`);
    await expect(redazione.getByRole('heading', { name: 'Categorie', level: 1 })).toBeVisible();
    await redazione.getByRole('button', { name: 'Nuova categoria' }).click();
    const creazione = redazione.getByRole('dialog', { name: 'Nuova categoria' });
    await creazione.getByLabel('Nome', { exact: true }).fill(nome);
    const slug = await creazione.getByLabel('Indirizzo', { exact: true }).inputValue();
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    await creazione.getByRole('button', { name: 'Crea categoria' }).click();
    await expect(creazione).toHaveCount(0);
    await expect(redazione.getByRole('cell', { name: nome, exact: true })).toBeVisible();

    // 2. Una notizia pubblicata nella categoria, perché l'archivio abbia qualcosa da mostrare.
    const id = await nuovaNotizia(redazione, titolo, `notizia-cronaca-${stamp}`);
    await cambiaCategorie(redazione, [], [nome]);
    await redazione.getByRole('button', { name: 'Pubblica' }).click();
    await expect.poll(async () => (await leggi(redazione, id)).status).toBe('published');

    const archivio = `/category/${slug}/`;
    expect(titoloPagina(await paginaSito(request, archivio))).toContain(nome);

    // 3. Rinomina: il nome nuovo compare, l'indirizzo resta lo stesso.
    await redazione.goto(`${ADMIN_URL}/admin/redazione/categorie`);
    const riga = redazione
      .getByRole('row')
      .filter({ has: redazione.getByRole('cell', { name: nome, exact: true }) });
    await riga.getByRole('button', { name: 'Modifica' }).click();
    const rinomina = redazione.getByRole('dialog', { name: 'Modifica categoria' });
    await expect(rinomina.getByLabel('Titolo SEO')).toBeEnabled();
    await rinomina.getByLabel('Nome', { exact: true }).fill(nomeNuovo);
    await rinomina.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(rinomina).toHaveCount(0);
    await expect(redazione.getByRole('cell', { name: nomeNuovo, exact: true })).toBeVisible();

    const dopo = await paginaSito(request, archivio);
    expect(titoloPagina(dopo)).toContain(nomeNuovo);
    expect(titoloPagina(dopo)).not.toContain(nome);
    expect(dopo).toContain(titolo);
    await redazione.close();
  });

  test('«Elimina» rifiuta una pagina in un menu con le voci elencate, ed elimina una notizia libera con conferma', async ({
    browser,
    request,
  }) => {
    const stamp = Date.now();
    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');

    // 1. La pagina del seme sta nel menu principale: il rifiuto elenca la voce e non chiede conferme.
    await redazione.goto(`${ADMIN_URL}/admin/redazione/pagine`);
    await redazione.getByRole('link', { name: 'Pagina di prova' }).click();
    await redazione.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
    const idPagina = idDallUrl(redazione.url());
    const prima = await leggi(redazione, idPagina);

    await redazione.getByRole('button', { name: 'Elimina', exact: true }).click();
    const rifiuto = redazione.getByRole('dialog', { name: 'Non si può eliminare' });
    await expect(rifiuto).toBeVisible();
    await expect(
      rifiuto.getByRole('listitem').filter({ hasText: 'Pagina di prova, nel menu' }),
    ).toHaveCount(1);
    await expect(rifiuto.getByRole('button', { name: 'Elimina definitivamente' })).toHaveCount(0);
    await redazione.keyboard.press('Escape');
    await expect(rifiuto).toHaveCount(0);
    expect(await leggi(redazione, idPagina)).toEqual(prima);

    // 2. Una notizia pubblicata senza altre dipendenze: conferma scrivendo il titolo.
    const titolo = `Notizia da eliminare ${stamp}`;
    const id = await nuovaNotizia(redazione, titolo, `da-eliminare-${stamp}`);
    await cambiaCategorie(redazione, [], ['Avvisi']);
    await redazione.getByRole('button', { name: 'Pubblica' }).click();
    await expect.poll(async () => (await leggi(redazione, id)).status).toBe('published');
    const { path } = await leggi(redazione, id);
    const risposta = await request.get(`${WEB_URL}${path}`, { maxRedirects: 0 });
    expect(risposta.status(), `${path} deve rispondere 200 prima dell'eliminazione`).toBe(200);

    await redazione.getByRole('button', { name: 'Elimina', exact: true }).click();
    const conferma = redazione.getByRole('dialog', { name: 'Elimina il contenuto' });
    await conferma.getByRole('textbox', { name: `Digita «${titolo}» per confermare` }).fill(titolo);
    await conferma.getByRole('button', { name: 'Elimina definitivamente' }).click();

    // Si torna all'elenco con un avviso generico, l'indirizzo perde l'indicatore e il sito non risponde più.
    await expect(
      redazione.getByText('Il contenuto è stato eliminato definitivamente.'),
    ).toBeVisible();
    await expect(redazione).toHaveURL(/\/admin\/redazione\/notizie$/);
    expect(redazione.url()).not.toContain(encodeURIComponent(titolo));
    const dopo = await request.get(`${WEB_URL}${path}`, { maxRedirects: 0 });
    expect(dopo.status()).toBe(404);
    await redazione.close();

    // 3. L'amministrazione ritrova l'eliminazione nel registro, con il titolo.
    const amministrazione = await browser.newPage();
    await entra(amministrazione, 'Impostazioni');
    await amministrazione.goto(`${ADMIN_URL}/admin/impostazioni/registro`);
    await expect(
      amministrazione.getByRole('heading', { name: 'Registro delle operazioni', level: 1 }),
    ).toBeVisible();
    await amministrazione
      .getByLabel('Operazione', { exact: true })
      .selectOption({ label: 'Ha eliminato' });
    await amministrazione.getByRole('button', { name: 'Applica i filtri' }).click();

    const eliminazione = amministrazione
      .getByRole('row')
      .filter({ has: amministrazione.getByRole('cell', { name: 'Ha eliminato', exact: true }) })
      .filter({ hasText: titolo });
    await expect(eliminazione).toHaveCount(1);
    await expect(eliminazione.getByRole('cell', { name: PERSONA_REDAZIONE })).toBeVisible();
    await expect(eliminazione.getByText('Riuscita')).toBeVisible();
    await amministrazione.close();
  });
});
