import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import type { ContentDetail } from '../src/lib/editor/roundtrip';
import { syntheticContent } from './fixtures';

/**
 * Wave 1G-W4, giro finale (I-1 e «Pagina»): dopo una scrittura sul contenuto la copia di
 * lavoro resta riprendibile, e «Pubblica» su una notizia senza categorie non scrive nulla
 * (D141-A). Il servizio simulato tiene lo stato come l'API: ogni `PATCH` sposta la data di
 * modifica, e una copia di lavoro si riprende solo se la sua base è ancora quella data.
 * Titoli e categorie sono inventati.
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

const { ContentEditor } = await import('../src/components/editor/ContentEditor');

const POST_ID = '66666666-6666-4666-8666-666666666666';
const CAT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTENT_PATH = `/contents/${POST_ID}`;
const DRAFT_PATH = `${CONTENT_PATH}/draft`;
const CATEGORY_MESSAGE =
  'Per pubblicare una notizia serve almeno una categoria: sceglila nella scheda «Elenchi e archivi».';

const post: ContentDetail = {
  ...syntheticContent,
  id: POST_ID,
  type: 'post',
  status: 'draft',
  slug: 'notizia-in-lavorazione',
  path: '/notizia-in-lavorazione/',
  title: 'Notizia in lavorazione',
  publishedAt: null,
  termIds: [CAT_A],
  featuredMedia: null,
};

interface StoredDraft {
  readonly title: string;
  readonly excerpt: string | null;
  readonly blocks: unknown;
  readonly baseUpdatedAt: string;
  readonly updatedAt: string;
}

/** Lo stato del servizio simulato: contenuto, copia di lavoro e un eventuale rifiuto della pubblicazione. */
let server: {
  content: ContentDetail;
  draft: StoredDraft | null;
  stamps: number;
  publishError: ApiError | null;
};

function nextStamp(): string {
  server.stamps += 1;
  return new Date(Date.UTC(2026, 9, 22, 10, server.stamps)).toISOString();
}

function install(): void {
  apiMock.mockImplementation((path: string, options?: { method?: string; body?: unknown }) => {
    const method = options?.method ?? 'GET';
    if (path === CONTENT_PATH && method === 'PATCH') {
      // Come l'API: qualunque PATCH fa avanzare la data di modifica e restituisce il dettaglio.
      server.content = {
        ...server.content,
        ...(options?.body as Partial<ContentDetail>),
        updatedAt: nextStamp(),
      };
      return Promise.resolve(server.content);
    }
    if (path === CONTENT_PATH) return Promise.resolve(server.content);
    if (path === `${CONTENT_PATH}/publish`) {
      if (server.publishError) return Promise.reject(server.publishError);
      server.content = { ...server.content, status: 'published', updatedAt: nextStamp() };
      return Promise.resolve(server.content);
    }
    if (path === `${CONTENT_PATH}/terms`) {
      const { termIds } = options?.body as { termIds: string[] };
      server.content = { ...server.content, termIds };
      return Promise.resolve({ termIds });
    }
    if (path === DRAFT_PATH && method === 'PUT') {
      const body = options?.body as Omit<StoredDraft, 'updatedAt'>;
      server.draft = { ...body, updatedAt: nextStamp() };
      return Promise.resolve({ ...server.draft, stillCurrent: true });
    }
    if (path === DRAFT_PATH && method === 'DELETE') {
      server.draft = null;
      return Promise.resolve(undefined);
    }
    if (path === DRAFT_PATH) {
      if (server.draft === null) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      return Promise.resolve({
        ...server.draft,
        stillCurrent: server.draft.baseUpdatedAt === server.content.updatedAt,
      });
    }
    if (path.startsWith('/terms')) {
      return Promise.resolve([
        { id: CAT_A, name: 'Categoria Alfa', slug: 'alfa', contentCount: 1 },
      ]);
    }
    if (path.startsWith('/media')) return Promise.resolve({ items: [] });
    return Promise.resolve(undefined);
  });
}

function renderEditor() {
  return render(
    <DensityProvider>
      <ContentEditor
        contentId={POST_ID}
        sectionId="notizie"
        listHref="/redazione/notizie"
        listLabel="Notizie"
      />
    </DensityProvider>,
  );
}

function callsTo(path: string, method: string): { body?: unknown }[] {
  return apiMock.mock.calls
    .filter((call) => call[0] === path && (call[1] as { method?: string })?.method === method)
    .map((call) => call[1] as { body?: unknown });
}

/** Le scritture sul contenuto: modifica, pubblicazione, ritiro. */
function contentWrites(): unknown[][] {
  return apiMock.mock.calls.filter((call) => {
    const method = (call[1] as { method?: string } | undefined)?.method;
    return (
      (call[0] === CONTENT_PATH && method === 'PATCH') ||
      call[0] === `${CONTENT_PATH}/publish` ||
      call[0] === `${CONTENT_PATH}/unpublish`
    );
  });
}

const draftPuts = () => callsTo(DRAFT_PATH, 'PUT').map((call) => call.body);

describe('copia di lavoro riprendibile dopo una scrittura sul contenuto', () => {
  beforeEach(() => {
    apiMock.mockReset();
    server = { content: post, draft: null, stamps: 0, publishError: null };
    install();
  });

  it('«Pubblica» su una notizia senza categorie dice che ne serve una e non scrive nulla (D141-A)', async () => {
    server.content = { ...post, termIds: [] };
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await user.type(title, ' ritoccata');
    await user.click(screen.getByRole('button', { name: 'Pubblica' }));

    expect(await screen.findByText(CATEGORY_MESSAGE)).toBeInTheDocument();
    expect(contentWrites()).toEqual([]);
    expect(screen.getByLabelText('Titolo')).toHaveValue('Notizia in lavorazione ritoccata');
  });

  it('assegnata una categoria dalla scheda «Elenchi e archivi», «Pubblica» procede', async () => {
    server.content = { ...post, termIds: [] };
    const user = userEvent.setup();
    renderEditor();
    await screen.findByLabelText('Titolo');
    await user.click(screen.getByRole('tab', { name: 'Elenchi e archivi' }));
    await user.click(await screen.findByLabelText('Categoria Alfa'));
    await user.click(screen.getByRole('button', { name: 'Salva le categorie' }));
    await screen.findByText('Categorie salvate.');

    await user.click(screen.getByRole('button', { name: 'Pubblica' }));
    expect(await screen.findByText('Contenuto pubblicato.')).toBeInTheDocument();
    expect(callsTo(`${CONTENT_PATH}/publish`, 'POST')).toHaveLength(1);
    expect(screen.queryByText(CATEGORY_MESSAGE)).toBeNull();
  });

  it('dopo una pubblicazione rifiutata, le modifiche successive si riprendono alla riapertura (I-1)', async () => {
    // Il servizio resta l'autorità: qui rifiuta anche se l'editor vede una categoria.
    server.publishError = new ApiError(
      400,
      'CONTENT_CATEGORY_REQUIRED',
      'Per pubblicare una notizia serve almeno una categoria.',
    );
    const user = userEvent.setup();
    const first = renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await user.clear(title);
    await user.type(title, 'Titolo riscritto');
    await waitFor(() => expect(draftPuts()).toHaveLength(1), { timeout: 4000 });

    await user.click(screen.getByRole('button', { name: 'Pubblica' }));
    expect(
      await screen.findByText('Per pubblicare una notizia serve almeno una categoria.'),
    ).toBeInTheDocument();
    expect(callsTo(CONTENT_PATH, 'PATCH')).toHaveLength(1);

    // La copia di lavoro riparte sulla data di modifica nuova del contenuto.
    await waitFor(() => expect(draftPuts()).toHaveLength(2), { timeout: 4000 });
    expect(draftPuts()[1]).toMatchObject({
      title: 'Titolo riscritto',
      baseUpdatedAt: server.content.updatedAt,
    });

    await user.type(screen.getByLabelText('Titolo'), ' e ritoccato');
    await waitFor(() => expect(draftPuts()).toHaveLength(3), { timeout: 4000 });

    first.unmount();
    renderEditor();
    expect(await screen.findByLabelText('Titolo')).toHaveValue('Titolo riscritto e ritoccato');
    expect(screen.queryByText(/più vecchia/)).toBeNull();
  });

  it('dopo «Salva», le modifiche successive si riprendono alla riapertura', async () => {
    const user = userEvent.setup();
    const first = renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await user.clear(title);
    await user.type(title, 'Titolo salvato');
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await screen.findByText('Contenuto salvato.');

    await user.type(screen.getByLabelText('Titolo'), ' e ritoccato');
    await waitFor(() => expect(server.draft?.title).toBe('Titolo salvato e ritoccato'), {
      timeout: 4000,
    });
    expect(server.draft?.baseUpdatedAt).toBe(server.content.updatedAt);

    first.unmount();
    renderEditor();
    expect(await screen.findByLabelText('Titolo')).toHaveValue('Titolo salvato e ritoccato');
    expect(screen.queryByText(/più vecchia/)).toBeNull();
  });

  it('salvare il layout in «Pagina» non rende irrecuperabile la copia di lavoro', async () => {
    const user = userEvent.setup();
    const first = renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await user.clear(title);
    await user.type(title, 'Titolo ancora da salvare');
    await waitFor(() => expect(draftPuts()).toHaveLength(1), { timeout: 4000 });

    await user.click(screen.getByRole('tab', { name: 'Pagina' }));
    await user.selectOptions(screen.getByLabelText('Layout della pagina'), 'full_width');
    await user.click(screen.getByRole('button', { name: 'Salva il layout' }));
    await screen.findByText('La pagina pubblica usa il nuovo layout.');
    expect(callsTo(CONTENT_PATH, 'PATCH')).toHaveLength(1);

    // La copia di lavoro riparte sulla data di modifica nuova del contenuto.
    await waitFor(() => expect(draftPuts()).toHaveLength(2), { timeout: 4000 });
    expect(draftPuts()[1]).toMatchObject({
      title: 'Titolo ancora da salvare',
      baseUpdatedAt: server.content.updatedAt,
    });

    first.unmount();
    renderEditor();
    expect(await screen.findByLabelText('Titolo')).toHaveValue('Titolo ancora da salvare');
    expect(screen.queryByText(/più vecchia/)).toBeNull();
  });
});
