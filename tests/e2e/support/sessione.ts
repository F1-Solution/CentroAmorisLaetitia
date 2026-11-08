import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import {
  ACCESSO,
  ACCESSO_AMMINISTRAZIONE,
  ADMIN_URL,
  DATABASE_E2E,
  urlPerDatabase,
} from './ambiente';
import { codiceTotp, passoCorrente } from './totp';

/** Il cookie della sessione: lo stesso nome predefinito dell'API (`SESSION_COOKIE_NAME`). */
const COOKIE_SESSIONE = process.env.SESSION_COOKIE_NAME ?? 'amoris_sessione';

/** Inserisce indirizzo e password e preme «Entra»; dopo la password viene il secondo fattore. */
export async function accedi(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${ADMIN_URL}/admin/accesso`);
  await page.getByLabel('Indirizzo di posta').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Entra' }).click();
}

/**
 * Supera il secondo fattore senza app di autenticazione: come l'harness dell'API, segna come
 * verificata e confermata ora, a database, la sola sessione del browser (DR-384). Serve alle prove
 * che non riguardano il TOTP; il flusso vero, con i codici, sta in `cms/secondo-fattore.spec.ts`.
 */
export async function superaSecondoFattore(page: Page): Promise<void> {
  await page.waitForURL(/\/admin\/secondo-fattore/);
  const token = (await page.context().cookies()).find((voce) => voce.name === COOKIE_SESSIONE);
  if (!token) throw new Error(`cookie ${COOKIE_SESSIONE} assente dopo l'accesso`);
  const digest = createHash('sha256').update(token.value, 'utf8').digest();
  const sql = postgres(urlPerDatabase(DATABASE_E2E), { max: 1 });
  try {
    const segnate = await sql`
      update sessions set second_factor_verified_at = now(), last_confirmed_at = now()
      where token_digest = ${digest} and revoked_at is null`;
    if (segnate.count !== 1) throw new Error('sessione del browser non trovata a database');
  } finally {
    await sql.end();
  }
  await page.goto(`${ADMIN_URL}/admin/`);
}

/** Attiva il secondo fattore dalla schermata, come farebbe la persona con l'app; rende la chiave e il passo usato. */
export async function attivaSecondoFattore(
  page: Page,
): Promise<{ readonly chiave: string; readonly passo: number }> {
  await page.waitForURL(/\/admin\/secondo-fattore/);
  await page.getByRole('button', { name: 'Mostra la chiave' }).click();
  const chiave = (await page.getByLabel('Chiave da inserire nell’app').innerText()).replace(
    /\s/g,
    '',
  );
  const passo = passoCorrente();
  await page.getByLabel('Codice di 6 cifre').fill(codiceTotp(chiave, passo));
  await page.getByRole('button', { name: 'Attiva' }).click();
  await page.waitForURL((url) => !url.pathname.includes('secondo-fattore'));
  return { chiave, passo };
}

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
  await accedi(page, accesso.email, accesso.password);
  await superaSecondoFattore(page);

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
