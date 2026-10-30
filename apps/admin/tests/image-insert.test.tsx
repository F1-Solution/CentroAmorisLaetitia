import { blockDocumentSchema, blockNodeSchema } from '@amoris/blocks';
import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';
import {
  CREATABLE_TYPES,
  UNCREATABLE_REASON,
  createBlock,
  creatableChildTypes,
  insertBlock,
} from '../src/lib/editor/tree';
import { isUnchanged, openContent, savePayloadOf } from '../src/lib/editor/roundtrip';
import { syntheticContent, syntheticDocument } from './fixtures';

/**
 * Wave 1G-W7, T2d: il blocco «Immagine» si inserisce dall'editor scegliendo un media pubblico
 * (DR-283). Media e titoli sono inventati.
 */

const apiMock = vi.fn();

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
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

const MEDIA_PUBLIC = '22222222-2222-4222-8222-222222222222';
const MEDIA_PRIVATE = '33333333-3333-4333-8333-333333333333';
const MEDIA = {
  items: [
    {
      id: MEDIA_PUBLIC,
      publicPath: '/media/foto-pubblica.png',
      fileName: 'foto-pubblica.png',
      title: 'Foto pubblica di prova',
      isPrivate: false,
    },
    {
      id: MEDIA_PRIVATE,
      publicPath: '/media/foto-privata.png',
      fileName: 'foto-privata.png',
      title: 'Foto privata di prova',
      isPrivate: true,
    },
  ],
};

describe('albero dei blocchi: l’immagine', () => {
  it('«image» è creabile e il blocco nato passa lo schema con mediaId e testo alternativo', () => {
    expect(CREATABLE_TYPES).toContain('image');
    const block = createBlock('image', { mediaId: MEDIA_PUBLIC, alt: 'Una foto di prova' });
    expect(block.type).toBe('image');
    if (block.type !== 'image') return;
    expect(block.props.mediaId).toBe(MEDIA_PUBLIC);
    expect(block.props.src).toBeNull();
    expect(block.props.alt).toBe('Una foto di prova');
    expect(blockNodeSchema.safeParse(block).success).toBe(true);
  });

  it('un’immagine decorativa ha alt vuoto, ed è comunque valida', () => {
    const block = createBlock('image', { mediaId: MEDIA_PUBLIC, alt: '' });
    expect(block.type === 'image' && block.props.alt).toBe('');
    expect(blockNodeSchema.safeParse(block).success).toBe(true);
  });

  it('senza mediaId il blocco non nasce', () => {
    expect(() => createBlock('image')).toThrow();
  });

  it('insertBlock lo inserisce in coda e il documento resta valido', () => {
    const { document, insertedId } = insertBlock(syntheticDocument, null, 'image', {
      mediaId: MEDIA_PUBLIC,
      alt: 'Una foto di prova',
    });
    expect(document.blocks.at(-1)?.id).toBe(insertedId);
    expect(blockDocumentSchema.safeParse(document).success).toBe(true);
    expect(creatableChildTypes(syntheticDocument, null)).toContain('image');
  });

  it('andata e ritorno 1D-36: il documento con l’immagine nuova si salva e si rilegge uguale', () => {
    const { document } = insertBlock(syntheticDocument, null, 'image', {
      mediaId: MEDIA_PUBLIC,
      alt: 'Una foto di prova',
    });
    const saved = savePayloadOf({ title: 'Pagina di prova', excerpt: null, document });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const reread = {
      ...syntheticContent,
      blocks: saved.payload.blocks,
      contentHtml: saved.payload.contentHtml,
    };
    const reopened = openContent(reread);
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(isUnchanged(reread, reopened.state)).toBe(true);
    expect(JSON.stringify(reopened.state.document)).toBe(JSON.stringify(document));
  });

  it('il motivo dei blocchi non creabili è vero: non nomina l’immagine né promette schermate', () => {
    const reason = UNCREATABLE_REASON.toLowerCase();
    expect(reason).not.toContain('immagine');
    expect(reason).not.toContain('esisteranno');
    expect(reason).not.toContain('schermata');
    expect(reason).toContain('video');
    expect(reason).toContain('mappa');
    expect(reason).toContain('modulo');
  });
});

/** Le etichette delle righe dell'albero, come le legge chi usa lo schermo. */
function labelsOf(tree: HTMLElement): string[] {
  return Array.from(tree.querySelectorAll('.amoris-block-tree__label')).map((node) =>
    (node.textContent ?? '').replace(/s+/g, ' ').trim(),
  );
}

describe('editor: inserimento dell’immagine', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) return Promise.resolve(syntheticContent);
      if (path === `/contents/${syntheticContent.id}/draft`) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      if (path.startsWith('/media?')) return Promise.resolve(MEDIA);
      return Promise.resolve(undefined);
    });
  });

  async function openInserter(): Promise<ReturnType<typeof userEvent.setup>> {
    const user = userEvent.setup();
    render(
      <DensityProvider>
        <ContentEditor
          contentId={syntheticContent.id}
          sectionId="pagine"
          listHref="/redazione/pagine"
          listLabel="Pagine"
        />
      </DensityProvider>,
    );
    const tree = await screen.findByRole('region', { name: 'Struttura del contenuto' });
    await within(tree).findByText(/Primo paragrafo di prova\./);
    await user.click(within(tree).getByRole('button', { name: 'Aggiungi blocco' }));
    return user;
  }

  it('«Immagine» è inseribile e apre la scelta dei media, solo immagini pubbliche', async () => {
    const user = await openInserter();
    const voce = await screen.findByRole('button', { name: 'Immagine' });
    expect(voce).toBeEnabled();
    await user.click(voce);

    expect(await screen.findByRole('option', { name: /Foto pubblica di prova/ })).toBeVisible();
    expect(screen.queryByRole('option', { name: /Foto privata di prova/ })).toBeNull();
    const richiesta = apiMock.mock.calls
      .map((call) => String(call[0]))
      .find((p) => p.startsWith('/media?'));
    expect(richiesta).toContain('mimePrefix=image%2F');
  });

  // Il documento si inserisce dalla T2k della 1G-W7 (DR-287), con la prova in `document-insert.test.tsx`.
  it('video, mappa e modulo restano spenti', async () => {
    await openInserter();
    for (const name of ['Video', 'Mappa', 'Modulo']) {
      expect(await screen.findByRole('button', { name })).toBeDisabled();
    }
  });

  it('senza testo alternativo (né spunta «decorativa») «Usa questo media» resta spento', async () => {
    const user = await openInserter();
    await user.click(await screen.findByRole('button', { name: 'Immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto pubblica di prova/ }));
    expect(screen.getByRole('button', { name: 'Usa questo media' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Testo alternativo' }), 'Una foto');
    expect(screen.getByRole('button', { name: 'Usa questo media' })).toBeEnabled();
  });

  it('scelto il file e scritto l’alt, inserisce il blocco e lo salva con mediaId e alt', async () => {
    const user = await openInserter();
    await user.click(await screen.findByRole('button', { name: 'Immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto pubblica di prova/ }));
    await user.type(
      screen.getByRole('textbox', { name: 'Testo alternativo' }),
      'Il portico del Centro',
    );
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));

    const tree = screen.getByRole('region', { name: 'Struttura del contenuto' });
    expect(labelsOf(tree)).toContain('Immagine — Il portico del Centro');
    // Il blocco nato è selezionato: il pannello mostra il suo testo alternativo.
    expect(await screen.findByRole('textbox', { name: 'Testo alternativo' })).toHaveValue(
      'Il portico del Centro',
    );
    expect(screen.queryByRole('listbox', { name: 'Media disponibili' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Salva e aggiorna il sito' }));
    await waitFor(() => {
      const patch = apiMock.mock.calls.find(
        (call) =>
          call[0] === `/contents/${syntheticContent.id}` &&
          (call[1] as { method?: string } | undefined)?.method === 'PATCH',
      );
      expect(patch).toBeDefined();
      const body = (
        patch?.[1] as {
          body: { blocks: { blocks: { type: string; props: Record<string, unknown> }[] } };
        }
      ).body;
      const image = body.blocks.blocks.find((block) => block.type === 'image');
      expect(image?.props['mediaId']).toBe(MEDIA_PUBLIC);
      expect(image?.props['alt']).toBe('Il portico del Centro');
      expect(blockDocumentSchema.safeParse(body.blocks).success).toBe(true);
    });
  });

  it('il secondo inserimento di seguito parte da un selettore vuoto', async () => {
    const user = await openInserter();
    await user.click(await screen.findByRole('button', { name: 'Immagine' }));
    await user.type(screen.getByRole('textbox', { name: 'Cerca media' }), 'foto');
    await user.click(await screen.findByRole('option', { name: /Foto pubblica di prova/ }));
    await user.type(screen.getByRole('textbox', { name: 'Testo alternativo' }), 'Prima');
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));

    const tree = screen.getByRole('region', { name: 'Struttura del contenuto' });
    await user.click(within(tree).getAllByRole('button', { name: 'Aggiungi blocco' })[0]!);
    await user.click(await screen.findByRole('button', { name: 'Immagine' }));
    await screen.findByRole('option', { name: /Foto pubblica di prova/ });
    expect(screen.getByRole('textbox', { name: 'Cerca media' })).toHaveValue('');
    expect(screen.getByRole('option', { name: /Foto pubblica di prova/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    // Il testo alternativo del pannello del blocco appena inserito resta: conta il dettaglio del selettore.
    expect(screen.queryByRole('button', { name: 'Usa questo media' })).toBeNull();
    // Resta solo la spunta dell'ispettore del blocco appena inserito, non quella del selettore.
    expect(screen.getAllByRole('checkbox', { name: /puramente decorativa/ })).toHaveLength(1);
  });

  it('un’immagine dichiarata decorativa si inserisce con alt vuoto', async () => {
    const user = await openInserter();
    await user.click(await screen.findByRole('button', { name: 'Immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto pubblica di prova/ }));
    await user.click(screen.getByRole('checkbox', { name: /puramente decorativa/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    const tree = screen.getByRole('region', { name: 'Struttura del contenuto' });
    expect(labelsOf(tree)).toContain('Immagine — immagine');
  });

  it('se i media non si caricano lo dice e non inserisce nulla', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) return Promise.resolve(syntheticContent);
      if (path === `/contents/${syntheticContent.id}/draft`) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      if (path.startsWith('/media?')) {
        return Promise.reject(new ApiError(500, 'INTERNAL', 'Errore del servizio.'));
      }
      return Promise.resolve(undefined);
    });
    const user = await openInserter();
    await user.click(await screen.findByRole('button', { name: 'Immagine' }));
    expect(await screen.findByText(/Errore del servizio\./)).toBeInTheDocument();
    expect(screen.queryByRole('option')).toBeNull();
  });
});
