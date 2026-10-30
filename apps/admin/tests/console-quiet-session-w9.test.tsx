import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import { SessionProvider, useSession } from '../src/lib/session';

/**
 * Wave 1G-W9, T8 (W8-09, criterio 1G-24): sulla schermata di accesso
 * `GET /auth/me` ora risponde `204` senza corpo, e il client lo consegna come
 * `undefined`. La sessione deve leggerlo come «nessuna persona» — `null`, lo
 * stesso valore di prima — e non come una persona indefinita.
 */

const apiMock = vi.fn();

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

function Probe(): React.JSX.Element {
  const { user, loading } = useSession();
  if (loading) return <p>in lettura</p>;
  return <p>{user === null ? 'nessuna sessione' : `persona: ${String(user?.fullName)}`}</p>;
}

beforeEach(() => {
  apiMock.mockReset();
});

describe('sessione senza accesso', () => {
  it('204 da /auth/me vale «nessuna sessione»', async () => {
    apiMock.mockResolvedValue(undefined);
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText('nessuna sessione')).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith('/auth/me', undefined);
  });

  it('con la sessione la persona arriva', async () => {
    apiMock.mockResolvedValue({
      userId: 'u1',
      email: 'redazione@esempio.invalid',
      fullName: 'Redattrice di prova',
      mustChangePassword: false,
      permissions: [],
      activeRoleId: null,
      activeArea: null,
      rolesHeld: [],
    });
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText('persona: Redattrice di prova')).toBeInTheDocument();
  });
});
