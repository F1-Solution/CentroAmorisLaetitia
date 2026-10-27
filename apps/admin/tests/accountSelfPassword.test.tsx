import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W7, T2l (DR-288): sul proprio account ogni salvataggio da «Persone e
 * permessi» chiede la password attuale, in un campo etichettato dentro la
 * finestra della modifica. L'errore dell'API (password errata, troppi
 * tentativi) è annunciato sul campo, che si svuota e riceve il fuoco; la
 * password non resta in memoria oltre la richiesta. Sugli account altrui il
 * campo non compare e non si invia nulla di più. Dati inventati.
 */

const apiMock = vi.fn();
const refreshMock = vi.fn();

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
        userId: 'a1',
        email: 'ada@example.invalid',
        fullName: 'Ada Inventata',
        mustChangePassword: false,
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
      refresh: refreshMock,
    }),
  };
});

const { ApiError } = await import('../src/lib/api');
const { default: PersonePage } = await import('../src/app/impostazioni/persone/page');
const { EditAccountDialog } = await import('../src/components/accounts/EditAccountDialog');

const PASSWORD = 'password-inventata-di-ada';

const ada = {
  id: 'a1',
  email: 'ada@example.invalid',
  fullName: 'Ada Inventata',
  isActive: true,
  roleKeys: ['amministrazione'],
  lastLoginAt: null,
  createdAt: '2026-01-10T10:00:00.000Z',
};
const bruno = {
  id: 'b2',
  email: 'bruno@example.invalid',
  fullName: 'Bruno Inventato',
  isActive: true,
  roleKeys: ['editor'],
  lastLoginAt: null,
  createdAt: '2026-02-10T10:00:00.000Z',
};

function patches(): { path: string; body: unknown }[] {
  return apiMock.mock.calls
    .filter((call) => (call[1] as { method?: string } | undefined)?.method === 'PATCH')
    .map((call) => ({ path: call[0] as string, body: (call[1] as { body?: unknown }).body }));
}

function renderPage() {
  return render(
    <DensityProvider>
      <PersonePage />
    </DensityProvider>,
  );
}

async function open(name: string): Promise<HTMLElement> {
  await userEvent.setup().click(await screen.findByRole('button', { name }));
  return screen.findByRole('dialog');
}

function refuseOnce(error: InstanceType<typeof ApiError>): void {
  let refused = false;
  apiMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === 'PATCH' && !refused) {
      refused = true;
      return Promise.reject(error);
    }
    if (path === '/accounts') return Promise.resolve({ items: [ada, bruno] });
    return Promise.resolve({ account: ada });
  });
}

describe('password attuale sul proprio account (DR-288)', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === '/accounts') return Promise.resolve({ items: [ada, bruno] });
      return Promise.resolve({ account: ada });
    });
  });

  it('nome proprio: campo etichettato, senza password nessun invio e un errore annunciato', async () => {
    renderPage();
    const dialog = await open('Modifica nome ed email di Ada Inventata');
    const campo = within(dialog).getByLabelText('Password attuale');
    expect(campo).toHaveAttribute('type', 'password');
    expect(campo).toHaveAttribute('autocomplete', 'current-password');

    const user = userEvent.setup();
    const nome = within(dialog).getByLabelText(/Nome e cognome/);
    await user.clear(nome);
    await user.type(nome, 'Ada Rinominata');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));

    const errore = await within(dialog).findByRole('alert');
    expect(errore).toHaveTextContent('Scrivi la tua password attuale.');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveFocus();
    expect(patches()).toHaveLength(0);
  });

  it('nome proprio con la password: la richiesta la porta, poi la finestra si chiude', async () => {
    renderPage();
    const dialog = await open('Modifica nome ed email di Ada Inventata');
    const user = userEvent.setup();
    const nome = within(dialog).getByLabelText(/Nome e cognome/);
    await user.clear(nome);
    await user.type(nome, 'Ada Rinominata');
    await user.type(within(dialog).getByLabelText('Password attuale'), PASSWORD);
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]).toEqual({
      path: '/accounts/a1',
      body: { fullName: 'Ada Rinominata', currentPassword: PASSWORD },
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('password errata: messaggio sul campo, campo vuoto con il fuoco, finestra aperta', async () => {
    refuseOnce(new ApiError(403, 'INVALID_CREDENTIALS', 'Indirizzo o password non corretti.'));
    renderPage();
    const dialog = await open('Modifica nome ed email di Ada Inventata');
    const user = userEvent.setup();
    const nome = within(dialog).getByLabelText(/Nome e cognome/);
    await user.clear(nome);
    await user.type(nome, 'Ada Rinominata');
    const campo = within(dialog).getByLabelText('Password attuale');
    await user.type(campo, 'password-sbagliata');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));

    const errore = await within(dialog).findByRole('alert');
    expect(errore).toHaveTextContent('La password attuale non è corretta.');
    expect(campo).toHaveValue('');
    expect(campo).toHaveFocus();
    // Le modifiche restano: si riprova con la sola password.
    expect(nome).toHaveValue('Ada Rinominata');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.type(campo, PASSWORD);
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches()[1]?.body).toEqual({ fullName: 'Ada Rinominata', currentPassword: PASSWORD });
  });

  it('giro 1: due 403 identici di fila svuotano il campo e gli danno il fuoco anche al secondo', async () => {
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (options?.method === 'PATCH') {
        return Promise.reject(
          new ApiError(403, 'INVALID_CREDENTIALS', 'Indirizzo o password non corretti.'),
        );
      }
      return Promise.resolve({ items: [ada, bruno] });
    });
    renderPage();
    const dialog = await open('Modifica nome ed email di Ada Inventata');
    const user = userEvent.setup();
    await user.type(within(dialog).getByLabelText(/Nome e cognome/), ' Bis');
    const campo = within(dialog).getByLabelText('Password attuale');
    for (const tentativo of ['sbagliata-uno', 'sbagliata-due']) {
      await user.type(campo, tentativo);
      await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
      await waitFor(() => expect(campo).toHaveValue(''));
      expect(campo).toHaveFocus();
    }
    expect(patches()).toHaveLength(2);
  });

  it('giro 1: il campo segue il contatore dei rifiuti, non il testo dell’errore', async () => {
    const message = 'La password attuale non è corretta.';
    const props = { account: ada, isSelf: true, busy: false, error: null, onClose: vi.fn() };
    const view = render(
      <DensityProvider>
        <EditAccountDialog
          {...props}
          passwordError={message}
          passwordRefusals={1}
          onSave={vi.fn()}
        />
      </DensityProvider>,
    );
    const campo = screen.getByLabelText('Password attuale');
    await userEvent.setup().type(campo, 'sbagliata-di-nuovo');
    // Lo stesso testo con un rifiuto in più: il campo si svuota e riprende il fuoco.
    view.rerender(
      <DensityProvider>
        <EditAccountDialog
          {...props}
          passwordError={message}
          passwordRefusals={2}
          onSave={vi.fn()}
        />
      </DensityProvider>,
    );
    await waitFor(() => expect(campo).toHaveValue(''));
    expect(campo).toHaveFocus();
  });

  it('troppi tentativi: lo dice in italiano sul campo', async () => {
    refuseOnce(new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Troppi tentativi. Riprovare più tardi.'));
    renderPage();
    const dialog = await open('Modifica i ruoli di Ada Inventata');
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Redazione' }));
    await user.type(within(dialog).getByLabelText('Password attuale'), PASSWORD);
    await user.click(within(dialog).getByRole('button', { name: 'Salva i ruoli' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Troppi tentativi. Riprova più tardi.',
    );
  });

  it('ruoli propri: senza password nessun invio, con la password la richiesta la porta', async () => {
    renderPage();
    const dialog = await open('Modifica i ruoli di Ada Inventata');
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Redazione' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salva i ruoli' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Scrivi la tua password attuale.',
    );
    expect(patches()).toHaveLength(0);

    await user.type(within(dialog).getByLabelText('Password attuale'), PASSWORD);
    await user.click(within(dialog).getByRole('button', { name: 'Salva i ruoli' }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]).toEqual({
      path: '/accounts/a1',
      body: { roleKeys: ['editor', 'amministrazione'], currentPassword: PASSWORD },
    });
  });

  it('la password non resta: riaprendo la finestra il campo è vuoto', async () => {
    refuseOnce(new ApiError(403, 'INVALID_CREDENTIALS', 'Indirizzo o password non corretti.'));
    renderPage();
    let dialog = await open('Modifica nome ed email di Ada Inventata');
    const user = userEvent.setup();
    await user.type(within(dialog).getByLabelText(/Nome e cognome/), ' Bis');
    await user.type(within(dialog).getByLabelText('Password attuale'), 'password-sbagliata');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await within(dialog).findByRole('alert');
    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    dialog = await open('Modifica nome ed email di Ada Inventata');
    expect(within(dialog).getByLabelText('Password attuale')).toHaveValue('');
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('sugli account altrui il campo non compare e la richiesta non lo porta', async () => {
    renderPage();
    let dialog = await open('Modifica nome ed email di Bruno Inventato');
    expect(within(dialog).queryByLabelText('Password attuale')).toBeNull();
    const user = userEvent.setup();
    const nome = within(dialog).getByLabelText(/Nome e cognome/);
    await user.clear(nome);
    await user.type(nome, 'Bruno Rinominato');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]?.body).toEqual({ fullName: 'Bruno Rinominato' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    dialog = await open('Modifica i ruoli di Bruno Inventato');
    expect(within(dialog).queryByLabelText('Password attuale')).toBeNull();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Amministrazione' }));
    await user.click(within(dialog).getByRole('button', { name: 'Salva i ruoli' }));
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches()[1]?.body).toEqual({ roleKeys: ['editor', 'amministrazione'] });
  });
});
