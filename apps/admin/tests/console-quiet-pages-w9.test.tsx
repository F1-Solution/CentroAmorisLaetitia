import { DensityProvider } from '@amoris/ui';
import { render, waitFor } from '@testing-library/react';
import { Suspense, type ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import type { CurrentUser } from '../src/lib/session';

/**
 * Wave 1G-W9, T8, rilievo M4 — criterio 1G-24 su **tutte** le pagine d'area.
 *
 * `console-quiet-w9.test.tsx` fissa W8-32 sulle tre schermate di Impostazioni.
 * La stessa causa valeva per le 12 di Redazione: aperte senza accesso o con la
 * veste dell'altra area, partivano letture che il servizio rifiutava con 401 o
 * 403, in rosso nella console del browser. Ogni pagina ora è avvolta nel
 * controllo d'accesso, e questa prova lo verifica su ognuna.
 *
 * Le pagine si raccolgono con `import.meta.glob`, non con un elenco scritto a
 * mano: una pagina nuova sotto `app/redazione/**` o `app/impostazioni/**` entra
 * da sola nella prova, e se nasce senza il controllo d'accesso la prova fallisce.
 * L'area attesa si ricava dal percorso. Per ogni pagina: senza accesso, con la
 * veste dell'altra area e mentre la sessione si legge ancora, nessuna chiamata
 * all'API deve partire, e nei primi due casi deve esserci il rinvio.
 *
 * Le pagine con `[id]` ricevono `params` come promessa, come in Next 15; la
 * promessa è già segnata come risolta, così `use(params)` la legge senza
 * sospendere. Dopo il rinvio si aspetta oltre il ritardo più lungo con cui una
 * schermata avvia la prima lettura (l'archivio dei media aspetta 400 ms prima
 * di cercare): un'attesa più corta lascerebbe passare la pagina senza
 * controllo. Dati sintetici.
 */

const apiMock = vi.fn();
const replace = vi.fn();

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const redazione: CurrentUser = {
  userId: 'u1',
  email: 'redazione@esempio.invalid',
  fullName: 'Redattrice di prova',
  mustChangePassword: false,
  secondFactor: 'verified',
  permissions: ['content.read', 'content.write', 'content.publish'],
  activeRoleId: 'r1',
  activeArea: 'redazione',
  rolesHeld: [{ roleId: 'r1', key: 'redazione', label: 'Redazione', areas: ['redazione'] }],
};

const impostazioni: CurrentUser = {
  userId: 'u2',
  email: 'amministrazione@esempio.invalid',
  fullName: 'Amministratrice di prova',
  mustChangePassword: false,
  secondFactor: 'verified',
  permissions: ['audit.read', 'site.settings.write', 'users.manage'],
  activeRoleId: 'r2',
  activeArea: 'impostazioni',
  rolesHeld: [
    { roleId: 'r2', key: 'amministrazione', label: 'Amministrazione', areas: ['impostazioni'] },
  ],
};

/** La sessione simulata: ogni prova la sceglie prima di rendere. */
const session: { user: CurrentUser | null; loading: boolean } = { user: null, loading: false };

vi.mock('../src/lib/session', async () => {
  const actual = await vi.importActual<typeof SessionModule>('../src/lib/session');
  return {
    ...actual,
    useSession: () => ({
      user: session.user,
      loading: session.loading,
      signIn: vi.fn(),
      signOut: vi.fn(),
      chooseVestment: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

/** Più del ritardo di 400 ms con cui l'archivio dei media avvia la prima lettura. */
const SETTLE_MS = 600;

const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

type PageModule = { default: ComponentType<{ params: Promise<{ id: string }> }> };

const modules = import.meta.glob<PageModule>([
  '../src/app/redazione/**/page.tsx',
  '../src/app/impostazioni/**/page.tsx',
]);

const PAGES = Object.keys(modules)
  .sort()
  .map((file) => {
    const route = file.replace('../src/app', '').replace(/\/page\.tsx$/, '') || '/';
    const area = route.startsWith('/redazione') ? 'redazione' : 'impostazioni';
    return { file, route, area, otherArea: area === 'redazione' ? impostazioni : redazione };
  });

async function renderPage(file: string): Promise<void> {
  const { default: Page } = await modules[file]!();
  const id = { id: 'c1' };
  const params = Object.assign(Promise.resolve(id), { status: 'fulfilled', value: id });
  render(
    <DensityProvider>
      <Suspense fallback={null}>
        <Page params={params} />
      </Suspense>
    </DensityProvider>,
  );
}

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockResolvedValue({ items: [] });
  replace.mockReset();
  session.user = null;
  session.loading = false;
});

it('la raccolta trova tutte le pagine delle due aree (12 di Redazione, 3 di Impostazioni)', () => {
  expect(PAGES.filter((page) => page.area === 'redazione').length).toBeGreaterThanOrEqual(12);
  expect(PAGES.filter((page) => page.area === 'impostazioni').length).toBeGreaterThanOrEqual(3);
});

describe.each(PAGES)('$route', ({ file, otherArea }) => {
  it('senza accesso nessuna chiamata all’API, e si manda all’accesso', async () => {
    await renderPage(file);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/accesso'));
    await settle();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('con la veste dell’altra area nessuna chiamata all’API, e c’è il rinvio', async () => {
    session.user = otherArea;
    await renderPage(file);
    await waitFor(() => expect(replace).toHaveBeenCalled());
    await settle();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('mentre la sessione si legge ancora nessuna chiamata e nessun rinvio', async () => {
    session.loading = true;
    await renderPage(file);
    await settle();
    expect(apiMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
