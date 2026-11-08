import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1F-W4, T6l-b (DR-384, DR-397): la schermata del secondo fattore e i rinvii che ci portano.
 * Finché il secondo fattore non è verificato l'API rifiuta tutto il resto, quindi ogni schermata
 * deve mandare lì **prima** del cambio della password. Persone, chiavi e codici sono inventati.
 */

type SecondFactor = 'verified' | 'activation_required' | 'verification_required';

const apiMock = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const signIn = vi.fn();
const signOut = vi.fn();
let secondFactor: SecondFactor = 'activation_required';
let mustChangePassword = false;
let hasUser = true;

const EDITOR_ROLE = { roleId: 'r1', key: 'editor', label: 'Redazione', areas: ['redazione'] };

function sessionUser() {
  return {
    userId: 'u1',
    email: 'redazione@esempio.invalid',
    fullName: 'Persona di prova',
    mustChangePassword,
    secondFactor,
    permissions: [],
    activeRoleId: 'r1',
    activeArea: 'redazione',
    rolesHeld: [EDITOR_ROLE],
  };
}

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
      user: hasUser ? sessionUser() : null,
      loading: false,
      signIn,
      signOut,
      chooseVestment: vi.fn(),
      refresh,
    }),
  };
});

const { ApiError } = await import('../src/lib/api');
const { default: SecondoFattorePage } = await import('../src/app/secondo-fattore/page');
const { default: Home } = await import('../src/app/page');
const { default: AccessoPage } = await import('../src/app/accesso/page');
const { default: PasswordPage } = await import('../src/app/password/page');
const { default: SceltaAreaPage } = await import('../src/app/scelta-area/page');
const { AreaShell } = await import('../src/components/AreaShell');

beforeEach(() => {
  apiMock.mockReset();
  replace.mockReset();
  refresh.mockReset();
  signIn.mockReset();
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
  secondFactor = 'activation_required';
  mustChangePassword = false;
  hasUser = true;
});

function renderWithDensity(node: React.ReactNode) {
  return render(<DensityProvider>{node}</DensityProvider>);
}

describe('schermata del secondo fattore: attivazione', () => {
  it('mostra la chiave solo su richiesta e la raggruppa per quattro caratteri', async () => {
    apiMock.mockResolvedValue({
      secret: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
      otpauthUri: 'otpauth://totp/Amoris%20Laetitia:redazione%40esempio.invalid?secret=X',
    });
    renderWithDensity(<SecondoFattorePage />);

    expect(screen.getByRole('heading', { name: 'Secondo fattore' })).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Mostra la chiave' }));

    expect(apiMock).toHaveBeenCalledWith('/auth/second-factor/setup', { method: 'POST' });
    expect(await screen.findByLabelText('Chiave da inserire nell’app')).toHaveTextContent(
      'ABCD EFGH IJKL MNOP QRST UVWX YZ23 4567',
    );
    expect(screen.getByRole('link', { name: 'Apri nell’app di autenticazione' })).toHaveAttribute(
      'href',
      'otpauth://totp/Amoris%20Laetitia:redazione%40esempio.invalid?secret=X',
    );
  });

  it('attiva con il codice, rilegge la sessione e torna alla radice che smista', async () => {
    apiMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/auth/second-factor/setup'
          ? { secret: 'ABCDEFGHIJKLMNOP', otpauthUri: 'otpauth://totp/x' }
          : { ok: true },
      ),
    );
    renderWithDensity(<SecondoFattorePage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mostra la chiave' }));
    await user.type(await screen.findByLabelText('Codice di 6 cifre'), '123456');
    await user.click(screen.getByRole('button', { name: 'Attiva' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(apiMock).toHaveBeenCalledWith('/auth/second-factor/activate', {
      method: 'POST',
      body: { code: '123456' },
    });
    expect(refresh).toHaveBeenCalled();
  });
});

describe('schermata del secondo fattore: verifica', () => {
  beforeEach(() => {
    secondFactor = 'verification_required';
  });

  it('verifica il codice senza chiedere né mostrare la chiave', async () => {
    apiMock.mockResolvedValue({ ok: true });
    renderWithDensity(<SecondoFattorePage />);

    expect(screen.queryByRole('button', { name: 'Mostra la chiave' })).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Codice di 6 cifre'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verifica' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(apiMock).toHaveBeenCalledWith('/auth/second-factor/verify', {
      method: 'POST',
      body: { code: '654321' },
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('un codice sbagliato lascia sulla schermata, con il messaggio e il campo vuoto', async () => {
    apiMock.mockRejectedValue(
      new ApiError(403, 'INVALID_SECOND_FACTOR_CODE', 'Codice non corretto.'),
    );
    renderWithDensity(<SecondoFattorePage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Codice di 6 cifre'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verifica' }));

    expect(await screen.findByText('Codice non corretto.')).toBeInTheDocument();
    expect(screen.getByLabelText('Codice di 6 cifre')).toHaveValue('');
    expect(replace).not.toHaveBeenCalled();
  });

  it('dice a chi ha perso il telefono che la reimpostazione è del manutentore (DR-397)', () => {
    renderWithDensity(<SecondoFattorePage />);
    expect(
      screen.getByText(/chiedi al manutentore di reimpostare il secondo fattore/),
    ).toBeVisible();
  });

  it('permette di uscire', async () => {
    renderWithDensity(<SecondoFattorePage />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Esci' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/accesso'));
    expect(signOut).toHaveBeenCalled();
  });
});

describe('rinvii verso il secondo fattore', () => {
  it('senza sessione la schermata manda all’accesso, a secondo fattore verificato alla radice', () => {
    hasUser = false;
    const { unmount } = renderWithDensity(<SecondoFattorePage />);
    expect(replace).toHaveBeenCalledWith('/accesso');
    unmount();

    replace.mockReset();
    hasUser = true;
    secondFactor = 'verified';
    renderWithDensity(<SecondoFattorePage />);
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('la radice manda al secondo fattore prima che al cambio della password', () => {
    mustChangePassword = true;
    renderWithDensity(<Home />);
    expect(replace).toHaveBeenCalledWith('/secondo-fattore');
  });

  it('dopo la password, l’accesso manda al secondo fattore', async () => {
    hasUser = false;
    signIn.mockResolvedValue({ ...sessionUser(), mustChangePassword: true });
    renderWithDensity(<AccessoPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Indirizzo di posta'), 'redazione@esempio.invalid');
    await user.type(screen.getByLabelText('Password'), 'password-inventata-di-prova');
    await user.click(screen.getByRole('button', { name: 'Entra' }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/secondo-fattore'));
    expect(replace).not.toHaveBeenCalledWith('/password');
  });

  it('cambio password, scelta dell’area e guscio delle aree mandano al secondo fattore', () => {
    secondFactor = 'verification_required';
    mustChangePassword = true;
    const password = renderWithDensity(<PasswordPage />);
    expect(replace).toHaveBeenLastCalledWith('/secondo-fattore');
    password.unmount();

    replace.mockReset();
    const choice = renderWithDensity(<SceltaAreaPage />);
    expect(replace).toHaveBeenLastCalledWith('/secondo-fattore');
    choice.unmount();

    replace.mockReset();
    renderWithDensity(
      <AreaShell area="redazione" sectionId="pagine" breadcrumbs={[{ label: 'Pagine' }]}>
        <p>contenuto riservato</p>
      </AreaShell>,
    );
    expect(replace).toHaveBeenLastCalledWith('/secondo-fattore');
    expect(screen.queryByText('contenuto riservato')).not.toBeInTheDocument();
  });

  it('con il secondo fattore verificato il cambio password obbligatorio resta il passo seguente', () => {
    secondFactor = 'verified';
    mustChangePassword = true;
    renderWithDensity(<Home />);
    expect(replace).toHaveBeenCalledWith('/password');
  });
});
