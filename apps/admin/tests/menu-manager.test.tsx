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

let contenuti: Array<{ id: string; title: string; isHome?: boolean }> = [];

let items: ReturnType<typeof voce>[] | Record<string, unknown>[] = [
  voce('v1', 'Prima voce', 0),
  voce('v2', 'Seconda voce', 1),
];

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
    contenuti = [{ id: 'c1', title: 'Pagina inventata' }];
    apiMock.mockReset();
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === '/menus')
        return Promise.resolve([{ id: 'menu1', key: 'principale', label: 'Menu principale' }]);
      if (path.startsWith('/contents')) {
        return Promise.resolve({ items: contenuti });
      }
      if (path === '/terms')
        return Promise.resolve([{ id: 't1', name: 'Avvisi', taxonomy: 'category' }]);
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

  it('ogni voce ha la maniglia per il trascinamento, e i bottoni funzionano ancora (DR-082)', async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });

    expect(
      screen.getByRole('button', { name: 'Prendi «Prima voce» per spostarlo' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Prendi «Seconda voce» per spostarlo' }),
    ).toBeInTheDocument();
    // Accanto alla regione di dnd-kit c'è la nostra, che dice la fascia scelta.
    expect(document.querySelector('.amoris-tree-drop__status')).not.toBeNull();

    // Un clic non è un trascinamento: la soglia di 8 pixel lascia passare il bottone.
    await user.click(screen.getByRole('button', { name: 'Elimina: Seconda voce' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
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
    expect(
      writes()
        .map((write) => write.path)
        .sort(),
    ).toEqual(['/menu-items/v1', '/menu-items/v2']);
  });

  it('spostare le voci non cancella le modifiche non salvate della voce aperta (DR-102)', async () => {
    // Il difetto del §3.1 di AUDIT.md: ogni nuova lettura delle voci riportava
    // la scheda aperta ai valori salvati. Il servizio restituisce oggetti nuovi
    // a ogni lettura, come fa quello vero.
    const reads = apiMock.getMockImplementation();
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.startsWith('/menus/') && !options?.method) {
        return Promise.resolve(items.map((item) => ({ ...item })));
      }
      return reads?.(path, options) as unknown;
    });
    const user = userEvent.setup();
    renderManager();
    await user.click(await screen.findByRole('button', { name: /^Prima voce/ }));

    const etichetta = await screen.findByLabelText('Etichetta');
    await user.clear(etichetta);
    await user.type(etichetta, 'Etichetta non ancora salvata');
    const lettureDelleVoci = () =>
      apiMock.mock.calls.filter(
        (call) =>
          (call[0] as string).startsWith('/menus/') &&
          (call[1] as { method?: string } | undefined)?.method === undefined,
      ).length;
    const prima = lettureDelleVoci();
    await user.click(screen.getByRole('button', { name: 'Sposta su: Seconda voce', hidden: true }));

    await waitFor(() => expect(lettureDelleVoci()).toBeGreaterThan(prima));
    await waitFor(() => {
      expect(screen.getByLabelText('Etichetta')).toHaveValue('Etichetta non ancora salvata');
    });
  });

  it('aprire un’altra voce mostra i suoi valori, non le modifiche della precedente (DR-102)', async () => {
    const user = userEvent.setup();
    renderManager();
    await user.click(await screen.findByRole('button', { name: /^Prima voce/ }));
    const etichetta = await screen.findByLabelText('Etichetta');
    await user.clear(etichetta);
    await user.type(etichetta, 'Modifica della prima voce');

    await user.click(screen.getByRole('button', { name: /^Seconda voce/, hidden: true }));

    await waitFor(() => {
      expect(screen.getByLabelText('Etichetta')).toHaveValue('Seconda voce');
    });
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

  it('W8-04: «Contenuto» parte da «Scegli…» e senza scelta non parte alcuna richiesta', async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });

    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    const elenco = within(dialogo).getByLabelText('Contenuto');
    expect(within(elenco).getAllByRole('option')[0]).toHaveTextContent('Scegli un contenuto');
    await user.type(within(dialogo).getByLabelText('Etichetta'), 'Voce nuova');
    await user.click(within(dialogo).getByRole('button', { name: 'Aggiungi' }));

    expect(
      await within(dialogo).findByText('Scegli il contenuto a cui punta la voce.'),
    ).toBeInTheDocument();
    expect(writes()).toEqual([]);
    expect(dialogo).not.toHaveTextContent('Invalid UUID');
  });

  it('W8-04: lo stesso vale per «Categoria»', async () => {
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });

    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    await user.selectOptions(within(dialogo).getByLabelText('La voce punta a'), 'term');
    const elenco = within(dialogo).getByLabelText('Categoria');
    expect(within(elenco).getAllByRole('option')[0]).toHaveTextContent('Scegli una categoria');
    await user.click(within(dialogo).getByRole('button', { name: 'Aggiungi' }));

    expect(
      await within(dialogo).findByText('Scegli la categoria a cui punta la voce.'),
    ).toBeInTheDocument();
    expect(writes()).toEqual([]);
  });

  it('W8-05: tutti i contenuti sono sceglibili, anche oltre la prima pagina', async () => {
    const reads = apiMock.getMockImplementation();
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.startsWith('/contents')) {
        const page = Number(new URL(path, 'http://x').searchParams.get('page') ?? '1');
        const all = Array.from({ length: 110 }, (_, i) => ({ id: `c${i}`, title: `Pagina ${i}` }));
        return Promise.resolve({
          items: all.slice((page - 1) * 100, page * 100),
          meta: { total: 110, page, perPage: 100 },
        });
      }
      return reads?.(path, options) as unknown;
    });
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });
    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    await waitFor(() => {
      expect(
        within(within(dialogo).getByLabelText('Contenuto')).getAllByRole('option'),
      ).toHaveLength(111);
    });
  });

  it('W8-15: i pulsanti di una voce senza etichetta usano il titolo del contenuto', async () => {
    items = [{ ...voce('v1', '', 0), kind: 'content' as const, contentId: 'c1', url: null }];
    renderManager();
    expect(
      await screen.findByRole('button', { name: 'Sposta su: Pagina inventata' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elimina: Pagina inventata' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Prendi «Pagina inventata» per spostarlo' }),
    ).toBeInTheDocument();
  });

  it('W9-N3: in «Contenuto» la pagina iniziale e i contenuti senza titolo hanno un nome', async () => {
    contenuti = [
      { id: 'home', title: '', isHome: true },
      { id: 'c2', title: '', isHome: false },
      { id: 'c1', title: 'Pagina inventata' },
    ];
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });
    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    const opzioni = within(within(dialogo).getByLabelText('Contenuto')).getAllByRole('option');
    expect(opzioni.map((opzione) => opzione.textContent)).toEqual([
      'Scegli un contenuto',
      'Pagina iniziale',
      'Senza titolo',
      'Pagina inventata',
    ]);
  });

  it('W9-N3: una voce senza etichetta verso la pagina iniziale senza titolo si chiama «Pagina iniziale»', async () => {
    contenuti = [{ id: 'home', title: '', isHome: true }];
    items = [{ ...voce('v1', '', 0), kind: 'content' as const, contentId: 'home', url: null }];
    renderManager();
    expect(
      await screen.findByRole('button', { name: 'Elimina: Pagina iniziale' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Prendi «Pagina iniziale» per spostarlo' }),
    ).toBeInTheDocument();
  });

  it('W8-16: spostare tra voci con posizioni sparse scrive solo le voci che cambiano', async () => {
    items = [
      voce('v1', 'Uno', 1),
      voce('v2', 'Due', 2),
      voce('v3', 'Tre', 3),
      voce('v4', 'Quattro', 9),
    ];
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Uno/ });
    const letture = () =>
      apiMock.mock.calls.filter(
        (call) =>
          (call[0] as string).startsWith('/menus/') &&
          (call[1] as { method?: string } | undefined)?.method === undefined,
      ).length;
    const prima = letture();
    await user.click(screen.getByRole('button', { name: 'Annida: Tre' }));
    await waitFor(() => expect(letture()).toBeGreaterThan(prima));
    expect(writes()).toEqual([
      {
        path: '/menu-items/v3',
        options: { method: 'PATCH', body: { parentId: 'v2', position: 0 } },
      },
    ]);
  });

  it('(I1) la voce nuova va dopo tutte quelle di primo livello, anche con posizioni sparse', async () => {
    items = [voce('v1', 'Uno', 1), voce('v2', 'Due', 2), voce('v3', 'Tre', 9)];
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Uno/ });
    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    await user.selectOptions(within(dialogo).getByLabelText('La voce punta a'), 'custom');
    await user.type(within(dialogo).getByLabelText('Etichetta'), 'Nuova');
    await user.type(within(dialogo).getByLabelText('Indirizzo'), '/nuova/');
    await user.click(within(dialogo).getByRole('button', { name: 'Aggiungi' }));
    await waitFor(() => {
      expect(writes()).toContainEqual({
        path: '/menus/principale/items',
        options: {
          method: 'POST',
          body: { kind: 'custom', label: 'Nuova', url: '/nuova/', position: 10 },
        },
      });
    });
  });

  it('(M2) senza contenuti né categorie l’elenco dice che non ce ne sono', async () => {
    const reads = apiMock.getMockImplementation();
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.startsWith('/contents')) return Promise.resolve({ items: [] });
      if (path === '/terms') return Promise.resolve([]);
      return reads?.(path, options) as unknown;
    });
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });
    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    expect(within(dialogo).getByText('Nessun contenuto.')).toBeInTheDocument();
    await user.selectOptions(within(dialogo).getByLabelText('La voce punta a'), 'term');
    expect(within(dialogo).getByText('Nessuna categoria.')).toBeInTheDocument();
  });

  it('(M3) una voce di categoria senza etichetta usa il nome della categoria ovunque', async () => {
    items = [{ ...voce('v1', '', 0), kind: 'term' as const, termId: 't1', url: null }];
    const user = userEvent.setup();
    renderManager();
    expect(await screen.findByRole('button', { name: 'Sposta su: Avvisi' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Prendi «Avvisi» per spostarlo' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Elimina: Avvisi' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getAllByText(/Avvisi/).length).toBeGreaterThan(0);
  });

  it('(M1) il caricamento dei contenuti ha un tetto di pagine e toglie i doppioni', async () => {
    const reads = apiMock.getMockImplementation();
    const chiamate: string[] = [];
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.startsWith('/contents')) {
        chiamate.push(path);
        const page = Number(new URL(path, 'http://x').searchParams.get('page') ?? '1');
        return Promise.resolve({
          items: [
            { id: `c${page}`, title: `Pagina ${page}` },
            { id: 'ripetuto', title: 'Pagina ripetuta' },
          ],
          meta: { total: 100000, page, perPage: 100 },
        });
      }
      return reads?.(path, options) as unknown;
    });
    const user = userEvent.setup();
    renderManager();
    await screen.findByRole('button', { name: /^Prima voce/ });
    await waitFor(() => expect(chiamate.length).toBe(20));
    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    // 20 contenuti distinti, un solo «ripetuto», più «Scegli…».
    expect(within(within(dialogo).getByLabelText('Contenuto')).getAllByRole('option')).toHaveLength(
      22,
    );
  });

  describe('i quattro casi di visibilità', () => {
    async function openPanel() {
      const user = userEvent.setup();
      renderManager();
      await screen.findByRole('button', { name: /^Prima voce/ });
      await user.click(screen.getByRole('button', { name: /^Prima voce/ }));
      return { user, panel: screen.getByRole('dialog', { name: 'Prima voce' }) };
    }

    it('sono tutti e quattro sceglibili', async () => {
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
