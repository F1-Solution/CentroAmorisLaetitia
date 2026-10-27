import { expect, test } from '@playwright/test';
import { ACCESSO_AMMINISTRAZIONE, ADMIN_URL } from '../support/ambiente';
import { entra } from '../support/sessione';

/**
 * DR-288 (1G-W7, T2l): l'amministrazione sintetica cambia il proprio nome da
 * «Persone e permessi». Senza la password attuale il salvataggio è fermato; con
 * una password errata l'API rifiuta; con quella giusta il nome cambia. Alla fine
 * il nome torna quello del seme, così le altre prove lo ritrovano.
 */

const SUFFISSO = Date.now().toString(36);

test('l’amministrazione cambia il proprio nome solo con la password attuale', async ({ page }) => {
  await entra(page, 'Impostazioni');
  await page.goto(`${ADMIN_URL}/admin/impostazioni/persone`);

  const riga = page.getByRole('row').filter({ hasText: ACCESSO_AMMINISTRAZIONE.email });
  const nomeDelSeme = (await riga.locator('strong').innerText()).trim();
  const nomeNuovo = `${nomeDelSeme} ${SUFFISSO}`;

  await page.getByRole('button', { name: `Modifica nome ed email di ${nomeDelSeme}` }).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Nome e cognome').fill(nomeNuovo);

  // Senza password: il salvataggio non parte e il campo lo dice.
  await dialogo.getByRole('button', { name: 'Salva' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText('Scrivi la tua password attuale.');
  await expect(dialogo.getByLabel('Password attuale')).toBeFocused();

  // Password errata: l'API rifiuta, la finestra resta aperta e il campo si svuota.
  await dialogo.getByLabel('Password attuale').fill('password-sbagliata-end-to-end');
  await dialogo.getByRole('button', { name: 'Salva' }).click();
  await expect(dialogo.getByRole('alert')).toHaveText('La password attuale non è corretta.');
  await expect(dialogo.getByLabel('Password attuale')).toHaveValue('');

  // Con la password giusta il nome cambia.
  await dialogo.getByLabel('Password attuale').fill(ACCESSO_AMMINISTRAZIONE.password);
  await dialogo.getByRole('button', { name: 'Salva' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(riga.locator('strong')).toHaveText(nomeNuovo);

  // Ritorno al nome del seme, con la stessa regola.
  await page.getByRole('button', { name: `Modifica nome ed email di ${nomeNuovo}` }).click();
  await dialogo.getByLabel('Nome e cognome').fill(nomeDelSeme);
  await dialogo.getByLabel('Password attuale').fill(ACCESSO_AMMINISTRAZIONE.password);
  await dialogo.getByRole('button', { name: 'Salva' }).click();
  await expect(dialogo).toHaveCount(0);
  await expect(riga.locator('strong')).toHaveText(nomeDelSeme);
});
