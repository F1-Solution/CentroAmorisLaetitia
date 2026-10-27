import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W7, T2i (DR-282): da «Persone e permessi» si modificano nome ed email
 * di un account. Il modulo controlla nome e formato dell'indirizzo prima di
 * inviare, manda solo i campi cambiati, avvisa che il cambio d'indirizzo chiude
 * le sessioni e, quando a cambiare è il proprio indirizzo, rilegge la sessione
 * (che l'API ha appena chiuso) così che l'area riporti all'accesso. Indirizzi
 * inventati, `*@example.invalid`.
 */

const apiMock = vi.fn();
const refreshMock = vi.fn();
let permissions: string[] = ['users.manage'];

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
        permissions,
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

async function openEdit(name: string): Promise<HTMLElement> {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: `Modifica nome ed email di ${name}` }),
  );
  return screen.findByRole('dialog');
}

describe('modifica di nome ed email (DR-282)', () => {
  beforeEach(() => {
    permissions = ['users.manage'];
    refreshMock.mockReset();
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === '/accounts') return Promise.resolve({ items: [ada, bruno] });
      return Promise.resolve({ account: bruno });
    });
  });

  it('senza users.manage il comando non compare', async () => {
    permissions = [];
    renderPage();
    await screen.findByText('Bruno Inventato');
    expect(screen.queryByRole('button', { name: /Modifica nome ed email/ })).toBeNull();
  });

  it('il modulo parte dai valori attuali e manda solo i campi cambiati', async () => {
    renderPage();
    const dialog = await openEdit('Bruno Inventato');
    const nome = within(dialog).getByLabelText(/Nome e cognome/);
    const email = within(dialog).getByLabelText(/Indirizzo email/);
    expect(nome).toHaveValue('Bruno Inventato');
    expect(email).toHaveValue('bruno@example.invalid');

    const user = userEvent.setup();
    await user.clear(email);
    await user.type(email, 'bruno.nuovo@example.invalid');
    expect(
      within(dialog).getByText(
        'Cambiando l’indirizzo si chiudono tutte le sessioni aperte di Bruno Inventato: dovrà entrare di nuovo con l’indirizzo nuovo.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]).toEqual({
      path: '/accounts/b2',
      body: { email: 'bruno.nuovo@example.invalid' },
    });
    expect(refreshMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('nome vuoto ed email non valida: errori in italiano e nessun invio', async () => {
    renderPage();
    const dialog = await openEdit('Bruno Inventato');
    const user = userEvent.setup();
    await user.clear(within(dialog).getByLabelText(/Nome e cognome/));
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    expect(await within(dialog).findByText('Scrivi il nome e cognome.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Nome e cognome/), 'Bruno');
    const email = within(dialog).getByLabelText(/Indirizzo email/);
    await user.clear(email);
    await user.type(email, 'non-un-indirizzo');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    expect(
      await within(dialog).findByText('Scrivi un indirizzo email valido.'),
    ).toBeInTheDocument();
    expect(patches()).toHaveLength(0);
  });

  it('un indirizzo già usato mostra il rifiuto dell’API in italiano nel modulo', async () => {
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (options?.method === 'PATCH') {
        return Promise.reject(
          new ApiError(409, 'EMAIL_TAKEN', 'Esiste già un account con questo indirizzo.'),
        );
      }
      return Promise.resolve({ items: [ada, bruno] });
    });
    renderPage();
    const dialog = await openEdit('Bruno Inventato');
    const user = userEvent.setup();
    const email = within(dialog).getByLabelText(/Indirizzo email/);
    await user.clear(email);
    await user.type(email, 'ada@example.invalid');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    expect(
      await within(dialog).findByText('Esiste già un account con questo indirizzo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('senza modifiche il modulo si chiude senza inviare', async () => {
    renderPage();
    const dialog = await openEdit('Bruno Inventato');
    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patches()).toHaveLength(0);
  });

  it('il proprio indirizzo: avviso dedicato e, salvato, la sessione si rilegge', async () => {
    renderPage();
    const dialog = await openEdit('Ada Inventata');
    const user = userEvent.setup();
    const email = within(dialog).getByLabelText(/Indirizzo email/);
    await user.clear(email);
    await user.type(email, 'ada.nuova@example.invalid');
    expect(
      within(dialog).getByText(
        'Cambiando il tuo indirizzo si chiude anche questa sessione: dovrai entrare di nuovo con ada.nuova@example.invalid.',
      ),
    ).toBeInTheDocument();
    // Sul proprio account serve la password attuale (DR-288).
    await user.type(within(dialog).getByLabelText('Password attuale'), 'password-inventata');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(patches()[0]).toEqual({
      path: '/accounts/a1',
      body: { email: 'ada.nuova@example.invalid', currentPassword: 'password-inventata' },
    });
  });

  it('il solo nome proprio non chiude la sessione: la si rilegge per aggiornare la testata', async () => {
    renderPage();
    const dialog = await openEdit('Ada Inventata');
    const user = userEvent.setup();
    const nome = within(dialog).getByLabelText(/Nome e cognome/);
    await user.clear(nome);
    await user.type(nome, 'Ada Rinominata');
    expect(within(dialog).queryByText(/si chiude anche questa sessione/)).toBeNull();
    // Giro 1: dopo il salvataggio l'elenco si rilegge e mostra il nome nuovo.
    apiMock.mockImplementation((path: string) => {
      if (path === '/accounts') {
        return Promise.resolve({ items: [{ ...ada, fullName: 'Ada Rinominata' }, bruno] });
      }
      return Promise.resolve({ account: { ...ada, fullName: 'Ada Rinominata' } });
    });
    await user.type(within(dialog).getByLabelText('Password attuale'), 'password-inventata');
    await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]?.body).toEqual({
      fullName: 'Ada Rinominata',
      currentPassword: 'password-inventata',
    });
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    const riga = (await screen.findByText('Ada Rinominata')).closest('tr') as HTMLElement;
    expect(within(riga).getByText('ada@example.invalid')).toBeInTheDocument();
    // La testata mostra il nome della sessione simulata: si guarda solo la tabella.
    expect(within(screen.getByRole('table')).queryByText('Ada Inventata')).toBeNull();
  });

  it('il controllo nel client accetta solo indirizzi ASCII, come l’API', async () => {
    renderPage();
    const dialog = await openEdit('Bruno Inventato');
    const user = userEvent.setup();
    const email = within(dialog).getByLabelText(/Indirizzo email/);
    for (const sbagliato of ['brunò@example.invalid', 'bruno@exämple.invalid', 'bruno@example.i']) {
      await user.clear(email);
      await user.type(email, sbagliato);
      await user.click(within(dialog).getByRole('button', { name: 'Salva' }));
      expect(
        await within(dialog).findByText('Scrivi un indirizzo email valido.'),
      ).toBeInTheDocument();
    }
    expect(patches()).toHaveLength(0);
  });
});
