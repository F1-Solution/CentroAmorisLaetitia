import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import type { ContentDetail } from '../src/lib/editor/roundtrip';
import { blockDocumentSchema, serializeBlockDocument } from '@amoris/blocks';
import { syntheticContent } from './fixtures';

/**
 * DR-278 (wave 1G-W7, T2e) nell'area: «mostrare il titolo», «spazio fra le
 * colonne» e «notizia in primo piano» nella scheda «Pagina»; l'immagine in
 * evidenza anche per le pagine, con lo stesso controllo delle notizie; il tipo
 * di dati strutturati nella SEO del contenuto e nei modelli SEO.
 *
 * Ogni campo si salva da solo, come il layout: il «Salva» dei blocchi e la copia
 * di lavoro non li toccano, e l'andata e ritorno 1D-36 resta quella di prima.
 * Dati sintetici.
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
        permissions: ['content.read', 'content.write', 'content.publish', 'settings.write'],
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
const { ContentSeoPanel } = await import('../src/components/editor/ContentSeoPanel');
const { SeoAndRedirects } = await import('../src/components/seo/SeoAndRedirects');

const POST_ID = '55555555-5555-4555-8555-555555555555';
const MEDIA_PUBLIC = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const page: ContentDetail = { ...syntheticContent, gutterWidth: null, isSticky: false };

/** Una pagina che non comincia con una sezione: Divi le mostra il titolo (`page.php`). */
const plainDocument = blockDocumentSchema.parse({
  schema: 1,
  blocks: [
    {
      type: 'rich_text',
      id: 'b_0000000000f1',
      props: { html: '<p>Testo sintetico.</p>' },
      children: [],
    },
  ],
});
const plainPage: ContentDetail = {
  ...page,
  blocks: plainDocument,
  contentHtml: serializeBlockDocument(plainDocument),
};

const post: ContentDetail = {
  ...syntheticContent,
  id: POST_ID,
  type: 'post',
  slug: 'notizia-di-prova',
  path: '/notizia-di-prova/',
  title: 'Notizia di prova',
  gutterWidth: 2,
  isSticky: false,
  termIds: [],
  featuredMedia: null,
};

const mediaList = {
  items: [
    {
      id: MEDIA_PUBLIC,
      publicPath: '/media/pubblica.jpg',
      fileName: 'pubblica.jpg',
      title: 'Sala di prova',
      isPrivate: false,
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
        sectionId={content.type === 'post' ? 'notizie' : 'pagine'}
        listHref="/redazione/pagine"
        listLabel="Pagine"
      />
    </DensityProvider>,
  );
}

function writesTo(path: string, method: string): { body?: unknown }[] {
  return apiMock.mock.calls
    .filter((call) => call[0] === path && (call[1] as { method?: string })?.method === method)
    .map((call) => call[1] as { body?: unknown });
}

function allWrites(): unknown[][] {
  return apiMock.mock.calls.filter((call) => {
    const method = (call[1] as { method?: string } | undefined)?.method;
    return method !== undefined && method !== 'GET';
  });
}

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === `/contents/${detail.id}` && options?.method === 'PATCH') {
      return Promise.resolve({ updatedAt: '2026-10-27T10:00:00.000Z' });
    }
    if (path === `/contents/${detail.id}`) return Promise.resolve(detail);
    if (path === `/contents/${detail.id}/draft`) {
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    }
    if (path.startsWith('/terms')) return Promise.resolve([]);
    if (path.startsWith('/media')) return Promise.resolve(mediaList);
    if (path.startsWith('/seo/contents/')) {
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    }
    return Promise.resolve(undefined);
  });
});

async function openPageTab(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await screen.findByLabelText('Titolo');
  await user.click(screen.getByRole('tab', { name: 'Pagina' }));
  return screen.findByRole('group', { name: 'Titolo e colonne' });
}

describe('scheda «Pagina»: titolo, spazio fra le colonne, primo piano (DR-278)', () => {
  it('una pagina: titolo visibile e spazio del tema; nessun «primo piano»', async () => {
    const user = userEvent.setup();
    renderEditor(plainPage);
    const group = await openPageTab(user);
    expect(within(group).getByLabelText('Mostra il titolo della pagina')).toBeChecked();
    expect(within(group).getByLabelText('Spazio fra le colonne')).toHaveValue('');
    expect(within(group).queryByLabelText('Notizia in primo piano')).toBeNull();
    expect(within(group).getByRole('button', { name: 'Salva titolo e colonne' })).toBeDisabled();
  });

  it('spegne il titolo e sceglie lo spazio 3 con un PATCH dei soli due campi', async () => {
    const user = userEvent.setup();
    renderEditor(plainPage);
    const group = await openPageTab(user);
    await user.click(within(group).getByLabelText('Mostra il titolo della pagina'));
    await user.selectOptions(within(group).getByLabelText('Spazio fra le colonne'), '3');
    await user.click(within(group).getByRole('button', { name: 'Salva titolo e colonne' }));

    await waitFor(() => expect(writesTo(`/contents/${page.id}`, 'PATCH')).toHaveLength(1));
    expect(writesTo(`/contents/${page.id}`, 'PATCH')[0]?.body).toEqual({
      showTitle: false,
      gutterWidth: 3,
    });
    // Nessun'altra scrittura: blocchi e copia di lavoro restano fuori (1D-36).
    expect(allWrites()).toHaveLength(1);
    await screen.findByText('Il sito usa le nuove impostazioni.');
  });

  it('una notizia: titolo e «primo piano», e tornare allo spazio del tema invia null', async () => {
    const user = userEvent.setup();
    renderEditor(post);
    const group = await openPageTab(user);
    expect(within(group).getByLabelText('Mostra il titolo della notizia')).toBeChecked();
    expect(within(group).getByLabelText('Spazio fra le colonne')).toHaveValue('2');
    const sticky = within(group).getByLabelText('Notizia in primo piano');
    expect(sticky).not.toBeChecked();
    // Il testo d'aiuto dice dove conta, come nella sorgente.
    const help = document.getElementById(sticky.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toMatch(/non cambia l’ordine/);

    await user.click(sticky);
    await user.selectOptions(within(group).getByLabelText('Spazio fra le colonne'), '');
    await user.click(within(group).getByRole('button', { name: 'Salva titolo e colonne' }));
    await waitFor(() => expect(writesTo(`/contents/${POST_ID}`, 'PATCH')).toHaveLength(1));
    expect(writesTo(`/contents/${POST_ID}`, 'PATCH')[0]?.body).toEqual({
      gutterWidth: null,
      isSticky: true,
    });
  });

  it('DR-286: una notizia spegne il titolo; l’aiuto dice che a sezioni sparisce anche la data', async () => {
    const user = userEvent.setup();
    renderEditor(post);
    const group = await openPageTab(user);
    const box = within(group).getByLabelText('Mostra il titolo della notizia');
    const help = document.getElementById(box.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toMatch(/costruita a sezioni perde titolo e data/);
    await user.click(box);
    await user.click(within(group).getByRole('button', { name: 'Salva titolo e colonne' }));
    await waitFor(() => expect(writesTo(`/contents/${POST_ID}`, 'PATCH')).toHaveLength(1));
    expect(writesTo(`/contents/${POST_ID}`, 'PATCH')[0]?.body).toEqual({ showTitle: false });
  });

  it('una pagina che comincia con una sezione: la casella è spenta e l’aiuto dice perché', async () => {
    const user = userEvent.setup();
    renderEditor(page);
    const group = await openPageTab(user);
    const box = within(group).getByLabelText('Mostra il titolo della pagina');
    expect(box).toBeDisabled();
    const help = document.getElementById(box.getAttribute('aria-describedby') ?? '');
    expect(help?.textContent).toMatch(/comincia con una sezione/);
    expect(help?.textContent).toMatch(/non mostra il titolo/);
  });

  it('mostra il messaggio dell’API se il salvataggio è rifiutato', async () => {
    const user = userEvent.setup();
    const message = 'Lo spazio fra le colonne è un valore da 1 a 4.';
    renderEditor(page);
    const group = await openPageTab(user);
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (options?.method === 'PATCH') {
        return Promise.reject(new ApiError(400, 'VALIDATION_FAILED', message));
      }
      return Promise.resolve(detail);
    });
    await user.selectOptions(within(group).getByLabelText('Spazio fra le colonne'), '4');
    await user.click(within(group).getByRole('button', { name: 'Salva titolo e colonne' }));
    expect(await within(group).findByRole('alert')).toHaveTextContent(message);
  });

  it('andata e ritorno 1D-36: aprire e premere «Salva» senza modifiche non scrive nulla', async () => {
    const user = userEvent.setup();
    renderEditor({ ...page, showTitle: false, gutterWidth: 3 });
    await screen.findByLabelText('Titolo');
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await screen.findByText('Nessuna modifica: il contenuto non è stato riscritto.');
    expect(allWrites()).toHaveLength(0);
  });
});

describe('immagine in evidenza di una pagina (DR-278)', () => {
  it('la pagina ha la scheda «Immagine in evidenza», senza categorie', async () => {
    const user = userEvent.setup();
    renderEditor(page);
    await screen.findByLabelText('Titolo');
    expect(screen.queryByRole('tab', { name: 'Elenchi e archivi' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Immagine in evidenza' }));
    const group = await screen.findByRole('group', { name: 'Immagine in evidenza' });
    expect(screen.queryByRole('group', { name: 'Categorie' })).toBeNull();
    expect(apiMock).not.toHaveBeenCalledWith('/terms?taxonomy=category', expect.anything());
    // Dove conta per una pagina: non nel testo, come il tema della sorgente.
    expect(group.textContent).toMatch(/non la mostra nella pagina/);
    expect(group.textContent).toMatch(/dati strutturati/);
  });

  it('sceglie un’immagine con un PATCH del solo featuredMediaId', async () => {
    const user = userEvent.setup();
    renderEditor(page);
    await screen.findByLabelText('Titolo');
    await user.click(screen.getByRole('tab', { name: 'Immagine in evidenza' }));
    await user.click(await screen.findByRole('button', { name: 'Scegli un’immagine' }));
    const panel = await screen.findByRole('dialog', { name: 'Scegli un media' });
    await user.click(await within(panel).findByText('Sala di prova'));
    await user.click(within(panel).getByRole('button', { name: 'Usa questo media' }));
    await waitFor(() => expect(writesTo(`/contents/${page.id}`, 'PATCH')).toHaveLength(1));
    expect(writesTo(`/contents/${page.id}`, 'PATCH')[0]?.body).toEqual({
      featuredMediaId: MEDIA_PUBLIC,
    });
    expect(await screen.findByAltText('Sala di prova')).toHaveAttribute(
      'src',
      '/media/pubblica.jpg',
    );
  });
});

describe('tipo di dati strutturati (DR-278)', () => {
  function renderSeo() {
    return render(
      <DensityProvider>
        <ContentSeoPanel contentId={page.id} path="/pagina-di-prova/" disabled={false} />
      </DensityProvider>,
    );
  }

  it('nella SEO del contenuto: «come il modello» per vuoto, poi la scelta va nel PUT', async () => {
    const user = userEvent.setup();
    renderSeo();
    const select = await screen.findByLabelText('Tipo di dati strutturati');
    await waitFor(() => expect(screen.queryByText(/Caricamento dei metadati/)).toBeNull());
    expect(select).toHaveValue('');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.getAttribute('value')),
    ).toEqual(['', 'WebPage', 'BlogPosting']);
    await user.selectOptions(select, 'BlogPosting');
    await user.click(screen.getByRole('button', { name: 'Salva i metadati SEO' }));
    await waitFor(() => expect(writesTo(`/seo/contents/${page.id}`, 'PUT')).toHaveLength(1));
    expect(writesTo(`/seo/contents/${page.id}`, 'PUT')[0]?.body).toMatchObject({
      schemaType: 'BlogPosting',
    });
  });

  it('nella SEO del contenuto: il valore salvato si rilegge', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path.startsWith('/seo/contents/')) {
        return Promise.resolve({
          contentId: page.id,
          title: null,
          description: null,
          canonicalUrl: null,
          ogTitle: null,
          ogDescription: null,
          ogImageId: null,
          robotsNoindex: false,
          robotsNofollow: false,
          schemaType: 'WebPage',
          updatedAt: '2026-10-27T10:00:00.000Z',
        });
      }
      return Promise.resolve({ items: [] });
    });
    renderSeo();
    await waitFor(() =>
      expect(screen.getByLabelText('Tipo di dati strutturati')).toHaveValue('WebPage'),
    );
  });

  const template = (scope: string) => ({
    scope,
    titleTemplate: '{title} - {site_title}',
    descriptionTemplate: null,
    robotsDirectives: [],
    ogType: null,
    schemaType: null,
    updatedAt: '2026-01-10T10:00:00.000Z',
  });

  function renderTemplates() {
    apiMock.mockImplementation((path: string) => {
      if (path === '/seo/templates')
        return Promise.resolve([template('page'), template('category')]);
      if (path.startsWith('/redirects')) {
        return Promise.resolve({ items: [], meta: { total: 0, page: 1, perPage: 50 } });
      }
      return Promise.resolve({});
    });
    return render(
      <DensityProvider>
        <SeoAndRedirects />
      </DensityProvider>,
    );
  }

  it('nel modello delle pagine si sceglie, e il PUT la porta', async () => {
    const user = userEvent.setup();
    renderTemplates();
    await user.click(await screen.findByRole('button', { name: 'Pagine' }));
    const panel = screen.getByRole('dialog', { name: 'Pagine' });
    const select = within(panel).getByLabelText('Tipo di dati strutturati');
    expect(select).toHaveValue('');
    await user.selectOptions(select, 'WebPage');
    await user.click(within(panel).getByRole('button', { name: 'Salva il template' }));
    await waitFor(() => expect(writesTo('/seo/templates/page', 'PUT')).toHaveLength(1));
    expect(writesTo('/seo/templates/page', 'PUT')[0]?.body).toMatchObject({
      schemaType: 'WebPage',
    });
  });

  it('nel modello delle categorie non si offre: il sito non lo userebbe', async () => {
    const user = userEvent.setup();
    renderTemplates();
    await user.click(await screen.findByRole('button', { name: 'Categorie' }));
    const panel = screen.getByRole('dialog', { name: 'Categorie' });
    expect(within(panel).queryByLabelText('Tipo di dati strutturati')).toBeNull();
  });
});
