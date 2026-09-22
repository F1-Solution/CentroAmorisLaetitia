import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Il criterio 1D-31 **eseguito nella schermata**: caricare, sostituire ed
 * eliminare un media, con testo alternativo e didascalia.
 *
 * Due esiti contano più degli altri, e sono quelli che le decisioni del Round 14
 * hanno reso possibili: la sostituzione passa per la rotta che conserva
 * l'indirizzo (DR-074), e l'eliminazione rifiutata **mostra quali contenuti**
 * citano il media invece di dire soltanto che non si può (DR-077).
 *
 * Tutti i media sono inventati.
 */

const apiMock = vi.fn();
const uploadMock = vi.fn();

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('../src/lib/upload', () => ({
  uploadFile: (path: string, file: File, options?: unknown) => uploadMock(path, file, options),
}));

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
        permissions: ['content.read', 'media.write'],
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

const { MediaLibrary } = await import('../src/components/media/MediaLibrary');

const immagine = {
  id: 'm1',
  publicPath: '/media/2026/01/immagine-inventata.png',
  fileName: 'immagine-inventata.png',
  mimeType: 'image/png',
  byteSize: 2048,
  title: 'Immagine inventata',
  altText: null,
  caption: null,
  description: null,
  uploadedAt: '2026-01-10T10:00:00.000Z',
};

function listResponse(overrides: Partial<typeof immagine> = {}) {
  return {
    items: [{ ...immagine, ...overrides }],
    meta: { total: 1, page: 1, perPage: 25 },
  };
}

function renderLibrary() {
  return render(
    <DensityProvider>
      <MediaLibrary />
    </DensityProvider>,
  );
}

async function openPanel(): Promise<HTMLElement> {
  const user = userEvent.setup();
  renderLibrary();
  await waitFor(() => expect(screen.getByText('Immagine inventata')).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: 'Immagine inventata' }));
  return screen.getByRole('dialog', { name: 'Immagine inventata' });
}

describe('archivio dei media', () => {
  beforeEach(() => {
    apiMock.mockReset();
    uploadMock.mockReset();
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.startsWith('/media?')) return Promise.resolve(listResponse());
      if (options?.method === 'PATCH') return Promise.resolve({ ...immagine, altText: 'Un albero.' });
      if (options?.method === 'DELETE') return Promise.resolve(undefined);
      return Promise.resolve({});
    });
  });

  it('mostra i media, e dice quali non hanno testo alternativo', async () => {
    renderLibrary();
    const tabella = await screen.findByRole('table', { name: /Archivio dei media/i });
    expect(within(tabella).getByText('Immagine inventata')).toBeInTheDocument();
    expect(within(tabella).getByText('Non indicato')).toBeInTheDocument();
  });

  it('carica un file nuovo', async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({ ...immagine, id: 'm2' });
    renderLibrary();
    await waitFor(() => expect(screen.getByText('Immagine inventata')).toBeInTheDocument());

    const file = new File(['byte inventati'], 'nuova.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Scegli i file da caricare'), file);

    await waitFor(() => expect(uploadMock).toHaveBeenCalledWith('/media', file, undefined));
  });

  it('salva testo alternativo e didascalia', async () => {
    const user = userEvent.setup();
    const panel = await openPanel();

    await user.type(within(panel).getByLabelText(/Testo alternativo/), 'Un albero.');
    await user.type(within(panel).getByLabelText(/Didascalia/), 'Nel giardino.');
    await user.click(within(panel).getByRole('button', { name: 'Salva' }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith(
        '/media/m1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.objectContaining({ altText: 'Un albero.', caption: 'Nel giardino.' }),
        }),
      );
    });
  });

  it('sostituisce il file conservando l’indirizzo', async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({ ...immagine, byteSize: 4096 });
    const panel = await openPanel();

    const file = new File(['altri byte inventati'], 'sostituta.png', { type: 'image/png' });
    await user.upload(within(panel).getByLabelText(/Scegli il file che sostituisce/), file);

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith('/media/m1/file', file, { method: 'PUT' });
    });
    expect(await within(panel).findByText(/L’indirizzo non è cambiato/)).toBeInTheDocument();
  });

  it('elimina un media, dopo averne digitato il nome', async () => {
    const user = userEvent.setup();
    const panel = await openPanel();

    await user.click(within(panel).getByRole('button', { name: 'Elimina' }));
    const conferma = screen.getByRole('dialog', { name: 'Elimina il media' });
    await user.type(
      within(conferma).getByLabelText(/Digita «immagine-inventata.png»/),
      'immagine-inventata.png',
    );
    await user.click(within(conferma).getByRole('button', { name: 'Elimina definitivamente' }));

    await waitFor(() => {
      expect(apiMock).toHaveBeenCalledWith('/media/m1', { method: 'DELETE' });
    });
  });

  it('se un contenuto lo cita, il rifiuto dice quale (DR-077)', async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation((path: string, options?: { method?: string }) => {
      if (path.startsWith('/media?')) return Promise.resolve(listResponse());
      if (options?.method === 'DELETE') {
        return Promise.reject(
          new ApiError(
            409,
            'CONFLICT',
            'Il media è citato da questi contenuti e non si elimina finché lo citano: Pagina inventata.',
          ),
        );
      }
      return Promise.resolve({});
    });

    const panel = await openPanel();
    await user.click(within(panel).getByRole('button', { name: 'Elimina' }));
    const conferma = screen.getByRole('dialog', { name: 'Elimina il media' });
    await user.type(
      within(conferma).getByLabelText(/Digita «immagine-inventata.png»/),
      'immagine-inventata.png',
    );
    await user.click(within(conferma).getByRole('button', { name: 'Elimina definitivamente' }));

    expect(await screen.findByText(/Pagina inventata/)).toBeInTheDocument();
  });
});
