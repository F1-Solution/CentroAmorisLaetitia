import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import { syntheticContent } from './fixtures';

/**
 * I criteri 1D-28, 1D-30 e 1D-36 **eseguiti nell'applicazione**, non affermati.
 *
 * Il criterio 1D-36 è quello che conta: aprire un contenuto e premere «Salva»
 * senza aver modificato nulla non deve cambiare il contenuto. Qui si verifica
 * nel modo più severo possibile — **la richiesta di scrittura non parte** — e si
 * verifica **sul contenuto**, come DR-068 impone, non sulla copia di lavoro.
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

function renderEditor() {
  // Solo la densità: la sessione è simulata qui sopra e `SessionProvider`
  // interrogherebbe davvero `/auth/me`.
  return render(
    <DensityProvider>
      <ContentEditor
        contentId={syntheticContent.id}
        sectionId="pagine"
        listHref="/redazione/pagine"
        listLabel="Pagine"
      />
    </DensityProvider>,
  );
}

/** L'albero, distinto dall'anteprima: lo stesso testo compare in entrambi. */
function tree(): HTMLElement {
  return screen.getByRole('region', { name: 'Struttura del contenuto' });
}

async function waitForEditor(): Promise<void> {
  await waitFor(() => {
    expect(within(tree()).getByText(/Primo paragrafo di prova\./)).toBeInTheDocument();
  });
}

function writes(): unknown[][] {
  return apiMock.mock.calls.filter((call) => {
    const options = call[1] as { method?: string } | undefined;
    return options?.method !== undefined && options.method !== 'GET';
  });
}

describe('editor del contenuto', () => {
  beforeEach(() => {
    apiMock.mockReset();
    // Nessuna copia di lavoro: è il caso di un contenuto aperto la prima volta.
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) return Promise.resolve(syntheticContent);
      if (path === `/contents/${syntheticContent.id}/draft`) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      return Promise.resolve(undefined);
    });
  });

  it('apre il contenuto, lo mostra nell’albero e lo rende nell’anteprima', async () => {
    renderEditor();
    await waitForEditor();
    expect(within(tree()).getByText(/et_pb_finto/)).toBeInTheDocument();

    // Lo stesso testo compare due volte, ed è il punto: la seconda è
    // l'anteprima, resa dai componenti di `@amoris/blocks` (ADR-006 §3.3).
    const preview = screen.getByRole('region', { name: 'Anteprima' });
    expect(within(preview).getByText(/Primo paragrafo di prova\./)).toBeInTheDocument();
  });

  it('ogni blocco ha la maniglia del trascinamento a due esiti (DR-085)', async () => {
    renderEditor();
    await waitForEditor();
    const handles = within(tree()).getAllByRole('button', { name: /^Prendi «.+» per spostarlo$/ });
    expect(handles.length).toBeGreaterThan(0);
    // I bottoni restano: sono il percorso da tastiera (`design-system.md` §9.3).
    expect(within(tree()).getAllByRole('button', { name: /^Sposta su:/ }).length).toBe(
      handles.length,
    );
  });

  it('DR-139: il layout della pagina si sceglie nella scheda «Pagina» e si salva da solo', async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();

    await user.click(screen.getByRole('tab', { name: 'Pagina' }));
    const select = screen.getByLabelText('Layout della pagina');
    expect(select).toHaveValue('right_sidebar');
    await user.selectOptions(select, 'full_width');
    await user.click(screen.getByRole('button', { name: 'Salva il layout' }));

    await waitFor(() => {
      expect(writes()).toEqual([
        [
          `/contents/${syntheticContent.id}`,
          { method: 'PATCH', body: { pageLayout: 'full_width' } },
        ],
      ]);
    });
  });

  it('criterio 1D-36: salvare senza modifiche non scrive il contenuto', async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();

    await user.click(screen.getByRole('button', { name: 'Salva' }));

    await screen.findByText('Nessuna modifica: il contenuto non è stato riscritto.');
    // La prova è questa: nessuna richiesta di scrittura è mai partita.
    expect(writes()).toEqual([]);
  });

  it('lo stato dichiara in parole compiute che non c’è nulla da salvare', async () => {
    renderEditor();
    expect(
      await screen.findByText('Nessuna modifica rispetto al contenuto salvato.'),
    ).toBeInTheDocument();
  });

  it('criterio 1D-30: spostare un blocco lo sposta, e il salvataggio automatico scrive sulla bozza', async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();

    await user.click(screen.getByRole('button', { name: /Sposta giù: Primo paragrafo/ }));

    await waitFor(
      () => {
        const draftWrites = apiMock.mock.calls.filter(
          (call) =>
            call[0] === `/contents/${syntheticContent.id}/draft` &&
            (call[1] as { method?: string } | undefined)?.method === 'PUT',
        );
        expect(draftWrites.length).toBeGreaterThan(0);
      },
      { timeout: 4000 },
    );

    // Il salvataggio automatico **non** ha toccato il contenuto: è DR-068, ed è
    // la ragione per cui il criterio 1D-36 resta vero sul contenuto.
    const contentWrites = apiMock.mock.calls.filter(
      (call) =>
        call[0] === `/contents/${syntheticContent.id}` &&
        (call[1] as { method?: string } | undefined)?.method === 'PATCH',
    );
    expect(contentWrites).toEqual([]);
  });

  it('criterio 1D-28: ritirare un contenuto pubblicato è un comando esplicito', async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();

    await user.click(screen.getByRole('button', { name: 'Ritira' }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        `/contents/${syntheticContent.id}/unpublish`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('una modifica fatta mentre il salvataggio è in corso resta sullo schermo (DR-102)', async () => {
    // Il difetto del §3.1 di AUDIT.md: dopo «Salva» l'editor rileggeva il
    // contenuto e sostituiva ciò che si era scritto nel frattempo.
    let releasePatch: () => void = () => undefined;
    let savedTitle = syntheticContent.title;
    apiMock.mockImplementation((path: string, options?: { method?: string; body?: unknown }) => {
      if (path === `/contents/${syntheticContent.id}` && options?.method === 'PATCH') {
        savedTitle = (options.body as { title: string }).title;
        return new Promise<void>((resolve) => {
          releasePatch = resolve;
        });
      }
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({ ...syntheticContent, title: savedTitle });
      }
      if (path === `/contents/${syntheticContent.id}/draft`) {
        return options?.method === undefined
          ? Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'))
          : Promise.resolve(undefined);
      }
      return Promise.resolve(undefined);
    });
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();

    const title = screen.getByRole('textbox', { name: 'Titolo' });
    await user.clear(title);
    await user.type(title, 'Titolo salvato');
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(savedTitle).toBe('Titolo salvato'));

    await user.type(title, ' e poi ritoccato');
    releasePatch();

    await screen.findByText('Contenuto salvato.');
    expect(screen.getByRole('textbox', { name: 'Titolo' })).toHaveValue(
      'Titolo salvato e poi ritoccato',
    );
    expect(
      screen.getByText('Modifiche non ancora salvate nella copia di lavoro.'),
    ).toBeInTheDocument();
  });

  it('durante un salvataggio la copia di lavoro non si scrive (DR-102)', async () => {
    // Scritta durante il salvataggio, la copia porterebbe la data del contenuto
    // di prima e verrebbe scartata alla rilettura come «più vecchia».
    let releasePatch: () => void = () => undefined;
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === `/contents/${syntheticContent.id}` && options?.method === 'PATCH') {
        return new Promise<void>((resolve) => {
          releasePatch = resolve;
        });
      }
      if (path === `/contents/${syntheticContent.id}`) return Promise.resolve(syntheticContent);
      if (path === `/contents/${syntheticContent.id}/draft` && options?.method === undefined) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      return Promise.resolve(undefined);
    });
    const draftWrites = () =>
      apiMock.mock.calls.filter(
        (call) =>
          call[0] === `/contents/${syntheticContent.id}/draft` &&
          (call[1] as { method?: string } | undefined)?.method === 'PUT',
      ).length;
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();

    const title = screen.getByRole('textbox', { name: 'Titolo' });
    await user.type(title, ' modificato');
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await user.type(title, ' ancora');
    const before = draftWrites();
    // Più del ritardo del salvataggio automatico, con il salvataggio ancora aperto.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(draftWrites()).toBe(before);

    releasePatch();
    await screen.findByText('Contenuto salvato.');
    await waitFor(() => expect(draftWrites()).toBeGreaterThan(before), { timeout: 4000 });
  });

  it('un documento non valido non si apre, e lo dice invece di riscriverlo', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({
          ...syntheticContent,
          blocks: { schema: 1, blocks: [{ type: 'inesistente' }] },
        });
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });

    renderEditor();
    expect(await screen.findByText(/non è valido secondo il modello/)).toBeInTheDocument();
  });
});
