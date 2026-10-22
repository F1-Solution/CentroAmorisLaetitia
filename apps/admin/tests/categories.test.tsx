import { DensityProvider } from '@amoris/ui';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W4, T5: schermata «Categorie» in Redazione (S5, S6, D140-A, DR-057).
 * Nomi, slug e notizie sono inventati.
 */

const apiMock = vi.fn();
let permissions: string[] = ['content.read', 'content.write'];

const { ApiError } = await vi.importActual<typeof ApiModule>('../src/lib/api');

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
        fullName: 'Redazione di prova',
        mustChangePassword: false,
        permissions,
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

const { CategoryManager } = await import('../src/components/terms/CategoryManager');
const { AREA_DEFINITIONS } = await import('../src/lib/areas');

const CATEGORIES = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    taxonomy: 'category',
    slug: 'incontri-di-prova',
    name: 'Incontri di prova',
    description: null,
    parentId: null,
    position: 0,
    path: '/category/incontri-di-prova/',
    contentCount: 3,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    taxonomy: 'category',
    slug: 'senza-categoria-di-prova',
    name: 'Senza categoria di prova',
    description: null,
    parentId: null,
    position: 1,
    path: '/category/senza-categoria-di-prova/',
    contentCount: 0,
  },
];

/** Il file della pagina di un indirizzo, a partire da questo file di prova e non dalla cartella di lancio. */
function paginaDi(href: string): string {
  return resolve(__dirname, '../src/app', href.replace(/^\//, ''), 'page.tsx');
}

function writesTo(method: string): unknown[][] {
  return apiMock.mock.calls.filter((call) => (call[1] as { method?: string })?.method === method);
}

beforeEach(() => {
  apiMock.mockReset();
  permissions = ['content.read', 'content.write'];
  apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path === '/terms?taxonomy=category' && !options?.method) return CATEGORIES;
    throw new Error(`chiamata non prevista: ${path}`);
  });
});

function renderScreen(): void {
  render(
    <DensityProvider>
      <CategoryManager />
    </DensityProvider>,
  );
}

describe('schermata Categorie', () => {
  it('elenca solo le categorie, con nome, indirizzo e numero di notizie', async () => {
    renderScreen();

    const riga = await screen.findByRole('row', { name: /Incontri di prova/ });
    expect(within(riga).getByText('/category/incontri-di-prova/')).toBeInTheDocument();
    expect(within(riga).getByText('3')).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith('/terms?taxonomy=category', undefined);
  });

  it('con il solo content.read non mostra «Nuova categoria» né «Rinomina» (DR-057)', async () => {
    permissions = ['content.read'];
    renderScreen();

    await screen.findByRole('row', { name: /Incontri di prova/ });
    expect(screen.queryByRole('button', { name: 'Nuova categoria' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rinomina' })).not.toBeInTheDocument();
  });

  it('propone lo slug dal nome, lo lascia correggere e crea con il corpo previsto', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/terms?taxonomy=category' && !options?.method) return CATEGORIES;
      if (path === '/terms' && options?.method === 'POST') {
        return { id: '33333333-3333-4333-8333-333333333333' };
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Nuova categoria' }));
    await user.type(screen.getByLabelText('Nome'), 'Età & famiglia');
    expect(screen.getByLabelText('Indirizzo')).toHaveValue('eta-famiglia');

    await user.clear(screen.getByLabelText('Indirizzo'));
    await user.type(screen.getByLabelText('Indirizzo'), 'eta-e-famiglia');
    await user.click(screen.getByRole('button', { name: 'Crea categoria' }));

    await waitFor(() => expect(writesTo('POST')).toHaveLength(1));
    expect(writesTo('POST')[0]).toEqual([
      '/terms',
      {
        method: 'POST',
        body: { taxonomy: 'category', name: 'Età & famiglia', slug: 'eta-e-famiglia' },
      },
    ]);
  });

  it('uno slug corretto a mano non si riscrive quando poi cambia il nome', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/terms?taxonomy=category' && !options?.method) return CATEGORIES;
      if (path === '/terms' && options?.method === 'POST') {
        return { id: '33333333-3333-4333-8333-333333333333' };
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Nuova categoria' }));
    await user.type(screen.getByLabelText('Nome'), 'Incontri');
    await user.clear(screen.getByLabelText('Indirizzo'));
    await user.type(screen.getByLabelText('Indirizzo'), 'incontri-corretti');
    await user.type(screen.getByLabelText('Nome'), ' di prova');
    expect(screen.getByLabelText('Indirizzo')).toHaveValue('incontri-corretti');

    await user.click(screen.getByRole('button', { name: 'Crea categoria' }));
    await waitFor(() => expect(writesTo('POST')).toHaveLength(1));
    expect(writesTo('POST')[0]?.[1]).toEqual({
      method: 'POST',
      body: { taxonomy: 'category', name: 'Incontri di prova', slug: 'incontri-corretti' },
    });
  });

  it('un indirizzo già usato è spiegato in italiano accanto al campo, con 409 e non 500', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/terms?taxonomy=category' && !options?.method) return CATEGORIES;
      if (path === '/terms' && options?.method === 'POST') {
        throw new ApiError(
          409,
          'TERM_SLUG_TAKEN',
          'Esiste già un termine con questo indirizzo: scegline un altro.',
        );
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Nuova categoria' }));
    await user.type(screen.getByLabelText('Nome'), 'Incontri di prova');
    await user.click(screen.getByRole('button', { name: 'Crea categoria' }));

    const slug = screen.getByLabelText('Indirizzo');
    await waitFor(() => expect(slug).toHaveAttribute('aria-invalid', 'true'));
    expect(
      screen.getByText('Esiste già un termine con questo indirizzo: scegline un altro.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/500|INTERNAL_ERROR/)).not.toBeInTheDocument();
  });

  it('un indirizzo non valido è spiegato accanto al campo Indirizzo', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/terms?taxonomy=category' && !options?.method) return CATEGORIES;
      if (path === '/terms' && options?.method === 'POST') {
        throw new ApiError(400, 'VALIDATION_FAILED', 'La richiesta non è valida.', [
          { path: '/slug', message: 'lo slug contiene caratteri non ammessi nel percorso' },
        ]);
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Nuova categoria' }));
    await user.type(screen.getByLabelText('Nome'), 'Prova');
    await user.click(screen.getByRole('button', { name: 'Crea categoria' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Indirizzo')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(
      screen.getByText('lo slug contiene caratteri non ammessi nel percorso'),
    ).toBeInTheDocument();
  });

  it('«Rinomina» cambia solo il nome: lo slug non è un campo modificabile (D140-A)', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/terms?taxonomy=category' && !options?.method) return CATEGORIES;
      if (path === `/terms/${CATEGORIES[0]!.id}` && options?.method === 'PATCH') {
        return { ...CATEGORIES[0], name: 'Incontri di prova rinnovati' };
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    renderScreen();

    const riga = await screen.findByRole('row', { name: /Incontri di prova/ });
    await user.click(within(riga).getByRole('button', { name: 'Rinomina' }));

    const dialogo = screen.getByRole('dialog');
    const nome = within(dialogo).getByLabelText('Nome');
    expect(nome).toHaveValue('Incontri di prova');
    expect(within(dialogo).queryByLabelText('Indirizzo')).not.toBeInTheDocument();
    expect(within(dialogo).getByText('/category/incontri-di-prova/')).toBeInTheDocument();

    await user.clear(nome);
    await user.type(nome, 'Incontri di prova rinnovati');
    await user.click(screen.getByRole('button', { name: 'Salva il nome' }));

    await waitFor(() => expect(writesTo('PATCH')).toHaveLength(1));
    expect(writesTo('PATCH')[0]).toEqual([
      `/terms/${CATEGORIES[0]!.id}`,
      { method: 'PATCH', body: { name: 'Incontri di prova rinnovati' } },
    ]);
  });
});

describe('voce di navigazione (1G-20)', () => {
  it('«Categorie» sta nel gruppo Contenuti di Redazione e punta a una pagina esistente', () => {
    const contenuti = AREA_DEFINITIONS.redazione.groups.find((group) => group.id === 'contenuti');
    const voce = contenuti?.sections.find((section) => section.href === '/redazione/categorie');

    expect(voce).toMatchObject({ label: 'Categorie', href: '/redazione/categorie' });
    expect(statSync(paginaDi('/redazione/categorie')).isFile()).toBe(true);
  });

  it('ogni voce di Redazione ha la sua pagina sotto src/app', () => {
    for (const { sections } of AREA_DEFINITIONS.redazione.groups) {
      for (const { href } of sections) {
        expect(existsSync(paginaDi(href)), href).toBe(true);
      }
    }
  });
});
