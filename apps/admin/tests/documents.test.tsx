import { DensityProvider } from '@amoris/ui';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W6, T4: schermata «Documenti» in Redazione (S5, D156). Titoli, descrizioni e
 * nomi di file sono inventati.
 */

const apiMock = vi.fn();
const uploadMock = vi.fn();
let permissions: string[] = ['content.read', 'content.write', 'media.write'];

const { ApiError } = await vi.importActual<typeof ApiModule>('../src/lib/api');

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
const { AREA_DEFINITIONS } = await import('../src/lib/areas');
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

const ALTRO = {
  ...DOC,
  id: '55555555-5555-4555-8555-555555555555',
  slug: 'altro-documento',
  title: 'Altro documento',
  modifiedAt: '2026-09-30T08:00:00.000Z',
  sitePath: '/download/altro-documento/',
  file: { ...DOC.file, fileName: 'altro.pdf', byteSize: 3 * 1024 * 1024 },
};

function paginaDi(href: string): string {
  return resolve(__dirname, '../src/app', href.replace(/^\//, ''), 'page.tsx');
}

function writesTo(method: string): unknown[][] {
  return apiMock.mock.calls.filter((call) => (call[1] as { method?: string })?.method === method);
}

beforeEach(() => {
  apiMock.mockReset();
  uploadMock.mockReset();
  permissions = ['content.read', 'content.write', 'media.write'];
  vi.unstubAllEnvs();
  apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path === '/documents' && !options?.method) return [DOC, ALTRO];
    if (path === `/documents/${DOC.id}` && !options?.method) return DOC;
    throw new Error(`chiamata non prevista: ${path}`);
  });
});

describe('voce di navigazione (1G-20)', () => {
  it('«Documenti» sta nel gruppo Corredo di Redazione e punta a una pagina esistente', () => {
    const corredo = AREA_DEFINITIONS.redazione.groups.find((group) => group.id === 'corredo');
    const voce = corredo?.sections.find((section) => section.href === '/redazione/documenti');

    expect(voce).toMatchObject({ label: 'Documenti', href: '/redazione/documenti' });
    expect(statSync(paginaDi('/redazione/documenti')).isFile()).toBe(true);
    expect(existsSync(paginaDi('/redazione/documenti/[id]'))).toBe(true);
  });

  it('ogni voce di Redazione ha la sua pagina sotto src/app', () => {
    for (const { sections } of AREA_DEFINITIONS.redazione.groups) {
      for (const { href } of sections) {
        expect(existsSync(paginaDi(href)), href).toBe(true);
      }
    }
  });
});

describe('registro delle operazioni', () => {
  it('«document.update» si legge «Ha modificato il documento»', () => {
    expect(actionLabel('document.update')).toBe('Ha modificato il documento');
  });
});

describe('elenco dei documenti', () => {
  function renderList(): void {
    render(
      <DensityProvider>
        <DocumentList />
      </DensityProvider>,
    );
  }

  it('mostra titolo, file, peso e «Ultimo aggiornamento» (modifica, altrimenti pubblicazione)', async () => {
    renderList();

    const prima = await screen.findByRole('row', { name: /Modulo di prova/ });
    expect(within(prima).getByText('modulo-di-prova.pdf')).toBeInTheDocument();
    expect(within(prima).getByText('2 kB')).toBeInTheDocument();
    expect(within(prima).getByText('01/03/2025')).toBeInTheDocument();

    const seconda = screen.getByRole('row', { name: /Altro documento/ });
    expect(within(seconda).getByText('3,0 MB')).toBeInTheDocument();
    expect(within(seconda).getByText('30/09/2026')).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith('/documents', expect.anything());
  });

  it('il titolo porta alla scheda e «Apri sul sito» a /download/<slug>/', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sito.example.invalid/');
    renderList();

    const riga = await screen.findByRole('row', { name: /Modulo di prova/ });
    expect(within(riga).getByRole('link', { name: 'Modulo di prova' })).toHaveAttribute(
      'href',
      `/redazione/documenti/${DOC.id}`,
    );
    const apri = within(riga).getByRole('link', { name: /Apri sul sito/ });
    expect(apri).toHaveAttribute('href', 'https://sito.example.invalid/download/modulo-di-prova/');
  });

  it('con l’API in errore mostra il messaggio del servizio', async () => {
    apiMock.mockRejectedValue(new ApiError(500, 'INTERNAL', 'Errore del servizio.'));
    renderList();
    expect(await screen.findByText(/Errore del servizio\./)).toBeInTheDocument();
  });
});

describe('scheda del documento', () => {
  function renderEditor(): void {
    render(
      <DensityProvider>
        <DocumentEditor documentId={DOC.id} />
      </DensityProvider>,
    );
  }

  async function ready(): Promise<ReturnType<typeof userEvent.setup>> {
    const user = userEvent.setup();
    renderEditor();
    await screen.findByDisplayValue('Modulo di prova');
    return user;
  }

  it('mostra titolo e descrizione nei campi, il file e il collegamento al sito', async () => {
    await ready();
    expect(screen.getByLabelText('Titolo')).toHaveValue('Modulo di prova');
    expect(screen.getByLabelText('Descrizione')).toHaveValue('Descrizione inventata.');
    expect(screen.getByText(/modulo-di-prova\.pdf \(2 kB\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apri sul sito/ })).toHaveAttribute(
      'href',
      '/download/modulo-di-prova/',
    );
  });

  it('«Salva» invia solo i campi cambiati', async () => {
    apiMock.mockImplementation(async (_path: string, options?: { method?: string }) =>
      options?.method === 'PATCH' ? { ...DOC, title: 'Modulo rinnovato' } : DOC,
    );
    const user = await ready();

    const titolo = screen.getByLabelText('Titolo');
    await user.clear(titolo);
    await user.type(titolo, 'Modulo rinnovato');
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(writesTo('PATCH')).toHaveLength(1));
    expect(writesTo('PATCH')[0]).toEqual([
      `/documents/${DOC.id}`,
      { method: 'PATCH', body: { title: 'Modulo rinnovato' } },
    ]);
    expect(await screen.findByText('Modifiche salvate.')).toBeInTheDocument();
  });

  it('svuotare la descrizione la invia vuota, e senza modifiche «Salva» è disabilitato', async () => {
    apiMock.mockImplementation(async (_path: string, options?: { method?: string }) =>
      options?.method === 'PATCH' ? { ...DOC, description: null } : DOC,
    );
    const user = await ready();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Descrizione'));
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(writesTo('PATCH')).toHaveLength(1));
    expect(writesTo('PATCH')[0]![1]).toEqual({ method: 'PATCH', body: { description: '' } });
  });

  it('i rifiuti 400 si leggono in italiano, sul campo che li riguarda', async () => {
    apiMock.mockImplementation(async (_path: string, options?: { method?: string }) => {
      if (options?.method === 'PATCH') {
        throw new ApiError(400, 'VALIDATION_FAILED', 'La richiesta non è valida.', [
          { path: '/title', message: 'Il titolo può avere al massimo 300 caratteri.' },
        ]);
      }
      return DOC;
    });
    const user = await ready();

    await user.type(screen.getByLabelText('Titolo'), ' più lungo');
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    expect(
      await screen.findByText('Il titolo può avere al massimo 300 caratteri.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/too big|expected string/i)).not.toBeInTheDocument();
  });

  it('con il solo content.read i campi sono bloccati e non ci sono «Salva» né «Sostituisci il file»', async () => {
    permissions = ['content.read'];
    await ready();
    expect(screen.getByLabelText('Titolo')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Salva' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sostituisci il file' })).not.toBeInTheDocument();
  });

  it('senza media.write titolo e descrizione si salvano, ma «Sostituisci il file» non c’è (A5)', async () => {
    permissions = ['content.read', 'content.write'];
    await ready();
    expect(screen.getByLabelText('Titolo')).toBeEnabled();
    expect(screen.getByLabelText('Descrizione')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Salva' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sostituisci il file' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Scegli il file che sostituisce/)).not.toBeInTheDocument();
  });

  it('con media.write «Sostituisci il file» compare, anche senza content.write (A5)', async () => {
    permissions = ['content.read', 'media.write'];
    await ready();
    expect(screen.getByRole('button', { name: 'Sostituisci il file' })).toBeEnabled();
    expect(screen.getByLabelText(/Scegli il file che sostituisce/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salva' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Titolo')).toBeDisabled();
  });

  it('un documento inesistente dice che non c’è, senza campi', async () => {
    apiMock.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Risorsa non trovata.'));
    renderEditor();
    expect(
      await screen.findByText(/Il documento non esiste o non è più pubblico/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Titolo')).not.toBeInTheDocument();
  });

  describe('«Sostituisci il file»', () => {
    const pdf = (): File => new File(['%PDF-1.4'], 'nuovo.pdf', { type: 'application/pdf' });

    it('il controllo di scelta accetta solo PDF', async () => {
      await ready();
      const accept = screen.getByLabelText(/Scegli il file che sostituisce/).getAttribute('accept');
      expect(accept).toBe('application/pdf,.pdf');
    });

    it('un file che non è PDF è rifiutato prima di ogni richiesta, in italiano', async () => {
      const user = userEvent.setup({ applyAccept: false });
      renderEditor();
      await screen.findByDisplayValue('Modulo di prova');

      await user.upload(
        screen.getByLabelText(/Scegli il file che sostituisce/),
        new File(['byte'], 'foto.png', { type: 'image/png' }),
      );

      expect(await screen.findByText(/Questo documento è un PDF/)).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Sostituisci il file' })).not.toBeInTheDocument();
      expect(uploadMock).not.toHaveBeenCalled();
    });

    it('chiede conferma e, con «Annulla», non invia nulla', async () => {
      const user = await ready();
      await user.upload(screen.getByLabelText(/Scegli il file che sostituisce/), pdf());

      const conferma = screen.getByRole('dialog', { name: 'Sostituisci il file' });
      expect(within(conferma).getByText(/non si potrà recuperare/)).toBeInTheDocument();
      expect(within(conferma).getByText(/nuovo\.pdf/)).toBeInTheDocument();
      await user.click(within(conferma).getByRole('button', { name: 'Annulla' }));

      expect(screen.queryByRole('dialog', { name: 'Sostituisci il file' })).not.toBeInTheDocument();
      expect(uploadMock).not.toHaveBeenCalled();
    });

    it('confermando sostituisce il file del media e rilegge il documento', async () => {
      const rinnovato = { ...DOC, modifiedAt: '2026-10-26T09:00:00.000Z' };
      let letture = 0;
      apiMock.mockImplementation(async (path: string) => {
        if (path === `/documents/${DOC.id}`) {
          letture += 1;
          return letture === 1 ? DOC : rinnovato;
        }
        throw new Error(`chiamata non prevista: ${path}`);
      });
      uploadMock.mockResolvedValue({});
      const user = userEvent.setup();
      renderEditor();
      await screen.findByDisplayValue('Modulo di prova');

      const file = pdf();
      await user.upload(screen.getByLabelText(/Scegli il file che sostituisce/), file);
      const conferma = screen.getByRole('dialog', { name: 'Sostituisci il file' });
      await user.click(within(conferma).getByRole('button', { name: 'Sostituisci' }));

      await waitFor(() =>
        expect(uploadMock).toHaveBeenCalledWith(`/media/${DOC.file.mediaId}/file`, file, {
          method: 'PUT',
        }),
      );
      expect(await screen.findByText(/File sostituito/)).toBeInTheDocument();
      await waitFor(() => expect(letture).toBe(2));
      expect(await screen.findByText('26/10/2026')).toBeInTheDocument();
    });

    it('un rifiuto dell’API si legge nella scheda', async () => {
      uploadMock.mockRejectedValue(
        new ApiError(409, 'MEDIA_TYPE_CHANGED', 'Il tipo del file non può cambiare.'),
      );
      const user = await ready();
      await user.upload(screen.getByLabelText(/Scegli il file che sostituisce/), pdf());
      const conferma = screen.getByRole('dialog', { name: 'Sostituisci il file' });
      await user.click(within(conferma).getByRole('button', { name: 'Sostituisci' }));

      expect(await screen.findByText('Il tipo del file non può cambiare.')).toBeInTheDocument();
    });
  });
});
