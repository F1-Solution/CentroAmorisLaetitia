import { expect, test, type Page } from '@playwright/test';
import { ADMIN_URL, WEB_URL } from '../support/ambiente';
import { entra } from '../support/sessione';

/**
 * Categorie complete (1G-W7, T2g, DR-280): dalla schermata «Categorie» la redazione
 * crea una categoria di prova, le dà descrizione e SEO, la sposta sotto un'altra e
 * la elimina. Sul **sito vero**: la meta description e il title dell'archivio, il
 * nuovo indirizzo `/category/genitrice/figlia/` con il 301 in un passo dal vecchio,
 * e il 404 dopo l'eliminazione. Nomi e slug sono inventati e unici nell'esecuzione.
 */

async function nuovaCategoria(page: Page, nome: string, slug: string): Promise<void> {
  await page.getByRole('button', { name: 'Nuova categoria' }).click();
  const finestra = page.getByRole('dialog');
  await finestra.getByLabel('Nome').fill(nome);
  await finestra.getByLabel('Indirizzo').fill(slug);
  await finestra.getByRole('button', { name: 'Crea categoria' }).click();
  await expect(page.getByRole('row', { name: new RegExp(nome) })).toBeVisible();
}

async function apriModifica(page: Page, nome: string) {
  await page
    .getByRole('row', { name: new RegExp(nome) })
    .getByRole('button', { name: 'Modifica' })
    .click();
  const finestra = page.getByRole('dialog', { name: 'Modifica categoria' });
  await expect(finestra.getByLabel('Titolo SEO')).toBeEnabled();
  return finestra;
}

test.describe('categorie complete', () => {
  test('descrizione e SEO sul sito, spostamento con 301, eliminazione con 404', async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const genitrice = { nome: `Genitrice di prova ${stamp}`, slug: `genitrice-${stamp}` };
    const figlia = { nome: `Categoria di prova ${stamp}`, slug: `categoria-${stamp}` };
    const primo = `/category/${figlia.slug}/`;
    const secondo = `/category/${genitrice.slug}/${figlia.slug}/`;

    await entra(page, 'Redazione');
    await page.goto(`${ADMIN_URL}/admin/redazione/categorie`);
    await nuovaCategoria(page, genitrice.nome, genitrice.slug);
    await nuovaCategoria(page, figlia.nome, figlia.slug);

    // 1. Descrizione e SEO dell'archivio.
    let finestra = await apriModifica(page, figlia.nome);
    await finestra.getByLabel('Descrizione', { exact: true }).fill('Descrizione sintetica.');
    await finestra.getByLabel('Titolo SEO').fill('Titolo sintetico di {term_title}');
    await finestra.getByRole('button', { name: 'Salva' }).click();
    await expect(finestra).toBeHidden();

    const archivio = await request.get(`${WEB_URL}${primo}`, { maxRedirects: 0 });
    expect(archivio.status()).toBe(200);
    const html = await archivio.text();
    expect(html).toContain('<meta name="description" content="Descrizione sintetica."/>');
    expect(html).toContain(`<title>Titolo sintetico di ${figlia.nome}</title>`);

    // 2. Spostata sotto la genitrice: nuovo indirizzo, 301 dal vecchio in un passo.
    finestra = await apriModifica(page, figlia.nome);
    await finestra.getByLabel('Categoria genitrice').selectOption({ label: genitrice.nome });
    await expect(finestra.getByText(secondo)).toBeVisible();
    await finestra.getByRole('button', { name: 'Salva' }).click();
    await expect(finestra).toBeHidden();
    await expect(page.getByRole('row', { name: new RegExp(figlia.nome) })).toContainText(secondo);

    const vecchio = await request.get(`${WEB_URL}${primo}`, { maxRedirects: 0 });
    expect(vecchio.status()).toBe(301);
    expect(new URL(vecchio.headers()['location'] ?? '', WEB_URL).pathname).toBe(secondo);
    const nuovo = await request.get(`${WEB_URL}${secondo}`, { maxRedirects: 0 });
    expect(nuovo.status()).toBe(200);
    expect(await nuovo.text()).toContain(`<title>Titolo sintetico di ${figlia.nome}</title>`);

    // 3. Eliminata con la conferma del nome: l'archivio risponde 404.
    await page
      .getByRole('row', { name: new RegExp(figlia.nome) })
      .getByRole('button', { name: 'Elimina' })
      .click();
    const conferma = page.getByRole('dialog', { name: 'Elimina la categoria' });
    await conferma.getByLabel(`Digita «${figlia.nome}» per confermare`).fill(figlia.nome);
    await conferma.getByRole('button', { name: 'Elimina definitivamente' }).click();
    await expect(page.getByRole('row', { name: new RegExp(figlia.nome) })).toHaveCount(0);

    expect((await request.get(`${WEB_URL}${secondo}`, { maxRedirects: 0 })).status()).toBe(404);
  });
});
