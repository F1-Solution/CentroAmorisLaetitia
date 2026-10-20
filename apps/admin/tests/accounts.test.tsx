import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W1, T4: la schermata «Persone e permessi». Account e password sono
 * inventati.
 */

const apiMock = vi.fn();
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
        userId: 'u1',
        email: 'direzione@esempio.invalid',
        fullName: 'Direzione di prova',
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
      refresh: vi.fn(),
    }),
  };
});

const { ApiError } = await import('../src/lib/api');
const { default: PersonePage } = await import('../src/app/impostazioni/persone/page');

const ada = {
  id: 'a1',
  email: 'ada@esempio.invalid',
  fullName: 'Ada Inventata',
  isActive: true,
  roleKeys: ['amministrazione'],
  lastLoginAt: '2026-10-01T09:30:00.000Z',
  createdAt: '2026-01-10T10:00:00.000Z',
};
const bruno = {
  id: 'b2',
  email: 'bruno@esempio.invalid',
  fullName: 'Bruno Inventato',
  isActive: true,
  roleKeys: ['editor'],
  lastLoginAt: null,
  createdAt: '2026-02-10T10:00:00.000Z',
};
const carla = { ...bruno, id: 'c3', fullName: 'Carla Inventata', isActive: false };

function writes(): { path: string; options: { method?: string; body?: unknown } }[] {
  return apiMock.mock.calls
    .filter((call) => (call[1] as { method?: string } | undefined)?.method !== undefined)
    .map((call) => ({
      path: call[0] as string,
      options: call[1] as { method?: string; body?: unknown },
    }));
}

function renderPage() {
  return render(
    <DensityProvider>
      <PersonePage />
    </DensityProvider>,
  );
}

const AVVISO =
  'Questa password non verrà mostrata di nuovo: consegnala di persona alla persona interessata.';

describe('persone e permessi', () => {
  beforeEach(() => {
    permissions = ['users.manage'];
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === '/accounts') return Promise.resolve({ items: [ada, bruno, carla] });
      return Promise.resolve({});
    });
  });

  it('elenca nome, email, ruoli, stato e ultimo accesso', async () => {
    renderPage();
    const riga = (await screen.findByText('Ada Inventata')).closest('tr') as HTMLElement;
    expect(within(riga).getByText('ada@esempio.invalid')).toBeInTheDocument();
    expect(within(riga).getByText('Amministrazione')).toBeInTheDocument();
    expect(within(riga).getByText('Attivo')).toBeInTheDocument();
    expect(within(riga).getByText('01/10/2026')).toBeInTheDocument();

    const rigaBruno = screen.getByText('Bruno Inventato').closest('tr') as HTMLElement;
    expect(within(rigaBruno).getByText('Redazione')).toBeInTheDocument();
    expect(within(rigaBruno).getByText('Mai')).toBeInTheDocument();
    const rigaCarla = screen.getByText('Carla Inventata').closest('tr') as HTMLElement;
    expect(within(rigaCarla).getByText('Disattivato')).toBeInTheDocument();
  });

  it('crea un account con i ruoli scelti e mostra la password una sola volta', async () => {
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/accounts' && options?.method === 'POST') {
        return Promise.resolve({
          account: {
            ...bruno,
            id: 'n4',
            fullName: 'Nuova Persona',
            email: 'nuova@esempio.invalid',
          },
          temporaryPassword: 'Temporanea-Inventata-1',
        });
      }
      if (path === '/accounts') return Promise.resolve({ items: [ada] });
      return Promise.resolve({});
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ada Inventata');

    await user.click(screen.getByRole('button', { name: 'Nuova persona' }));
    await user.type(screen.getByLabelText('Nome e cognome'), 'Nuova Persona');
    await user.type(screen.getByLabelText('Indirizzo email'), 'nuova@esempio.invalid');
    await user.click(screen.getByRole('checkbox', { name: 'Redazione' }));
    await user.click(screen.getByRole('button', { name: 'Crea account' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/accounts',
        options: {
          method: 'POST',
          body: {
            email: 'nuova@esempio.invalid',
            fullName: 'Nuova Persona',
            roleKeys: ['editor'],
          },
        },
      });
    });

    const pannello = await screen.findByRole('region', { name: 'Password temporanea' });
    expect(within(pannello).getByText('Temporanea-Inventata-1')).toBeInTheDocument();
    expect(within(pannello).getByText(AVVISO)).toBeInTheDocument();
    expect(pannello).toHaveFocus();
    expect(within(pannello).getByRole('button', { name: 'Copia la password' })).toBeInTheDocument();

    await user.click(within(pannello).getByRole('button', { name: 'Ho consegnato la password' }));
    expect(screen.queryByText('Temporanea-Inventata-1')).not.toBeInTheDocument();
  });

  it('senza alcun ruolo scelto non invia e lo dice', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ada Inventata');
    await user.click(screen.getByRole('button', { name: 'Nuova persona' }));
    await user.type(screen.getByLabelText('Nome e cognome'), 'Senza Ruolo');
    await user.type(screen.getByLabelText('Indirizzo email'), 'senza@esempio.invalid');
    await user.click(screen.getByRole('button', { name: 'Crea account' }));
    expect(await screen.findByText('Scegli almeno un ruolo.')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('mostra in italiano l’errore 409 di email già usata', async () => {
    apiMock.mockImplementation((_path: string, options?: { method?: string }) => {
      if (options?.method === 'POST') {
        return Promise.reject(
          new ApiError(409, 'EMAIL_TAKEN', 'Esiste già un account con questo indirizzo.'),
        );
      }
      return Promise.resolve({ items: [ada] });
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ada Inventata');
    await user.click(screen.getByRole('button', { name: 'Nuova persona' }));
    await user.type(screen.getByLabelText('Nome e cognome'), 'Doppione');
    await user.type(screen.getByLabelText('Indirizzo email'), 'ada@esempio.invalid');
    await user.click(screen.getByRole('checkbox', { name: 'Amministrazione' }));
    await user.click(screen.getByRole('button', { name: 'Crea account' }));
    expect(
      await screen.findByText('Esiste già un account con questo indirizzo.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Password temporanea' })).not.toBeInTheDocument();
  });

  it('disattiva solo dopo la conferma', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Bruno Inventato');

    await user.click(screen.getByRole('button', { name: 'Disattiva Bruno Inventato' }));
    expect(writes()).toHaveLength(0);
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Annulla' }));
    expect(writes()).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Disattiva Bruno Inventato' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disattiva' }),
    );
    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/accounts/b2',
        options: { method: 'PATCH', body: { isActive: false } },
      });
    });
  });

  it('mostra in italiano l’errore dell’ultima amministrazione', async () => {
    apiMock.mockImplementation((_path: string, options?: { method?: string }) => {
      if (options?.method === 'PATCH') {
        return Promise.reject(
          new ApiError(
            409,
            'LAST_ADMINISTRATOR',
            'Non è possibile: nessun account attivo avrebbe più il ruolo di amministrazione.',
          ),
        );
      }
      return Promise.resolve({ items: [ada] });
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Ada Inventata');
    await user.click(screen.getByRole('button', { name: 'Disattiva Ada Inventata' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disattiva' }),
    );
    expect(
      await screen.findByText(/nessun account attivo avrebbe più il ruolo/),
    ).toBeInTheDocument();
  });

  it('riattiva un account disattivato', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Carla Inventata');
    await user.click(screen.getByRole('button', { name: 'Riattiva Carla Inventata' }));
    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/accounts/c3',
        options: { method: 'PATCH', body: { isActive: true } },
      });
    });
  });

  it('reimposta la password dopo la conferma e la mostra una sola volta', async () => {
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/accounts/b2/password-reset' && options?.method === 'POST') {
        return Promise.resolve({ temporaryPassword: 'Reimpostata-Inventata-2' });
      }
      return Promise.resolve({ items: [ada, bruno] });
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Bruno Inventato');

    await user.click(
      screen.getByRole('button', { name: 'Reimposta la password di Bruno Inventato' }),
    );
    expect(writes()).toHaveLength(0);
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reimposta' }),
    );

    const pannello = await screen.findByRole('region', { name: 'Password temporanea' });
    expect(within(pannello).getByText('Reimpostata-Inventata-2')).toBeInTheDocument();
    expect(within(pannello).getByText(AVVISO)).toBeInTheDocument();
    expect(pannello).toHaveFocus();
    expect(writes()).toContainEqual({
      path: '/accounts/b2/password-reset',
      options: { method: 'POST' },
    });
  });

  it('cambia i ruoli di un account', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Bruno Inventato');
    await user.click(screen.getByRole('button', { name: 'Modifica i ruoli di Bruno Inventato' }));
    const dialogo = await screen.findByRole('dialog');
    await user.click(within(dialogo).getByRole('checkbox', { name: 'Amministrazione' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Salva i ruoli' }));
    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/accounts/b2',
        options: { method: 'PATCH', body: { roleKeys: ['editor', 'amministrazione'] } },
      });
    });
  });

  it('sulla riga di chi ha l’accesso non offre né Disattiva né Reimposta password', async () => {
    const io = { ...ada, id: 'u1', fullName: 'Direzione di prova' };
    apiMock.mockImplementation((path: string) =>
      Promise.resolve(path === '/accounts' ? { items: [io, bruno] } : {}),
    );
    renderPage();
    await screen.findByText('Bruno Inventato');
    expect(
      screen.queryByRole('button', { name: 'Disattiva Direzione di prova' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reimposta la password di Direzione di prova' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Modifica i ruoli di Direzione di prova' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disattiva Bruno Inventato' })).toBeInTheDocument();
  });

  it('senza users.manage non mostra i comandi di scrittura', async () => {
    permissions = [];
    renderPage();
    await screen.findByText('Ada Inventata');
    expect(screen.queryByRole('button', { name: 'Nuova persona' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Disattiva / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Riattiva / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reimposta / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Modifica i ruoli/ })).not.toBeInTheDocument();
  });
});
