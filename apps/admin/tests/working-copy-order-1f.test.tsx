import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import { syntheticContent } from './fixtures';

/*
 * W9-N7 (DR-330, DR-350): su una rete lenta i salvataggi della copia di lavoro
 * non devono superarsi, e un salvataggio ancora in viaggio non deve far
 * rinascere la copia dopo «Scarta», «Salva» o «Pubblica».
 *
 * Il servizio è simulato con uno stato proprio: un PUT della copia arriva al
 * servizio solo quando la prova lo rilascia, nell'ordine che la prova sceglie;
 * PATCH, DELETE e pubblicazione arrivano subito. Così si riproduce la rete che
 * consegna le richieste in ordine diverso da quello di partenza. Titoli
 * inventati, nessun dato reale.
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

interface StoredDraft {
  title: string;
  updatedAt: string;
}

interface HeldPut {
  title: string;
  /** Consegna il PUT al servizio e manda la risposta all'editor. */
  deliver: () => void;
}

/** La copia di lavoro come la vede il servizio simulato. */
let serverDraft: StoredDraft | null;
/** PUT partiti dall'editor e non ancora arrivati al servizio, in ordine di partenza. */
let heldPuts: HeldPut[];
let clock: number;

function nextTimestamp(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 3, 9, clock)).toISOString();
}

beforeEach(() => {
  apiMock.mockReset();
  serverDraft = null;
  heldPuts = [];
  clock = 0;
  apiMock.mockImplementation((path: string, options?: { method?: string; body?: unknown }) => {
    const method = options?.method ?? 'GET';
    if (path === DRAFT_PATH && method === 'PUT') {
      const { title } = options?.body as { title: string };
      return new Promise((resolve) => {
        heldPuts.push({
          title,
          deliver: () => {
            serverDraft = { title, updatedAt: nextTimestamp() };
            resolve({ ...(options?.body as object), ...serverDraft, stillCurrent: true });
          },
        });
      });
    }
    if (path === DRAFT_PATH && method === 'DELETE') {
      serverDraft = null;
      return Promise.resolve(undefined);
    }
    if (path === DRAFT_PATH) return Promise.resolve(undefined);
    if (path === `/contents/${PAGE_ID}` && method === 'PATCH') {
      return Promise.resolve({ updatedAt: nextTimestamp() });
    }
    if (path === `/contents/${PAGE_ID}/publish` || path === `/contents/${PAGE_ID}/unpublish`) {
      return Promise.resolve(undefined);
    }
    if (path === `/contents/${PAGE_ID}`) return Promise.resolve(syntheticContent);
    if (path.startsWith('/media')) return Promise.resolve({ items: [] });
    if (path.startsWith('/terms')) return Promise.resolve([]);
    return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
  });
});

function renderEditor(): void {
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
}

/** Aspetta che il salvataggio automatico (1,5 s) abbia avuto il tempo di partire. */
const pastAutosave = (): Promise<void> => new Promise((done) => setTimeout(done, 2200));

/**
 * Consegna i PUT trattenuti dal più recente al più vecchio, come una rete che
 * li inverte, finché l'editor non ne manda più.
 */
async function deliverNewestFirst(): Promise<void> {
  for (let round = 0; round < 6; round += 1) {
    while (heldPuts.length > 0) heldPuts.pop()!.deliver();
    await pastAutosave();
    if (heldPuts.length === 0) return;
  }
}

/** Primo salvataggio riuscito: compare «Scarta la copia di lavoro». */
async function saveFirstDraft(title: HTMLElement): Promise<void> {
  const user = userEvent.setup();
  await user.type(title, ' A');
  await waitFor(() => expect(heldPuts).toHaveLength(1), { timeout: 4000 });
  heldPuts.shift()!.deliver();
  await screen.findByText(/^Copia di lavoro salvata alle/, {}, { timeout: 4000 });
}

/** Una modifica nuova il cui PUT resta in viaggio. */
async function leaveSaveInFlight(title: HTMLElement): Promise<void> {
  const user = userEvent.setup();
  await user.type(title, 'B');
  await waitFor(() => expect(heldPuts).toHaveLength(1), { timeout: 4000 });
}

describe('W9-N7: salvataggi della copia di lavoro su una rete lenta', () => {
  it('due salvataggi consegnati in ordine inverso lasciano sul servizio la copia più recente', async () => {
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByLabelText('Titolo');

    await user.type(title, ' A');
    await waitFor(() => expect(heldPuts).toHaveLength(1), { timeout: 4000 });
    // Il primo PUT è in viaggio; si scrive ancora e si lascia partire il salvataggio automatico.
    await user.type(title, 'B');
    await pastAutosave();

    await deliverNewestFirst();

    expect(serverDraft?.title).toBe(`${syntheticContent.title} AB`);
    // L'ora mostrata è quella della copia più recente, non di quella superata (W1-1).
    const shown = new Date(serverDraft!.updatedAt).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    });
    expect(
      await screen.findByText(`Copia di lavoro salvata alle ${shown}.`, { exact: false }),
    ).toBeInTheDocument();
  }, 30_000);

  it('dopo «Scarta la copia di lavoro» un salvataggio in viaggio non fa rinascere la copia', async () => {
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await saveFirstDraft(title);
    await leaveSaveInFlight(title);

    await user.click(screen.getByRole('button', { name: 'Scarta la copia di lavoro' }));
    await deliverNewestFirst();
    await pastAutosave();

    expect(serverDraft).toBeNull();
  }, 30_000);

  it('mentre «Scarta» attende il salvataggio in viaggio, i pulsanti sono disattivati (DR-355)', async () => {
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await saveFirstDraft(title);
    await leaveSaveInFlight(title);

    const discard = screen.getByRole('button', { name: 'Scarta la copia di lavoro' });
    await user.click(discard);
    // Il PUT è ancora trattenuto: un secondo clic o «Salva» non devono poter partire.
    await waitFor(() => expect(discard).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Anteprima sul sito' })).toBeDisabled();

    await deliverNewestFirst();
    expect(
      await screen.findByText('Copia di lavoro scartata: è tornato il contenuto salvato.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anteprima sul sito' })).toBeEnabled();
    expect(serverDraft).toBeNull();
  }, 30_000);

  it('dopo «Salva» un salvataggio in viaggio non fa rinascere la copia', async () => {
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await saveFirstDraft(title);
    await leaveSaveInFlight(title);

    await user.click(screen.getByRole('button', { name: 'Salva e aggiorna il sito' }));
    await deliverNewestFirst();
    await pastAutosave();

    expect(serverDraft).toBeNull();
  }, 30_000);

  it('dopo «Pubblica» un salvataggio in viaggio non fa rinascere la copia', async () => {
    const user = userEvent.setup();
    renderEditor();
    const title = await screen.findByLabelText('Titolo');
    await saveFirstDraft(title);
    await leaveSaveInFlight(title);

    await user.click(screen.getByRole('button', { name: 'Pubblica' }));
    await deliverNewestFirst();
    await pastAutosave();

    expect(serverDraft).toBeNull();
  }, 30_000);
});
