import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import { syntheticContent } from './fixtures';

/*
 * W9-N2, seconda metà (T11b): una modifica scritta mentre la copia di lavoro è
 * in viaggio verso il servizio deve finire nella copia successiva. Il
 * salvataggio automatico parte 1,5 s dopo l'ultima modifica; se all'arrivo
 * della risposta l'editor segnasse «nulla in sospeso» senza guardare ciò che è
 * cambiato nel frattempo, la copia di lavoro resterebbe indietro mentre lo
 * stato dice «Copia di lavoro salvata». Titoli inventati.
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

const PAGE_ID = syntheticContent.id;
const DRAFT_PATH = `/contents/${PAGE_ID}/draft`;

/** Le risposte ai PUT della copia di lavoro: la prova decide quando arrivano. */
let pendingPuts: Array<() => void>;

beforeEach(() => {
  apiMock.mockReset();
  pendingPuts = [];
  apiMock.mockImplementation((path: string, options?: { method?: string; body?: unknown }) => {
    const method = options?.method ?? 'GET';
    if (path === DRAFT_PATH && method === 'PUT') {
      const body = options?.body as { title: string };
      return new Promise((resolve) => {
        pendingPuts.push(() =>
          resolve({ ...body, updatedAt: '2026-10-30T09:00:00.000Z', stillCurrent: true }),
        );
      });
    }
    if (path === DRAFT_PATH) return Promise.resolve(undefined);
    if (path === `/contents/${PAGE_ID}`) return Promise.resolve(syntheticContent);
    if (path.startsWith('/media')) return Promise.resolve({ items: [] });
    if (path.startsWith('/terms')) return Promise.resolve([]);
    return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
  });
});

const draftTitles = (): string[] =>
  apiMock.mock.calls
    .filter((call) => call[0] === DRAFT_PATH && (call[1] as { method?: string })?.method === 'PUT')
    .map((call) => (call[1] as { body: { title: string } }).body.title);

describe('W9-N2: modifiche scritte mentre la copia di lavoro viaggia', () => {
  it('finiscono nella copia di lavoro successiva', async () => {
    const user = userEvent.setup();
    render(
      <DensityProvider>
        <ContentEditor
          contentId={PAGE_ID}
          sectionId="pagine"
          listHref="/redazione/pagine"
          listLabel="Pagine"
        />
      </DensityProvider>,
    );
    const title = await screen.findByLabelText('Titolo');

    await user.type(title, ' A');
    await waitFor(() => expect(draftTitles()).toHaveLength(1), { timeout: 4000 });

    // Il primo PUT è ancora in viaggio quando si scrive di nuovo.
    await user.type(title, 'B');
    pendingPuts.shift()!();

    await waitFor(() => expect(draftTitles()).toHaveLength(2), { timeout: 4000 });
    expect(draftTitles()[1]).toBe(`${syntheticContent.title} AB`);
    pendingPuts.shift()!();
    expect(
      await screen.findByText(/^Copia di lavoro salvata alle/, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});
