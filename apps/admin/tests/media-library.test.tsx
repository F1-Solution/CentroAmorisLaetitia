import {
  DEFAULT_MEDIA_LIMITS,
  MEDIA_RULES,
  mediaMessages,
  ruleForMime,
} from '@amoris/contracts/mediaRules';
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
      if (options?.method === 'PATCH')
        return Promise.resolve({ ...immagine, altText: 'Un albero.' });
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

  it('l’aiuto del testo alternativo concorda col soggetto: «Le pagine lo usano…»', async () => {
    const panel = await openPanel();
    expect(
      within(panel).getByText(
        /Le pagine lo usano quando il blocco dell’immagine non ha un testo suo/,
      ),
    ).toBeInTheDocument();
  });

  it('DR-313: l’aiuto del titolo dice che nelle pagine vale solo il titolo del blocco', async () => {
    const panel = await openPanel();
    expect(
      within(panel).getByText(
        'Serve a ritrovare il file nell’area; nelle pagine compare solo il titolo scritto nel blocco.',
      ),
    ).toBeInTheDocument();
  });

  it('DR-312: l’aiuto della didascalia dice che non compare sotto le immagini già presenti nei contenuti ripresi', async () => {
    // Il segno sta sui blocchi delle pagine importate, non sul file: lo stesso
    // media scelto in un blocco nuovo mostra la didascalia.
    const panel = await openPanel();
    expect(
      within(panel).getByText(
        /Non compare sotto le immagini che c’erano già nelle pagine e nelle notizie riprese dal sito precedente\./,
      ),
    ).toBeInTheDocument();
    expect(
      within(panel).queryByText(/Le immagini riprese dal sito precedente non la mostrano/),
    ).not.toBeInTheDocument();
  });

  async function chooseReplacement(panel: HTMLElement, file: File, applyAccept = true) {
    const user = userEvent.setup({ applyAccept });
    await user.upload(within(panel).getByLabelText(/Scegli il file che sostituisce/), file);
    return user;
  }

  async function confirmReplacement(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    const conferma = screen.getByRole('dialog', { name: 'Sostituisci il file' });
    await user.click(within(conferma).getByRole('button', { name: 'Sostituisci' }));
  }

  it('prima di sostituire avverte che il file attuale e le sue dimensioni derivate non si recuperano', async () => {
    const panel = await openPanel();
    await chooseReplacement(panel, new File(['byte'], 'sostituta.png', { type: 'image/png' }));

    const conferma = screen.getByRole('dialog', { name: 'Sostituisci il file' });
    expect(
      within(conferma).getByText(
        /file attuale e le sue dimensioni derivate non si potranno recuperare/,
      ),
    ).toBeInTheDocument();
    expect(within(conferma).getByText(/sostituta\.png/)).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('«Annulla» nella conferma non invia nulla', async () => {
    const panel = await openPanel();
    const user = await chooseReplacement(
      panel,
      new File(['byte'], 'sostituta.png', { type: 'image/png' }),
    );
    const conferma = screen.getByRole('dialog', { name: 'Sostituisci il file' });
    await user.click(within(conferma).getByRole('button', { name: 'Annulla' }));

    expect(screen.queryByRole('dialog', { name: 'Sostituisci il file' })).not.toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('dopo la sostituzione dice quante dimensioni derivate sono state rigenerate', async () => {
    uploadMock.mockResolvedValue({ ...immagine, derivatives: { written: 5, removed: 2 } });
    const panel = await openPanel();
    const user = await chooseReplacement(
      panel,
      new File(['byte'], 'sostituta.png', { type: 'image/png' }),
    );
    await confirmReplacement(user);

    expect(await within(panel).findByText(/5 dimensioni derivate rigenerate/)).toBeInTheDocument();
    expect(within(panel).getByText(/2 non servono più e sono state tolte/)).toBeInTheDocument();
  });

  it('un file di tipo non ammesso, scelto per sostituire, è rifiutato prima di ogni richiesta', async () => {
    const panel = await openPanel();
    await chooseReplacement(
      panel,
      new File(['byte'], 'script.exe', { type: 'application/x-msdownload' }),
      false,
    );

    expect(
      await within(panel).findByText(mediaMessages.typeNotAllowed('script.exe')),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Sostituisci il file' })).not.toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('il rifiuto che elenca i contenuti si legge per intero nel pannello (D146-A)', async () => {
    const messaggio = mediaMessages.variantInUse('Pagina inventata, Notizia inventata');
    uploadMock.mockRejectedValue(new ApiError(409, 'MEDIA_VARIANT_IN_USE', messaggio));
    const panel = await openPanel();
    const user = await chooseReplacement(
      panel,
      new File(['byte'], 'piccola.png', { type: 'image/png' }),
    );
    await confirmReplacement(user);

    expect(
      await within(panel).findByText(/Pagina inventata, Notizia inventata/),
    ).toBeInTheDocument();
  });

  it('dichiara i tipi ammessi accanto a «Carica» e a «Sostituisci»', async () => {
    const panel = await openPanel();
    const riga = 'Tipi ammessi: JPEG, PNG, WebP, PDF e MP4.';
    expect(screen.getAllByText(riga)).toHaveLength(2);
    const rigaPannello = within(panel).getByText(riga);
    expect(
      within(panel)
        .getByLabelText(/Scegli il file che sostituisce/)
        .getAttribute('aria-describedby'),
    ).toBe(rigaPannello.id);
    expect(rigaPannello.id).not.toBe('');
  });

  it('i controlli di scelta hanno «accept» con i tipi ammessi', async () => {
    const panel = await openPanel();
    for (const input of [
      screen.getByLabelText('Scegli i file da caricare'),
      within(panel).getByLabelText(/Scegli il file che sostituisce/),
    ]) {
      const accept = input.getAttribute('accept') ?? '';
      for (const rule of MEDIA_RULES) {
        expect(accept).toContain(rule.mime);
        for (const extension of rule.extensions) expect(accept).toContain(`.${extension}`);
      }
      expect(accept).not.toContain('svg');
    }
  });

  it('un file di tipo non ammesso è rifiutato prima dell’invio, con il messaggio in italiano', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderLibrary();
    await waitFor(() => expect(screen.getByText('Immagine inventata')).toBeInTheDocument());

    const file = new File(['<svg/>'], 'disegno.svg', { type: 'image/svg+xml' });
    await user.upload(screen.getByLabelText('Scegli i file da caricare'), file);

    expect(
      await screen.findByText(mediaMessages.typeNotAllowed('disegno.svg')),
    ).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('un file troppo pesante è rifiutato prima dell’invio, con il limite del suo tipo', async () => {
    const user = userEvent.setup();
    renderLibrary();
    await waitFor(() => expect(screen.getByText('Immagine inventata')).toBeInTheDocument());

    const file = new File(['x'], 'enorme.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: DEFAULT_MEDIA_LIMITS.imageBytes + 1 });
    await user.upload(screen.getByLabelText('Scegli i file da caricare'), file);

    const rule = ruleForMime('image/png');
    if (!rule) throw new Error('Regola PNG assente.');
    expect(await screen.findByText(mediaMessages.tooLarge('enorme.png', rule))).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('con più file, invia quelli ammessi e rifiuta gli altri', async () => {
    const user = userEvent.setup({ applyAccept: false });
    uploadMock.mockResolvedValue({ ...immagine, id: 'm2', derivatives: 4 });
    renderLibrary();
    await waitFor(() => expect(screen.getByText('Immagine inventata')).toBeInTheDocument());

    const buono = new File(['byte'], 'buona.png', { type: 'image/png' });
    const cattivo = new File(['byte'], 'cattivo.exe', { type: 'application/octet-stream' });
    await user.upload(screen.getByLabelText('Scegli i file da caricare'), [cattivo, buono]);

    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
    expect(uploadMock).toHaveBeenCalledWith('/media', buono, undefined);
    expect(screen.getByText(mediaMessages.typeNotAllowed('cattivo.exe'))).toBeInTheDocument();
  });

  it('con una sola dimensione derivata il participio è al singolare', async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({ ...immagine, id: 'm3', derivatives: 1 });
    renderLibrary();
    await waitFor(() => expect(screen.getByText('Immagine inventata')).toBeInTheDocument());

    await user.upload(
      screen.getByLabelText('Scegli i file da caricare'),
      new File(['byte'], 'piccola.png', { type: 'image/png' }),
    );

    expect(await screen.findByText('1 dimensione derivata generata.')).toBeInTheDocument();
  });

  it('dopo un caricamento dice quante dimensioni derivate sono state create', async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({ ...immagine, id: 'm2', derivatives: 4 });
    renderLibrary();
    await waitFor(() => expect(screen.getByText('Immagine inventata')).toBeInTheDocument());

    await user.upload(
      screen.getByLabelText('Scegli i file da caricare'),
      new File(['byte'], 'nuova.png', { type: 'image/png' }),
    );

    expect(await screen.findByText('4 dimensioni derivate generate.')).toBeInTheDocument();
  });

  it('il messaggio italiano del server per un file troppo grande si mostra così com’è', async () => {
    const user = userEvent.setup();
    const messaggio = mediaMessages.tooLargeAny(DEFAULT_MEDIA_LIMITS.videoBytes);
    uploadMock.mockRejectedValue(new ApiError(413, 'MEDIA_TOO_LARGE', messaggio));
    renderLibrary();
    await waitFor(() => expect(screen.getByText('Immagine inventata')).toBeInTheDocument());

    await user.upload(
      screen.getByLabelText('Scegli i file da caricare'),
      new File(['byte'], 'nuova.png', { type: 'image/png' }),
    );

    expect(await screen.findByText(messaggio)).toBeInTheDocument();
  });

  it('sostituisce il file conservando l’indirizzo, dopo la conferma', async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue({
      ...immagine,
      byteSize: 4096,
      derivatives: { written: 3, removed: 0 },
    });
    const panel = await openPanel();

    const file = new File(['altri byte inventati'], 'sostituta.png', { type: 'image/png' });
    await user.upload(within(panel).getByLabelText(/Scegli il file che sostituisce/), file);
    await confirmReplacement(user);

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
