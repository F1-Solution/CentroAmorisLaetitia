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
 * Wave 1G-W6, T4c: il blocco «Presentazione a scorrimento» si inserisce dall'editor (S20,
 * DR-257). I caroselli e i loro titoli sono inventati.
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

const SLIDER_A = '66666666-6666-4666-8666-666666666666';
const SLIDER_B = '99999999-9999-4999-8999-999999999999';
const SLIDERS = [
  {
    id: SLIDER_A,
    title: 'Carosello A',
    slideCount: 3,
    usedInCount: 0,
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: SLIDER_B,
    title: 'Carosello B',
    slideCount: 5,
    usedInCount: 1,
    updatedAt: '2026-10-01T10:00:00.000Z',
  },
];

describe('albero dei blocchi: il carosello', () => {
  it('«slider» è creabile e il blocco nato passa lo schema con il sliderId scelto', () => {
    expect(CREATABLE_TYPES).toContain('slider');
    const block = createBlock('slider', { sliderId: SLIDER_A });
    expect(block.type === 'slider' && block.props.sliderId).toBe(SLIDER_A);
    expect(blockNodeSchema.safeParse(block).success).toBe(true);
  });

  it('senza sliderId il blocco non nasce', () => {
    expect(() => createBlock('slider')).toThrow();
  });

  it('insertBlock lo inserisce in coda e il documento resta valido', () => {
    const { document, insertedId } = insertBlock(syntheticDocument, null, 'slider', {
      sliderId: SLIDER_B,
    });
    expect(document.blocks.at(-1)?.id).toBe(insertedId);
    expect(blockDocumentSchema.safeParse(document).success).toBe(true);
    expect(creatableChildTypes(syntheticDocument, null)).toContain('slider');
  });

  it('il motivo dei blocchi non creabili non nomina più la presentazione', () => {
    expect(UNCREATABLE_REASON.toLowerCase()).not.toContain('presentazione');
  });
});

describe('pannello del blocco «slider»', () => {
  const block = createBlock('slider', { sliderId: SLIDER_A });

  function renderInspector(onChange = vi.fn(), disabled = false) {
    render(
      <DensityProvider>
        <BlockInspector
          block={block}
          onChange={onChange}
          onColumnStructureChange={vi.fn()}
          disabled={disabled}
        />
      </DensityProvider>,
    );
    return onChange;
  }

  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/sliders') return SLIDERS;
      throw new Error(`chiamata non prevista: ${path}`);
    });
  });

  it('cambia carosello fra quelli esistenti', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector();
    const select = await screen.findByRole('combobox', { name: 'Carosello' });
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));
    await user.selectOptions(select, SLIDER_B);
    const next = onChange.mock.calls[0]?.[0];
    expect(next.props.sliderId).toBe(SLIDER_B);
    expect(blockNodeSchema.safeParse(next).success).toBe(true);
  });

  it('ha il collegamento alla schermata del carosello scelto, in una scheda nuova (A6)', async () => {
    renderInspector();
    const link = await screen.findByRole('link', { name: 'Modifica le immagini del carosello' });
    expect(link).toHaveAttribute('href', `/redazione/caroselli/${SLIDER_A}`);
    // Come «Anteprima sul sito»: l'editor resta aperto e un blocco appena inserito non si perde.
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('un blocco di un altro tipo non nomina più la presentazione', () => {
    render(
      <DensityProvider>
        <BlockInspector
          block={createBlock('html')}
          onChange={vi.fn()}
          onColumnStructureChange={vi.fn()}
        />
      </DensityProvider>,
    );
    expect(screen.queryByText(/presentazione/i)).toBeNull();
  });
});

describe('editor: inserimento del blocco', () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) return Promise.resolve(syntheticContent);
      if (path === `/contents/${syntheticContent.id}/draft`) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      if (path === '/sliders') return Promise.resolve(SLIDERS);
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

  it('offre «Presentazione a scorrimento» e chiede quale carosello', async () => {
    const user = await openInserter();
    const voce = await screen.findByRole('button', { name: 'Presentazione a scorrimento' });
    expect(voce).toBeEnabled();
    await user.click(voce);
    expect(await screen.findByRole('combobox', { name: 'Quale carosello?' })).toBeInTheDocument();
  });

  it('senza scegliere un carosello «Inserisci» non agisce; scelto, inserisce il blocco', async () => {
    const user = await openInserter();
    await user.click(await screen.findByRole('button', { name: 'Presentazione a scorrimento' }));
    const select = await screen.findByRole('combobox', { name: 'Quale carosello?' });
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));

    const inserisci = screen.getByRole('button', { name: 'Inserisci' });
    expect(inserisci).toBeDisabled();
    await user.click(inserisci);
    const tree = screen.getByRole('region', { name: 'Struttura del contenuto' });
    expect(within(tree).queryByText('Presentazione a scorrimento')).toBeNull();

    await user.selectOptions(select, SLIDER_B);
    await user.click(screen.getByRole('button', { name: 'Inserisci' }));

    expect(within(tree).getByText('Presentazione a scorrimento')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Quale carosello?' })).toBeNull();
    // Il blocco nato è selezionato e il pannello mostra il carosello scelto.
    expect(
      await screen.findByRole('link', { name: 'Modifica le immagini del carosello' }),
    ).toHaveAttribute('href', `/redazione/caroselli/${SLIDER_B}`);
  });

  it('se i caroselli non si caricano lo dice e «Inserisci» resta spento', async () => {
    apiMock.mockImplementation((path: string) => {
      if (path === `/contents/${syntheticContent.id}`) return Promise.resolve(syntheticContent);
      if (path === `/contents/${syntheticContent.id}/draft`) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      if (path === '/sliders') {
        return Promise.reject(new ApiError(500, 'INTERNAL', 'Errore del servizio.'));
      }
      return Promise.resolve(undefined);
    });
    const user = await openInserter();
    await user.click(await screen.findByRole('button', { name: 'Presentazione a scorrimento' }));
    expect(await screen.findByText(/Errore del servizio\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inserisci' })).toBeDisabled();
  });
});
