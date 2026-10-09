import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * I criteri 1D-33 e 1D-34 **eseguiti nelle schermate**: i template SEO globali
 * e i redirect stanno in «SEO e indirizzi»; la SEO del singolo contenuto sta
 * dentro l'editor del contenuto (DR-076) e si verifica lì.
 *
 * Il caso che vale la pena verificare sulla SEO di un contenuto è il **404**:
 * un contenuto senza sovrascrittura è la normalità, non un guasto, e la
 * schermata deve dirlo con quelle parole.
 *
 * Indirizzi, titoli e note sono inventati.
 */

const apiMock = vi.fn();

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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
        permissions: ['content.read', 'content.write', 'settings.write'],
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

const { SeoAndRedirects } = await import('../src/components/seo/SeoAndRedirects');
const { ContentSeoPanel } = await import('../src/components/editor/ContentSeoPanel');

const template = {
  scope: 'page',
  titleTemplate: '{title} - {site_title}',
  descriptionTemplate: null,
  robotsDirectives: [],
  ogType: null,
  schemaType: null,
  updatedAt: '2026-01-10T10:00:00.000Z',
};

const redirect = {
  id: 'r1',
  sourcePath: '/indirizzo-inventato/',
  targetPath: '/pagina-inventata/',
  statusCode: 301,
  kind: 'exact' as const,
  origin: 'migration' as const,
  isActive: true,
  note: null,
  hitCount: 3,
  lastHitAt: null,
};

function writes(): { path: string; options: { method?: string; body?: unknown } }[] {
  return apiMock.mock.calls
    .filter((call) => (call[1] as { method?: string } | undefined)?.method !== undefined)
    .map((call) => ({ path: call[0] as string, options: call[1] as { method?: string } }));
}

function renderSection() {
  return render(
    <DensityProvider>
      <SeoAndRedirects />
    </DensityProvider>,
  );
}

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation((path: string) => {
    if (path === '/seo/templates') return Promise.resolve([template]);
    if (path.startsWith('/redirects')) {
      return Promise.resolve({ items: [redirect], meta: { total: 1, page: 1, perPage: 50 } });
    }
    if (path.startsWith('/media')) return Promise.resolve({ items: [] });
    return Promise.resolve({});
  });
});

describe('template SEO globali (criterio 1D-33)', () => {
  it('mostra i template e ne modifica uno', async () => {
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Pagine' }));
    const panel = screen.getByRole('dialog', { name: 'Pagine' });

    const campo = within(panel).getByLabelText(/Template del titolo/);
    await user.clear(campo);
    await user.type(campo, 'Titolo del sito inventato');
    await user.click(within(panel).getByRole('button', { name: 'Salva il template' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/seo/templates/page',
        options: {
          method: 'PUT',
          body: expect.objectContaining({ titleTemplate: 'Titolo del sito inventato' }) as unknown,
        },
      });
    });
  });
});

describe('redirect (criterio 1D-34)', () => {
  async function openRedirectTab() {
    const user = userEvent.setup();
    renderSection();
    await user.click(await screen.findByRole('tab', { name: 'Redirect' }));
    return user;
  }

  it('elenca i redirect con origine e stato', async () => {
    await openRedirectTab();
    const tabella = await screen.findByRole('table', { name: /Redirect/i });
    expect(within(tabella).getByText('/indirizzo-inventato/')).toBeInTheDocument();
    expect(within(tabella).getByText('Migrazione')).toBeInTheDocument();
    expect(within(tabella).getByText('Attivo')).toBeInTheDocument();
  });

  it('crea un redirect', async () => {
    const user = await openRedirectTab();
    await user.click(await screen.findByRole('button', { name: 'Nuovo redirect' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuovo redirect' });

    await user.type(within(dialogo).getByLabelText(/Indirizzo di partenza/), '/vecchio/');
    await user.type(within(dialogo).getByLabelText(/Indirizzo di arrivo/), '/nuovo/');
    await user.click(within(dialogo).getByRole('button', { name: 'Crea il redirect' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/redirects',
        options: {
          method: 'POST',
          body: expect.objectContaining({
            sourcePath: '/vecchio/',
            targetPath: '/nuovo/',
            statusCode: 301,
          }) as unknown,
        },
      });
    });
  });

  it('disattiva un redirect senza eliminarlo', async () => {
    const user = await openRedirectTab();
    await user.click(await screen.findByRole('button', { name: '/indirizzo-inventato/' }));
    const panel = screen.getByRole('dialog', { name: '/indirizzo-inventato/' });

    await user.click(within(panel).getByRole('checkbox', { name: 'Attivo' }));
    await user.click(within(panel).getByRole('button', { name: 'Salva il redirect' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/redirects/r1',
        options: {
          method: 'PATCH',
          body: expect.objectContaining({ isActive: false }) as unknown,
        },
      });
    });
    // Nessuna eliminazione: spegnere e cancellare restano due gesti diversi.
    expect(writes().some((write) => write.options.method === 'DELETE')).toBe(false);
  });
});

describe('SEO di un contenuto, dentro l’editor (DR-076)', () => {
  function renderPanel() {
    return render(
      <DensityProvider>
        <ContentSeoPanel contentId="c1" path="/pagina-inventata/" disabled={false} />
      </DensityProvider>,
    );
  }

  it('un contenuto senza sovrascrittura non è un errore: vale il template globale', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === '/seo/contents/c1') {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Risorsa non trovata.'));
      }
      return Promise.resolve({ items: [] });
    });

    renderPanel();
    expect(await screen.findByText(/usa i template globali/)).toBeInTheDocument();
  });

  it('ciò che si scrive prima che i metadati arrivino non viene sovrascritto (DR-102)', async () => {
    // Il difetto del §3.1 di AUDIT.md: il pannello è modificabile mentre carica,
    // e la lettura sostituiva anche i campi già scritti. Ora tocca solo gli altri.
    let deliver: (row: unknown) => void = () => undefined;
    apiMock.mockImplementation((path: string) => {
      if (path === '/seo/contents/c1') {
        return new Promise((resolve) => {
          deliver = resolve;
        });
      }
      return Promise.resolve({ items: [] });
    });
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText('Caricamento dei metadati in corso…');

    await user.type(screen.getByLabelText(/Titolo SEO/), 'Titolo scritto subito');
    deliver({
      contentId: 'c1',
      title: 'Titolo dal servizio',
      description: 'Descrizione dal servizio',
      canonicalUrl: null,
      ogTitle: null,
      ogDescription: null,
      ogImageId: null,
      robotsNoindex: false,
      robotsNofollow: false,
      updatedAt: '2026-09-21T10:00:00.000Z',
    });

    await waitFor(() => {
      expect(screen.queryByText('Caricamento dei metadati in corso…')).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Titolo SEO/)).toHaveValue('Titolo scritto subito');
    expect(screen.getByLabelText(/Descrizione SEO/)).toHaveValue('Descrizione dal servizio');
  });

  it('salva titolo, descrizione e direttive del contenuto', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation((path: string) => {
      if (path === '/seo/contents/c1') {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Risorsa non trovata.'));
      }
      return Promise.resolve({ items: [] });
    });

    renderPanel();
    await screen.findByText(/usa i template globali/);

    await user.type(screen.getByLabelText(/Titolo SEO/), 'Titolo inventato');
    await user.type(screen.getByLabelText(/Descrizione SEO/), 'Descrizione inventata');
    await user.click(screen.getByRole('checkbox', { name: /Non indicizzare/ }));
    await user.click(screen.getByRole('button', { name: 'Salva i metadati SEO' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/seo/contents/c1',
        options: {
          method: 'PUT',
          body: expect.objectContaining({
            title: 'Titolo inventato',
            description: 'Descrizione inventata',
            robotsNoindex: true,
          }) as unknown,
        },
      });
    });
  });
});
