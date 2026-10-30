import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W7, T2g (DR-280): nella schermata «Categorie» si cambiano descrizione,
 * categoria genitrice e SEO dell'archivio, e si elimina con conferma scrivendo il
 * nome, con il rifiuto spiegato. Nomi, slug e testi sono inventati.
 */

const apiMock = vi.fn();
let permissions: string[] = ['content.read', 'content.write', 'content.publish'];

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

const MADRE = {
  id: '11111111-1111-4111-8111-111111111111',
  taxonomy: 'category',
  slug: 'madre-di-prova',
  name: 'Madre di prova',
  description: null,
  parentId: null,
  position: 0,
  path: '/category/madre-di-prova/',
  contentCount: 2,
};
const FIGLIA = {
  id: '22222222-2222-4222-8222-222222222222',
  taxonomy: 'category',
  slug: 'figlia-di-prova',
  name: 'Figlia di prova',
  description: 'Descrizione sintetica.',
  parentId: MADRE.id,
  position: 1,
  path: '/category/madre-di-prova/figlia-di-prova/',
  contentCount: 0,
};
const ALTRA = {
  id: '33333333-3333-4333-8333-333333333333',
  taxonomy: 'category',
  slug: 'altra-di-prova',
  name: 'Altra di prova',
  description: null,
  parentId: null,
  position: 2,
  path: '/category/altra-di-prova/',
  contentCount: 0,
};
const CATEGORIES = [MADRE, FIGLIA, ALTRA];
const SEO_VUOTA = (termId: string) => ({
  termId,
  title: null,
  description: null,
  robotsNoindex: false,
  robotsNofollow: false,
  updatedAt: null,
});

type Handler = (path: string, options?: { method?: string; body?: unknown }) => unknown;

function routes(extra: Handler = () => undefined): void {
  apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    const answer = await extra(path, options);
    if (answer !== undefined) return answer;
    if (path === '/terms?taxonomy=category' && !options?.method) return CATEGORIES;
    const seo = /^\/terms\/([^/]+)\/seo$/.exec(path);
    if (seo && !options?.method) return SEO_VUOTA(seo[1] ?? '');
    throw new Error(`chiamata non prevista: ${path}`);
  });
}

function writesTo(method: string): unknown[][] {
  return apiMock.mock.calls.filter((call) => (call[1] as { method?: string })?.method === method);
}

beforeEach(() => {
  apiMock.mockReset();
  permissions = ['content.read', 'content.write', 'content.publish'];
  routes();
});

function renderScreen(): void {
  render(
    <DensityProvider>
      <CategoryManager />
    </DensityProvider>,
  );
}

async function openEdit(name: RegExp) {
  const user = userEvent.setup();
  renderScreen();
  const riga = await screen.findByRole('row', { name });
  await user.click(within(riga).getByRole('button', { name: 'Modifica' }));
  const dialogo = await screen.findByRole('dialog');
  await waitFor(() => expect(within(dialogo).getByLabelText('Titolo SEO')).toBeInTheDocument());
  return { user, dialogo };
}

describe('«Modifica»: descrizione e categoria genitrice', () => {
  it('la genitrice si sceglie fra le altre categorie, senza sé stessa né le discendenti', async () => {
    const { dialogo } = await openEdit(/Madre di prova/);
    const scelta = within(dialogo).getByLabelText('Categoria genitrice');
    const opzioni = within(scelta)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(opzioni).toEqual(['Nessuna: primo livello', 'Altra di prova']);
  });

  it('W8-22: «Categoria genitrice» spiega che le categorie che stanno sotto questa non compaiono', async () => {
    const { dialogo } = await openEdit(/Madre di prova/);
    expect(within(dialogo).getByLabelText('Categoria genitrice')).toHaveAccessibleDescription(
      'Le categorie che stanno sotto questa non compaiono: una categoria non può avere come genitrice una sua discendente.',
    );
  });

  it('salva la descrizione con un PATCH dei soli campi cambiati', async () => {
    routes((path, options) =>
      path === `/terms/${MADRE.id}` && options?.method === 'PATCH' ? MADRE : undefined,
    );
    const { user, dialogo } = await openEdit(/Madre di prova/);
    await user.type(within(dialogo).getByLabelText('Descrizione'), 'Testo nuovo');
    await user.click(within(dialogo).getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(writesTo('PATCH')).toHaveLength(1));
    expect(writesTo('PATCH')[0]).toEqual([
      `/terms/${MADRE.id}`,
      { method: 'PATCH', body: { description: 'Testo nuovo' } },
    ]);
    expect(writesTo('PUT')).toHaveLength(0);
  });

  it('cambiare la genitrice mostra il nuovo indirizzo e il redirect 301, poi manda parentId', async () => {
    routes((path, options) =>
      path === `/terms/${ALTRA.id}` && options?.method === 'PATCH' ? ALTRA : undefined,
    );
    const { user, dialogo } = await openEdit(/Altra di prova/);
    await user.selectOptions(within(dialogo).getByLabelText('Categoria genitrice'), MADRE.id);
    expect(
      within(dialogo).getByText('/category/madre-di-prova/altra-di-prova/'),
    ).toBeInTheDocument();
    expect(within(dialogo).getByText(/redirect 301/)).toBeInTheDocument();

    await user.click(within(dialogo).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(writesTo('PATCH')).toHaveLength(1));
    expect(writesTo('PATCH')[0]?.[1]).toEqual({ method: 'PATCH', body: { parentId: MADRE.id } });
  });

  it('riportare una figlia al primo livello manda parentId null', async () => {
    routes((path, options) =>
      path === `/terms/${FIGLIA.id}` && options?.method === 'PATCH' ? FIGLIA : undefined,
    );
    const { user, dialogo } = await openEdit(/Figlia di prova/);
    await user.selectOptions(within(dialogo).getByLabelText('Categoria genitrice'), '');
    await user.click(within(dialogo).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(writesTo('PATCH')).toHaveLength(1));
    expect(writesTo('PATCH')[0]?.[1]).toEqual({ method: 'PATCH', body: { parentId: null } });
  });

  it('il rifiuto dell’API è mostrato in italiano', async () => {
    routes((path, options) => {
      if (path === `/terms/${ALTRA.id}` && options?.method === 'PATCH') {
        throw new ApiError(
          409,
          'REDIRECT_AT_DESTINATION',
          'L’indirizzo è l’origine di un redirect manuale.',
        );
      }
      return undefined;
    });
    const { user, dialogo } = await openEdit(/Altra di prova/);
    await user.selectOptions(within(dialogo).getByLabelText('Categoria genitrice'), MADRE.id);
    await user.click(within(dialogo).getByRole('button', { name: 'Salva' }));
    expect(await within(dialogo).findByText(/origine di un redirect manuale/)).toBeInTheDocument();
  });
});

describe('«Modifica»: SEO dell’archivio', () => {
  it('titolo e indicizzazione si salvano con un PUT dei soli campi cambiati', async () => {
    routes((path, options) =>
      path === `/terms/${MADRE.id}/seo` && options?.method === 'PUT'
        ? SEO_VUOTA(MADRE.id)
        : undefined,
    );
    const { user, dialogo } = await openEdit(/Madre di prova/);
    await user.type(within(dialogo).getByLabelText('Titolo SEO'), 'Titolo sintetico');
    await user.click(within(dialogo).getByLabelText('Non indicizzare'));
    await user.click(within(dialogo).getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(writesTo('PUT')).toHaveLength(1));
    expect(writesTo('PUT')[0]).toEqual([
      `/terms/${MADRE.id}/seo`,
      { method: 'PUT', body: { title: 'Titolo sintetico', robotsNoindex: true } },
    ]);
    expect(writesTo('PATCH')).toHaveLength(0);
  });
});

describe('«Elimina»', () => {
  it('se qualcosa la trattiene, spiega che cosa e non chiede conferma', async () => {
    const user = userEvent.setup();
    routes((path) =>
      path === `/terms/${MADRE.id}/deletion`
        ? {
            blocked: true,
            contentCount: 2,
            children: [{ id: FIGLIA.id, name: FIGLIA.name, path: FIGLIA.path }],
            menuItems: [{ id: 'v1', label: 'Voce sintetica', menu: 'Menu sintetico' }],
            redirectsToPath: [],
          }
        : undefined,
    );
    renderScreen();
    const riga = await screen.findByRole('row', { name: /Madre di prova/ });
    await user.click(within(riga).getByRole('button', { name: 'Elimina' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Non si può eliminare' });
    expect(within(dialogo).getByText(/ha 2 notizie/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/Figlia di prova/)).toBeInTheDocument();
    expect(
      within(dialogo).getByText(/Voce sintetica, nel menu Menu sintetico/),
    ).toBeInTheDocument();
    expect(writesTo('DELETE')).toHaveLength(0);
  });

  it('libera: si conferma scrivendo il nome, poi DELETE e l’elenco si ricarica', async () => {
    const user = userEvent.setup();
    routes((path, options) => {
      if (path === `/terms/${ALTRA.id}/deletion`) {
        return {
          blocked: false,
          contentCount: 0,
          children: [],
          menuItems: [],
          redirectsToPath: [{ source: '/vecchio-sintetico/' }],
        };
      }
      if (path === `/terms/${ALTRA.id}` && options?.method === 'DELETE') return null;
      return undefined;
    });
    renderScreen();
    const riga = await screen.findByRole('row', { name: /Altra di prova/ });
    await user.click(within(riga).getByRole('button', { name: 'Elimina' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Elimina la categoria' });
    expect(within(dialogo).getByText(/pagina non trovata/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/\/vecchio-sintetico\//)).toBeInTheDocument();
    const conferma = within(dialogo).getByRole('button', { name: 'Elimina definitivamente' });
    expect(conferma).toBeDisabled();
    await user.type(
      within(dialogo).getByLabelText('Digita «Altra di prova» per confermare'),
      'Altra di prova',
    );
    await user.click(conferma);

    await waitFor(() => expect(writesTo('DELETE')).toHaveLength(1));
    expect(writesTo('DELETE')[0]).toEqual([`/terms/${ALTRA.id}`, { method: 'DELETE' }]);
    await waitFor(() =>
      expect(
        apiMock.mock.calls.filter((call) => call[0] === '/terms?taxonomy=category'),
      ).toHaveLength(2),
    );
  });

  it('con il solo content.read non ci sono «Modifica» né «Elimina»', async () => {
    permissions = ['content.read'];
    renderScreen();
    await screen.findByRole('row', { name: /Madre di prova/ });
    expect(screen.queryByRole('button', { name: 'Modifica' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elimina' })).not.toBeInTheDocument();
  });
});

describe('giro 1: permesso di pubblicare e avvisi D132-A', () => {
  it('senza content.publish la genitrice non si cambia ed «Elimina» non c’è', async () => {
    permissions = ['content.read', 'content.write'];
    const { dialogo } = await openEdit(/Altra di prova/);
    expect(within(dialogo).getByLabelText('Categoria genitrice')).toBeDisabled();
    expect(
      within(dialogo).getByText('Per spostare una categoria serve il permesso di pubblicare.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Elimina' })).not.toBeInTheDocument();
  });

  it('dopo uno spostamento mostra i riferimenti scritti a mano che non cambiano', async () => {
    routes((path, options) =>
      path === `/terms/${ALTRA.id}` && options?.method === 'PATCH'
        ? {
            ...ALTRA,
            warnings: [
              { kind: 'canonical', id: 'c1', value: '/category/altra-di-prova/' },
              { kind: 'menu', id: 'm1', value: '/category/altra-di-prova/' },
            ],
          }
        : undefined,
    );
    const { user, dialogo } = await openEdit(/Altra di prova/);
    await user.selectOptions(within(dialogo).getByLabelText('Categoria genitrice'), MADRE.id);
    await user.click(within(dialogo).getByRole('button', { name: 'Salva' }));

    const avviso = await screen.findByRole('region', {
      name: 'Riferimenti scritti a mano che non cambiano',
    });
    expect(
      within(avviso).getByText(
        'L’indirizzo canonico di un contenuto indica ancora /category/altra-di-prova/.',
      ),
    ).toBeInTheDocument();
    expect(
      within(avviso).getByText(
        'Una voce di menu personalizzata indica ancora /category/altra-di-prova/.',
      ),
    ).toBeInTheDocument();
  });
});
