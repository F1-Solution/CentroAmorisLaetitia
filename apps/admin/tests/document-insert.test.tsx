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
import { syntheticContent, syntheticDocument } from './fixtures';

/**
 * Wave 1G-W7, T2k (DR-287): il blocco «Documento» si inserisce dall'editor, e nasce solo con un
 * documento pubblico scelto dallo stesso elenco che usa il pannello del blocco (`GET /documents`,
 * i riservati non ci sono). Nessun segnaposto inventato. Titoli e slug sono inventati.
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
const { BlockInspector } = await import('../src/components/editor/BlockInspector');
const { EditorPreview } = await import('../src/components/editor/EditorPreview');

const DOC_A = '77777777-7777-4777-8777-777777777777';
const DOC_B = '88888888-8888-4888-8888-888888888888';
const DOCUMENTS = [DOC_A, DOC_B].map((id, index) => ({
  id,
  slug: `modulo-${index + 1}`,
  title: `Modulo sintetico ${index + 1}`,
  description: null,
  publishedAt: null,
  modifiedAt: null,
  sitePath: `/download/modulo-${index + 1}/`,
  file: {
    mediaId: `f${index}`,
    fileName: `modulo-${index + 1}.pdf`,
    mimeType: 'application/pdf',
    byteSize: 10,
    publicPath: `/media/2026/01/modulo-${index + 1}.pdf`,
  },
}));

describe('albero dei blocchi: il documento (DR-287)', () => {
  it('«document» è creabile e il blocco nato passa lo schema con il documento scelto', () => {
    expect(CREATABLE_TYPES).toContain('document');
    const block = createBlock('document', { documentId: DOC_A });
    expect(block.type === 'document' && block.props.documentId).toBe(DOC_A);
    expect(block.type === 'document' && block.props.label).toBeNull();
    expect(blockNodeSchema.safeParse(block).success).toBe(true);
  });

  it('senza documentId il blocco non nasce', () => {
    expect(() => createBlock('document')).toThrow();
  });

  it('insertBlock lo inserisce in coda e il documento a blocchi resta valido', () => {
    const { document, insertedId } = insertBlock(syntheticDocument, null, 'document', {
      documentId: DOC_B,
    });
    expect(document.blocks.at(-1)?.id).toBe(insertedId);
    expect(blockDocumentSchema.safeParse(document).success).toBe(true);
    expect(creatableChildTypes(syntheticDocument, null)).toContain('document');
  });

  it('il motivo dei blocchi non creabili non nomina più il documento; restano video, mappa, modulo', () => {
    const reason = UNCREATABLE_REASON.toLowerCase();
    expect(reason).not.toContain('documento');
    expect(reason).toContain('video');
    expect(reason).toContain('mappa');
    expect(reason).toContain('modulo');
  });
});

describe('editor: inserimento del blocco «Documento»', () => {
  function mockApi(documents: () => Promise<unknown>): void {
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) return Promise.resolve(syntheticContent);
      if (path === `/contents/${syntheticContent.id}/draft`) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      if (path === '/documents') return documents();
      return Promise.resolve(undefined);
    });
  }

  beforeEach(() => mockApi(() => Promise.resolve(DOCUMENTS)));

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

  it('offre «Documento» e chiede quale documento, fra i pubblici', async () => {
    const user = await openInserter();
    const voce = await screen.findByRole('button', { name: 'Documento' });
    expect(voce).toBeEnabled();
    await user.click(voce);
    const select = await screen.findByRole('combobox', { name: 'Quale documento?' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3));
    expect(within(select).getByRole('option', { name: 'Modulo sintetico 1' })).toBeInTheDocument();
  });

  it('senza scegliere un documento «Inserisci» non agisce; scelto, inserisce il blocco', async () => {
    const user = await openInserter();
    await user.click(await screen.findByRole('button', { name: 'Documento' }));
    const select = await screen.findByRole('combobox', { name: 'Quale documento?' });
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));

    const inserisci = screen.getByRole('button', { name: 'Inserisci' });
    expect(inserisci).toBeDisabled();
    const tree = screen.getByRole('region', { name: 'Struttura del contenuto' });
    expect(within(tree).queryByText('Documento')).toBeNull();

    await user.selectOptions(select, DOC_B);
    await user.click(screen.getByRole('button', { name: 'Inserisci' }));

    expect(within(tree).getByText('Documento')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Quale documento?' })).toBeNull();
    // Il blocco nato è selezionato e il pannello mostra il documento scelto.
    const inspector = await screen.findByRole('combobox', { name: 'Documento' });
    await waitFor(() => expect(inspector).toHaveValue(DOC_B));
  });

  it('se i documenti non si caricano lo dice e «Inserisci» resta spento', async () => {
    mockApi(() => Promise.reject(new ApiError(500, 'INTERNAL', 'Errore del servizio.')));
    const user = await openInserter();
    await user.click(await screen.findByRole('button', { name: 'Documento' }));
    expect(await screen.findByText(/Errore del servizio\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inserisci' })).toBeDisabled();
  });
});

describe('giro 1 della T2k', () => {
  it('senza documenti pubblici il passo di scelta lo dice', async () => {
    mockApiForEmpty();
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
    await user.click(await screen.findByRole('button', { name: 'Documento' }));
    expect(await screen.findByText('Non ci sono documenti pubblici.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inserisci' })).toBeDisabled();
  });

  it('l’aiuto di «Etichetta» dice che è il testo del collegamento e che vuota vale il titolo', async () => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/documents') return DOCUMENTS;
      throw new Error(`chiamata non prevista: ${path}`);
    });
    render(
      <DensityProvider>
        <BlockInspector
          block={createBlock('document', { documentId: DOC_A })}
          onChange={vi.fn()}
          onColumnStructureChange={vi.fn()}
        />
      </DensityProvider>,
    );
    expect(
      await screen.findByText(
        'Il testo del collegamento sul sito; vuota, si usa il titolo del documento.',
      ),
    ).toBeInTheDocument();
  });

  it('l’anteprima dell’editor mostra il segnaposto con l’etichetta, anche dentro «media e testo»', () => {
    const document = blockDocumentSchema.parse({
      schema: 1,
      blocks: [
        {
          type: 'document',
          id: 'b_00000000e001',
          props: { documentId: DOC_A, label: 'Etichetta alla radice' },
          children: [],
        },
        {
          type: 'media_text',
          id: 'b_00000000e002',
          props: {},
          children: [
            {
              type: 'document',
              id: 'b_00000000e003',
              props: { documentId: DOC_B, label: 'Etichetta in media e testo' },
              children: [],
            },
          ],
        },
      ],
    });
    render(
      <DensityProvider>
        <EditorPreview document={document} viewport="desktop" onViewportChange={vi.fn()} />
      </DensityProvider>,
    );
    expect(screen.getByText('Etichetta alla radice')).toBeInTheDocument();
    expect(screen.getByText('Etichetta in media e testo')).toBeInTheDocument();
  });
});

function mockApiForEmpty(): void {
  apiMock.mockReset();
  apiMock.mockImplementation((path: string) => {
    if (path === `/contents/${syntheticContent.id}`) return Promise.resolve(syntheticContent);
    if (path === `/contents/${syntheticContent.id}/draft`) {
      return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
    }
    if (path === '/documents') return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
}
