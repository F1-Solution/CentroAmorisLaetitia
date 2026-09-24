import { expect, type Page } from '@playwright/test';
import { ACCESSO, ADMIN_URL } from './ambiente';

/**
 * Entra nell'area amministrativa e sceglie una veste.
 *
 * La persona del seme sintetico possiede **due** vesti — Redazione e
 * Impostazioni, perché il suo ruolo ha tutti e cinque i permessi — quindi la
 * schermata di scelta compare davvero (`ux-proposals.md` §4.3). Passare da lì
 * fa parte del flusso, non è un passo da saltare.
 */
export async function entra(page: Page, area: 'Redazione' | 'Impostazioni'): Promise<void> {
  await page.goto(`${ADMIN_URL}/admin/accesso`);

  await page.getByLabel('Indirizzo di posta').fill(ACCESSO.email);
  await page.getByLabel('Password').fill(ACCESSO.password);
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
  await page.getByRole('button', { name: /Redazione di prova/ }).click();
  await page.getByRole('menuitem', { name: 'Disconnetti' }).click();
  await page.waitForURL(/\/admin\/accesso/);
}
