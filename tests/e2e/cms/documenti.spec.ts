import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import { MARKERS, buildPdf, contains } from '../../../apps/api/tests/_support/syntheticFiles';
import { ADMIN_URL, API_URL, DATABASE_E2E, WEB_URL, urlPerDatabase } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * I documenti dalla redazione al sito (1G-W6, T7): titolo, descrizione e file di un documento
 * pubblico si cambiano dall'area e il sito li mostra subito; il file nuovo esce senza i metadati
 * del programma che l'ha scritto; il documento riservato non esiste né per l'area né per il sito.
 *
 * Il seme dell'e2e porta un documento pubblico e uno riservato, entrambi inventati.
 */

const SLUG_PUBBLICO = 'documento-di-prova-pubblico';
const SLUG_RISERVATO = 'documento-di-prova-riservato';
const FILE_PUBBLICO = '/media/prova-sintetica/documento-di-prova-pubblico.pdf';
const FILE_RISERVATO = '/media/prova-sintetica/documento-di-prova-riservato.pdf';
const CATEGORIA = '/download-category/moduli-di-prova/';

const MESI = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

/** Oggi come lo scrive la scheda del documento: giorno, mese esteso in italiano, anno, ora di Roma. */
function oggiComeIlSito(): string {
  const parti = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date());
  const valore = (tipo: string) => parti.find((parte) => parte.type === tipo)?.value ?? '';
  return `${Number(valore('day'))} ${MESI[Number(valore('month')) - 1] ?? ''} ${valore('year')}`;
}

/** L'identificativo del media di un file del seme, letto dal database usa e getta dell'e2e. */
async function idDelMedia(nomeFile: string): Promise<string> {
  const sql = postgres(urlPerDatabase(DATABASE_E2E), { max: 1 });
  try {
    const righe = await sql<{ id: string }[]>`select id from media where file_name = ${nomeFile}`;
    const id = righe[0]?.id;
    expect(id, `media ${nomeFile} nel seme`).toBeDefined();
    return id ?? '';
  } finally {
    await sql.end();
  }
}

async function scarica(page: Page, percorso: string) {
  const risposta = await page.request.get(`${WEB_URL}${percorso}`);
  return {
    status: risposta.status(),
    etag: risposta.headers()['etag'] ?? null,
    corpo: risposta.status() === 200 ? await risposta.body() : Buffer.alloc(0),
  };
}

test.describe('documenti', () => {
  test('la redazione cambia titolo e descrizione e sostituisce il PDF: il sito mostra subito i valori nuovi', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const titolo = `Modulo rivisto ${stamp}`;
    const descrizione = `Descrizione rivista ${stamp}`;

    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');

    // L'elenco mostra il documento pubblico e non il riservato.
    await redazione.goto(`${ADMIN_URL}/admin/redazione/documenti`);
    await expect(
      redazione.getByRole('link', { name: 'Documento di prova pubblico', exact: true }),
    ).toBeVisible();
    await expect(
      redazione.getByRole('link', { name: 'Documento di prova riservato', exact: true }),
    ).toHaveCount(0);

    const prima = await scarica(redazione, FILE_PUBBLICO);
    expect(prima.status, 'il PDF del seme è servito dal sito').toBe(200);
    const paginaPrima = await (await request.get(`${WEB_URL}/download/${SLUG_PUBBLICO}/`)).text();
    expect(paginaPrima).toContain('Ultimo aggiornamento');
    expect(paginaPrima).not.toContain(oggiComeIlSito());

    // Titolo e descrizione.
    await redazione.getByRole('link', { name: 'Documento di prova pubblico', exact: true }).click();
    await redazione.waitForURL(/\/admin\/redazione\/documenti\/[0-9a-f-]{36}/);
    await redazione.getByRole('textbox', { name: 'Titolo' }).fill(titolo);
    await redazione.getByLabel('Descrizione').fill(descrizione);
    await redazione.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(redazione.getByText('Modifiche salvate.')).toBeVisible();

    // Scheda, categoria dei download e ricerca mostrano i valori nuovi.
    const scheda = await (await request.get(`${WEB_URL}/download/${SLUG_PUBBLICO}/`)).text();
    expect(scheda).toContain(titolo);
    expect(scheda).toContain(descrizione);
    const categoria = await request.get(`${WEB_URL}${CATEGORIA}`);
    expect(categoria.status()).toBe(200);
    expect(await categoria.text()).toContain(titolo);
    const ricerca = await (await request.get(`${WEB_URL}/?s=${stamp}`)).text();
    expect(ricerca).toContain(titolo);

    // Sostituzione del file con un PDF che porta autore, programma e XMP sintetici.
    const nuovo = buildPdf({ pages: 1, withMetadata: true, visibleText: `nuovo ${stamp}` });
    expect(contains(nuovo, MARKERS.author), 'il file caricato porta l’autore sintetico').toBe(true);
    await redazione.getByLabel('Scegli il file che sostituisce questo').setInputFiles({
      name: `modulo-nuovo-${stamp}.pdf`,
      mimeType: 'application/pdf',
      buffer: nuovo,
    });
    await redazione.getByRole('button', { name: 'Sostituisci', exact: true }).click();
    await expect(redazione.getByText(/File sostituito\./)).toBeVisible({ timeout: 60_000 });

    // «Download» serve il file nuovo, ripulito dai metadati.
    const collegamento = await (await request.get(`${WEB_URL}/download/${SLUG_PUBBLICO}/`)).text();
    expect(collegamento).toContain(`href="${FILE_PUBBLICO}"`);
    const dopo = await scarica(redazione, FILE_PUBBLICO);
    expect(dopo.status).toBe(200);
    expect(dopo.etag, 'impronta nuova').not.toBe(prima.etag);
    expect(createHash('sha256').update(dopo.corpo).digest('hex')).not.toBe(
      createHash('sha256').update(prima.corpo).digest('hex'),
    );
    expect(dopo.corpo.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    for (const marcatore of [MARKERS.author, MARKERS.oldAuthor, MARKERS.producer, MARKERS.xmp]) {
      expect(contains(nuovo, marcatore), `il file caricato porta ${marcatore}`).toBe(true);
      expect(contains(dopo.corpo, marcatore), `il file servito non porta ${marcatore}`).toBe(false);
    }

    // «Ultimo aggiornamento» ha la data di oggi.
    const aggiornamento =
      /Ultimo aggiornamento(?:<!-- -->)? <span class="badge">([^<]*)<\/span>/.exec(collegamento);
    expect(aggiornamento?.[1]).toBe(oggiComeIlSito());
    await redazione.close();
  });

  test('il documento riservato non è nell’elenco e nessun suo indirizzo risponde', async ({
    browser,
    request,
  }) => {
    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const intestazioni = await intestazioniApi(redazione);

    const elenco = await redazione.request.get(`${API_URL}/documents`, { headers: intestazioni });
    expect(elenco.ok()).toBeTruthy();
    const slug = ((await elenco.json()) as { slug: string }[]).map((voce) => voce.slug);
    expect(slug).not.toContain(SLUG_RISERVATO);

    const mediaId = await idDelMedia('documento-di-prova-riservato.pdf');
    const lettura = await redazione.request.get(`${API_URL}/media/${mediaId}`, {
      headers: intestazioni,
    });
    expect(lettura.status()).toBe(404);
    const libreria = await redazione.request.get(
      `${API_URL}/media?search=documento-di-prova-riservato`,
      { headers: intestazioni },
    );
    expect(((await libreria.json()) as { items: unknown[] }).items).toEqual([]);

    expect((await request.get(`${WEB_URL}/download/${SLUG_RISERVATO}/`)).status()).toBe(404);
    expect((await request.get(`${WEB_URL}${FILE_RISERVATO}`)).status()).toBe(404);
    expect(await (await request.get(`${WEB_URL}/?s=riservato`)).text()).not.toContain(
      'Documento di prova riservato',
    );
    await redazione.close();
  });
});
