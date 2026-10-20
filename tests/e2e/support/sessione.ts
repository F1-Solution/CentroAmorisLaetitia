import { expect, type Page } from '@playwright/test';
import { ACCESSO, ACCESSO_AMMINISTRAZIONE, ADMIN_URL } from './ambiente';

/**
 * Entra nell'area amministrativa nella veste richiesta.
 *
 * Dopo DR-227 ogni persona del seme ha una sola veste: la redazione entra in
 * Redazione, l'amministrazione in Impostazioni. L'accesso usa quindi la persona
 * giusta per l'area, e la schermata di scelta compare solo a chi ha entrambi i
 * ruoli (`ux-proposals.md` §4.3).
 */
export async function entra(page: Page, area: 'Redazione' | 'Impostazioni'): Promise<void> {
  const accesso = area === 'Impostazioni' ? ACCESSO_AMMINISTRAZIONE : ACCESSO;
  await page.goto(`${ADMIN_URL}/admin/accesso`);

  await page.getByLabel('Indirizzo di posta').fill(accesso.email);
  await page.getByLabel('Password').fill(accesso.password);
  await page.getByRole('button', { name: 'Entra' }).click();

  await page.waitForURL(/\/admin\/(scelta-area|redazione|impostazioni)/);

  if (page.url().includes('scelta-area')) {
    await page.getByRole('button', { name: area, exact: false }).first().click();
  }

  // L'ambiente attivo è dichiarato in parole compiute su ogni schermata
  // (`design-system.md` §9.6): è anche il segnale che la veste è quella giusta.
  await expect(page.getByText(`Stai lavorando come ${area}`)).toBeVisible();
}

/**
 * Le intestazioni con cui interrogare il servizio riusando la sessione del
 * browser.
 *
 * Non basta `page.request`: i cookie di sessione sono marcati `Secure`
 * (ADR-007 §3.1 controllo 3) e il contesto di richiesta di Playwright non li
 * manda su `http://`, mentre il browser sì, perché considera `127.0.0.1`
 * un'origine sicura. Si leggono dal contesto e si passano a mano: la prova
 * resta quella di una sessione vera, non di una inventata.
 */
export async function intestazioniApi(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies();
  const cookie = cookies.map((voce) => `${voce.name}=${voce.value}`).join('; ');
  const csrf = cookies.find((voce) => voce.name.includes('csrf'))?.value ?? '';
  return { cookie, 'x-csrf-token': csrf };
}

/** Esce, e verifica che l'uscita riporti davvero alla schermata di accesso. */
export async function esci(page: Page): Promise<void> {
  // Il menu della persona è il solo pulsante-menu col nome; i pulsanti di riga
  // di «Persone e permessi» portano lo stesso nome ma non aprono un menu.
  await page
    .locator('button[aria-haspopup="menu"]')
    .filter({ hasText: /di prova/ })
    .click();
  await page.getByRole('menuitem', { name: 'Disconnetti' }).click();
  await page.waitForURL(/\/admin\/accesso/);
}
