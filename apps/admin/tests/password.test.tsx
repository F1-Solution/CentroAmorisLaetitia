import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W1, T2: la schermata «Cambia password» e il reindirizzamento di chi
 * deve cambiarla. Account e password sono inventati.
 */

const apiMock = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
let mustChangePassword = true;
let activeArea: 'redazione' | null = 'redazione';
const chooseVestment = vi.fn();
const signOut = vi.fn();
const EDITOR_ROLE = { roleId: 'r1', key: 'editor', label: 'Redazione', areas: ['redazione'] };
let rolesHeld: { roleId: string; key: string; label: string; areas: string[] }[] = [EDITOR_ROLE];

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
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
        email: 'redazione@esempio.invalid',
        fullName: 'Persona di prova',
        mustChangePassword,
        permissions: [],
        activeRoleId: 'r1',
        activeArea,
        rolesHeld,
      },
      loading: false,
      signIn: vi.fn(),
      signOut,
      chooseVestment,
      refresh,
    }),
  };
});

const { default: PasswordPage } = await import('../src/app/password/page');
const { AreaShell } = await import('../src/components/AreaShell');
const { default: SceltaAreaPage } = await import('../src/app/scelta-area/page');
const { ApiError } = await import('../src/lib/api');

beforeEach(() => {
  apiMock.mockReset();
  replace.mockReset();
  refresh.mockReset();
  mustChangePassword = true;
  activeArea = 'redazione';
  chooseVestment.mockReset();
  signOut.mockReset();
  rolesHeld = [EDITOR_ROLE];
});

function renderPage() {
  return render(
    <DensityProvider>
      <PasswordPage />
    </DensityProvider>,
  );
}

async function fill(current: string, next: string, repeat: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Password attuale'), current);
  await user.type(screen.getByLabelText('Nuova password'), next);
  await user.type(screen.getByLabelText('Ripeti la nuova password'), repeat);
  await user.click(screen.getByRole('button', { name: 'Cambia password' }));
}

describe('schermata /password', () => {
  it('«Esci» chiude la sessione e porta alla pagina di accesso', async () => {
    signOut.mockResolvedValueOnce(undefined);
    renderPage();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Esci' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/accesso'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('rifiuta una nuova password sotto i 12 caratteri, senza chiamare il servizio', async () => {
    renderPage();
    await fill('vecchia-password-lunga', 'corta', 'corta');
    expect(await screen.findByText(/almeno 12 caratteri/i)).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('rifiuta due nuove password diverse', async () => {
    renderPage();
    await fill('vecchia-password-lunga', 'nuova-password-sintetica', 'nuova-password-diversa');
    expect(await screen.findByText(/non coincidono/i)).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('rifiuta una nuova password uguale a quella attuale, senza chiamare il servizio', async () => {
    renderPage();
    await fill(
      'stessa-password-sintetica',
      'stessa-password-sintetica',
      'stessa-password-sintetica',
    );
    expect(await screen.findByText(/diversa da quella attuale/i)).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('con la password attuale sbagliata mostra un messaggio in italiano', async () => {
    apiMock.mockRejectedValueOnce(
      new ApiError(403, 'INVALID_CREDENTIALS', 'Indirizzo o password non corretti.'),
    );
    renderPage();
    await fill('sbagliata-sbagliata', 'nuova-password-sintetica', 'nuova-password-sintetica');
    expect(await screen.findByText('La password attuale non è corretta.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('con esito positivo aggiorna la sessione e torna alla radice', async () => {
    apiMock.mockResolvedValueOnce({ ok: true });
    renderPage();
    await fill('vecchia-password-lunga', 'nuova-password-sintetica', 'nuova-password-sintetica');
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(apiMock).toHaveBeenCalledWith('/auth/password', {
      method: 'POST',
      body: { currentPassword: 'vecchia-password-lunga', newPassword: 'nuova-password-sintetica' },
    });
    expect(refresh).toHaveBeenCalled();
  });
});

describe('reindirizzamento di chi deve cambiare la password', () => {
  it('AreaShell manda a /password', async () => {
    render(
      <AreaShell area="redazione" sectionId="x" breadcrumbs={[]}>
        contenuto
      </AreaShell>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/password'));
    expect(screen.queryByText('contenuto')).not.toBeInTheDocument();
  });

  it('la scelta dell’area manda a /password', async () => {
    activeArea = null;
    render(<SceltaAreaPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/password'));
  });
});

describe('scelta dell’area dopo il cambio della password', () => {
  beforeEach(() => {
    mustChangePassword = false;
    activeArea = null;
  });

  it('con una sola veste e nessuna area attiva la indossa e va nell’area', async () => {
    chooseVestment.mockResolvedValue({});
    render(<SceltaAreaPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/redazione/pagine'));
    expect(chooseVestment).toHaveBeenCalledTimes(1);
    expect(chooseVestment).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1:redazione', roleId: 'r1', area: 'redazione' }),
    );
  });

  it('con due vesti non sceglie al posto della persona', async () => {
    rolesHeld = [{ ...EDITOR_ROLE, areas: ['redazione', 'impostazioni'] }];
    render(<SceltaAreaPage />);
    expect(await screen.findByText(/Buon lavoro/)).toBeInTheDocument();
    expect(chooseVestment).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('senza alcuna veste non sceglie nulla', async () => {
    rolesHeld = [];
    render(<SceltaAreaPage />);
    expect(await screen.findByText(/Buon lavoro/)).toBeInTheDocument();
    expect(chooseVestment).not.toHaveBeenCalled();
  });

  it('se la scelta fallisce mostra l’errore e non riprova', async () => {
    chooseVestment.mockRejectedValue(new Error('rete'));
    render(<SceltaAreaPage />);
    expect(
      await screen.findByText('Non è stato possibile contattare il servizio.'),
    ).toBeInTheDocument();
    expect(chooseVestment).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
