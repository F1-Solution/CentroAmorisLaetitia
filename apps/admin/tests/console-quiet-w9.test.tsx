import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import type { CurrentUser } from '../src/lib/session';
import { syntheticContent } from './fixtures';

/**
 * Wave 1G-W9, T8 — criterio 1G-24: nessun errore in console per risposte attese.
 *
 * W8-09: l'API ora dice l'assenza di copia di lavoro e di sovrascrittura SEO con
 * `204` senza corpo, che il client consegna come `undefined`. Prima l'area
 * leggeva quell'`undefined` come se fosse la riga, e l'editor non si apriva («Il
 * contenuto non si apre») o la scheda SEO mostrava un errore: queste prove lo
 * fissano.
 *
 * W8-32: le schermate di Impostazioni caricavano i dati (`GET /accounts`,
 * `GET /audit…`, `GET /settings`) mentre il guscio dell'area decideva ancora il
 * rinvio, e chi entrava da Redazione o senza accesso si vedeva due rifiuti 401 o
 * 403 in console. Ora la pagina non monta la schermata finché il guscio non l'ha
 * ammessa: nessuna chiamata parte.
 */

const apiMock = vi.fn();
const replace = vi.fn();

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

const redazione: CurrentUser = {
  userId: 'u1',
  email: 'redazione@esempio.invalid',
  fullName: 'Redattrice di prova',
  mustChangePassword: false,
  secondFactor: 'verified',
  permissions: ['content.read', 'content.write', 'content.publish'],
  activeRoleId: 'r1',
  activeArea: 'redazione',
  rolesHeld: [{ roleId: 'r1', key: 'redazione', label: 'Redazione', areas: ['redazione'] }],
};

const impostazioni: CurrentUser = {
  userId: 'u2',
  email: 'amministrazione@esempio.invalid',
  fullName: 'Amministratrice di prova',
  mustChangePassword: false,
  secondFactor: 'verified',
  permissions: ['audit.read', 'site.settings.write', 'users.manage'],
  activeRoleId: 'r2',
  activeArea: 'impostazioni',
  rolesHeld: [
    { roleId: 'r2', key: 'amministrazione', label: 'Amministrazione', areas: ['impostazioni'] },
  ],
};

/** La sessione simulata: ogni prova la sceglie prima di rendere. */
const session: { user: CurrentUser | null; loading: boolean } = { user: redazione, loading: false };

vi.mock('../src/lib/session', async () => {
  const actual = await vi.importActual<typeof SessionModule>('../src/lib/session');
  return {
    ...actual,
    useSession: () => ({
      user: session.user,
      loading: session.loading,
      signIn: vi.fn(),
      signOut: vi.fn(),
      chooseVestment: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

const { ContentEditor } = await import('../src/components/editor/ContentEditor');
const { ContentSeoPanel } = await import('../src/components/editor/ContentSeoPanel');
const { default: ImpostazioniPage } = await import('../src/app/impostazioni/page');
const { default: PersonePage } = await import('../src/app/impostazioni/persone/page');
const { default: RegistroPage } = await import('../src/app/impostazioni/registro/page');

beforeEach(() => {
  apiMock.mockReset();
  replace.mockReset();
  session.user = redazione;
  session.loading = false;
});

describe('W8-09: l’assenza detta con 204 non è un errore', () => {
  it('l’editor si apre quando il contenuto non ha copia di lavoro (204)', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) return Promise.resolve(syntheticContent);
      // `204`: il client restituisce `undefined`.
      return Promise.resolve(undefined);
    });
    render(
      <DensityProvider>
        <ContentEditor
          contentId={syntheticContent.id}
          sectionId="pagine"
          listHref="/redazione/pagine"
          listLabel="Pagine"
        />
      </DensityProvider>,
    );

    const tree = await screen.findByRole('region', { name: 'Struttura del contenuto' });
    await waitFor(() => {
      expect(within(tree).getByText(/Primo paragrafo di prova\./)).toBeInTheDocument();
    });
    expect(
      apiMock.mock.calls.some((call) => call[0] === `/contents/${syntheticContent.id}/draft`),
    ).toBe(true);
    expect(screen.queryByText('Il contenuto non si apre')).not.toBeInTheDocument();
    expect(screen.queryByText(/copia di lavoro/i)).not.toBeInTheDocument();
  });

  it('la scheda SEO senza sovrascrittura (204) usa i template globali, senza errore', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === '/seo/contents/c1') return Promise.resolve(undefined);
      return Promise.resolve({ items: [] });
    });
    render(
      <DensityProvider>
        <ContentSeoPanel contentId="c1" path="/pagina-inventata/" disabled={false} />
      </DensityProvider>,
    );

    expect(await screen.findByText(/usa i template globali/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Caricamento dei metadati in corso…')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Non è stato possibile')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Titolo SEO/)).toHaveValue('');
  });
});

const SETTINGS_PAGES = [
  ['Impostazioni del sito', ImpostazioniPage],
  ['Persone e permessi', PersonePage],
  ['Registro delle operazioni', RegistroPage],
] as const;

describe('W8-32: le schermate di Impostazioni non chiamano l’API prima del rinvio', () => {
  for (const [name, Page] of SETTINGS_PAGES) {
    it(`${name}: da Redazione nessuna chiamata, e si manda a scegliere l’area`, async () => {
      apiMock.mockResolvedValue({ items: [] });
      render(
        <DensityProvider>
          <Page />
        </DensityProvider>,
      );
      await waitFor(() => expect(replace).toHaveBeenCalled());
      expect(apiMock).not.toHaveBeenCalled();
    });

    it(`${name}: senza accesso nessuna chiamata, e si manda all’accesso`, async () => {
      session.user = null;
      apiMock.mockResolvedValue({ items: [] });
      render(
        <DensityProvider>
          <Page />
        </DensityProvider>,
      );
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/accesso'));
      expect(apiMock).not.toHaveBeenCalled();
    });

    it(`${name}: mentre la sessione si legge ancora nessuna chiamata`, async () => {
      session.user = null;
      session.loading = true;
      apiMock.mockResolvedValue({ items: [] });
      render(
        <DensityProvider>
          <Page />
        </DensityProvider>,
      );
      // Un giro di microtask basta perché un effetto di caricamento partirebbe.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(apiMock).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    });

    it(`${name}: da Impostazioni la schermata carica i suoi dati`, async () => {
      session.user = impostazioni;
      apiMock.mockResolvedValue({ items: [] });
      render(
        <DensityProvider>
          <Page />
        </DensityProvider>,
      );
      await waitFor(() => expect(apiMock).toHaveBeenCalled());
      expect(replace).not.toHaveBeenCalled();
    });
  }
});
