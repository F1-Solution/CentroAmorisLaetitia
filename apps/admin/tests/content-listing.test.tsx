import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import type { ContentDetail } from '../src/lib/editor/roundtrip';
import { syntheticContent } from './fixtures';

/**
 * Wave 1G-W4, T4: «Estratto» nella scheda «Contenuto» e scheda «Elenchi e archivi»
 * (immagine in evidenza e categorie). Titoli, categorie e media sono inventati.
 */

const apiMock = vi.fn();
const FULL_PERMISSIONS = ['content.read', 'content.write', 'content.publish'];
let sessionPermissions = [...FULL_PERMISSIONS];

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
        fullName: 'Redattrice di prova',
        mustChangePassword: false,
        permissions: sessionPermissions,
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

const { ContentEditor } = await import('../src/components/editor/ContentEditor');

const POST_ID = '55555555-5555-4555-8555-555555555555';
const CAT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MEDIA_OLD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MEDIA_PUBLIC = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const MEDIA_PRIVATE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const post: ContentDetail = {
  ...syntheticContent,
  id: POST_ID,
  type: 'post',
  status: 'published',
  slug: 'notizia-di-prova',
  path: '/notizia-di-prova/',
  title: 'Notizia di prova',
  excerpt: 'Estratto di prova.',
  termIds: [CAT_A],
  featuredMedia: { id: MEDIA_OLD, title: 'Facciata di prova', thumbnailUrl: '/media/vecchia.jpg' },
};

const categories = [
  { id: CAT_A, name: 'Categoria Alfa', slug: 'alfa', contentCount: 3 },
  { id: CAT_B, name: 'Categoria Beta', slug: 'beta', contentCount: 0 },
];

const mediaList = {
  items: [
    {
      id: MEDIA_PUBLIC,
      publicPath: '/media/pubblica.jpg',
      fileName: 'pubblica.jpg',
      title: 'Sala di prova',
      isPrivate: false,
    },
    {
      id: MEDIA_PRIVATE,
      publicPath: '/media/privata.jpg',
      fileName: 'privata.jpg',
      title: 'Documento riservato di prova',
      isPrivate: true,
    },
  ],
};

let detail: ContentDetail;

function renderEditor(content: ContentDetail) {
  detail = content;
  return render(
    <DensityProvider>
      <ContentEditor
        contentId={content.id}
        sectionId="notizie"
        listHref="/redazione/notizie"
        listLabel="Notizie"
      />
    </DensityProvider>,
  );
}

function writes(): unknown[][] {
  return apiMock.mock.calls.filter((call) => {
    const options = call[1] as { method?: string } | undefined;
    return options?.method !== undefined && options.method !== 'GET';
  });
}

function writesTo(path: string, method: string): { body?: unknown }[] {
  return writes()
    .filter((call) => call[0] === path && (call[1] as { method: string }).method === method)
    .map((call) => call[1] as { body?: unknown });
}

async function openListingTab(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByLabelText('Titolo');
  await user.click(screen.getByRole('tab', { name: 'Elenchi e archivi' }));
  await screen.findByRole('group', { name: 'Categorie' });
}

describe('«Estratto» nella scheda «Contenuto»', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${detail.id}`) return Promise.resolve(detail);
      if (path === `/contents/${detail.id}/draft`) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      if (path.startsWith('/terms')) return Promise.resolve(categories);
      if (path.startsWith('/media')) return Promise.resolve(mediaList);
      return Promise.resolve(undefined);
    });
  });

  it('una pagina non ha né l’estratto né la scheda «Elenchi e archivi»', async () => {
    renderEditor(syntheticContent);
    await screen.findByLabelText('Titolo');
    expect(screen.queryByLabelText('Estratto')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Elenchi e archivi' })).toBeNull();
  });

  it('una notizia mostra l’estratto con il testo d’aiuto che dice dove compare (D139 = B)', async () => {
    renderEditor(post);
    const field = await screen.findByLabelText('Estratto');
    expect(field).toHaveValue('Estratto di prova.');
    const help = document.getElementById(field.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toMatch(/archivio della categoria/);
    expect(help?.textContent).toMatch(/ricerca/);
    expect(help?.textContent).toMatch(/Elenco articoli/);
    expect(help?.textContent).toMatch(/feed/);
    expect(help?.textContent).toMatch(/motori di ricerca/);
    expect(help?.textContent).toMatch(/inizio del testo/);
  });

  it('l’estratto si salva con il contenuto, e svuotato si invia vuoto', async () => {
    const user = userEvent.setup();
    renderEditor(post);
    const field = await screen.findByLabelText('Estratto');
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(writesTo(`/contents/${POST_ID}`, 'PATCH')).toHaveLength(1));
    const [call] = writesTo(`/contents/${POST_ID}`, 'PATCH');
    expect((call?.body as { excerpt: string }).excerpt).toBe('');
  });

  it('riscrivere l’estratto vuoto su una notizia che non lo aveva non conta come modifica', async () => {
    const user = userEvent.setup();
    renderEditor({ ...post, excerpt: null });
    const field = await screen.findByLabelText('Estratto');
    await user.type(field, 'a');
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await screen.findByText('Nessuna modifica: il contenuto non è stato riscritto.');
    expect(writesTo(`/contents/${POST_ID}`, 'PATCH')).toHaveLength(0);
  });
});

describe('scheda «Elenchi e archivi»', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${detail.id}`) return Promise.resolve(detail);
      if (path === `/contents/${detail.id}/draft`) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      if (path.startsWith('/terms')) return Promise.resolve(categories);
      if (path.startsWith('/media')) return Promise.resolve(mediaList);
      return Promise.resolve(undefined);
    });
  });

  it('elenca le categorie con quelle assegnate spuntate e spiega la regola D141-A', async () => {
    const user = userEvent.setup();
    renderEditor(post);
    await openListingTab(user);
    expect(apiMock).toHaveBeenCalledWith('/terms?taxonomy=category', expect.anything());
    const group = screen.getByRole('group', { name: 'Categorie' });
    expect(within(group).getByLabelText('Categoria Alfa')).toBeChecked();
    expect(within(group).getByLabelText('Categoria Beta')).not.toBeChecked();
    expect(group.textContent).toMatch(/notizia pubblicata deve avere almeno una categoria/);
    expect(group.textContent).toMatch(/bozza/);
    expect(group.textContent).toMatch(/per pubblicarla/);
  });

  it('assegna e toglie categorie con un PUT delle sole categorie', async () => {
    const user = userEvent.setup();
    renderEditor(post);
    await openListingTab(user);
    const save = screen.getByRole('button', { name: 'Salva le categorie' });
    expect(save).toBeDisabled();
    await user.click(screen.getByLabelText('Categoria Beta'));
    await user.click(screen.getByLabelText('Categoria Alfa'));
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(writesTo(`/contents/${POST_ID}/terms`, 'PUT')).toHaveLength(1));
    const [call] = writesTo(`/contents/${POST_ID}/terms`, 'PUT');
    expect(call?.body).toEqual({ termIds: [CAT_B] });
    await screen.findByText('Categorie salvate.');
  });

  it('mostra accanto alle categorie il messaggio dell’API se l’ultima non si toglie', async () => {
    const user = userEvent.setup();
    const message = 'Una notizia pubblicata deve avere almeno una categoria.';
    renderEditor(post);
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === `/contents/${POST_ID}/terms` && options?.method === 'PUT') {
        return Promise.reject(new ApiError(400, 'CONTENT_CATEGORY_REQUIRED', message));
      }
      if (path === `/contents/${POST_ID}`) return Promise.resolve(detail);
      if (path.endsWith('/draft')) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'x'));
      if (path.startsWith('/terms')) return Promise.resolve(categories);
      return Promise.resolve(mediaList);
    });
    await openListingTab(user);
    await user.click(screen.getByLabelText('Categoria Alfa'));
    await user.click(screen.getByRole('button', { name: 'Salva le categorie' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
  });

  it('mostra l’immagine in evidenza e la toglie con un PATCH del solo featuredMediaId', async () => {
    const user = userEvent.setup();
    renderEditor(post);
    await openListingTab(user);
    expect(screen.getByAltText('Facciata di prova')).toHaveAttribute('src', '/media/vecchia.jpg');
    await user.click(screen.getByRole('button', { name: 'Togli l’immagine' }));
    await waitFor(() => expect(writesTo(`/contents/${POST_ID}`, 'PATCH')).toHaveLength(1));
    expect(writesTo(`/contents/${POST_ID}`, 'PATCH')[0]?.body).toEqual({ featuredMediaId: null });
    await waitFor(() => expect(screen.queryByAltText('Facciata di prova')).toBeNull());
    expect(screen.getByRole('button', { name: 'Scegli un’immagine' })).toBeInTheDocument();
  });

  it('sceglie un’immagine pubblica senza chiedere il testo alternativo', async () => {
    const user = userEvent.setup();
    renderEditor(post);
    await openListingTab(user);
    await user.click(screen.getByRole('button', { name: 'Cambia l’immagine' }));

    const panel = await screen.findByRole('dialog', { name: 'Scegli un media' });
    await within(panel).findByText('Sala di prova');
    // Solo immagini pubbliche: la privata non si offre.
    expect(within(panel).queryByText('Documento riservato di prova')).toBeNull();
    expect(
      apiMock.mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].startsWith('/media?mimePrefix=image%2F'),
      ),
    ).toBe(true);

    await user.click(within(panel).getByText('Sala di prova'));
    expect(within(panel).queryByLabelText('Testo alternativo')).toBeNull();
    await user.click(within(panel).getByRole('button', { name: 'Usa questo media' }));

    await waitFor(() => expect(writesTo(`/contents/${POST_ID}`, 'PATCH')).toHaveLength(1));
    expect(writesTo(`/contents/${POST_ID}`, 'PATCH')[0]?.body).toEqual({
      featuredMediaId: MEDIA_PUBLIC,
    });
    expect(await screen.findByAltText('Sala di prova')).toHaveAttribute(
      'src',
      '/media/pubblica.jpg',
    );
  });

  it('mostra accanto all’immagine il messaggio dell’API se il media è rifiutato', async () => {
    const user = userEvent.setup();
    const message = 'Il media scelto non esiste, è privato o non è un’immagine.';
    renderEditor({ ...post, featuredMedia: null });
    await openListingTab(user);
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === `/contents/${POST_ID}` && options?.method === 'PATCH') {
        return Promise.reject(new ApiError(400, 'CONTENT_MEDIA_INVALID', message));
      }
      if (path.startsWith('/media')) return Promise.resolve(mediaList);
      return Promise.resolve(detail);
    });
    await user.click(screen.getByRole('button', { name: 'Scegli un’immagine' }));
    const panel = await screen.findByRole('dialog', { name: 'Scegli un media' });
    await user.click(await within(panel).findByText('Sala di prova'));
    await user.click(within(panel).getByRole('button', { name: 'Usa questo media' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('salvarla non perde né salva le modifiche non salvate di «Contenuto» (§6 caso 2)', async () => {
    const user = userEvent.setup();
    renderEditor(post);
    const title = await screen.findByLabelText('Titolo');
    await user.clear(title);
    await user.type(title, 'Titolo ancora da salvare');

    await user.click(screen.getByRole('tab', { name: 'Elenchi e archivi' }));
    await screen.findByRole('group', { name: 'Categorie' });
    await user.click(screen.getByLabelText('Categoria Beta'));
    await user.click(screen.getByRole('button', { name: 'Salva le categorie' }));
    await screen.findByText('Categorie salvate.');

    // Nessuna scrittura sul contenuto: né titolo né blocchi sono partiti.
    expect(writesTo(`/contents/${POST_ID}`, 'PATCH')).toHaveLength(0);
    expect(writesTo(`/contents/${POST_ID}`, 'PUT')).toHaveLength(0);

    await user.click(screen.getByRole('tab', { name: 'Contenuto' }));
    expect(await screen.findByLabelText('Titolo')).toHaveValue('Titolo ancora da salvare');
    expect(screen.getByText(/non ancora salvate|da riversare/)).toBeInTheDocument();
  });

  it('salvare o togliere l’immagine non perde le modifiche non salvate di «Contenuto» (§6 caso 2)', async () => {
    const user = userEvent.setup();
    const draftPath = `/contents/${POST_ID}/draft`;
    const savedAt = '2026-10-22T10:05:00.000Z';
    let serverUpdatedAt = post.updatedAt;
    let storedDraft: { title: string; baseUpdatedAt: string; updatedAt: string } | null = null;
    apiMock.mockImplementation((path: string, options?: { method?: string; body?: unknown }) => {
      const method = options?.method ?? 'GET';
      if (path === `/contents/${POST_ID}` && method === 'PATCH') {
        // Come l'API: qualunque PATCH fa avanzare la data di modifica.
        serverUpdatedAt = savedAt;
        return Promise.resolve({ ...post, featuredMedia: null, updatedAt: savedAt });
      }
      if (path === `/contents/${POST_ID}`)
        return Promise.resolve({ ...post, updatedAt: serverUpdatedAt });
      if (path === draftPath && method === 'PUT') {
        const body = options?.body as { title: string; baseUpdatedAt: string };
        storedDraft = { title: body.title, baseUpdatedAt: body.baseUpdatedAt, updatedAt: savedAt };
        return Promise.resolve(storedDraft);
      }
      if (path === draftPath) {
        if (storedDraft === null)
          return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
        return Promise.resolve({
          ...storedDraft,
          excerpt: post.excerpt,
          blocks: post.blocks,
          stillCurrent: storedDraft.baseUpdatedAt === serverUpdatedAt,
        });
      }
      if (path.startsWith('/terms')) return Promise.resolve(categories);
      if (path.startsWith('/media')) return Promise.resolve(mediaList);
      return Promise.resolve(undefined);
    });

    const first = renderEditor(post);
    const title = await screen.findByLabelText('Titolo');
    await user.clear(title);
    await user.type(title, 'Titolo ancora da salvare');
    await waitFor(() => expect(writesTo(draftPath, 'PUT')).toHaveLength(1), { timeout: 4000 });

    await openListingTab(user);
    await user.click(screen.getByRole('button', { name: 'Togli l’immagine' }));
    await waitFor(() => expect(writesTo(`/contents/${POST_ID}`, 'PATCH')).toHaveLength(1));

    // La copia di lavoro riparte con la data di modifica nuova: resta riprendibile.
    await waitFor(() => expect(writesTo(draftPath, 'PUT')).toHaveLength(2), { timeout: 4000 });
    expect(writesTo(draftPath, 'PUT')[1]?.body).toMatchObject({
      title: 'Titolo ancora da salvare',
      baseUpdatedAt: savedAt,
    });

    first.unmount();
    renderEditor(post);
    expect(await screen.findByLabelText('Titolo')).toHaveValue('Titolo ancora da salvare');
    expect(screen.queryByText(/più vecchia/)).toBeNull();
  });

  it('in sola lettura nasconde le azioni invece di mostrarle spente (DR-057)', async () => {
    const user = userEvent.setup();
    sessionPermissions = ['content.read'];
    renderEditor(post);
    await openListingTab(user);
    expect(screen.getByAltText('Facciata di prova')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambia l’immagine' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Togli l’immagine' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Salva le categorie' })).toBeNull();
  });

  it('se l’elenco dei media non si carica lo dice, e non dice «Nessun media trovato»', async () => {
    const user = userEvent.setup();
    renderEditor(post);
    await openListingTab(user);
    apiMock.mockImplementation((path: string) => {
      if (path.startsWith('/media')) return Promise.reject(new Error('rete'));
      return Promise.resolve(undefined);
    });
    await user.click(screen.getByRole('button', { name: 'Cambia l’immagine' }));
    const panel = await screen.findByRole('dialog', { name: 'Scegli un media' });
    expect(
      await within(panel).findByText('L’elenco dei media non si è caricato.'),
    ).toBeInTheDocument();
    expect(within(panel).queryByText('Nessun media trovato.')).toBeNull();
  });

  afterEach(() => {
    sessionPermissions = [...FULL_PERMISSIONS];
  });
});
