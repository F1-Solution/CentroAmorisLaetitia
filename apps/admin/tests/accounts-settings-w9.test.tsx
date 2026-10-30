import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W9, T7: account e impostazioni.
 *
 * - W8-27: il menu della persona offre «Cambia la password», che porta alla pagina del cambio.
 *   Prima c'era solo «Disconnetti» e la pagina si raggiungeva scrivendone l'indirizzo.
 * - W8-28: chi si toglie un ruolo chiude la propria sessione (scelta voluta). Prima l'area
 *   rileggeva l'elenco, riceveva 401 e mostrava «Serve un accesso valido.»; ora lascia un
 *   avviso alla schermata di accesso, che spiega di entrare di nuovo.
 * - W8-38: «Logo del sito» si sceglie dal selettore dei media e «Pagina iniziale» da un elenco
 *   delle pagine pubblicate, invece di scrivere un identificativo interno.
 *
 * Nomi, indirizzi, media e pagine sono inventati.
 */

const apiMock = vi.fn();
const pushMock = vi.fn();
const replaceMock = vi.fn();
const refreshMock = vi.fn();
let signedIn = true;
let activeArea: 'redazione' | 'impostazioni' = 'impostazioni';

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../src/lib/session', async () => {
  const actual = await vi.importActual<typeof SessionModule>('../src/lib/session');
  return {
    ...actual,
    useSession: () => ({
      user: signedIn
        ? {
            userId: 'u1',
            email: 'ada@esempio.invalid',
            fullName: 'Ada Inventata',
            mustChangePassword: false,
            permissions: ['users.manage', 'site.settings.write'],
            activeRoleId: 'r1',
            activeArea,
            rolesHeld: [
              {
                roleId: 'r1',
                key: 'amministrazione',
                label: 'Amministrazione',
                areas: ['impostazioni'],
              },
            ],
          }
        : null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      chooseVestment: vi.fn(),
      refresh: refreshMock,
    }),
  };
});

const { SiteSettings } = await import('../src/components/settings/SiteSettings');
const { AccountsScreen } = await import('../src/components/accounts/AccountsScreen');
const { default: AccessoPage } = await import('../src/app/accesso/page');
const { ApiError } = await import('../src/lib/api');

function show(element: React.JSX.Element): ReturnType<typeof userEvent.setup> {
  const user = userEvent.setup();
  render(<DensityProvider>{element}</DensityProvider>);
  return user;
}

function writes(): { path: string; body: unknown }[] {
  return apiMock.mock.calls
    .filter((call) => (call[1] as { method?: string } | undefined)?.method !== undefined)
    .map((call) => ({ path: call[0] as string, body: (call[1] as { body?: unknown }).body }));
}

const LOGO_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_IMAGE_ID = '22222222-2222-4222-8222-222222222222';
const HOME_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_PAGE_ID = '44444444-4444-4444-8444-444444444444';

const setting = (key: string, value: unknown, label: string) => ({
  key,
  value,
  label,
  description: null,
  isSecret: false,
  updatedAt: '2026-01-10T10:00:00.000Z',
});

const logoImage = {
  id: LOGO_ID,
  title: 'Logo inventato',
  fileName: 'logo-inventato.png',
  publicPath: '/media/2026/01/logo-inventato.png',
};
const otherImage = {
  id: OTHER_IMAGE_ID,
  title: null,
  fileName: 'altro-inventato.png',
  publicPath: '/media/2026/01/altro-inventato.png',
};

beforeEach(() => {
  apiMock.mockReset();
  pushMock.mockReset();
  replaceMock.mockReset();
  refreshMock.mockReset();
  refreshMock.mockResolvedValue(undefined);
  signedIn = true;
  activeArea = 'impostazioni';
  window.sessionStorage.clear();
  apiMock.mockImplementation(async (path: string) => {
    if (path === '/settings') {
      return [
        setting('site.logo_media_id', LOGO_ID, 'Logo del sito'),
        setting('site.home_content_id', HOME_ID, 'Pagina iniziale'),
      ];
    }
    if (path.startsWith('/settings/choices/logo')) {
      return { items: [logoImage, otherImage], current: logoImage };
    }
    if (path === '/settings/choices/home') {
      return {
        items: [
          { id: OTHER_PAGE_ID, title: 'Chi siamo inventato', path: '/chi-siamo/' },
          { id: HOME_ID, title: 'Casa inventata', path: '/casa/' },
        ],
      };
    }
    return {};
  });
});

describe('W8-27: «Cambia la password» nel menu della persona', () => {
  it('il menu porta alla pagina del cambio della password', async () => {
    const user = show(<SiteSettings />);
    await user.click(await screen.findByRole('button', { name: 'Ada Inventata' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cambia la password' }));
    expect(pushMock).toHaveBeenCalledWith('/password');
  });
});

describe('W8-28: togliersi un ruolo', () => {
  const ada = {
    id: 'u1',
    email: 'ada@esempio.invalid',
    fullName: 'Ada Inventata',
    isActive: true,
    roleKeys: ['editor', 'amministrazione'],
    lastLoginAt: null,
    createdAt: '2026-01-10T10:00:00.000Z',
  };
  const bruno = {
    ...ada,
    id: 'b2',
    email: 'bruno@esempio.invalid',
    fullName: 'Bruno Inventato',
    roleKeys: ['editor'],
  };

  beforeEach(() => {
    let closed = false;
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'PATCH') {
        closed = true;
        return {};
      }
      if (path === '/accounts') {
        // Dopo il salvataggio la sessione è chiusa: l'elenco riletto riceverebbe 401.
        if (closed) throw new ApiError(401, 'UNAUTHENTICATED', 'Serve un accesso valido.');
        return { items: [ada, bruno] };
      }
      return {};
    });
  });

  it('dopo il salvataggio non mostra «Serve un accesso valido.» e la schermata di accesso spiega perché', async () => {
    const user = show(<AccountsScreen />);
    await user.click(
      await screen.findByRole('button', { name: 'Modifica i ruoli di Ada Inventata' }),
    );
    const dialogo = screen.getByRole('dialog');
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Redazione' }));
    await user.type(within(dialogo).getByLabelText('Password attuale'), 'password-inventata');
    await user.click(within(dialogo).getByRole('button', { name: 'Salva i ruoli' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(writes()).toContainEqual({
      path: '/accounts/u1',
      body: { roleKeys: ['amministrazione'], currentPassword: 'password-inventata' },
    });
    expect(screen.queryByText(/Serve un accesso valido/)).not.toBeInTheDocument();

    signedIn = false;
    render(
      <DensityProvider>
        <AccessoPage />
      </DensityProvider>,
    );
    expect(
      await screen.findByText('Ruoli cambiati: la sessione è stata chiusa. Entra di nuovo.'),
    ).toBeInTheDocument();
  });

  it('aggiungersi un ruolo non chiude la sessione: «Modifiche salvate.» e nessun avviso per l’accesso', async () => {
    const soloAmministrazione = { ...ada, roleKeys: ['amministrazione'] };
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'PATCH') return {};
      if (path === '/accounts') return { items: [soloAmministrazione, bruno] };
      return {};
    });
    const user = show(<AccountsScreen />);
    await user.click(
      await screen.findByRole('button', { name: 'Modifica i ruoli di Ada Inventata' }),
    );
    const dialogo = screen.getByRole('dialog');
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Redazione' }));
    await user.type(within(dialogo).getByLabelText('Password attuale'), 'password-inventata');
    await user.click(within(dialogo).getByRole('button', { name: 'Salva i ruoli' }));
    expect(await screen.findByText('Modifiche salvate.')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('amoris.accesso.avviso')).toBeNull();
  });
});

describe('W8-38: logo e pagina iniziale si scelgono da elenco', () => {
  it('«Logo del sito» mostra il logo attuale e si cambia dal selettore dei media', async () => {
    const user = show(<SiteSettings />);
    expect(await screen.findByText('Logo inventato')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Logo del sito' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Scegli il logo' }));
    const panel = await screen.findByRole('dialog', { name: 'Scegli un media' });
    const option = await within(panel).findByRole('option', { name: /altro-inventato\.png/ });
    expect(option.querySelector('img')).toHaveAttribute(
      'src',
      '/media/2026/01/altro-inventato.png',
    );
    // Il testo alternativo del logo non si chiede qui: il selettore va senza.
    expect(within(panel).queryByLabelText('Testo alternativo')).not.toBeInTheDocument();
    await user.click(option);
    await user.click(within(panel).getByRole('button', { name: 'Usa questo media' }));
    expect(screen.getByText('altro-inventato.png')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salva «Logo del sito»' }));
    await waitFor(() =>
      expect(writes()).toContainEqual({
        path: '/settings/site.logo_media_id',
        body: { value: OTHER_IMAGE_ID },
      }),
    );
  });

  it('«Togli il logo» salva nessun logo', async () => {
    const user = show(<SiteSettings />);
    await screen.findByText('Logo inventato');
    await user.click(screen.getByRole('button', { name: 'Togli il logo' }));
    expect(screen.getByText('Nessun logo.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salva «Logo del sito»' }));
    await waitFor(() =>
      expect(writes()).toContainEqual({
        path: '/settings/site.logo_media_id',
        body: { value: null },
      }),
    );
  });

  it('«Pagina iniziale» si sceglie fra le pagine pubblicate', async () => {
    const user = show(<SiteSettings />);
    const select = await screen.findByRole('combobox', { name: 'Pagina iniziale' });
    await waitFor(() => expect(select).toHaveValue(HOME_ID));
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(
      expect.arrayContaining(['Casa inventata (/casa/)', 'Chi siamo inventato (/chi-siamo/)']),
    );
    await user.selectOptions(select, OTHER_PAGE_ID);
    await user.click(screen.getByRole('button', { name: 'Salva «Pagina iniziale»' }));
    await waitFor(() =>
      expect(writes()).toContainEqual({
        path: '/settings/site.home_content_id',
        body: { value: OTHER_PAGE_ID },
      }),
    );
  });

  it('W9-N3: la pagina iniziale senza titolo si chiama «Pagina iniziale», le altre «Senza titolo»', async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/settings')
        return [setting('site.home_content_id', HOME_ID, 'Pagina iniziale')];
      if (path === '/settings/choices/home') {
        return {
          items: [
            { id: HOME_ID, title: '', path: '/home/' },
            { id: OTHER_PAGE_ID, title: '', path: '/senza-titolo-inventata/' },
          ],
          current: { id: HOME_ID, title: '', path: '/home/' },
        };
      }
      return {};
    });
    show(<SiteSettings />);
    const select = await screen.findByRole('combobox', { name: 'Pagina iniziale' });
    await waitFor(() =>
      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Pagina iniziale (/home/)', 'Senza titolo (/senza-titolo-inventata/)']),
    );
  });

  it('la pagina iniziale attuale si mostra anche quando resta fuori dall’elenco (revisione, M2)', async () => {
    // L'elenco ha un tetto: la pagina attuale arriva a parte, come per il logo.
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/settings')
        return [setting('site.home_content_id', HOME_ID, 'Pagina iniziale')];
      if (path === '/settings/choices/home') {
        return {
          items: [{ id: OTHER_PAGE_ID, title: 'Chi siamo inventato', path: '/chi-siamo/' }],
          current: { id: HOME_ID, title: 'Casa inventata', path: '/casa/' },
        };
      }
      return {};
    });
    show(<SiteSettings />);
    const select = await screen.findByRole('combobox', { name: 'Pagina iniziale' });
    await waitFor(() =>
      expect(
        within(select)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Casa inventata (/casa/)', 'Chi siamo inventato (/chi-siamo/)']),
    );
    expect(select).toHaveValue(HOME_ID);
  });

  it('W9-N3: dopo «Salva» il nome «Pagina iniziale» passa alla pagina scelta', async () => {
    let savedHome = HOME_ID;
    apiMock.mockImplementation(
      async (path: string, options?: { method?: string; body?: unknown }) => {
        if (options?.method === 'PUT') {
          savedHome = (options.body as { value: string }).value;
          return {};
        }
        if (path === '/settings')
          return [setting('site.home_content_id', savedHome, 'Pagina iniziale')];
        if (path === '/settings/choices/home') {
          return {
            items: [
              { id: HOME_ID, title: '', path: '/home/' },
              { id: OTHER_PAGE_ID, title: '', path: '/altra-inventata/' },
            ],
            current: { id: HOME_ID, title: '', path: '/home/' },
          };
        }
        return {};
      },
    );
    const user = show(<SiteSettings />);
    const select = await screen.findByRole('combobox', { name: 'Pagina iniziale' });
    const labels = () =>
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent);
    await waitFor(() =>
      expect(labels()).toEqual(['Pagina iniziale (/home/)', 'Senza titolo (/altra-inventata/)']),
    );
    await user.selectOptions(select, OTHER_PAGE_ID);
    await user.click(screen.getByRole('button', { name: 'Salva «Pagina iniziale»' }));
    await waitFor(() =>
      expect(
        within(screen.getByRole('combobox', { name: 'Pagina iniziale' }))
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Senza titolo (/home/)', 'Pagina iniziale (/altra-inventata/)']),
    );
  });

  it('un rifiuto del servizio si mostra in italiano sotto il campo', async () => {
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'PUT') {
        throw new ApiError(
          400,
          'VALIDATION_FAILED',
          '«Pagina iniziale» deve essere una pagina pubblicata.',
        );
      }
      if (path === '/settings')
        return [setting('site.home_content_id', HOME_ID, 'Pagina iniziale')];
      if (path === '/settings/choices/home') {
        return { items: [{ id: HOME_ID, title: 'Casa inventata', path: '/casa/' }] };
      }
      return {};
    });
    const user = show(<SiteSettings />);
    await screen.findByRole('combobox', { name: 'Pagina iniziale' });
    await user.click(screen.getByRole('button', { name: 'Salva «Pagina iniziale»' }));
    expect(
      await screen.findByText(/«Pagina iniziale» deve essere una pagina pubblicata\./),
    ).toBeInTheDocument();
  });
});
