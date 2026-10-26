import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import type { ContentDetail } from '../src/lib/editor/roundtrip';
import { previewUrl } from '../src/lib/siteUrl';
import { syntheticContent } from './fixtures';

/**
 * Wave 1G-W5, T6 (S17): «Anteprima sul sito» apre `<sito>/anteprima/<id>/` in una scheda nuova,
 * dopo aver salvato la copia di lavoro in sospeso. Titoli e indirizzi sono inventati.
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

const PAGE_ID = '77777777-7777-4777-8777-777777777777';
const CONTENT_PATH = `/contents/${PAGE_ID}`;
const DRAFT_PATH = `${CONTENT_PATH}/draft`;

const page: ContentDetail = {
  ...syntheticContent,
  id: PAGE_ID,
  type: 'page',
  status: 'draft',
  slug: 'pagina-di-prova',
  path: '/pagina-di-prova/',
  title: 'Pagina di prova',
  publishedAt: null,
};

let draftSaved: (() => void) | null;
let holdDraft: boolean;

function install(): void {
  apiMock.mockImplementation((path: string, options?: { method?: string }) => {
    const method = options?.method ?? 'GET';
    if (path === CONTENT_PATH) return Promise.resolve(page);
    if (path === DRAFT_PATH && method === 'PUT') {
      const saved = {
        title: 'x',
        excerpt: null,
        blocks: page.blocks,
        updatedAt: page.updatedAt,
        stillCurrent: true,
      };
      if (!holdDraft) return Promise.resolve(saved);
      return new Promise((resolve) => {
        draftSaved = () => resolve(saved);
      });
    }
    if (path === DRAFT_PATH) {
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    }
    return Promise.resolve(undefined);
  });
}

function renderEditor() {
  return render(
    <DensityProvider>
      <ContentEditor
        contentId={PAGE_ID}
        sectionId="pagine"
        listHref="/redazione/pagine"
        listLabel="Pagine"
      />
    </DensityProvider>,
  );
}

const draftPuts = () =>
  apiMock.mock.calls.filter(
    (call) => call[0] === DRAFT_PATH && (call[1] as { method?: string })?.method === 'PUT',
  );

describe('indirizzo dell’anteprima (S17)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('con NEXT_PUBLIC_SITE_URL è assoluto e senza doppia barra', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sito.example.invalid/');
    expect(previewUrl(PAGE_ID)).toBe(`https://sito.example.invalid/anteprima/${PAGE_ID}/`);
  });

  it('senza la variabile è relativo alla radice, fuori dal basePath dell’area', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(previewUrl(PAGE_ID)).toBe(`/anteprima/${PAGE_ID}/`);
  });
});

describe('«Anteprima sul sito» nell’editor', () => {
  const open = vi.fn();

  beforeEach(() => {
    apiMock.mockReset();
    open.mockReset();
    draftSaved = null;
    holdDraft = false;
    install();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sito.example.invalid');
    vi.stubGlobal('open', open);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('senza modifiche in sospeso apre subito una scheda nuova e non scrive la copia di lavoro', async () => {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByLabelText('Titolo');
    await user.click(screen.getByRole('button', { name: 'Anteprima sul sito' }));

    expect(open).toHaveBeenCalledWith(
      `https://sito.example.invalid/anteprima/${PAGE_ID}/`,
      '_blank',
      'noopener',
    );
    expect(draftPuts()).toEqual([]);
  });

  it('con modifiche in sospeso salva prima la copia di lavoro e poi porta la scheda sull’anteprima', async () => {
    holdDraft = true;
    const tab = { location: { href: '' }, close: vi.fn(), opener: {} };
    open.mockReturnValue(tab);
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await user.type(title, ' ritoccata');
    await user.click(screen.getByRole('button', { name: 'Anteprima sul sito' }));

    // La scheda si apre subito (gesto dell'utente), ma resta vuota finché il salvataggio non è finito.
    await waitFor(() => expect(draftPuts()).toHaveLength(1));
    expect(open).toHaveBeenCalledTimes(1);
    expect(tab.location.href).toBe('');
    draftSaved?.();
    await waitFor(() =>
      expect(tab.location.href).toBe(`https://sito.example.invalid/anteprima/${PAGE_ID}/`),
    );
    expect(tab.opener).toBeNull();
  });

  it('se il salvataggio fallisce chiude la scheda vuota e lo dice', async () => {
    const tab = { location: { href: '' }, close: vi.fn(), opener: {} };
    open.mockReturnValue(tab);
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === CONTENT_PATH) return Promise.resolve(page);
      if (path === DRAFT_PATH && options?.method === 'PUT') {
        return Promise.reject(new Error('rete'));
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await user.type(title, ' ritoccata');
    await user.click(screen.getByRole('button', { name: 'Anteprima sul sito' }));

    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(tab.location.href).toBe('');
    expect(await screen.findByText(/La copia di lavoro non è stata salvata/)).toBeInTheDocument();
  });
});
