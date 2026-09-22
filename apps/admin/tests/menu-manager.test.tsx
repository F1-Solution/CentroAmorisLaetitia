import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Il criterio 1D-32 **eseguito nella schermata**: aggiungere, spostare,
 * annidare, cambiare visibilità.
 *
 * Il punto più delicato è l'ultimo: i casi di visibilità sono **quattro**, e i
 * ruoli si scelgono soltanto nel caso che li usa. Scegliere ruoli su una voce
 * pubblica farebbe fallire il vincolo del database, e la schermata deve
 * rendere quella strada non percorribile invece di lasciarla percorrere e
 * riferire l'errore.
 *
 * Voci, contenuti e ruoli sono inventati.
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
        permissions: ['content.read', 'content.write'],
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

const { MenuManager } = await import('../src/components/menu/MenuManager');

const voce = (id: string, label: string, position: number, parentId: string | null = null) => ({
  id,
  menuId: 'menu1',
  parentId,
  position,
  kind: 'custom' as const,
  label,
  contentId: null,
  termId: null,
  url: `/${id}/`,
  linkTarget: null,
  cssClasses: null,
  visibility: 'public' as const,
  visibleToRoles: [] as string[],
});

let items = [voce('v1', 'Prima voce', 0), voce('v2', 'Seconda voce', 1)];

function renderManager() {
  return render(
    <DensityProvider>
      <MenuManager />
    </DensityProvider>,
  );
}

function writes(): { path: string; options: { method?: string; body?: unknown } }[] {
  return apiMock.mock.calls
    .filter((call) => (call[1] as { method?: string } | undefined)?.method !== undefined)
    .map((call) => ({ path: call[0] as string, options: call[1] as { method?: string } }));
}

describe('menu di navigazione', () => {
  beforeEach(() => {
    items = [voce('v1', 'Prima voce', 0), voce('v2', 'Seconda voce', 1)];
    apiMock.mockReset();
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/menus') return Promise.resolve([{ id: 'menu1', key: 'principale', label: 'Menu principale' }]);
      if (path.startsWith('/contents')) {
        return Promise.resolve({ items: [{ id: 'c1', title: 'Pagina inventata' }] });
      }
      if (path === '/terms') return Promise.resolve([{ id: 't1', name: 'Avvisi', taxonomy: 'category' }]);
      if (path === '/roles') {
        return Promise.resolve([
          { key: 'redazione', label: 'Redazione' },
          { key: 'segreteria', label: 'Segreteria' },
        ]);
      }
      if (path.startsWith('/menus/') && !options?.method) return Promise.resolve(items);
      return Promise.resolve({});
    });
  });

  it('mostra le voci del menu', async () => {
    renderManager();
    expect(await screen.findByRole('button', { name: /^Prima voce/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Seconda voce/ })).toBeInTheDocument();
  });

  it('annida una voce sotto quella che la precede', async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });

    await user.click(screen.getByRole('button', { name: 'Annida: Seconda voce' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/menu-items/v2',
        options: { method: 'PATCH', body: { parentId: 'v1', position: 0 } },
      });
    });
  });

  it('sposta una voce e scrive solo quelle che si sono mosse', async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });

    await user.click(screen.getByRole('button', { name: 'Sposta su: Seconda voce' }));

    await waitFor(() => expect(writes().length).toBe(2));
    expect(writes().map((write) => write.path).sort()).toEqual([
      '/menu-items/v1',
      '/menu-items/v2',
    ]);
  });

  it('aggiunge una voce che punta a un contenuto', async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });

    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    await user.type(within(dialogo).getByLabelText('Etichetta'), 'Voce nuova');
    await user.selectOptions(within(dialogo).getByLabelText('Contenuto'), 'c1');
    await user.click(within(dialogo).getByRole('button', { name: 'Aggiungi' }));

    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/menus/principale/items',
        options: {
          method: 'POST',
          body: { kind: 'content', label: 'Voce nuova', contentId: 'c1', position: 2 },
        },
      });
    });
  });

  describe('i quattro casi di visibilità', () => {
    async function openPanel() {
      const user = userEvent.setup();
      renderManager();
      await screen.findByRole('button', { name: /^Prima voce/ });
      await user.click(screen.getByRole('button', { name: /^Prima voce/ }));
      return { user, panel: screen.getByRole('dialog', { name: 'Prima voce' }) };
    }

    it('sono tutti e quattro scegliibili', async () => {
      const { panel } = await openPanel();
      for (const label of [
        'Visibile a tutti',
        'Solo a chi ha fatto accesso',
        'Solo ad alcuni ruoli',
        'Nascosta',
      ]) {
        expect(within(panel).getByRole('radio', { name: label })).toBeInTheDocument();
      }
    });

    it('i ruoli compaiono solo nel caso che li usa', async () => {
      const { user, panel } = await openPanel();
      expect(within(panel).queryByRole('checkbox', { name: 'Segreteria' })).not.toBeInTheDocument();

      await user.click(within(panel).getByRole('radio', { name: 'Solo ad alcuni ruoli' }));
      expect(within(panel).getByRole('checkbox', { name: 'Segreteria' })).toBeInTheDocument();

      await user.click(within(panel).getByRole('radio', { name: 'Nascosta' }));
      expect(within(panel).queryByRole('checkbox', { name: 'Segreteria' })).not.toBeInTheDocument();
    });

    it('salva la visibilità per ruoli con i ruoli scelti', async () => {
      const { user, panel } = await openPanel();
      await user.click(within(panel).getByRole('radio', { name: 'Solo ad alcuni ruoli' }));
      await user.click(within(panel).getByRole('checkbox', { name: 'Segreteria' }));
      await user.click(within(panel).getByRole('button', { name: 'Salva la voce' }));

      await waitFor(() => {
        expect(writes()).toContainEqual({
          path: '/menu-items/v1',
          options: {
            method: 'PATCH',
            body: expect.objectContaining({
              visibility: 'roles',
              visibleToRoles: ['segreteria'],
            }) as unknown,
          },
        });
      });
    });

    it('fuori dal caso «roles» l’elenco dei ruoli parte vuoto, come il vincolo pretende', async () => {
      const { user, panel } = await openPanel();
      await user.click(within(panel).getByRole('radio', { name: 'Solo ad alcuni ruoli' }));
      await user.click(within(panel).getByRole('checkbox', { name: 'Segreteria' }));
      await user.click(within(panel).getByRole('radio', { name: 'Visibile a tutti' }));
      await user.click(within(panel).getByRole('button', { name: 'Salva la voce' }));

      await waitFor(() => {
        expect(writes()).toContainEqual({
          path: '/menu-items/v1',
          options: {
            method: 'PATCH',
            body: expect.objectContaining({ visibility: 'public', visibleToRoles: [] }) as unknown,
          },
        });
      });
    });
  });
});
