import { expect, test } from '@playwright/test';
import { API_URL } from './support/ambiente';

/**
 * DR-273 con DR-284: il `<title>` di una pagina e quello della 404 stanno
 * nell'`<head>` della risposta HTML e contengono «Titolo del sito». Con i
 * metadati in streaming il titolo finirebbe in un blocco nel `<body>`.
 */

/** La ricerca risponde sempre, qualunque sia lo stato dei contenuti seminati; poi un percorso che non esiste. */
const PAGINA = '/?s=prova';
const INESISTENTE = '/percorso-che-non-esiste/';

/** Il `<title>` della risposta, con la sua posizione rispetto a `<head>` e `</head>`. */
function titoloDi(html: string) {
  const apertura = html.indexOf('<head');
  const chiusura = html.indexOf('</head>');
  const titolo = html.indexOf('<title');
  const testo = /<title[^>]*>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
  return { apertura, chiusura, titolo, testo };
}

test.describe('titolo nell’head (DR-273, DR-284)', () => {
  test('una pagina e la 404 hanno il title nell’head con il titolo del sito', async ({
    request,
  }) => {
    const impostazioni = await request.get(`${API_URL}/public/settings`);
    expect(impostazioni.ok()).toBe(true);
    const sito = ((await impostazioni.json()) as Record<string, unknown>)['site.title'];
    expect(typeof sito).toBe('string');
    expect(sito).not.toBe('');

    const normale = await request.get(PAGINA);
    expect(normale.status()).toBe(200);
    const pagina = titoloDi(await normale.text());
    expect(pagina.apertura).toBeGreaterThanOrEqual(0);
    expect(pagina.titolo).toBeGreaterThan(pagina.apertura);
    expect(pagina.titolo).toBeLessThan(pagina.chiusura);
    expect(pagina.testo).toContain(sito as string);

    const assente = await request.get(INESISTENTE);
    expect(assente.status()).toBe(404);
    const quattroCentoQuattro = titoloDi(await assente.text());
    expect(quattroCentoQuattro.titolo).toBeGreaterThan(quattroCentoQuattro.apertura);
    expect(quattroCentoQuattro.titolo).toBeLessThan(quattroCentoQuattro.chiusura);
    expect(quattroCentoQuattro.testo).toBe(`404 Non trovato | ${sito as string}`);
  });
});
