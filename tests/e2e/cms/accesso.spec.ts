import { expect, test } from '@playwright/test';
import { ACCESSO, ADMIN_URL } from '../support/ambiente';
import { entra, esci } from '../support/sessione';

/**
 * Accesso, scelta della veste, uscita — eseguiti nel browser, contro le
 * applicazioni avviate.
 *
 * Perché qui e non fra le prove del servizio: il messaggio unico di ADR-007
 * §3.1 controllo 9 lo scrive l'interfaccia, il cookie di sessione lo posa il
 * browser, e il percorso `/admin` esiste solo quando l'applicazione è servita
 * davvero. Sono le tre cose che le prove in processo non possono vedere.
 */

test.describe('accesso all’area di gestione', () => {
  test('una password sbagliata non dice se l’indirizzo esista', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/accesso`);

    await page.getByLabel('Indirizzo di posta').fill(ACCESSO.email);
    await page.getByLabel('Password').fill('questa-password-non-e-quella-giusta');
    await page.getByRole('button', { name: 'Entra' }).click();

    await expect(page.getByText('Accesso non riuscito')).toBeVisible();
    // Il messaggio non deve distinguere i due casi: sarebbe l'enumerazione
    // degli account reintrodotta dall'interfaccia.
    await expect(page.getByText(/non esiste|inesistente|sconosciut/i)).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/accesso/);
  });

  test('un indirizzo inesistente riceve lo stesso messaggio', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/admin/accesso`);

    await page.getByLabel('Indirizzo di posta').fill('nessuno@esempio.invalid');
    await page.getByLabel('Password').fill(ACCESSO.password);
    await page.getByRole('button', { name: 'Entra' }).click();

    await expect(page.getByText('Accesso non riuscito')).toBeVisible();
  });

  test('entrando si sceglie la veste, e l’ambiente attivo è scritto in parole', async ({
    page,
  }) => {
    await entra(page, 'Redazione');
    await expect(page).toHaveURL(/\/admin\/redazione\/pagine/);
    await expect(page.getByRole('heading', { name: 'Pagine', level: 1 })).toBeVisible();
  });

  test('si può lavorare nell’altra area, e la schermata lo dichiara', async ({ page }) => {
    await entra(page, 'Impostazioni');
    await expect(page.getByRole('heading', { name: 'Impostazioni del sito' })).toBeVisible();
  });

  test('uscendo si torna alla schermata di accesso, e l’area non è più raggiungibile', async ({
    page,
  }) => {
    await entra(page, 'Redazione');
    await esci(page);

    await page.goto(`${ADMIN_URL}/admin/redazione/pagine`);
    await page.waitForURL(/\/admin\/accesso/);
  });
});
