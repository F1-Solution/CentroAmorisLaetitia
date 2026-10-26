import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { MARKERS, buildMp4, contains } from '../../../apps/api/tests/_support/syntheticFiles';
import { ADMIN_URL, API_URL, WEB_URL } from '../support/ambiente';
import { BLU, ROSSO, coloreProssimo, leggiPng, pngTintaUnita } from '../support/immagini';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * I media dalla redazione al sito (1G-W5, T7): un'immagine caricata ha le dimensioni derivate
 * e, messa in evidenza, l'archivio e la ricerca servono il ritaglio 1080×675 (caso §6.4);
 * sostituirla rigenera le derivate, fa sparire quelle che non servono più e il browser vede
 * subito il colore nuovo (D149-A); i file non ammessi sono rifiutati in italiano senza
 * scrivere nulla.
 *
 * Le immagini sono generate nella prova e i nomi sono unici nell'esecuzione.
 */

const MESSAGGIO_TIPO = 'non è di un tipo ammesso. Si possono caricare JPEG, PNG, WebP, PDF e MP4.';

interface Media {
  id: string;
  fileName: string;
  publicPath: string;
  width: number | null;
  height: number | null;
}

interface Variante {
  publicPath: string;
  width: number;
  height: number;
}

/** L'elenco dei media il cui nome contiene `testo`, letto dal servizio con la sessione del browser. */
async function cercaMedia(page: Page, testo: string): Promise<Media[]> {
  const risposta = await page.request.get(`${API_URL}/media?search=${encodeURIComponent(testo)}`, {
    headers: await intestazioniApi(page),
  });
  expect(risposta.ok(), `elenco dei media: ${risposta.status()}`).toBeTruthy();
  return ((await risposta.json()) as { items: Media[] }).items;
}

async function leggiMedia(page: Page, id: string): Promise<Media> {
  const risposta = await page.request.get(`${API_URL}/media/${id}`, {
    headers: await intestazioniApi(page),
  });
  expect(risposta.ok(), `lettura del media: ${risposta.status()}`).toBeTruthy();
  return (await risposta.json()) as Media;
}

/** Le dimensioni derivate che la lettura pubblica dichiara per il media in evidenza di una pagina. */
async function variantiPubbliche(
  request: APIRequestContext,
  percorso: string,
  mediaId: string,
): Promise<Variante[]> {
  const risposta = await request.get(
    `${API_URL}/public/content?path=${encodeURIComponent(percorso)}`,
  );
  expect(risposta.ok(), `lettura pubblica di ${percorso}: ${risposta.status()}`).toBeTruthy();
  const corpo = (await risposta.json()) as {
    media: Record<string, { variants: Variante[] }>;
  };
  const media = corpo.media[mediaId];
  expect(media, 'il media in evidenza è nella lettura pubblica').toBeDefined();
  return media?.variants ?? [];
}

/** Il file come lo serve il sito: stato, impronta, politica di cache e, se è un PNG, misure e colore. */
async function fileDelSito(request: APIRequestContext, percorso: string) {
  const risposta = await request.get(`${WEB_URL}${percorso}`);
  const corpo = risposta.status() === 200 ? await risposta.body() : null;
  return {
    status: risposta.status(),
    etag: risposta.headers()['etag'] ?? null,
    cache: risposta.headers()['cache-control'] ?? null,
    png: corpo ? leggiPng(corpo) : null,
  };
}

/** Il colore del centro dell'immagine in evidenza della prima notizia, letto dal browser sul sito. */
async function coloreMostrato(page: Page, archivio: string) {
  await page.goto(`${WEB_URL}${archivio}`);
  const immagine = page.locator('a.entry-featured-image-url img').first();
  await expect
    .poll(() => immagine.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);
  return immagine.evaluate((img: HTMLImageElement) => {
    const tela = document.createElement('canvas');
    tela.width = img.naturalWidth;
    tela.height = img.naturalHeight;
    const contesto = tela.getContext('2d');
    if (!contesto) throw new Error('canvas non disponibile');
    contesto.drawImage(img, 0, 0);
    const [r = -1, g = -1, b = -1] = contesto.getImageData(
      Math.floor(tela.width / 2),
      Math.floor(tela.height / 2),
      1,
      1,
    ).data;
    return { r, g, b, larghezza: img.naturalWidth, altezza: img.naturalHeight };
  });
}

test.describe('media', () => {
  test('un’immagine verticale in evidenza esce come ritaglio 1080×675 e, sostituita, il sito mostra subito quella nuova', async ({
    browser,
    request,
  }) => {
    test.setTimeout(150_000);
    const stamp = Date.now();
    const nomeFile = `verticale-${stamp}.png`;

    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');

    // 1. Il caricamento dall'area: l'avviso conta le dimensioni derivate generate.
    await redazione.goto(`${ADMIN_URL}/admin/redazione/media`);
    await redazione.getByLabel('Scegli i file da caricare').setInputFiles({
      name: nomeFile,
      mimeType: 'image/png',
      buffer: pngTintaUnita(1100, 1400, ROSSO),
    });
    await expect(redazione.getByText(/dimensioni derivate generate\./)).toBeVisible({
      timeout: 60_000,
    });
    const caricato = (await cercaMedia(redazione, nomeFile)).find(
      (voce) => voce.fileName === nomeFile,
    );
    expect(caricato, 'il media caricato è nell’archivio').toBeDefined();
    const media = await leggiMedia(redazione, caricato?.id ?? '');
    expect([media.width, media.height]).toEqual([1100, 1400]);

    // 2. Una notizia sintetica, in una categoria sua, con quell'immagine in evidenza.
    const categoria = { nome: `Media di prova ${stamp}`, slug: `media-${stamp}` };
    const cat = await redazione.request.post(`${API_URL}/terms`, {
      headers: await intestazioniApi(redazione),
      data: { taxonomy: 'category', name: categoria.nome, slug: categoria.slug },
    });
    expect(cat.ok(), await cat.text()).toBeTruthy();
    const termId = ((await cat.json()) as { id: string }).id;

    const titolo = `Notizia con immagine ${stamp}`;
    const creata = await redazione.request.post(`${API_URL}/contents`, {
      headers: await intestazioniApi(redazione),
      data: { type: 'post', slug: `con-immagine-${stamp}`, title: titolo },
    });
    expect(creata.ok(), await creata.text()).toBeTruthy();
    const notizia = (await creata.json()) as { id: string };
    const evidenza = await redazione.request.patch(`${API_URL}/contents/${notizia.id}`, {
      headers: await intestazioniApi(redazione),
      data: { featuredMediaId: media.id },
    });
    expect(evidenza.ok(), await evidenza.text()).toBeTruthy();
    const categorie = await redazione.request.put(`${API_URL}/contents/${notizia.id}/terms`, {
      headers: await intestazioniApi(redazione),
      data: { termIds: [termId] },
    });
    expect(categorie.ok(), await categorie.text()).toBeTruthy();
    const pubblicata = await redazione.request.post(`${API_URL}/contents/${notizia.id}/publish`, {
      headers: await intestazioniApi(redazione),
    });
    expect(pubblicata.ok(), await pubblicata.text()).toBeTruthy();
    const percorso = ((await pubblicata.json()) as { path: string }).path;

    // 3. Caso §6.4: archivio e ricerca servono il ritaglio 1080×675, non l'originale.
    const ritaglio = media.publicPath.replace(/\.png$/, '-1080x675.png');
    const archivio = `/category/${categoria.slug}/`;
    for (const indirizzo of [archivio, `/?s=${stamp}`]) {
      const html = await (await request.get(`${WEB_URL}${indirizzo}`)).text();
      expect(html, `${indirizzo} mostra la notizia`).toContain(titolo);
      expect(html, `${indirizzo} serve il ritaglio`).toContain(`src="${ritaglio}"`);
      expect(html, `${indirizzo} non serve l'originale come src`).not.toContain(
        `src="${media.publicPath}"`,
      );
      expect(html).toMatch(/width="1080"/);
      expect(html).toMatch(/height="675"/);
    }

    // Il browser, con la cache calda, vede il rosso del primo file.
    const visitatore = await browser.newPage();
    const prima = await coloreMostrato(visitatore, archivio);
    expect([prima.larghezza, prima.altezza]).toEqual([1080, 675]);
    expect(coloreProssimo(prima, ROSSO), `colore iniziale ${JSON.stringify(prima)}`).toBe(true);

    const varianti0 = await variantiPubbliche(request, percorso, media.id);
    expect(varianti0.length).toBeGreaterThan(3);
    const impronte0 = new Map<string, string | null>();
    for (const variante of varianti0) {
      const file = await fileDelSito(request, variante.publicPath);
      expect(file.status, variante.publicPath).toBe(200);
      expect([file.png?.width, file.png?.height]).toEqual([variante.width, variante.height]);
      impronte0.set(variante.publicPath, file.etag);
    }
    const originale0 = await fileDelSito(request, media.publicPath);

    // 4. Sostituzione con un'immagine orizzontale di altro colore, dall'area.
    await redazione.goto(`${ADMIN_URL}/admin/redazione/media`);
    await redazione.getByRole('button', { name: nomeFile }).click();
    await redazione.getByLabel('Scegli il file che sostituisce questo').setInputFiles({
      name: `orizzontale-${stamp}.png`,
      mimeType: 'image/png',
      buffer: pngTintaUnita(1600, 900, BLU),
    });
    await redazione.getByRole('button', { name: 'Sostituisci', exact: true }).click();
    await expect(redazione.getByText(/File sostituito\./)).toBeVisible({ timeout: 60_000 });

    const dopo = await leggiMedia(redazione, media.id);
    expect([dopo.width, dopo.height]).toEqual([1600, 900]);
    expect(dopo.publicPath).toBe(media.publicPath);

    // 5. Ogni derivata servita ha l'impronta nuova e il colore nuovo; quelle sparite rispondono 404.
    const varianti1 = await variantiPubbliche(request, percorso, media.id);
    const percorsi1 = new Set(varianti1.map((variante) => variante.publicPath));
    expect(percorsi1.has(ritaglio), 'il ritaglio 1080×675 esiste anche per l’immagine nuova').toBe(
      true,
    );
    for (const variante of varianti1) {
      const file = await fileDelSito(request, variante.publicPath);
      expect(file.status, variante.publicPath).toBe(200);
      expect([file.png?.width, file.png?.height], variante.publicPath).toEqual([
        variante.width,
        variante.height,
      ]);
      expect(file.png ? coloreProssimo(file.png.centro, BLU) : false, variante.publicPath).toBe(
        true,
      );
      expect(file.cache, variante.publicPath).toBe('no-cache');
      if (impronte0.has(variante.publicPath)) {
        expect(file.etag, `impronta nuova per ${variante.publicPath}`).not.toBe(
          impronte0.get(variante.publicPath),
        );
      }
    }
    const sparite = varianti0.filter((variante) => !percorsi1.has(variante.publicPath));
    expect(
      sparite.length,
      'almeno una derivata dell’immagine verticale non serve più',
    ).toBeGreaterThan(0);
    for (const variante of sparite) {
      expect((await fileDelSito(request, variante.publicPath)).status, variante.publicPath).toBe(
        404,
      );
    }

    const originale1 = await fileDelSito(request, media.publicPath);
    expect(originale1.status).toBe(200);
    expect(originale1.etag).not.toBe(originale0.etag);
    expect(originale1.png?.width).toBe(1600);
    expect(originale1.png ? coloreProssimo(originale1.png.centro, BLU) : false).toBe(true);

    // 6. Il browser che aveva già l'immagine rossa in cache mostra il blu, senza svuotare nulla (D149-A).
    const poi = await coloreMostrato(visitatore, archivio);
    expect([poi.larghezza, poi.altezza]).toEqual([1080, 675]);
    expect(coloreProssimo(poi, BLU), `colore dopo la sostituzione ${JSON.stringify(poi)}`).toBe(
      true,
    );

    // 7. La ricerca serve lo stesso ritaglio, ora dell'immagine nuova.
    const ricerca = await (await request.get(`${WEB_URL}/?s=${stamp}`)).text();
    expect(ricerca).toContain(`src="${ritaglio}"`);

    await visitatore.close();
    await redazione.close();
  });

  test('un SVG e un testo chiamato .jpg sono rifiutati in italiano, senza scrivere nulla; un nome ostile si ripulisce', async ({
    browser,
  }) => {
    const stamp = Date.now();
    const nomeSvg = `disegno-${stamp}.svg`;
    const nomeFinto = `finto-${stamp}.jpg`;

    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    await redazione.goto(`${ADMIN_URL}/admin/redazione/media`);

    // Dall'area: l'SVG si ferma prima dell'invio, il testo rinominato lo ferma il servizio sul contenuto.
    await redazione.getByLabel('Scegli i file da caricare').setInputFiles([
      {
        name: nomeSvg,
        mimeType: 'image/svg+xml',
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'),
      },
      {
        name: nomeFinto,
        mimeType: 'image/jpeg',
        buffer: Buffer.from('<html><body>non sono un’immagine</body></html>'),
      },
    ]);
    const avvisi = redazione.getByRole('alert');
    await expect(avvisi.filter({ hasText: `«${nomeSvg}» ${MESSAGGIO_TIPO}` })).toHaveCount(1);
    await expect(avvisi.filter({ hasText: `«${nomeFinto}» ${MESSAGGIO_TIPO}` })).toHaveCount(1);

    // Il servizio dà lo stesso rifiuto anche a chi lo interroga senza passare dall'area: 415 e codice stabile.
    const rifiuto = await redazione.request.post(`${API_URL}/media`, {
      headers: await intestazioniApi(redazione),
      multipart: {
        file: { name: nomeSvg, mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
      },
    });
    expect(rifiuto.status()).toBe(415);
    const errore = ((await rifiuto.json()) as { error: { code: string; message: string } }).error;
    expect(errore.code).toBe('MEDIA_TYPE_NOT_ALLOWED');
    expect(errore.message).toBe(`Il file «${nomeSvg}» ${MESSAGGIO_TIPO}`);

    // Nessun rifiuto ha scritto qualcosa nell'archivio.
    expect(await cercaMedia(redazione, String(stamp))).toEqual([]);

    // Un nome con percorso diventa il solo nome del file.
    const ostile = await redazione.request.post(`${API_URL}/media`, {
      headers: await intestazioniApi(redazione),
      multipart: {
        file: {
          name: `../../ostile-${stamp}.png`,
          mimeType: 'image/png',
          buffer: pngTintaUnita(8, 8, ROSSO),
        },
      },
    });
    expect(ostile.status(), await ostile.text()).toBe(201);
    const creato = (await ostile.json()) as { fileName: string; publicPath: string };
    expect(creato.fileName).toBe(`ostile-${stamp}.png`);
    expect(creato.publicPath).not.toContain('..');
    await redazione.close();
  });

  test('un MP4 con posizione, artista e capitoli si scarica dal sito senza quei metadati', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const nomeFile = `video-${stamp}.mp4`;
    const originale = await buildMp4({ withMetadata: true });
    expect(contains(originale, MARKERS.location), 'il file caricato porta la posizione').toBe(true);

    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const caricato = await redazione.request.post(`${API_URL}/media`, {
      headers: await intestazioniApi(redazione),
      multipart: { file: { name: nomeFile, mimeType: 'video/mp4', buffer: originale } },
    });
    expect(caricato.status(), await caricato.text()).toBe(201);
    const { publicPath } = (await caricato.json()) as { publicPath: string };

    const servito = await request.get(`${WEB_URL}${publicPath}`);
    expect(servito.status()).toBe(200);
    const corpo = await servito.body();
    expect(corpo.subarray(4, 8).toString('latin1'), 'è ancora un MP4').toBe('ftyp');
    for (const marcatore of [
      MARKERS.location,
      MARKERS.artist,
      MARKERS.chapter,
      MARKERS.subtitle,
      MARKERS.uuidXmp,
    ]) {
      expect(contains(originale, marcatore), `il file caricato porta ${marcatore}`).toBe(true);
      expect(contains(corpo, marcatore), `il file servito non porta ${marcatore}`).toBe(false);
    }
    await redazione.close();
  });
});
