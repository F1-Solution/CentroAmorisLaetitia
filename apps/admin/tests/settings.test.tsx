import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Il criterio 1D-35 **eseguito nella schermata**: modificare le impostazioni
 * globali.
 *
 * Due cose si verificano oltre al salvataggio: che il campo **si deduca dal
 * valore** — spunta per un booleano, testo per una stringa — e che
 * un'impostazione riservata non mostri né lasci modificare il suo valore.
 *
 * Tutte le impostazioni sono inventate.
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
        email: 'direzione@esempio.invalid',
        fullName: 'Impostazioni di prova',
        mustChangePassword: false,
        permissions: ['content.read', 'settings.write'],
        activeRoleId: 'r1',
        activeArea: 'impostazioni',
        rolesHeld: [
          { roleId: 'r1', key: 'impostazioni', label: 'Impostazioni', areas: ['impostazioni'] },
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

const { SiteSettings, textOf, valueFrom } = await import('../src/components/settings/SiteSettings');

const impostazioni = [
  {
    key: 'site.title',
    value: 'Sito inventato',
    label: 'Titolo del sito',
    description: 'Compare nella scheda del browser.',
    isSecret: false,
    updatedAt: '2026-01-10T10:00:00.000Z',
  },
  {
    key: 'seo.sitemap_enabled',
    value: true,
    label: 'Sitemap attiva',
    description: null,
    isSecret: false,
    updatedAt: '2026-01-10T10:00:00.000Z',
  },
  {
    key: 'content.posts_per_page',
    value: 10,
    label: 'Articoli per pagina',
    description: null,
    isSecret: false,
    updatedAt: '2026-01-10T10:00:00.000Z',
  },
  {
    key: 'analytics.token_inventato',
    value: null,
    label: 'Valore riservato inventato',
    description: null,
    isSecret: true,
    updatedAt: '2026-01-10T10:00:00.000Z',
  },
];

function writes(): { path: string; options: { method?: string; body?: unknown } }[] {
  return apiMock.mock.calls
    .filter((call) => (call[1] as { method?: string } | undefined)?.method !== undefined)
    .map((call) => ({ path: call[0] as string, options: call[1] as { method?: string } }));
}

function renderSettings() {
  return render(
    <DensityProvider>
      <SiteSettings />
    </DensityProvider>,
  );
}

describe('impostazioni globali', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === '/settings') return Promise.resolve(impostazioni);
      return Promise.resolve({});
    });
  });

  it('il campo si deduce dal valore', async () => {
    renderSettings();
    expect(await screen.findByLabelText('Titolo del sito')).toHaveValue('Sito inventato');
    expect(screen.getByRole('checkbox', { name: 'Sitemap attiva' })).toBeChecked();
    expect(screen.getByLabelText('Articoli per pagina')).toHaveValue('10');
  });

  it('un valore riservato non si mostra e non si modifica', async () => {
    renderSettings();
    await screen.findByLabelText('Titolo del sito');
    expect(screen.queryByLabelText('Valore riservato inventato')).not.toBeInTheDocument();
    expect(screen.getByText(/Il valore è riservato/)).toBeInTheDocument();
  });

  it('modifica una stringa', async () => {
    const user = userEvent.setup();
    renderSettings();
    const campo = await screen.findByLabelText('Titolo del sito');
    await user.clear(campo);
    await user.type(campo, 'Altro nome inventato');
    await user.click(screen.getByRole('button', { name: 'Salva «Titolo del sito»' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/settings/site.title',
        options: { method: 'PUT', body: { value: 'Altro nome inventato' } },
      });
    });
  });

  it('modifica un booleano, e manda un booleano', async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByLabelText('Titolo del sito');
    await user.click(screen.getByRole('checkbox', { name: 'Sitemap attiva' }));
    await user.click(screen.getByRole('button', { name: 'Salva «Sitemap attiva»' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/settings/seo.sitemap_enabled',
        options: { method: 'PUT', body: { value: false } },
      });
    });
  });

  it('modifica un numero, e manda un numero', async () => {
    const user = userEvent.setup();
    renderSettings();
    const campo = await screen.findByLabelText('Articoli per pagina');
    await user.clear(campo);
    await user.type(campo, '25');
    await user.click(screen.getByRole('button', { name: 'Salva «Articoli per pagina»' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/settings/content.posts_per_page',
        options: { method: 'PUT', body: { value: 25 } },
      });
    });
  });
});

describe('conversione del valore', () => {
  it('una stringa resta una stringa, anche se somiglia a JSON', () => {
    expect(valueFrom('qualcosa', '[1, 2]')).toBe('[1, 2]');
  });

  it('un oggetto si rilegge come oggetto', () => {
    expect(valueFrom({ a: 1 }, '{"a": 2}')).toEqual({ a: 2 });
  });

  it('un testo che non è JSON, dove JSON serviva, risale come errore', () => {
    expect(() => valueFrom({ a: 1 }, 'non è json')).toThrow();
  });

  it('il testo mostrato per un oggetto è JSON leggibile', () => {
    expect(textOf({ a: 1 })).toContain('"a": 1');
  });
});
