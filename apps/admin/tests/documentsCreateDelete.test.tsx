import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W7, T2h (DR-281): dalla schermata «Documenti» si crea un documento pubblico (titolo,
 * PDF, descrizione facoltativa, categoria dei download) e dalla scheda lo si elimina scrivendo
 * il titolo. Titoli, nomi di file e categorie sono inventati.
 */

const apiMock = vi.fn();
const uploadMock = vi.fn();
const pushMock = vi.fn();
const ALL = ['content.read', 'content.write', 'content.publish', 'media.write'];
let permissions: string[] = ALL;

const { ApiError } = await vi.importActual<typeof ApiModule>('../src/lib/api');

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('../src/lib/upload', () => ({
  uploadFile: (path: string, file: File, options?: unknown) => uploadMock(path, file, options),
}));

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
        fullName: 'Redazione di prova',
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

const { DocumentList } = await import('../src/components/documents/DocumentList');
const { DocumentEditor } = await import('../src/components/documents/DocumentEditor');
const { actionLabel } = await import('../src/lib/auditLabels');

const DOC = {
  id: '33333333-3333-4333-8333-333333333333',
  slug: 'modulo-di-prova',
  title: 'Modulo di prova',
  description: 'Descrizione inventata.',
  publishedAt: '2025-03-01T10:00:00.000Z',
  modifiedAt: null as string | null,
  sitePath: '/download/modulo-di-prova/',
  file: {
    mediaId: '44444444-4444-4444-8444-444444444444',
    fileName: 'modulo-di-prova.pdf',
    mimeType: 'application/pdf',
    byteSize: 2048,
    publicPath: '/media/2025/03/modulo-di-prova.pdf',
  },
};

const CATEGORIE = [
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Moduli inventati',
    taxonomy: 'wpdmcategory',
  },
  { id: '77777777-7777-4777-8777-777777777777', name: 'Altri inventati', taxonomy: 'wpdmcategory' },
];

const NUOVO_MEDIA = '88888888-8888-4888-8888-888888888888';
const NUOVO_DOC = '99999999-9999-4999-8999-999999999999';

const LIBERO = {
  blocked: false,
  contents: [],
  menuItems: [],
  redirectsToPath: [],
  fileShared: false,
};

function callsTo(method: string): unknown[][] {
  return apiMock.mock.calls.filter((call) => (call[1] as { method?: string })?.method === method);
}

const pdf = (name = 'modulo-nuovo.pdf'): File =>
  new File(['%PDF-1.4'], name, { type: 'application/pdf' });

beforeEach(() => {
  apiMock.mockReset();
  uploadMock.mockReset();
  pushMock.mockReset();
  permissions = ALL;
  apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path === '/documents' && !options?.method) return [DOC];
    if (path === '/terms?taxonomy=wpdmcategory') return CATEGORIE;
    if (path === '/documents' && options?.method === 'POST') return { ...DOC, id: NUOVO_DOC };
    if (path === `/documents/${DOC.id}` && !options?.method) return DOC;
    if (path === `/documents/${DOC.id}/deletion`) return LIBERO;
    if (path === `/documents/${DOC.id}` && options?.method === 'DELETE') return undefined;
    if (path === `/media/${NUOVO_MEDIA}` && options?.method === 'DELETE') return undefined;
    throw new Error(`chiamata non prevista: ${path}`);
  });
  uploadMock.mockResolvedValue({ id: NUOVO_MEDIA });
});

describe('registro delle operazioni', () => {
  it('«document.create» e «document.delete» si leggono in italiano', () => {
    expect(actionLabel('document.create')).toBe('Ha creato un documento');
    expect(actionLabel('document.delete')).toBe('Ha eliminato un documento');
  });
});

describe('«Nuovo documento» nell’elenco', () => {
  function renderList(): ReturnType<typeof userEvent.setup> {
    const user = userEvent.setup();
    render(
      <DensityProvider>
        <DocumentList />
      </DensityProvider>,
    );
    return user;
  }

  async function openDialog(): Promise<{
    user: ReturnType<typeof userEvent.setup>;
    dialogo: HTMLElement;
  }> {
    const user = renderList();
    await screen.findByRole('row', { name: /Modulo di prova/ });
    await user.click(screen.getByRole('button', { name: 'Nuovo documento' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuovo documento' });
    await within(dialogo).findByRole('option', { name: 'Moduli inventati' });
    return { user, dialogo };
  }

  it.each([
    [['content.read']],
    [['content.read', 'content.write']],
    [['content.read', 'media.write']],
    // Giro 1: senza content.publish non si crea né si elimina (DR-242, DR-246).
    [['content.read', 'content.write', 'media.write']],
  ])(
    'senza content.write, media.write e content.publish insieme il pulsante non c’è (%j)',
    async (perms) => {
      permissions = perms;
      renderList();
      await screen.findByRole('row', { name: /Modulo di prova/ });
      expect(screen.queryByRole('button', { name: 'Nuovo documento' })).not.toBeInTheDocument();
    },
  );

  it('la finestra chiede titolo, file PDF, descrizione e categoria dei download', async () => {
    const { dialogo } = await openDialog();
    expect(within(dialogo).getByLabelText('Titolo')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText('Descrizione')).toBeInTheDocument();
    const file = within(dialogo).getByLabelText('File PDF');
    expect(file).toHaveAttribute('accept', 'application/pdf,.pdf');
    const categoria = within(dialogo).getByLabelText('Categoria dei download');
    expect(
      within(categoria)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Moduli inventati', 'Altri inventati']);
    expect(apiMock).toHaveBeenCalledWith('/terms?taxonomy=wpdmcategory', expect.anything());
  });

  it('un file che non è PDF è rifiutato in italiano, senza richieste', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(
      <DensityProvider>
        <DocumentList />
      </DensityProvider>,
    );
    await screen.findByRole('row', { name: /Modulo di prova/ });
    await user.click(screen.getByRole('button', { name: 'Nuovo documento' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nuovo documento' });
    await user.upload(
      within(dialogo).getByLabelText('File PDF'),
      new File(['byte'], 'foto.png', { type: 'image/png' }),
    );
    expect(await within(dialogo).findByText(/Il documento è un PDF/)).toBeInTheDocument();
    await user.type(within(dialogo).getByLabelText('Titolo'), 'Titolo');
    await user.click(within(dialogo).getByRole('button', { name: 'Crea il documento' }));
    expect(uploadMock).not.toHaveBeenCalled();
    expect(callsTo('POST')).toHaveLength(0);
  });

  it('senza titolo o senza file non parte nulla e il motivo si legge', async () => {
    const { user, dialogo } = await openDialog();
    await user.click(within(dialogo).getByRole('button', { name: 'Crea il documento' }));
    expect(await within(dialogo).findByText('Il titolo è obbligatorio.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Scegli il file PDF del documento.')).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(callsTo('POST')).toHaveLength(0);
  });

  it('carica il PDF con la rotta dei media, crea il documento e apre la sua scheda', async () => {
    const { user, dialogo } = await openDialog();
    const file = pdf();
    await user.type(within(dialogo).getByLabelText('Titolo'), 'Modulo nuovo');
    await user.type(within(dialogo).getByLabelText('Descrizione'), 'Testo inventato');
    await user.upload(within(dialogo).getByLabelText('File PDF'), file);
    await user.selectOptions(
      within(dialogo).getByLabelText('Categoria dei download'),
      CATEGORIE[1]!.id,
    );
    await user.click(within(dialogo).getByRole('button', { name: 'Crea il documento' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith(`/redazione/documenti/${NUOVO_DOC}`));
    expect(uploadMock).toHaveBeenCalledWith('/media', file, undefined);
    expect(callsTo('POST')).toEqual([
      [
        '/documents',
        {
          method: 'POST',
          body: {
            title: 'Modulo nuovo',
            description: 'Testo inventato',
            termId: CATEGORIE[1]!.id,
            mediaId: NUOVO_MEDIA,
          },
        },
      ],
    ]);
  });

  it('se la creazione è rifiutata il file appena caricato si toglie e il rifiuto si legge', async () => {
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === '/documents' && !options?.method) return [DOC];
      if (path === '/terms?taxonomy=wpdmcategory') return CATEGORIE;
      if (path === '/documents' && options?.method === 'POST') {
        throw new ApiError(
          400,
          'DOCUMENT_CATEGORY_INVALID',
          'Scegli una categoria dei download fra quelle esistenti.',
        );
      }
      if (path === `/media/${NUOVO_MEDIA}` && options?.method === 'DELETE') return undefined;
      throw new Error(`chiamata non prevista: ${path}`);
    });
    const { user, dialogo } = await openDialog();
    await user.type(within(dialogo).getByLabelText('Titolo'), 'Modulo nuovo');
    await user.upload(within(dialogo).getByLabelText('File PDF'), pdf());
    await user.click(within(dialogo).getByRole('button', { name: 'Crea il documento' }));

    expect(
      await within(dialogo).findByText('Scegli una categoria dei download fra quelle esistenti.'),
    ).toBeInTheDocument();
    expect(callsTo('DELETE')).toEqual([[`/media/${NUOVO_MEDIA}`, { method: 'DELETE' }]]);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('un rifiuto del caricamento (file non pulibile, troppo grande) si legge e il documento non si crea', async () => {
    uploadMock.mockRejectedValue(
      new ApiError(422, 'MEDIA_FILE_INVALID', 'Il file «modulo-nuovo.pdf» non è leggibile.'),
    );
    const { user, dialogo } = await openDialog();
    await user.type(within(dialogo).getByLabelText('Titolo'), 'Modulo nuovo');
    await user.upload(within(dialogo).getByLabelText('File PDF'), pdf());
    await user.click(within(dialogo).getByRole('button', { name: 'Crea il documento' }));

    expect(
      await within(dialogo).findByText('Il file «modulo-nuovo.pdf» non è leggibile.'),
    ).toBeInTheDocument();
    expect(callsTo('POST')).toHaveLength(0);
  });
});

describe('«Elimina» nella scheda', () => {
  async function ready(): Promise<ReturnType<typeof userEvent.setup>> {
    const user = userEvent.setup();
    render(
      <DensityProvider>
        <DocumentEditor documentId={DOC.id} />
      </DensityProvider>,
    );
    await screen.findByDisplayValue('Modulo di prova');
    return user;
  }

  it.each([
    [['content.read']],
    [['content.read', 'content.write']],
    [['content.read', 'media.write']],
    // Giro 1: senza content.publish non si crea né si elimina (DR-242, DR-246).
    [['content.read', 'content.write', 'media.write']],
  ])(
    'senza content.write, media.write e content.publish insieme «Elimina» non c’è (%j)',
    async (perms) => {
      permissions = perms;
      await ready();
      expect(screen.queryByRole('button', { name: 'Elimina' })).not.toBeInTheDocument();
    },
  );

  it('chiede di scrivere il titolo, poi elimina e torna all’elenco', async () => {
    const user = await ready();
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    const conferma = await screen.findByRole('dialog', { name: 'Elimina il documento' });
    expect(within(conferma).getByText(/risponderanno «pagina non trovata»/)).toBeInTheDocument();
    expect(within(conferma).getByText(/Il file PDF sparisce dall’archivio/)).toBeInTheDocument();
    const definitivo = within(conferma).getByRole('button', { name: 'Elimina definitivamente' });
    expect(definitivo).toBeDisabled();
    expect(callsTo('DELETE')).toHaveLength(0);

    await user.type(
      within(conferma).getByLabelText('Digita «Modulo di prova» per confermare'),
      'Modulo di prova',
    );
    await user.click(definitivo);
    await waitFor(() =>
      expect(callsTo('DELETE')).toEqual([[`/documents/${DOC.id}`, { method: 'DELETE' }]]),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/redazione/documenti'));
  });

  it('con il file usato altrove la conferma dice che il file resta, e nomina i redirect', async () => {
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === `/documents/${DOC.id}` && !options?.method) return DOC;
      if (path === `/documents/${DOC.id}/deletion`) {
        return { ...LIBERO, fileShared: true, redirectsToPath: [{ source: '/vecchio-modulo/' }] };
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    const user = await ready();
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    const conferma = await screen.findByRole('dialog', { name: 'Elimina il documento' });
    expect(within(conferma).getByText(/Il file PDF resta/)).toBeInTheDocument();
    expect(within(conferma).getByText(/\/vecchio-modulo\//)).toBeInTheDocument();
  });

  it('se un blocco o un menu lo cita spiega il motivo e non offre la conferma', async () => {
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === `/documents/${DOC.id}` && !options?.method) return DOC;
      if (path === `/documents/${DOC.id}/deletion`) {
        return {
          ...LIBERO,
          blocked: true,
          contents: [{ id: 'c1', title: 'Pagina inventata', path: '/pagina-inventata/' }],
          menuItems: [{ id: 'm1', label: 'Voce inventata', menu: 'Principale' }],
        };
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    const user = await ready();
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    const motivo = await screen.findByRole('dialog', { name: 'Non si può eliminare' });
    expect(within(motivo).getByText(/blocco «Documento»/)).toBeInTheDocument();
    expect(
      within(motivo).getByText(/Pagina inventata \(\/pagina-inventata\/\)/),
    ).toBeInTheDocument();
    expect(within(motivo).getByText(/Voce inventata, nel menu Principale/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Elimina definitivamente' }),
    ).not.toBeInTheDocument();
    expect(callsTo('DELETE')).toHaveLength(0);
  });

  it('un rifiuto dell’API all’eliminazione si legge nella conferma', async () => {
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === `/documents/${DOC.id}` && !options?.method) return DOC;
      if (path === `/documents/${DOC.id}/deletion`) return LIBERO;
      if (options?.method === 'DELETE') {
        throw new ApiError(409, 'DOCUMENT_IN_MENU', 'Il documento è in un menu.');
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    const user = await ready();
    await user.click(screen.getByRole('button', { name: 'Elimina' }));
    const conferma = await screen.findByRole('dialog', { name: 'Elimina il documento' });
    await user.type(
      within(conferma).getByLabelText('Digita «Modulo di prova» per confermare'),
      'Modulo di prova',
    );
    await user.click(within(conferma).getByRole('button', { name: 'Elimina definitivamente' }));
    expect(await within(conferma).findByText('Il documento è in un menu.')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
