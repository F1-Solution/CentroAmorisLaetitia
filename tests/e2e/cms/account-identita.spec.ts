import { expect, test, type Page } from '@playwright/test';
import { ADMIN_URL } from '../support/ambiente';
import { entra, esci } from '../support/sessione';

/**
 * DR-282 (1G-W7, T2i): l'amministrazione cambia nome ed email di un account
 * sintetico da «Persone e permessi»; la persona entra poi con l'indirizzo nuovo
 * e non più con il vecchio. Indirizzi `*@example.invalid` con un suffisso per
 * esecuzione, così la prova si ripete su un database già usato.
 */

const SUFFISSO = Date.now().toString(36);
const NOME = `Identità di prova ${SUFFISSO}`;
const NOME_NUOVO = `Identità rinominata ${SUFFISSO}`;
const EMAIL = `identita.${SUFFISSO}@example.invalid`;
const EMAIL_NUOVA = `identita.nuova.${SUFFISSO}@example.invalid`;

async function accedi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${ADMIN_URL}/admin/accesso`);
  await page.getByLabel('Indirizzo di posta').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Entra' }).click();
}

test('l’amministrazione cambia nome ed email; si entra col nuovo indirizzo e non col vecchio', async ({
  page,
}) => {
  await entra(page, 'Impostazioni');
  await page.goto(`${ADMIN_URL}/admin/impostazioni/persone`);
  await page.getByRole('button', { name: 'Nuova persona' }).click();
  await page.getByLabel('Nome e cognome').fill(NOME);
  await page.getByLabel('Indirizzo email').fill(EMAIL);
  await page.getByRole('checkbox', { name: 'Redazione' }).check();
  await page.getByRole('button', { name: 'Crea account' }).click();
  const pannello = page.getByRole('region', { name: 'Password temporanea' });
  const temporanea = (await pannello.locator('code').innerText()).trim();
  await pannello.getByRole('button', { name: 'Ho consegnato la password' }).click();

  await page.getByRole('button', { name: `Modifica nome ed email di ${NOME}` }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Nome e cognome').fill(NOME_NUOVO);
  await dialogo.getByLabel('Indirizzo email').fill(EMAIL_NUOVA);
  await expect(dialogo.getByText(/si chiudono tutte le sessioni aperte/)).toBeVisible();
  await dialogo.getByRole('button', { name: 'Salva' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole('cell', { name: new RegExp(EMAIL_NUOVA) })).toBeVisible();
  await expect(page.getByText(NOME_NUOVO)).toBeVisible();
  await expect(page.getByRole('cell', { name: new RegExp(`^${NOME}`) })).toHaveCount(0);
  await esci(page);

  // Il vecchio indirizzo non apre più nulla.
  await accedi(page, EMAIL, temporanea);
  await expect(page.getByText('Accesso non riuscito')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/accesso/);

  // Il nuovo sì, con la stessa password: porta al cambio obbligatorio.
  await accedi(page, EMAIL_NUOVA, temporanea);
  await page.waitForURL(/\/admin\/password/);
});
