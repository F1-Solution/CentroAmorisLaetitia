import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import { serializeBlockDocument } from '@amoris/blocks';
import { findBlock, insertBlock, replaceBlock } from '../src/lib/editor/tree';
import { syntheticContent, syntheticDocument } from './fixtures';

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
    await user.click(screen.getByRole('button', { name: 'Salva il layout e aggiorna il sito' }));

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

    await user.click(screen.getByRole('button', { name: 'Salva e aggiorna il sito' }));

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
    await user.click(screen.getByRole('button', { name: 'Salva e aggiorna il sito' }));
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
    await user.click(screen.getByRole('button', { name: 'Salva e aggiorna il sito' }));
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

  it('W2-3: mostra «Ultima modifica di X il Y» dal registro', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({
          ...syntheticContent,
          lastChange: { actorLabel: 'Ada Inventata', occurredAt: '2026-10-01T12:30:00.000Z' },
        });
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    renderEditor();
    const riga = await screen.findByText(/^Ultima modifica di Ada Inventata il /);
    expect(riga.textContent).toMatch(/01\/10\/2026/);
  });

  it('W2-3: per un contenuto mai toccato dopo l’import cita la sorgente', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({
          ...syntheticContent,
          lastChange: { importedAt: '2026-03-05T12:00:00.000Z' },
        });
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    renderEditor();
    const riga = await screen.findByText(/^Importato dalla sorgente, ultima modifica il /);
    expect(riga.textContent).toMatch(/05\/03\/2026/);
  });

  it('m5: dopo il salvataggio del layout «Ultima modifica» si aggiorna senza ricaricare l’editor', async () => {
    const user = userEvent.setup();
    let reads = 0;
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === `/contents/${syntheticContent.id}` && !options?.method) {
        reads += 1;
        return Promise.resolve({
          ...syntheticContent,
          lastChange:
            reads === 1
              ? { actorLabel: 'Ada Inventata', occurredAt: '2026-10-01T12:30:00.000Z' }
              : { actorLabel: 'Bruno Inventato', occurredAt: '2026-10-02T09:00:00.000Z' },
        });
      }
      if (options?.method === 'PATCH') return Promise.resolve(undefined);
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    renderEditor();
    await screen.findByText(/^Ultima modifica di Ada Inventata il /);
    await user.click(screen.getByRole('tab', { name: 'Pagina' }));
    await user.selectOptions(screen.getByLabelText('Layout della pagina'), 'full_width');
    await user.click(screen.getByRole('button', { name: 'Salva il layout e aggiorna il sito' }));
    expect(await screen.findByText(/^Ultima modifica di Bruno Inventato il /)).toBeInTheDocument();
    // Si rilegge solo il contenuto: la copia di lavoro non viene richiesta di nuovo.
    expect(apiMock.mock.calls.filter((c) => (c[0] as string).endsWith('/draft'))).toHaveLength(1);
  });

  it('W2-3: senza ultima modifica non scrive nulla', async () => {
    renderEditor();
    await waitForEditor();
    expect(screen.queryByText(/Ultima modifica/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Importato dalla sorgente/)).not.toBeInTheDocument();
  });

  it('W8-13: su un contenuto pubblicato «Salva» si chiama «Salva e aggiorna il sito» e avvisa', async () => {
    renderEditor();
    await waitForEditor();
    expect(screen.getByRole('button', { name: 'Salva e aggiorna il sito' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva' })).toBeNull();
    expect(screen.getByText('Le modifiche salvate compaiono subito sul sito.')).toBeInTheDocument();
  });

  it('W8-13: su un contenuto non pubblicato «Salva» resta «Salva», senza l’avviso', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({ ...syntheticContent, status: 'draft', publishedAt: null });
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument();
    expect(screen.queryByText('Le modifiche salvate compaiono subito sul sito.')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Pagina' }));
    expect(screen.getByRole('button', { name: 'Salva il layout' })).toBeInTheDocument();
  });

  it('W8-13: la scheda «Pagina» di un contenuto pubblicato avvisa che il layout va subito sul sito', async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitForEditor();
    await user.click(screen.getByRole('tab', { name: 'Pagina' }));
    expect(
      screen.getByRole('button', { name: 'Salva il layout e aggiorna il sito' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Il nuovo layout compare subito sul sito, senza passare dall’anteprima.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Salva il layout e aggiorna il sito' }),
    ).toHaveAccessibleDescription(
      'Il nuovo layout compare subito sul sito, senza passare dall’anteprima.',
    );
  });

  it('W8-24: la pagina iniziale con il titolo vuoto si riconosce nell’intestazione', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({ ...syntheticContent, title: '', isHome: true, path: '/home/' });
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    renderEditor();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pagina iniziale' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/\/home\/ — pubblicato — pagina iniziale/)).toBeInTheDocument();
  });

  it('DR-314: sulla pagina iniziale «Ritira» è disattivato e una frase dice perché', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({ ...syntheticContent, isHome: true });
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    renderEditor();
    const ritira = await screen.findByRole('button', { name: 'Ritira' });
    expect(ritira).toBeDisabled();
    expect(ritira).toHaveAccessibleDescription(
      'La pagina iniziale non si può ritirare: prima scegline un’altra nelle Impostazioni.',
    );
  });

  it('DR-314: se l’API rifiuta il ritiro, l’editor mostra il motivo in italiano', async () => {
    const user = userEvent.setup();
    const motivo =
      'Il contenuto è la pagina iniziale del sito: scegli prima un’altra pagina iniziale.';
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === `/contents/${syntheticContent.id}/unpublish`) {
        return Promise.reject(new ApiError(409, 'CONTENT_IS_HOME', motivo));
      }
      if (path === `/contents/${syntheticContent.id}` && !options?.method) {
        return Promise.resolve({ ...syntheticContent, isHome: false });
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    renderEditor();
    const ritira = await screen.findByRole('button', { name: 'Ritira' });
    expect(ritira).toBeEnabled();
    expect(ritira).not.toHaveAccessibleDescription();
    await user.click(ritira);
    expect(await screen.findByText(motivo)).toBeInTheDocument();
    expect(screen.getByText('Operazione non riuscita')).toBeInTheDocument();
  });

  it('W8-24: una pagina comune senza titolo non si spaccia per la pagina iniziale', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({ ...syntheticContent, title: '', isHome: false });
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    renderEditor();
    await screen.findByText(/pubblicato/);
    expect(screen.queryByText(/pagina iniziale/i)).toBeNull();
  });

  it('W8-33: nell’albero un blocco Documento senza etichetta porta il titolo del documento', async () => {
    const DOC_ID = '77777777-7777-4777-8777-777777777777';
    const { document } = insertBlock(syntheticDocument, 'b_0000000000a3', 'document', {
      documentId: DOC_ID,
    });
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({
          ...syntheticContent,
          blocks: document,
          contentHtml: serializeBlockDocument(document),
        });
      }
      if (path === '/documents') {
        return Promise.resolve([{ id: DOC_ID, title: 'Statuto pubblicato' }]);
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    renderEditor();
    await waitFor(() => {
      expect(within(tree()).getByText(/Statuto pubblicato/)).toBeInTheDocument();
    });
  });

  it('W8-33: senza blocchi Documento l’elenco dei documenti non si chiede', async () => {
    renderEditor();
    await waitForEditor();
    expect(apiMock.mock.calls.filter((call) => call[0] === '/documents')).toEqual([]);
  });

  it('W10-N1: nell’albero un «Elenco di contenuti» porta categorie e numero di notizie', async () => {
    const CATEGORIA = '55555555-5555-4555-8555-555555555555';
    const inserted = insertBlock(syntheticDocument, 'b_0000000000a3', 'post_list');
    const block = findBlock(inserted.document.blocks, inserted.insertedId);
    if (block?.type !== 'post_list') throw new Error('blocco non inserito');
    const document = replaceBlock(inserted.document, {
      ...block,
      props: { ...block.props, termIds: [CATEGORIA], limit: 3 },
    });
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) {
        return Promise.resolve({
          ...syntheticContent,
          blocks: document,
          contentHtml: serializeBlockDocument(document),
        });
      }
      if (path === '/terms?taxonomy=category') {
        return Promise.resolve([{ id: CATEGORIA, name: 'Categoria inventata' }]);
      }
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    renderEditor();
    await waitFor(() => {
      expect(within(tree()).getByText(/Categoria inventata · 3 notizie/)).toBeInTheDocument();
    });
  });

  it('W10-N1: senza «Elenco di contenuti» le categorie non si chiedono', async () => {
    renderEditor();
    await waitForEditor();
    expect(apiMock.mock.calls.filter((call) => String(call[0]).startsWith('/terms'))).toEqual([]);
  });

  it.each([
    ['vuoto', ''],
    ['di soli spazi', '   '],
  ])(
    'W10-N3: un contenuto con il titolo %s si chiama «Senza titolo» nell’intestazione',
    async (_, title) => {
      apiMock.mockImplementation((path: string) => {
        if (path === `/contents/${syntheticContent.id}`) {
          return Promise.resolve({ ...syntheticContent, title, status: 'draft' });
        }
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      });
      renderEditor();
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Senza titolo' }),
      ).toBeInTheDocument();
    },
  );
});
