import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1F-W4, T6l-b (DR-391, DR-396): ogni rotta di «Persone e permessi», anche l'elenco, chiede una
 * conferma con password o codice se l'ultima ha più di 10 minuti. L'API risponde 403
 * `CONFIRMATION_REQUIRED`; la schermata chiede la conferma e ripete la richiesta. Dati inventati.
 */

const apiMock = vi.fn();

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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
      user: {
        userId: 'u1',
        email: 'direzione@esempio.invalid',
        fullName: 'Direzione di prova',
        mustChangePassword: false,
        secondFactor: 'verified',
        permissions: ['users.manage'],
        activeRoleId: 'r1',
        activeArea: 'impostazioni',
        rolesHeld: [
          {
            roleId: 'r1',
            key: 'amministrazione',
            label: 'Amministrazione',
            areas: ['impostazioni'],
          },
        ],
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      chooseVestment: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

const { ApiError } = await import('../src/lib/api');
const { default: PersonePage } = await import('../src/app/impostazioni/persone/page');

const bruno = {
  id: 'b2',
  email: 'bruno@esempio.invalid',
  fullName: 'Bruno Inventato',
  isActive: true,
  roleKeys: ['editor'],
  lastLoginAt: null,
  createdAt: '2026-02-10T10:00:00.000Z',
};

const stale = () =>
  new ApiError(
    403,
    'CONFIRMATION_REQUIRED',
    'Per proseguire conferma con la password o con il codice.',
  );

function renderPage() {
  return render(
    <DensityProvider>
      <PersonePage />
    </DensityProvider>,
  );
}

/** Risponde con la conferma scaduta finché `/auth/confirm` non va a buon fine. */
function confirmationGate(): void {
  let confirmed = false;
  apiMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === '/auth/confirm') {
      confirmed = true;
      return Promise.resolve({ ok: true });
    }
    if (!confirmed) return Promise.reject(stale());
    if (path === '/accounts' && options === undefined) return Promise.resolve({ items: [bruno] });
    return Promise.resolve({ ok: true });
  });
}

describe('conferma recente in «Persone e permessi»', () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it('anche l’elenco chiede la conferma; con la password si conferma e l’elenco compare', async () => {
    confirmationGate();
    renderPage();

    const dialog = await screen.findByRole('dialog', { name: 'Conferma la tua identità' });
    expect(screen.queryByText('Bruno Inventato')).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(within(dialog).getByLabelText('Password'), 'password-inventata-di-prova');
    await user.click(within(dialog).getByRole('button', { name: 'Conferma' }));

    expect(await screen.findByText('Bruno Inventato')).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith('/auth/confirm', {
      method: 'POST',
      body: { password: 'password-inventata-di-prova' },
    });
    expect(screen.queryByRole('dialog', { name: 'Conferma la tua identità' })).toBeNull();
  });

  it('si può confermare con il codice dell’app invece che con la password', async () => {
    confirmationGate();
    renderPage();

    const dialog = await screen.findByRole('dialog', { name: 'Conferma la tua identità' });
    const user = userEvent.setup();
    await user.click(within(dialog).getByLabelText('Il codice dell’app'));
    await user.type(within(dialog).getByLabelText('Codice di 6 cifre'), '246810');
    await user.click(within(dialog).getByRole('button', { name: 'Conferma' }));

    expect(await screen.findByText('Bruno Inventato')).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith('/auth/confirm', {
      method: 'POST',
      body: { code: '246810' },
    });
  });

  it('una password sbagliata lascia aperta la richiesta, con il motivo', async () => {
    apiMock.mockImplementation((path: string) =>
      Promise.reject(
        path === '/auth/confirm'
          ? new ApiError(403, 'INVALID_CREDENTIALS', 'Indirizzo o password non corretti.')
          : stale(),
      ),
    );
    renderPage();

    const dialog = await screen.findByRole('dialog', { name: 'Conferma la tua identità' });
    const user = userEvent.setup();
    await user.type(within(dialog).getByLabelText('Password'), 'sbagliata-inventata');
    await user.click(within(dialog).getByRole('button', { name: 'Conferma' }));

    expect(await within(dialog).findByText('La password non è corretta.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Password')).toHaveValue('');
  });

  it('chi annulla vede perché l’elenco manca e può riaprire la conferma', async () => {
    confirmationGate();
    renderPage();

    const dialog = await screen.findByRole('dialog', { name: 'Conferma la tua identità' });
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));

    expect(await screen.findByText(/serve una conferma recente/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Conferma ora' }));
    expect(await screen.findByRole('dialog', { name: 'Conferma la tua identità' })).toBeVisible();
  });

  it('una modifica scaduta chiede la conferma e poi si ripete con gli stessi dati', async () => {
    let patches = 0;
    let confirmed = false;
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/auth/confirm') {
        confirmed = true;
        return Promise.resolve({ ok: true });
      }
      if (options?.method === 'PATCH') {
        patches += 1;
        return confirmed ? Promise.resolve({ ok: true }) : Promise.reject(stale());
      }
      return Promise.resolve({ items: [bruno] });
    });
    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Disattiva Bruno Inventato' }));
    const ask = await screen.findByRole('dialog', { name: 'Disattiva l’account' });
    await user.click(within(ask).getByRole('button', { name: 'Disattiva' }));

    const dialog = await screen.findByRole('dialog', { name: 'Conferma la tua identità' });
    // Una finestra alla volta: la richiesta di conferma prende il posto di quella dell'azione.
    expect(screen.queryByRole('dialog', { name: 'Disattiva l’account' })).toBeNull();
    await user.type(within(dialog).getByLabelText('Password'), 'password-inventata-di-prova');
    await user.click(within(dialog).getByRole('button', { name: 'Conferma' }));

    expect(await screen.findByText('Account disattivato.')).toBeInTheDocument();
    await waitFor(() => expect(patches).toBe(2));
    const bodies = apiMock.mock.calls
      .filter((call) => (call[1] as { method?: string } | undefined)?.method === 'PATCH')
      .map((call) => (call[1] as { body?: unknown }).body);
    expect(bodies).toEqual([{ isActive: false }, { isActive: false }]);
  });
});
