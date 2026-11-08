import { expect, test } from '@playwright/test';
import { ACCESSO_ENTRAMBI, ADMIN_URL, API_URL } from '../support/ambiente';
import {
  accedi,
  attivaSecondoFattore,
  entra,
  esci,
  intestazioniApi,
  superaSecondoFattore,
} from '../support/sessione';

/**
 * Persone e permessi (1G-W1): il ciclo di vita di un account nel browser e il
 * rifiuto diretto verso chi ha solo il ruolo di redazione (W1-1, W1-2, W1-3,
 * W1-4). Account e password sono inventati; l'indirizzo porta un suffisso per
 * esecuzione, così la prova si ripete anche su un database già usato.
 */

const SUFFISSO = Date.now().toString(36);
const NOME = `Nuova redazione di prova ${SUFFISSO}`;
const EMAIL = `nuova.redazione.${SUFFISSO}@esempio.invalid`;
const PASSWORD_SCELTA = 'password-scelta-dalla-persona-1';

test.describe('persone e permessi', () => {
  test('ciclo completo: crea, primo accesso con cambio password, disattiva', async ({ page }) => {
    // 1. L'amministrazione crea l'account e legge la password temporanea.
    await entra(page, 'Impostazioni');
    await page.goto(`${ADMIN_URL}/admin/impostazioni/persone`);
    await expect(page.getByRole('heading', { name: 'Persone e permessi', level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Nuova persona' }).click();
    await page.getByLabel('Nome e cognome').fill(NOME);
    await page.getByLabel('Indirizzo email').fill(EMAIL);
    await page.getByRole('checkbox', { name: 'Redazione' }).check();
    await page.getByRole('button', { name: 'Crea account' }).click();

    const pannello = page.getByRole('region', { name: 'Password temporanea' });
    await expect(pannello).toBeVisible();
    await expect(
      pannello.getByText(
        'Questa password non verrà mostrata di nuovo: consegnala di persona alla persona interessata.',
      ),
    ).toBeVisible();
    const temporanea = (await pannello.locator('code').innerText()).trim();
    expect(temporanea.length).toBeGreaterThanOrEqual(12);
    await expect(page.getByRole('cell', { name: new RegExp(EMAIL) })).toBeVisible();

    await pannello.getByRole('button', { name: 'Ho consegnato la password' }).click();
    await expect(pannello).toHaveCount(0);
    await esci(page);

    // 2. Il nuovo account attiva il secondo fattore (DR-384), poi è portato a cambiare la password
    // prima di ogni altra cosa.
    await accedi(page, EMAIL, temporanea);
    await attivaSecondoFattore(page);
    await page.waitForURL(/\/admin\/password/);
    await page.goto(`${ADMIN_URL}/admin/redazione/pagine`);
    await page.waitForURL(/\/admin\/password/);

    await page.getByLabel('Password attuale').fill(temporanea);
    await page.getByLabel('Nuova password', { exact: true }).fill(PASSWORD_SCELTA);
    await page.getByLabel('Ripeti la nuova password').fill(PASSWORD_SCELTA);
    await page.getByRole('button', { name: 'Cambia password' }).click();

    // 3. Entra in Redazione e non vede Impostazioni.
    await page.waitForURL(/\/admin\/redazione/);
    await expect(page.getByText('Stai lavorando come Redazione')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Impostazioni' })).toHaveCount(0);
    await esci(page);

    // 4. L'amministrazione disattiva l'account: da quel momento non entra più.
    await entra(page, 'Impostazioni');
    await page.goto(`${ADMIN_URL}/admin/impostazioni/persone`);
    await page.getByRole('button', { name: `Disattiva ${NOME}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Disattiva', exact: true }).click();
    await expect(page.getByRole('button', { name: `Riattiva ${NOME}` })).toBeVisible();
    await esci(page);

    await accedi(page, EMAIL, PASSWORD_SCELTA);
    await expect(page.getByText('Accesso non riuscito')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/accesso/);
  });

  test('chi ha solo il ruolo di redazione non raggiunge persone e permessi', async ({ page }) => {
    await entra(page, 'Redazione');

    // La pagina non si apre: si è riportati fuori da Impostazioni.
    await page.goto(`${ADMIN_URL}/admin/impostazioni/persone`);
    await page.waitForURL(/\/admin\/(scelta-area|redazione)/);
    await expect(page.getByRole('heading', { name: 'Persone e permessi' })).toHaveCount(0);

    // E il servizio rifiuta la richiesta diretta.
    const risposta = await page.request.get(`${API_URL}/accounts`, {
      headers: await intestazioniApi(page),
    });
    expect(risposta.status()).toBe(403);
  });

  test('chi ha entrambi i ruoli sceglie l’area e può cambiarla', async ({ page }) => {
    await accedi(page, ACCESSO_ENTRAMBI.email, ACCESSO_ENTRAMBI.password);
    await superaSecondoFattore(page);
    await page.waitForURL(/\/admin\/scelta-area/);
    await expect(page.getByRole('button', { name: 'Redazione' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Impostazioni' })).toBeVisible();

    await page.getByRole('button', { name: 'Redazione' }).click();
    await page.waitForURL(/\/admin\/redazione/);
    await expect(page.getByText('Stai lavorando come Redazione')).toBeVisible();

    // Il commutatore offre l'altra veste.
    await page.getByRole('button', { name: /^Redazione/ }).click();
    await page.getByRole('menuitemradio', { name: /Impostazioni/ }).click();
    // Oggi la schermata di partenza rimanda alla scelta dell'area prima che
    // la navigazione verso l'altra area si compia: si conferma lì la scelta.
    await page.waitForURL(/\/admin\/(scelta-area|impostazioni)/);
    if (page.url().includes('scelta-area')) {
      await page.getByRole('button', { name: 'Impostazioni' }).click();
    }
    await page.waitForURL(/\/admin\/impostazioni/);
    await expect(page.getByText('Stai lavorando come Impostazioni')).toBeVisible();
  });
});
