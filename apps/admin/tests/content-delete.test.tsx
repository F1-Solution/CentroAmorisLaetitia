import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import type { ContentDetail } from '../src/lib/editor/roundtrip';
import { syntheticContent } from './fixtures';

/**
 * Wave 1G-W4, T4: «Elimina» nell'editor (S7, D142-A, D143-A) e avviso nell'elenco.
 * Titoli, indirizzi e voci di menu sono inventati.
 */

const apiMock = vi.fn();
const pushMock = vi.fn();
let permissions: string[] = ['content.read', 'content.write', 'content.publish'];

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: pushMock }),
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
      user: {
        userId: 'u1',
        email: 'redazione@esempio.invalid',
        fullName: 'Redattrice di prova',
        mustChangePassword: false,
        permissions,
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
const { ContentList } = await import('../src/components/ContentList');

const ID = syntheticContent.id;
const free = {
  blocked: false,
  children: [],
  menuItems: [],
  isHome: false,
  redirectsToPath: [],
};

let content: ContentDetail;
let preview: typeof free | Record<string, unknown>;

function install(): void {
  apiMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === `/contents/${ID}/deletion`) return Promise.resolve(preview);
    if (path === `/contents/${ID}` && options?.method === 'DELETE')
      return Promise.resolve(undefined);
    if (path === `/contents/${ID}`) return Promise.resolve(content);
    if (path === `/contents/${ID}/draft`) {
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    }
    return Promise.resolve(undefined);
  });
}

function renderEditor() {
  return render(
    <DensityProvider>
      <ContentEditor
        contentId={ID}
        sectionId="pagine"
        listHref="/redazione/pagine"
        listLabel="Pagine"
      />
    </DensityProvider>,
  );
}

function writesTo(method: string): unknown[][] {
  return apiMock.mock.calls.filter(
    (call) => call[0] === `/contents/${ID}` && (call[1] as { method?: string })?.method === method,
  );
}

describe('«Elimina» nell’editor', () => {
  beforeEach(() => {
    apiMock.mockReset();
    pushMock.mockReset();
    permissions = ['content.read', 'content.write', 'content.publish'];
    content = { ...syntheticContent, status: 'draft', title: 'Bozza di prova' };
    preview = free;
    install();
  });

  it('con un’anteprima bloccata elenca i motivi e non offre la conferma', async () => {
    preview = {
      blocked: true,
      children: [{ id: 'f1', title: 'Figlia di prova', path: '/pagina-di-prova/figlia/' }],
      menuItems: [{ id: 'm1', label: 'Voce di prova', menu: 'Menu principale di prova' }],
      isHome: true,
      redirectsToPath: [],
    };
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));

    const dialog = await screen.findByRole('dialog', { name: 'Non si può eliminare' });
    expect(dialog).toHaveTextContent('Figlia di prova');
    expect(dialog).toHaveTextContent('/pagina-di-prova/figlia/');
    expect(dialog).toHaveTextContent('Voce di prova');
    expect(dialog).toHaveTextContent('Menu principale di prova');
    expect(dialog).toHaveTextContent(/pagina iniziale/);
    expect(within(dialog).queryByRole('button', { name: 'Elimina definitivamente' })).toBeNull();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(writesTo('DELETE')).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('senza impedimenti chiede di scrivere il titolo, e «Annulla» non scrive', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));

    const dialog = await screen.findByRole('dialog', { name: 'Elimina il contenuto' });
    const confirm = within(dialog).getByRole('button', { name: 'Elimina definitivamente' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Digita «Bozza di prova»/), 'Bozza di prova');
    expect(confirm).toBeEnabled();

    await user.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writesTo('DELETE')).toHaveLength(0);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('una pagina figlia senza titolo compare come «Senza titolo» (DR-331)', async () => {
    preview = {
      ...free,
      blocked: true,
      children: [{ id: 'f1', title: '', path: '/pagina-di-prova/figlia/' }],
    };
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));

    const dialog = await screen.findByRole('dialog', { name: 'Non si può eliminare' });
    expect(within(dialog).getByRole('listitem')).toHaveTextContent(
      'Senza titolo (/pagina-di-prova/figlia/)',
    );
  });

  // DR-331: con il titolo vuoto la conferma si accendeva senza scrivere nulla, perché il testo
  // digitato (vuoto) coincideva con il nome dell'oggetto; ora va scritto «Senza titolo».
  it.each([
    ['vuoto', ''],
    ['di soli spazi', '   '],
  ])(
    'con un titolo %s la conferma chiede di scrivere «Senza titolo» (DR-331)',
    async (_case, title) => {
      content = { ...syntheticContent, status: 'draft', title };
      const user = userEvent.setup();
      renderEditor();
      await user.click(await screen.findByRole('button', { name: 'Elimina' }));

      const dialog = await screen.findByRole('dialog', { name: 'Elimina il contenuto' });
      const confirm = within(dialog).getByRole('button', { name: 'Elimina definitivamente' });
      expect(confirm).toBeDisabled();
      const field = within(dialog).getByLabelText('Digita «Senza titolo» per confermare');
      if (title) {
        await user.type(field, title);
        expect(confirm).toBeDisabled();
        await user.clear(field);
      }
      await user.type(field, 'Senza titolo');
      expect(confirm).toBeEnabled();
      expect(writesTo('DELETE')).toHaveLength(0);
    },
  );

  it('elenca nella conferma le regole di redirect che restano (D143-A)', async () => {
    preview = { ...free, redirectsToPath: [{ source: '/vecchio-indirizzo/' }] };
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));
    const dialog = await screen.findByRole('dialog', { name: 'Elimina il contenuto' });
    expect(dialog).toHaveTextContent('/vecchio-indirizzo/');
    expect(dialog).toHaveTextContent(/pagina non trovata/);
    expect(dialog).toHaveTextContent(/pagina dei redirect/);
  });

  it('dopo l’eliminazione torna all’elenco con un indicatore costante, senza il titolo', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));
    const dialog = await screen.findByRole('dialog', { name: 'Elimina il contenuto' });
    await user.type(within(dialog).getByLabelText(/Digita/), 'Bozza di prova');
    await user.click(within(dialog).getByRole('button', { name: 'Elimina definitivamente' }));

    await waitFor(() => expect(writesTo('DELETE')).toHaveLength(1));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/redazione/pagine?eliminato=1'));
    // H-1: il titolo non entra nell'indirizzo, quindi né nella cronologia né nei log del proxy.
    expect(JSON.stringify(pushMock.mock.calls)).not.toContain('Bozza');
  });

  it('un rifiuto dell’API arrivato dopo l’anteprima si legge nella conferma e non si torna all’elenco', async () => {
    const message = 'Il contenuto ha ora delle pagine figlie: «Figlia nata nel frattempo».';
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === `/contents/${ID}/deletion`) return Promise.resolve(free);
      if (path === `/contents/${ID}` && options?.method === 'DELETE') {
        return Promise.reject(new ApiError(409, 'CONTENT_HAS_CHILDREN', message));
      }
      if (path === `/contents/${ID}`) return Promise.resolve(content);
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    });
    const user = userEvent.setup();
    renderEditor();
    await user.click(await screen.findByRole('button', { name: 'Elimina' }));
    const dialog = await screen.findByRole('dialog', { name: 'Elimina il contenuto' });
    await user.type(within(dialog).getByLabelText(/Digita/), 'Bozza di prova');
    await user.click(within(dialog).getByRole('button', { name: 'Elimina definitivamente' }));
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('senza content.publish un pubblicato non si elimina e lo dice (D142-A)', async () => {
    permissions = ['content.read', 'content.write'];
    content = { ...syntheticContent, status: 'published' };
    renderEditor();
    expect(await screen.findByText(/serve il permesso di pubblicare/)).toHaveTextContent(
      /Per eliminare un contenuto pubblicato/,
    );
    expect(screen.queryByRole('button', { name: 'Elimina' })).toBeNull();
    expect(apiMock).not.toHaveBeenCalledWith(`/contents/${ID}/deletion`, expect.anything());
  });

  it('«Elimina» usa la variante distruttiva, come gli altri comandi di eliminazione (m-2)', async () => {
    renderEditor();
    expect(await screen.findByRole('button', { name: 'Elimina' })).toHaveClass(
      'amoris-button--destructive',
    );
  });

  it('senza content.publish una bozza si elimina', async () => {
    permissions = ['content.read', 'content.write'];
    renderEditor();
    expect(await screen.findByRole('button', { name: 'Elimina' })).toBeEnabled();
  });

  it('in sola lettura il comando non c’è', async () => {
    permissions = ['content.read'];
    renderEditor();
    await screen.findByLabelText('Titolo');
    expect(screen.queryByRole('button', { name: 'Elimina' })).toBeNull();
  });
});

describe('avviso nell’elenco dopo un’eliminazione', () => {
  beforeEach(() => {
    apiMock.mockReset();
    permissions = ['content.read', 'content.write', 'content.publish'];
    apiMock.mockResolvedValue({ items: [], meta: { total: 0, page: 1, perPage: 25 } });
  });

  function renderList() {
    return render(
      <DensityProvider>
        <ContentList
          type="page"
          sectionId="pagine"
          title="Pagine"
          summary="Le pagine del sito."
          searchLabel="Cerca fra le pagine"
          emptyText="Nessuna pagina."
          caption="Pagine del sito"
          basePath="/redazione/pagine"
          createLabel="Nuova pagina"
        />
      </DensityProvider>,
    );
  }

  it('mostra un avviso generico e toglie l’indicatore dall’indirizzo senza aggiungere voci (H-1, m-3)', async () => {
    window.history.pushState({}, '', '/redazione/pagine?eliminato=1');
    const voci = window.history.length;
    renderList();
    const alert = await screen.findByText('Contenuto eliminato');
    expect(alert.closest('[role="status"]')).toHaveTextContent(
      'Il contenuto è stato eliminato definitivamente.',
    );
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(window.location.pathname).toBe('/redazione/pagine');
    expect(window.history.length).toBe(voci);
    window.history.pushState({}, '', '/');
  });

  it('ricaricando l’elenco l’avviso non ricompare (m-3)', async () => {
    window.history.pushState({}, '', '/redazione/pagine?eliminato=1');
    const first = renderList();
    await screen.findByText('Contenuto eliminato');
    first.unmount();
    renderList();
    await screen.findByRole('button', { name: 'Nuova pagina' });
    expect(screen.queryByText('Contenuto eliminato')).toBeNull();
    window.history.pushState({}, '', '/');
  });

  it('un titolo messo nell’indirizzo da un collegamento non compare e si toglie (H-1)', async () => {
    window.history.pushState(
      {},
      '',
      `/redazione/pagine?eliminato=${encodeURIComponent('Titolo inventato da un collegamento')}`,
    );
    renderList();
    await screen.findByRole('button', { name: 'Nuova pagina' });
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(screen.queryByText(/Titolo inventato/)).toBeNull();
    expect(screen.queryByText('Contenuto eliminato')).toBeNull();
    window.history.pushState({}, '', '/');
  });

  it('senza il parametro non mostra nulla', async () => {
    window.history.pushState({}, '', '/redazione/pagine');
    renderList();
    await screen.findByRole('button', { name: 'Nuova pagina' });
    expect(screen.queryByText('Contenuto eliminato')).toBeNull();
  });
});
