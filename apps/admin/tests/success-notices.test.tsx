import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W9, T5: ogni operazione riuscita dice che è riuscita (W8-17, W8-19, W8-23, W8-25),
 * con lo stesso avviso «Fatto» già usato da «Modifiche salvate.». Prima di questa wave la
 * finestra si chiudeva e l'elenco si aggiornava senza una parola: chi collaudava non sapeva se
 * l'operazione fosse andata a buon fine. Indirizzi, nomi, titoli e file sono inventati.
 */

const apiMock = vi.fn();
const uploadMock = vi.fn();
const pushMock = vi.fn();
const replaceMock = vi.fn();
const refreshMock = vi.fn();

const ALL = [
  'content.read',
  'content.write',
  'content.publish',
  'media.write',
  'settings.write',
  'users.manage',
];
let activeArea: 'redazione' | 'impostazioni' = 'redazione';
let signedIn = true;

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('../src/lib/upload', () => ({
  uploadFile: (path: string, file: File, options?: unknown) => uploadMock(path, file, options),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
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
      user: signedIn
        ? {
            userId: 'u1',
            email: 'ada@esempio.invalid',
            fullName: 'Ada Inventata',
            mustChangePassword: false,
            permissions: ALL,
            activeRoleId: 'r1',
            activeArea,
            rolesHeld: [
              {
                roleId: 'r1',
                key: 'amministrazione',
                label: 'Amministrazione',
                areas: ['redazione', 'impostazioni'],
              },
            ],
          }
        : null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      chooseVestment: vi.fn(),
      refresh: refreshMock,
    }),
  };
});

const { SeoAndRedirects } = await import('../src/components/seo/SeoAndRedirects');
const { MediaLibrary } = await import('../src/components/media/MediaLibrary');
const { CategoryManager } = await import('../src/components/terms/CategoryManager');
const { MenuManager } = await import('../src/components/menu/MenuManager');
const { DocumentList } = await import('../src/components/documents/DocumentList');
const { DocumentEditor } = await import('../src/components/documents/DocumentEditor');
const { AccountsScreen } = await import('../src/components/accounts/AccountsScreen');
const { default: AccessoPage } = await import('../src/app/accesso/page');
const { ApiError } = await import('../src/lib/api');

type Handler = (path: string, options?: { method?: string; body?: unknown }) => unknown;

function routes(handler: Handler): void {
  apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    const answer = await handler(path, options);
    return answer === undefined ? {} : answer;
  });
}

function show(element: React.JSX.Element): ReturnType<typeof userEvent.setup> {
  const user = userEvent.setup();
  render(<DensityProvider>{element}</DensityProvider>);
  return user;
}

/**
 * Come `show`, ma in modalità rigorosa: React esegue due volte gli effetti al montaggio, come fa
 * il server di sviluppo. Le letture una tantum degli indicatori non devono perdere l'avviso alla
 * seconda esecuzione (revisione T5, M3).
 */
function showStrict(element: React.JSX.Element): ReturnType<typeof userEvent.setup> {
  const user = userEvent.setup();
  render(
    <StrictMode>
      <DensityProvider>{element}</DensityProvider>
    </StrictMode>,
  );
  return user;
}

/** Un rifiuto qualunque del servizio, con un testo inventato. */
const rifiuto = (): Error => new ApiError(422, 'invalid', 'Rifiuto inventato.');

/** L'avviso di riuscita è l'Alert «Fatto» con il testo atteso. */
async function expectNotice(text: string): Promise<void> {
  const message = await screen.findByText(text);
  const alert = message.closest('.amoris-alert--success');
  expect(alert).not.toBeNull();
  expect(alert).toHaveAttribute('role', 'status');
  expect(within(alert as HTMLElement).getByText('Fatto')).toBeInTheDocument();
}

beforeEach(() => {
  apiMock.mockReset();
  uploadMock.mockReset();
  pushMock.mockReset();
  replaceMock.mockReset();
  refreshMock.mockReset();
  refreshMock.mockResolvedValue(undefined);
  activeArea = 'redazione';
  signedIn = true;
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('W8-17: SEO e indirizzi', () => {
  const redirect = {
    id: 'r1',
    sourcePath: '/indirizzo-inventato/',
    targetPath: '/pagina-inventata/',
    statusCode: 301,
    kind: 'exact' as const,
    origin: 'manual' as const,
    isActive: true,
    note: null,
    hitCount: 0,
    lastHitAt: null,
  };
  const template = {
    scope: 'page',
    titleTemplate: '{title} - {site_title}',
    descriptionTemplate: null,
    robotsDirectives: [],
    ogType: null,
    schemaType: null,
    updatedAt: '2026-01-10T10:00:00.000Z',
  };

  beforeEach(() => {
    routes((path) => {
      if (path === '/seo/templates') return [template];
      if (path.startsWith('/redirects?')) {
        return { items: [redirect], meta: { total: 1, page: 1, perPage: 50 } };
      }
      if (path.startsWith('/media')) return { items: [] };
      return undefined;
    });
  });

  async function openRedirects(): Promise<ReturnType<typeof userEvent.setup>> {
    const user = show(<SeoAndRedirects />);
    await user.click(await screen.findByRole('tab', { name: 'Redirect' }));
    return user;
  }

  it('«Crea il redirect»: lo dice e filtra l’elenco sul suo indirizzo, così la riga si vede', async () => {
    const user = await openRedirects();
    await user.click(await screen.findByRole('button', { name: 'Nuovo redirect' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuovo redirect' });
    await user.type(within(dialogo).getByLabelText(/Indirizzo di partenza/), '/vecchio-inventato/');
    await user.type(within(dialogo).getByLabelText(/Indirizzo di arrivo/), '/nuovo-inventato/');
    await user.click(within(dialogo).getByRole('button', { name: 'Crea il redirect' }));

    await expectNotice('Redirect creato. Per rivedere tutti i redirect, svuota la ricerca.');
    expect(screen.getByLabelText('Cerca fra i redirect')).toHaveValue('/vecchio-inventato/');
    await waitFor(() => {
      expect(
        apiMock.mock.calls.some((call) =>
          (call[0] as string).includes('search=%2Fvecchio-inventato%2F'),
        ),
      ).toBe(true);
    });
  });

  it('M1: con un indirizzo di partenza più lungo del limite della ricerca il filtro si accorcia', async () => {
    // L'API accetta partenze fino a 2.000 caratteri ma ricerche fino a 200: senza il taglio
    // l'elenco filtrato riceverebbe un rifiuto subito dopo «Redirect creato.».
    const lungo = `/${'a'.repeat(249)}`;
    const user = await openRedirects();
    await user.click(await screen.findByRole('button', { name: 'Nuovo redirect' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuovo redirect' });
    await user.click(within(dialogo).getByLabelText(/Indirizzo di partenza/));
    await user.paste(lungo);
    await user.type(within(dialogo).getByLabelText(/Indirizzo di arrivo/), '/nuovo-inventato/');
    await user.click(within(dialogo).getByRole('button', { name: 'Crea il redirect' }));

    await expectNotice('Redirect creato. Per rivedere tutti i redirect, svuota la ricerca.');
    expect(screen.getByLabelText('Cerca fra i redirect')).toHaveValue(lungo.slice(0, 200));
    await waitFor(() => {
      const cercate = apiMock.mock.calls
        .map((call) => call[0] as string)
        .filter((path) => path.startsWith('/redirects?') && path.includes('search='))
        .map((path) => new URLSearchParams(path.slice(path.indexOf('?') + 1)).get('search') ?? '');
      expect(cercate.length).toBeGreaterThan(0);
      for (const value of cercate) expect(value.length).toBeLessThanOrEqual(200);
    });
  });

  it('«Salva il redirect»: «Modifiche salvate.»', async () => {
    const user = await openRedirects();
    await user.click(await screen.findByRole('button', { name: '/indirizzo-inventato/' }));
    const panel = screen.getByRole('dialog', { name: '/indirizzo-inventato/' });
    await user.click(within(panel).getByRole('button', { name: 'Salva il redirect' }));
    await expectNotice('Modifiche salvate.');
  });

  it('«Salva il template»: «Modifiche salvate.»', async () => {
    const user = show(<SeoAndRedirects />);
    await user.click(await screen.findByRole('button', { name: 'Pagine' }));
    const panel = screen.getByRole('dialog', { name: 'Pagine' });
    await user.click(within(panel).getByRole('button', { name: 'Salva il template' }));
    await expectNotice('Modifiche salvate.');
  });
});

describe('W8-19 e W8-25: Media', () => {
  const immagine = {
    id: 'm1',
    publicPath: '/media/2026/01/immagine-inventata.png',
    fileName: 'immagine-inventata.png',
    mimeType: 'image/png',
    byteSize: 2048,
    title: 'Immagine inventata',
    altText: null,
    caption: null,
    description: null,
    uploadedAt: '2026-01-10T10:00:00.000Z',
  };

  beforeEach(() => {
    routes((path, options) => {
      if (path.startsWith('/media?')) {
        return { items: [immagine], meta: { total: 1, page: 1, perPage: 25 } };
      }
      if (options?.method === 'DELETE') return null;
      return undefined;
    });
  });

  it('W8-19: dopo «Elimina definitivamente» compare «File eliminato.» (DR-316)', async () => {
    const user = show(<MediaLibrary />);
    await user.click(await screen.findByRole('button', { name: 'Immagine inventata' }));
    const panel = screen.getByRole('dialog', { name: 'Immagine inventata' });
    await user.click(within(panel).getByRole('button', { name: 'Elimina' }));
    const conferma = screen.getByRole('dialog', { name: 'Elimina il media' });
    await user.type(
      within(conferma).getByLabelText(/Digita «immagine-inventata.png»/),
      'immagine-inventata.png',
    );
    await user.click(within(conferma).getByRole('button', { name: 'Elimina definitivamente' }));
    await expectNotice('File eliminato.');
  });

  it('I1: dopo «File eliminato.» un caricamento rifiutato toglie l’avviso', async () => {
    uploadMock.mockRejectedValue(rifiuto());
    const user = show(<MediaLibrary />);
    await user.click(await screen.findByRole('button', { name: 'Immagine inventata' }));
    const panel = screen.getByRole('dialog', { name: 'Immagine inventata' });
    await user.click(within(panel).getByRole('button', { name: 'Elimina' }));
    const conferma = screen.getByRole('dialog', { name: 'Elimina il media' });
    await user.type(
      within(conferma).getByLabelText(/Digita «immagine-inventata.png»/),
      'immagine-inventata.png',
    );
    await user.click(within(conferma).getByRole('button', { name: 'Elimina definitivamente' }));
    await expectNotice('File eliminato.');

    await user.upload(
      screen.getByLabelText('Scegli i file da caricare'),
      new File(['byte inventati'], 'documento-inventato.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByText(/Rifiuto inventato\./)).toBeInTheDocument();
    expect(screen.queryByText('File eliminato.')).not.toBeInTheDocument();
  });

  it.each([
    ['documento-inventato.pdf', 'application/pdf'],
    ['video-inventato.mp4', 'video/mp4'],
  ])('W8-25: dopo il caricamento di %s compare «File caricato.»', async (name, type) => {
    uploadMock.mockResolvedValue({ ...immagine, id: 'm2', fileName: name, mimeType: type });
    const user = show(<MediaLibrary />);
    await screen.findByRole('button', { name: 'Immagine inventata' });
    await user.upload(
      screen.getByLabelText('Scegli i file da caricare'),
      new File(['byte inventati'], name, { type }),
    );
    expect(await screen.findByText('File caricato.')).toBeInTheDocument();
  });

  it('W8-25: le immagini continuano a dire quante dimensioni derivate sono nate', async () => {
    uploadMock.mockResolvedValue({ ...immagine, id: 'm2', derivatives: 3 });
    const user = show(<MediaLibrary />);
    await screen.findByRole('button', { name: 'Immagine inventata' });
    await user.upload(
      screen.getByLabelText('Scegli i file da caricare'),
      new File(['byte inventati'], 'nuova.png', { type: 'image/png' }),
    );
    expect(await screen.findByText(/3 dimensioni derivate generate\./)).toBeInTheDocument();
    expect(screen.queryByText('File caricato.')).not.toBeInTheDocument();
  });
});

describe('W8-23: Categorie', () => {
  const categoria = {
    id: '11111111-1111-4111-8111-111111111111',
    taxonomy: 'category',
    slug: 'categoria-inventata',
    name: 'Categoria inventata',
    description: null,
    parentId: null,
    position: 0,
    path: '/category/categoria-inventata/',
    contentCount: 0,
  };

  beforeEach(() => {
    routes((path, options) => {
      if (path === '/terms?taxonomy=category') return [categoria];
      if (path === `/terms/${categoria.id}/seo`) {
        return {
          termId: categoria.id,
          title: null,
          description: null,
          robotsNoindex: false,
          robotsNofollow: false,
          updatedAt: null,
        };
      }
      if (path === `/terms/${categoria.id}/deletion`) {
        return {
          blocked: false,
          contentCount: 0,
          children: [],
          menuItems: [],
          redirectsToPath: [],
        };
      }
      if (options?.method === 'DELETE') return null;
      return undefined;
    });
  });

  it('crea: «Categoria creata.»', async () => {
    const user = show(<CategoryManager />);
    await screen.findByText('Categoria inventata');
    await user.click(screen.getByRole('button', { name: 'Nuova categoria' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuova categoria' });
    await user.type(within(dialogo).getByLabelText('Nome'), 'Nuova inventata');
    await user.click(within(dialogo).getByRole('button', { name: 'Crea categoria' }));
    await expectNotice('Categoria creata.');
  });

  it('modifica: «Modifiche salvate.»', async () => {
    const user = show(<CategoryManager />);
    const riga = (await screen.findByText('Categoria inventata')).closest('tr')!;
    await user.click(within(riga).getByRole('button', { name: 'Modifica' }));
    const panel = await screen.findByRole('dialog');
    await user.click(within(panel).getByRole('button', { name: 'Salva' }));
    await expectNotice('Modifiche salvate.');
  });

  it('elimina: «Categoria eliminata.»', async () => {
    const user = show(<CategoryManager />);
    const riga = (await screen.findByText('Categoria inventata')).closest('tr')!;
    await user.click(within(riga).getByRole('button', { name: 'Elimina' }));
    const conferma = await screen.findByRole('dialog', { name: 'Elimina la categoria' });
    await user.type(
      within(conferma).getByLabelText(/Digita «Categoria inventata»/),
      'Categoria inventata',
    );
    await user.click(within(conferma).getByRole('button', { name: 'Elimina definitivamente' }));
    await expectNotice('Categoria eliminata.');
  });

  async function createThenDelete(): Promise<ReturnType<typeof userEvent.setup>> {
    const user = show(<CategoryManager />);
    await screen.findByText('Categoria inventata');
    await user.click(screen.getByRole('button', { name: 'Nuova categoria' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuova categoria' });
    await user.type(within(dialogo).getByLabelText('Nome'), 'Nuova inventata');
    await user.click(within(dialogo).getByRole('button', { name: 'Crea categoria' }));
    await expectNotice('Categoria creata.');
    const riga = screen.getByText('Categoria inventata').closest('tr')!;
    await user.click(within(riga).getByRole('button', { name: 'Elimina' }));
    return user;
  }

  it('I1: dopo «Categoria creata.» un’eliminazione rifiutata toglie l’avviso', async () => {
    const reads = apiMock.getMockImplementation()!;
    apiMock.mockImplementation((path: string, options?: { method?: string }) =>
      options?.method === 'DELETE' ? Promise.reject(rifiuto()) : reads(path, options),
    );
    const user = await createThenDelete();
    const conferma = await screen.findByRole('dialog', { name: 'Elimina la categoria' });
    await user.type(
      within(conferma).getByLabelText(/Digita «Categoria inventata»/),
      'Categoria inventata',
    );
    await user.click(within(conferma).getByRole('button', { name: 'Elimina definitivamente' }));
    expect(await screen.findByText(/Rifiuto inventato\./)).toBeInTheDocument();
    expect(screen.queryByText('Categoria creata.')).not.toBeInTheDocument();
  });

  it('I1: dopo «Categoria creata.» un controllo preliminare non riuscito toglie l’avviso', async () => {
    const reads = apiMock.getMockImplementation()!;
    apiMock.mockImplementation((path: string, options?: { method?: string }) =>
      path.endsWith('/deletion') ? Promise.reject(rifiuto()) : reads(path, options),
    );
    await createThenDelete();
    expect(await screen.findByText(/Rifiuto inventato\./)).toBeInTheDocument();
    expect(screen.queryByText('Categoria creata.')).not.toBeInTheDocument();
  });
});

describe('W8-23: Menu', () => {
  const voce = {
    id: 'v1',
    menuId: 'menu1',
    parentId: null,
    position: 0,
    kind: 'custom' as const,
    label: 'Voce inventata',
    contentId: null,
    termId: null,
    url: '/voce-inventata/',
    linkTarget: null,
    cssClasses: null,
    visibility: 'public' as const,
    visibleToRoles: [] as string[],
  };

  beforeEach(() => {
    routes((path, options) => {
      if (path === '/menus') return [{ id: 'menu1', key: 'principale', label: 'Menu principale' }];
      if (path.startsWith('/contents')) return { items: [{ id: 'c1', title: 'Pagina inventata' }] };
      if (path === '/terms') return [];
      if (path === '/roles') return [];
      if (path.startsWith('/menus/') && !options?.method) return [voce];
      if (options?.method === 'DELETE') return null;
      return undefined;
    });
  });

  it('aggiungi: «Voce aggiunta.»', async () => {
    const user = show(<MenuManager />);
    await screen.findByRole('button', { name: /^Voce inventata/ });
    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    await user.type(within(dialogo).getByLabelText('Etichetta'), 'Voce nuova');
    await user.selectOptions(within(dialogo).getByLabelText('Contenuto'), 'c1');
    await user.click(within(dialogo).getByRole('button', { name: 'Aggiungi' }));
    await expectNotice('Voce aggiunta.');
  });

  it('elimina: «Voce eliminata.»', async () => {
    const user = show(<MenuManager />);
    await user.click(await screen.findByRole('button', { name: 'Elimina: Voce inventata' }));
    const conferma = await screen.findByRole('dialog', { name: 'Elimina la voce di menu' });
    await user.type(within(conferma).getByLabelText(/Digita «Voce inventata»/), 'Voce inventata');
    await user.click(within(conferma).getByRole('button', { name: 'Elimina definitivamente' }));
    await expectNotice('Voce eliminata.');
  });

  const seconda = { ...voce, id: 'v2', position: 1, label: 'Seconda inventata', url: '/seconda/' };

  /** Due menu e due voci; le scritture sulle voci esistenti sono rifiutate. */
  function menuWithRejectedWrites(): void {
    routes((path, options) => {
      if (path === '/menus') {
        return [
          { id: 'menu1', key: 'principale', label: 'Menu principale' },
          { id: 'menu2', key: 'piede', label: 'Menu a piè di pagina' },
        ];
      }
      if (path.startsWith('/contents')) return { items: [{ id: 'c1', title: 'Pagina inventata' }] };
      if (path === '/terms') return [];
      if (path === '/roles') return [];
      if (path.startsWith('/menus/') && !options?.method) return [voce, seconda];
      if (path.startsWith('/menu-items/') && options?.method === 'PATCH') throw rifiuto();
      return undefined;
    });
  }

  async function addItem(): Promise<ReturnType<typeof userEvent.setup>> {
    const user = show(<MenuManager />);
    await screen.findByRole('button', { name: /^Seconda inventata/ });
    await user.click(screen.getByRole('button', { name: 'Aggiungi una voce' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aggiungi una voce' });
    await user.type(within(dialogo).getByLabelText('Etichetta'), 'Voce nuova');
    await user.selectOptions(within(dialogo).getByLabelText('Contenuto'), 'c1');
    await user.click(within(dialogo).getByRole('button', { name: 'Aggiungi' }));
    await expectNotice('Voce aggiunta.');
    return user;
  }

  it('I1: dopo «Voce aggiunta.» uno spostamento rifiutato toglie l’avviso', async () => {
    menuWithRejectedWrites();
    const user = await addItem();
    await user.click(screen.getByRole('button', { name: 'Sposta su: Seconda inventata' }));
    expect(await screen.findByText(/Rifiuto inventato\./)).toBeInTheDocument();
    expect(screen.queryByText('Voce aggiunta.')).not.toBeInTheDocument();
  });

  it('I1: dopo «Voce aggiunta.» un salvataggio rifiutato della voce toglie l’avviso', async () => {
    menuWithRejectedWrites();
    const user = await addItem();
    await user.click(screen.getByRole('button', { name: /^Voce inventata/ }));
    const panel = await screen.findByRole('dialog', { name: 'Voce inventata' });
    await user.click(within(panel).getByRole('button', { name: 'Salva la voce' }));
    expect(await screen.findByText(/Rifiuto inventato\./)).toBeInTheDocument();
    expect(screen.queryByText('Voce aggiunta.')).not.toBeInTheDocument();
  });

  it('I1: cambiando menu l’avviso riferito al menu precedente sparisce', async () => {
    menuWithRejectedWrites();
    const user = await addItem();
    await user.selectOptions(screen.getByLabelText('Menu'), 'piede');
    expect(screen.queryByText('Voce aggiunta.')).not.toBeInTheDocument();
  });
});

describe('W8-23: Documenti', () => {
  const DOC = {
    id: '33333333-3333-4333-8333-333333333333',
    slug: 'modulo-inventato',
    title: 'Modulo inventato',
    description: null,
    publishedAt: '2025-03-01T10:00:00.000Z',
    modifiedAt: null,
    sitePath: '/download/modulo-inventato/',
    file: {
      mediaId: '44444444-4444-4444-8444-444444444444',
      fileName: 'modulo-inventato.pdf',
      mimeType: 'application/pdf',
      byteSize: 2048,
      publicPath: '/media/2025/03/modulo-inventato.pdf',
    },
  };

  beforeEach(() => {
    routes((path, options) => {
      if (path === '/documents' && !options?.method) return [DOC];
      if (path === '/terms?taxonomy=wpdmcategory') {
        return [{ id: 'k1', name: 'Moduli inventati', taxonomy: 'wpdmcategory' }];
      }
      if (path === '/documents' && options?.method === 'POST') return DOC;
      if (path === `/documents/${DOC.id}` && !options?.method) return DOC;
      if (path === `/documents/${DOC.id}/deletion`) {
        return {
          blocked: false,
          contents: [],
          menuItems: [],
          redirectsToPath: [],
          fileShared: false,
        };
      }
      if (options?.method === 'DELETE') return null;
      return undefined;
    });
    uploadMock.mockResolvedValue({ id: DOC.file.mediaId });
  });

  it('crea: si apre la scheda con l’indicatore «creato»', async () => {
    const user = show(<DocumentList />);
    await screen.findByRole('row', { name: /Modulo inventato/ });
    await user.click(screen.getByRole('button', { name: 'Nuovo documento' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuovo documento' });
    await within(dialogo).findByRole('option', { name: 'Moduli inventati' });
    await user.type(within(dialogo).getByLabelText('Titolo'), 'Modulo inventato');
    await user.upload(
      within(dialogo).getByLabelText('File PDF'),
      new File(['%PDF-1.4'], 'modulo-inventato.pdf', { type: 'application/pdf' }),
    );
    await user.click(within(dialogo).getByRole('button', { name: 'Crea il documento' }));
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(`/redazione/documenti/${DOC.id}?creato=1`),
    );
  });

  it('la scheda aperta con «?creato=1» dice «Documento creato.» e toglie l’indicatore', async () => {
    window.history.replaceState({}, '', `/redazione/documenti/${DOC.id}?creato=1`);
    showStrict(<DocumentEditor documentId={DOC.id} />);
    await expectNotice('Documento creato.');
    expect(window.location.search).toBe('');
  });

  it('elimina: si torna all’elenco con l’indicatore', async () => {
    const user = show(<DocumentEditor documentId={DOC.id} />);
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));
    const conferma = await screen.findByRole('dialog', { name: 'Elimina il documento' });
    await user.type(
      within(conferma).getByLabelText(/Digita «Modulo inventato»/),
      'Modulo inventato',
    );
    await user.click(within(conferma).getByRole('button', { name: 'Elimina definitivamente' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/redazione/documenti?eliminato=1'));
  });

  it('l’elenco aperto con «?eliminato=1» dice «Documento eliminato.» e toglie l’indicatore', async () => {
    window.history.replaceState({}, '', '/redazione/documenti?eliminato=1');
    showStrict(<DocumentList />);
    await expectNotice('Documento eliminato.');
    expect(window.location.search).toBe('');
  });
});

describe('W8-23: Persone e permessi', () => {
  const ada = {
    id: 'u1',
    email: 'ada@esempio.invalid',
    fullName: 'Ada Inventata',
    isActive: true,
    roleKeys: ['amministrazione'],
    lastLoginAt: null,
    createdAt: '2026-01-10T10:00:00.000Z',
  };
  const bruno = {
    id: 'b2',
    email: 'bruno@esempio.invalid',
    fullName: 'Bruno Inventato',
    isActive: true,
    roleKeys: ['editor'],
    lastLoginAt: null,
    createdAt: '2026-02-10T10:00:00.000Z',
  };
  const carla = { ...bruno, id: 'c3', fullName: 'Carla Inventata', isActive: false };

  beforeEach(() => {
    activeArea = 'impostazioni';
    routes((path, options) => {
      if (path === '/accounts' && options?.method === 'POST') {
        return {
          account: { ...bruno, id: 'n4', fullName: 'Nuova Inventata' },
          temporaryPassword: 'Temporanea-Inventata-1',
        };
      }
      if (path === '/accounts') return { items: [ada, bruno, carla] };
      return undefined;
    });
  });

  it('crea: «Account creato.» accanto alla password temporanea', async () => {
    const user = show(<AccountsScreen />);
    await screen.findByText('Bruno Inventato');
    await user.click(screen.getByRole('button', { name: 'Nuova persona' }));
    await user.type(screen.getByLabelText('Nome e cognome'), 'Nuova Inventata');
    await user.type(screen.getByLabelText('Indirizzo email'), 'nuova@esempio.invalid');
    await user.click(screen.getByRole('checkbox', { name: 'Redazione' }));
    await user.click(screen.getByRole('button', { name: 'Crea account' }));
    await expectNotice('Account creato.');
    expect(screen.getByRole('region', { name: 'Password temporanea' })).toBeInTheDocument();
  });

  it('modifica nome ed email di un altro: «Modifiche salvate.»', async () => {
    const user = show(<AccountsScreen />);
    await user.click(
      await screen.findByRole('button', { name: 'Modifica nome ed email di Bruno Inventato' }),
    );
    const dialogo = screen.getByRole('dialog');
    const nome = within(dialogo).getByLabelText(/Nome e cognome/);
    await user.clear(nome);
    await user.type(nome, 'Bruno Rinominato');
    await user.click(within(dialogo).getByRole('button', { name: 'Salva' }));
    await expectNotice('Modifiche salvate.');
  });

  it('ruoli: «Modifiche salvate.»', async () => {
    const user = show(<AccountsScreen />);
    await user.click(
      await screen.findByRole('button', { name: 'Modifica i ruoli di Bruno Inventato' }),
    );
    const dialogo = screen.getByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Salva i ruoli' }));
    await expectNotice('Modifiche salvate.');
  });

  it('disattiva: «Account disattivato.»', async () => {
    const user = show(<AccountsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Disattiva Bruno Inventato' }));
    const dialogo = screen.getByRole('dialog');
    await user.click(within(dialogo).getByRole('button', { name: 'Disattiva' }));
    await expectNotice('Account disattivato.');
  });

  it('riattiva: «Account riattivato.»', async () => {
    const user = show(<AccountsScreen />);
    await user.click(await screen.findByRole('button', { name: 'Riattiva Carla Inventata' }));
    await expectNotice('Account riattivato.');
  });

  it('proprio indirizzo: la schermata di accesso dice che l’indirizzo è cambiato', async () => {
    const user = show(<AccountsScreen />);
    await user.click(
      await screen.findByRole('button', { name: 'Modifica nome ed email di Ada Inventata' }),
    );
    const dialogo = screen.getByRole('dialog');
    const email = within(dialogo).getByLabelText(/Indirizzo email/);
    await user.clear(email);
    await user.type(email, 'ada.nuova@esempio.invalid');
    await user.type(within(dialogo).getByLabelText('Password attuale'), 'password-inventata');
    await user.click(within(dialogo).getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));

    // La sessione è chiusa: l'area porta all'accesso, che deve spiegare perché.
    signedIn = false;
    render(
      <StrictMode>
        <DensityProvider>
          <AccessoPage />
        </DensityProvider>
      </StrictMode>,
    );
    await expectNotice('Indirizzo cambiato: entra di nuovo con il nuovo indirizzo.');
  });

  it('l’avviso sull’accesso compare una volta sola', async () => {
    signedIn = false;
    window.sessionStorage.setItem('amoris.accesso.avviso', 'indirizzo-cambiato');
    const first = render(
      <DensityProvider>
        <AccessoPage />
      </DensityProvider>,
    );
    await screen.findByText('Indirizzo cambiato: entra di nuovo con il nuovo indirizzo.');
    first.unmount();
    render(
      <DensityProvider>
        <AccessoPage />
      </DensityProvider>,
    );
    await screen.findByRole('button', { name: 'Entra' });
    expect(
      screen.queryByText('Indirizzo cambiato: entra di nuovo con il nuovo indirizzo.'),
    ).not.toBeInTheDocument();
  });

  it.each(['__proto__', 'toString', 'constructor', 'hasOwnProperty', 'codice-inventato'])(
    'M2: un codice sconosciuto («%s») nella memoria di scheda non mostra nessun avviso',
    async (code) => {
      signedIn = false;
      window.sessionStorage.setItem('amoris.accesso.avviso', code);
      render(
        <DensityProvider>
          <AccessoPage />
        </DensityProvider>,
      );
      await screen.findByRole('button', { name: 'Entra' });
      expect(document.querySelector('.amoris-alert--success')).toBeNull();
      expect(window.sessionStorage.getItem('amoris.accesso.avviso')).toBeNull();
    },
  );

  it('M2: senza memoria del browser la schermata di accesso funziona e non mostra avvisi', async () => {
    signedIn = false;
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('memoria non disponibile');
    });
    try {
      render(
        <DensityProvider>
          <AccessoPage />
        </DensityProvider>,
      );
      await screen.findByRole('button', { name: 'Entra' });
      expect(document.querySelector('.amoris-alert--success')).toBeNull();
    } finally {
      getItem.mockRestore();
    }
  });
});
