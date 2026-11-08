import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import postgres from 'postgres';
import {
  ACCESSO_AMMINISTRAZIONE,
  ADMIN_URL,
  API_URL,
  DATABASE_E2E,
  urlPerDatabase,
} from '../support/ambiente';
import { accedi, attivaSecondoFattore, entra, esci, intestazioniApi } from '../support/sessione';
import { codiceTotp, passoCorrente } from '../support/totp';

/**
 * Secondo fattore TOTP nell'area (1F-W4 T6l, DR-384, DR-391, DR-396), nel browser e con i codici
 * calcolati come li calcola l'app: attivazione al primo accesso, nessuna area prima del codice,
 * codice sbagliato e codice riusato rifiutati, conferma recente per «Persone e permessi».
 * Account e password inventati, con un suffisso per esecuzione.
 */

const SUFFISSO = Date.now().toString(36);
const NOME = `Secondo fattore di prova ${SUFFISSO}`;
const EMAIL = `secondo.fattore.${SUFFISSO}@esempio.invalid`;
const PASSWORD_SCELTA = 'password-scelta-per-il-secondo-fattore';

const COOKIE_SESSIONE = process.env.SESSION_COOKIE_NAME ?? 'amoris_sessione';

async function creaAccountDiRedazione(page: Page): Promise<string> {
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
  await esci(page);
  return temporanea;
}

async function scriviCodice(page: Page, codice: string): Promise<void> {
  await page.getByLabel('Codice di 6 cifre').fill(codice);
  await page.getByRole('button', { name: 'Verifica' }).click();
}

/** Sposta indietro l'ultima conferma della sola sessione del browser, come se fossero passati i minuti dati. */
async function invecchiaConferma(page: Page, minuti: number): Promise<void> {
  const token = (await page.context().cookies()).find((voce) => voce.name === COOKIE_SESSIONE);
  if (!token) throw new Error(`cookie ${COOKIE_SESSIONE} assente`);
  const digest = createHash('sha256').update(token.value, 'utf8').digest();
  const sql = postgres(urlPerDatabase(DATABASE_E2E), { max: 1 });
  try {
    await sql`
      update sessions set last_confirmed_at = now() - make_interval(mins => ${minuti})
      where token_digest = ${digest}`;
  } finally {
    await sql.end();
  }
}

test.describe('secondo fattore nell’area di gestione', () => {
  test('attivazione al primo accesso, poi codice a ogni accesso; sbagliato o riusato non entra', async ({
    page,
  }) => {
    const temporanea = await creaAccountDiRedazione(page);

    // Dopo la password, nessuna area: né dalla navigazione né dall'API.
    await accedi(page, EMAIL, temporanea);
    await page.waitForURL(/\/admin\/secondo-fattore/);
    await expect(page.getByRole('heading', { name: 'Secondo fattore', level: 1 })).toBeVisible();
    await page.goto(`${ADMIN_URL}/admin/redazione/pagine`);
    await page.waitForURL(/\/admin\/secondo-fattore/);
    const rifiuto = await page.request.get(`${API_URL}/contents?type=page`, {
      headers: await intestazioniApi(page),
    });
    expect(rifiuto.status()).toBe(403);
    expect(((await rifiuto.json()) as { error: { code: string } }).error.code).toBe(
      'SECOND_FACTOR_REQUIRED',
    );

    // Attivazione con la chiave mostrata, poi il cambio obbligatorio della password.
    const { chiave, passo } = await attivaSecondoFattore(page);
    await page.waitForURL(/\/admin\/password/);
    await page.getByLabel('Password attuale').fill(temporanea);
    await page.getByLabel('Nuova password', { exact: true }).fill(PASSWORD_SCELTA);
    await page.getByLabel('Ripeti la nuova password').fill(PASSWORD_SCELTA);
    await page.getByRole('button', { name: 'Cambia password' }).click();
    await page.waitForURL(/\/admin\/redazione/);
    await expect(page.getByText('Stai lavorando come Redazione')).toBeVisible();
    await esci(page);

    // Accesso seguente: la chiave non si mostra più; un codice fuori finestra è rifiutato.
    await accedi(page, EMAIL, PASSWORD_SCELTA);
    await page.waitForURL(/\/admin\/secondo-fattore/);
    await expect(page.getByRole('button', { name: 'Mostra la chiave' })).toHaveCount(0);
    await scriviCodice(page, codiceTotp(chiave, passo + 10));
    await expect(page.getByText('Codice non corretto.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/secondo-fattore/);

    // Il codice del passo successivo a quello dell'attivazione apre l'area.
    const passoBuono = Math.max(passo + 1, passoCorrente());
    const buono = codiceTotp(chiave, passoBuono);
    await scriviCodice(page, buono);
    await page.waitForURL(/\/admin\/redazione/);
    await expect(page.getByText('Stai lavorando come Redazione')).toBeVisible();
    await esci(page);

    // Lo stesso codice, riusato, non vale più (protezione dal riuso di RFC 6238 §5.2).
    await accedi(page, EMAIL, PASSWORD_SCELTA);
    await page.waitForURL(/\/admin\/secondo-fattore/);
    await scriviCodice(page, buono);
    await expect(page.getByText('Codice non corretto.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/secondo-fattore/);
  });

  test('«Persone e permessi» chiede di nuovo la password dopo 10 minuti, anche per l’elenco', async ({
    page,
  }) => {
    await entra(page, 'Impostazioni');
    await page.goto(`${ADMIN_URL}/admin/impostazioni/persone`);
    await expect(
      page.getByRole('cell', { name: new RegExp(ACCESSO_AMMINISTRAZIONE.email) }),
    ).toBeVisible();

    await invecchiaConferma(page, 11);
    await page.reload();

    const dialogo = page.getByRole('dialog', { name: 'Conferma la tua identità' });
    await expect(dialogo).toBeVisible();
    await expect(
      page.getByRole('cell', { name: new RegExp(ACCESSO_AMMINISTRAZIONE.email) }),
    ).toHaveCount(0);

    await dialogo.getByLabel('Password', { exact: true }).fill('password-sbagliata-end-to-end');
    await dialogo.getByRole('button', { name: 'Conferma' }).click();
    await expect(dialogo.getByText('La password non è corretta.')).toBeVisible();

    await dialogo.getByLabel('Password', { exact: true }).fill(ACCESSO_AMMINISTRAZIONE.password);
    await dialogo.getByRole('button', { name: 'Conferma' }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(
      page.getByRole('cell', { name: new RegExp(ACCESSO_AMMINISTRAZIONE.email) }),
    ).toBeVisible();
  });
});
