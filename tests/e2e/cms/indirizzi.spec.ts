import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ADMIN_URL, API_URL, WEB_URL } from '../support/ambiente';
import { entra, intestazioniApi } from '../support/sessione';

/**
 * Cambio d'indirizzo dall'editor (1G-W3, compito 1G-11): la redazione cambia lo
 * slug di una pagina pubblicata che ha una figlia pubblicata, e il **sito vero**
 * porta i vecchi indirizzi ai nuovi in un passo; riportato lo slug al valore
 * originale, i primi indirizzi tornano a rispondere e i secondi portano ai primi,
 * senza cicli; l'amministrazione ritrova il cambio nel registro.
 *
 * «In un passo» si prova senza seguire i redirect: il vecchio indirizzo risponde
 * 301 e la sua destinazione risponde già 200, non un altro 3xx. Titoli e slug
 * sono inventati e unici nell'esecuzione.
 */

const PERSONA_REDAZIONE = 'Redazione di prova';

interface Regola {
  sourcePath: string;
  targetPath: string;
  origin: string;
  isActive: boolean;
}

/** Crea una pagina in bozza con lo slug scelto e ne restituisce l'identificativo. */
async function nuovaPagina(page: Page, titolo: string, slug: string): Promise<string> {
  await page.goto(`${ADMIN_URL}/admin/redazione/pagine`);
  await page.getByRole('button', { name: 'Nuova pagina' }).click();
  const finestra = page.getByRole('dialog');
  await finestra.getByLabel('Titolo').fill(titolo);
  await finestra.getByLabel('Indirizzo', { exact: true }).fill(slug);
  await finestra.getByRole('button', { name: 'Crea in bozza' }).click();
  await page.waitForURL(/\/admin\/redazione\/pagine\/[0-9a-f-]{36}/);
  return page.url().split('/').pop() ?? '';
}

/** Lo stato e il percorso del contenuto, letti dal servizio con la sessione del browser. */
async function statoDi(page: Page, id: string): Promise<[string, string]> {
  const risposta = await page.request.get(`${API_URL}/contents/${id}`, {
    headers: await intestazioniApi(page),
  });
  expect(risposta.ok(), `lettura del contenuto ${id}: ${risposta.status()}`).toBeTruthy();
  const contenuto = (await risposta.json()) as { status: string; path: string };
  return [contenuto.status, contenuto.path];
}

/** Le regole il cui indirizzo di partenza o di arrivo contiene `parte`, in ordine stabile. */
async function regoleCon(page: Page, parte: string): Promise<Regola[]> {
  const risposta = await page.request.get(
    `${API_URL}/redirects?search=${encodeURIComponent(parte)}`,
    { headers: await intestazioniApi(page) },
  );
  expect(risposta.ok(), `elenco dei redirect: ${risposta.status()}`).toBeTruthy();
  const corpo = (await risposta.json()) as { items: Regola[] };
  return corpo.items
    .map(({ sourcePath, targetPath, origin, isActive }) => ({
      sourcePath,
      targetPath,
      origin,
      isActive,
    }))
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}

/** Il percorso indicato da un'intestazione `location`, assoluta o relativa. */
function percorsoDi(location: string): string {
  const indirizzo = new URL(location, WEB_URL);
  return `${indirizzo.pathname}${indirizzo.search}`;
}

/** Il sito serve il contenuto a quell'indirizzo, senza alcun redirect. */
async function rispondeDirettamente(
  request: APIRequestContext,
  percorso: string,
  titolo: string,
): Promise<void> {
  const risposta = await request.get(`${WEB_URL}${percorso}`, { maxRedirects: 0 });
  expect(risposta.status(), `${percorso} deve rispondere 200, non un redirect`).toBe(200);
  expect(await risposta.text(), `${percorso} deve servire «${titolo}»`).toContain(titolo);
}

/** Il vecchio indirizzo risponde 301 verso il nuovo, che risponde già 200. */
async function portaInUnPasso(
  request: APIRequestContext,
  da: string,
  a: string,
  titolo: string,
): Promise<void> {
  const risposta = await request.get(`${WEB_URL}${da}`, { maxRedirects: 0 });
  expect(risposta.status(), `${da} deve rispondere 301`).toBe(301);
  expect(percorsoDi(risposta.headers()['location'] ?? ''), `${da} deve portare a ${a}`).toBe(a);
  await rispondeDirettamente(request, a, titolo);
}

/** Cambia lo slug dalla scheda «Indirizzo» e conferma nella finestra. */
async function cambiaSlug(page: Page, slug: string, redirect: string[]): Promise<void> {
  await page.getByRole('textbox', { name: 'Slug', exact: true }).fill(slug);
  await page.getByRole('button', { name: "Salva l'indirizzo" }).click();

  // La madre e la figlia sono pubblicate: prima di scrivere, la conferma (S6).
  const conferma = page.getByRole('dialog', { name: "Cambia l'indirizzo pubblico" });
  await expect(conferma).toBeVisible();
  const nascono = conferma.getByRole('list', { name: 'Redirect che nascono' });
  for (const voce of redirect) await expect(nascono.getByText(voce, { exact: true })).toBeVisible();
  await conferma.getByRole('button', { name: "Cambia l'indirizzo" }).click();
  await expect(conferma).toHaveCount(0);
}

test.describe('indirizzi dei contenuti', () => {
  test('cambiare lo slug della madre porta i vecchi indirizzi ai nuovi in un passo, e il ritorno non lascia cicli', async ({
    browser,
    request,
  }) => {
    const stamp = Date.now();
    const titoloMadre = `Madre degli indirizzi ${stamp}`;
    const titoloFiglia = `Figlia degli indirizzi ${stamp}`;
    const primo = `/madre-${stamp}/`;
    const primoFiglia = `${primo}figlia-${stamp}/`;
    const secondo = `/madre-spostata-${stamp}/`;
    const secondoFiglia = `${secondo}figlia-${stamp}/`;

    // 1. La redazione crea e pubblica la madre.
    const redazione = await browser.newPage();
    await entra(redazione, 'Redazione');
    const madre = await nuovaPagina(redazione, titoloMadre, `madre-${stamp}`);
    await redazione.getByRole('button', { name: 'Pubblica' }).click();
    await expect.poll(async () => await statoDi(redazione, madre)).toEqual(['published', primo]);

    // 2. Crea la figlia, che nasce al primo livello (W3-PLAN §8), e le sceglie la
    //    madre come genitore. In bozza non cambia nessun indirizzo pubblico: si
    //    salva senza conferma.
    const figlia = await nuovaPagina(redazione, titoloFiglia, `figlia-${stamp}`);
    await redazione.getByRole('tab', { name: 'Indirizzo' }).click();
    await redazione
      .getByLabel('Pagina genitore', { exact: true })
      .selectOption({ label: `${titoloMadre} — ${primo}` });
    await redazione.getByRole('button', { name: "Salva l'indirizzo" }).click();
    await expect(
      redazione.getByText(
        `L'indirizzo ora è ${primoFiglia}; sarà pubblico quando il contenuto verrà pubblicato.`,
      ),
    ).toBeVisible();
    await expect(redazione.getByRole('dialog')).toHaveCount(0);
    await redazione.getByRole('button', { name: 'Pubblica' }).click();
    await expect
      .poll(async () => await statoDi(redazione, figlia))
      .toEqual(['published', primoFiglia]);

    // Prima del cambio il sito serve le due pagine ai primi indirizzi.
    await rispondeDirettamente(request, primo, titoloMadre);
    await rispondeDirettamente(request, primoFiglia, titoloFiglia);

    // 3. Cambia lo slug della madre dalla scheda «Indirizzo»: la figlia la segue.
    await redazione.goto(`${ADMIN_URL}/admin/redazione/pagine/${madre}`);
    await redazione.getByRole('tab', { name: 'Indirizzo' }).click();
    await cambiaSlug(redazione, `madre-spostata-${stamp}`, [
      `${primo} → ${secondo}`,
      `${primoFiglia} → ${secondoFiglia}`,
    ]);
    await expect(redazione.getByText(`L'indirizzo pubblico ora è ${secondo}.`)).toBeVisible();
    expect(await statoDi(redazione, madre)).toEqual(['published', secondo]);
    expect(await statoDi(redazione, figlia)).toEqual(['published', secondoFiglia]);

    // Sul sito i vecchi indirizzi portano ai nuovi in un passo.
    await portaInUnPasso(request, primo, secondo, titoloMadre);
    await portaInUnPasso(request, primoFiglia, secondoFiglia, titoloFiglia);
    expect(await regoleCon(redazione, `-${stamp}/`)).toEqual([
      { sourcePath: primo, targetPath: secondo, origin: 'automatic', isActive: true },
      { sourcePath: primoFiglia, targetPath: secondoFiglia, origin: 'automatic', isActive: true },
    ]);

    // 4. Riporta lo slug al valore originale.
    await cambiaSlug(redazione, `madre-${stamp}`, [
      `${secondo} → ${primo}`,
      `${secondoFiglia} → ${primoFiglia}`,
    ]);
    await expect(redazione.getByText(`L'indirizzo pubblico ora è ${primo}.`)).toBeVisible();
    expect(await statoDi(redazione, madre)).toEqual(['published', primo]);
    expect(await statoDi(redazione, figlia)).toEqual(['published', primoFiglia]);

    // I primi indirizzi rispondono di nuovo, i secondi portano ai primi in un passo.
    await rispondeDirettamente(request, primo, titoloMadre);
    await rispondeDirettamente(request, primoFiglia, titoloFiglia);
    await portaInUnPasso(request, secondo, primo, titoloMadre);
    await portaInUnPasso(request, secondoFiglia, primoFiglia, titoloFiglia);

    // Nessun ciclo: le regole dai primi indirizzi sono sparite, non solo nascoste
    // dal contenuto pubblicato che sul sito vince su una regola con la stessa origine.
    expect(await regoleCon(redazione, `-${stamp}/`)).toEqual([
      { sourcePath: secondo, targetPath: primo, origin: 'automatic', isActive: true },
      { sourcePath: secondoFiglia, targetPath: primoFiglia, origin: 'automatic', isActive: true },
    ]);
    await redazione.close();

    // 5. L'amministrazione ritrova i due cambi d'indirizzo della madre nel registro.
    const amministrazione = await browser.newPage();
    await entra(amministrazione, 'Impostazioni');
    await amministrazione.goto(`${ADMIN_URL}/admin/impostazioni/registro`);
    await expect(
      amministrazione.getByRole('heading', { name: 'Registro delle operazioni', level: 1 }),
    ).toBeVisible();

    await amministrazione.getByLabel('Contenuto', { exact: true }).fill(titoloMadre.slice(0, -4));
    await amministrazione
      .getByRole('button', { name: `${titoloMadre} (Pagina)`, exact: true })
      .click();
    await amministrazione.getByRole('button', { name: 'Applica i filtri' }).click();

    const cambi = amministrazione.getByRole('row').filter({
      has: amministrazione.getByRole('cell', { name: "Ha cambiato l'indirizzo", exact: true }),
    });
    await expect(cambi).toHaveCount(2);
    for (const riga of await cambi.all()) {
      await expect(riga.getByRole('cell', { name: PERSONA_REDAZIONE })).toBeVisible();
      await expect(riga.getByText(titoloMadre)).toBeVisible();
      await expect(riga.getByText('Riuscita')).toBeVisible();
    }
    await amministrazione.close();
  });
});
