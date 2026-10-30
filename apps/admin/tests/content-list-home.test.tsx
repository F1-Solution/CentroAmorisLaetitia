import { DensityProvider } from '@amoris/ui';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * W8-24: nell'elenco delle pagine la pagina iniziale si riconosce anche con il titolo vuoto,
 * senza cambiare il titolo importato. Titoli e indirizzi sono inventati.
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
        email: 'redazione@esempio.invalid',
        fullName: 'Redattrice di prova',
        mustChangePassword: false,
        permissions: ['content.read', 'content.write', 'content.publish'],
        activeRoleId: 'r1',
        activeArea: 'redazione',
        rolesHeld: [{ roleId: 'r1', key: 'redazione', label: 'Redazione', areas: ['redazione'] }],
      },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      chooseVestment: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

const { ContentList } = await import('../src/components/ContentList');

const base = {
  type: 'page',
  status: 'published',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

describe('elenco delle pagine e pagina iniziale (W8-24)', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue({
      items: [
        { ...base, id: 'a1', title: '', path: '/home/', isHome: true },
        { ...base, id: 'a2', title: 'Pagina comune', path: '/pagina-comune/', isHome: false },
      ],
      meta: { total: 2, page: 1, perPage: 25 },
    });
  });

  it('la riga della pagina iniziale lo dice, e una pagina comune no', async () => {
    render(
      <DensityProvider>
        <ContentList
          type="page"
          sectionId="pagine"
          title="Pagine"
          summary="Le pagine del sito."
          searchLabel="Cerca una pagina"
          emptyText="Nessuna pagina."
          caption="Elenco delle pagine"
          basePath="/redazione/pagine"
          createLabel="Nuova pagina"
        />
      </DensityProvider>,
    );
    const home = await screen.findByRole('row', { name: /\/home\// });
    expect(within(home).getByText(/Pagina iniziale/)).toBeInTheDocument();
    const comune = screen.getByRole('row', { name: /Pagina comune/ });
    expect(within(comune).queryByText(/Pagina iniziale/)).toBeNull();
  });
});
