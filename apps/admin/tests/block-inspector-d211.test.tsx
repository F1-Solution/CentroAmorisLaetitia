import { blockNodeSchema, type BlockNode } from '@amoris/blocks';
import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';

/**
 * D211 / DR-320 (wave 1G-W9, T10b, difetto W9-N1): «Media e testo» ed «Elenco di contenuti»
 * si inseriscono dall'editor e ora si configurano anche, ciascuno con il suo pannello.
 *
 * - Media e testo: si cambia l'immagine con lo stesso selettore del blocco «Immagine» e si
 *   scrive il testo alternativo. Il sito usa `mediaAlt` così com'è, senza leggerlo dal media:
 *   se nel selettore si conferma il testo proposto dal media, il pannello lo copia nel blocco.
 *   Il testo arriva dal selettore stesso (DR-321): nessuna richiesta a `GET /media/:id`, quindi
 *   nessuna attesa in cui il documento possa cambiare.
 * - Elenco di contenuti: categorie da `GET /terms?taxonomy=category` (nessuna = tutte) e
 *   numero di notizie da 1 a 50 o vuoto (`null` = quante una pagina dell'archivio). Una
 *   categoria del blocco che non esiste più resta scelta e si può togliere; senza categorie
 *   il pannello lo dice come quello delle notizie (DR-322).
 * - Sezione, colonna e modulo dicono che cosa si può fare, con il nome italiano del blocco:
 *   nessun testo mostra più il nome interno del tipo.
 *
 * Ogni blocco che esce dai pannelli passa lo schema di `@amoris/blocks`. Media, categorie e
 * testi sono inventati.
 */

const apiMock = vi.fn();

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

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

const { BlockInspector } = await import('../src/components/editor/BlockInspector');

const MEDIA_A = '22222222-2222-4222-8222-222222222222';
const MEDIA_B = '44444444-4444-4444-8444-444444444444';
const CAT_A = '55555555-5555-4555-8555-555555555555';
const CAT_B = '66666666-6666-4666-8666-666666666666';
const CAT_GONE = '77777777-7777-4777-8777-777777777777';
const FORM_ID = '88888888-8888-4888-8888-888888888888';

const MEDIA_ITEMS = [
  {
    id: MEDIA_A,
    publicPath: '/media/foto-a.png',
    fileName: 'foto-a.png',
    title: 'Foto A di prova',
    altText: 'Alt della foto A',
    mimeType: 'image/png',
    isPrivate: false,
  },
  {
    id: MEDIA_B,
    publicPath: '/media/foto-b.png',
    fileName: 'foto-b.png',
    title: 'Foto B di prova',
    altText: null,
    mimeType: 'image/png',
    isPrivate: false,
  },
];

const CATEGORIES = [
  { id: CAT_A, name: 'Famiglie di prova', contentCount: 3 },
  { id: CAT_B, name: 'Coppie di prova', contentCount: 1 },
];

/** I nomi interni dei tipi che nessun testo dell'area deve mostrare. */
const INTERNAL_NAMES = /\b(section|column|form|media_text|post_list)\b/;

const CHILD = {
  type: 'rich_text',
  id: 'b_00000000d2c1',
  props: { html: '<p>Testo sintetico accanto all’immagine.</p>' },
  children: [],
};

function mediaTextBlock(props: Record<string, unknown> = {}): BlockNode {
  return blockNodeSchema.parse({
    type: 'media_text',
    id: 'b_00000000d201',
    props: {
      mediaId: MEDIA_A,
      mediaAlt: 'Alt del blocco',
      mediaVariant: '300x200',
      mediaPosition: 'right',
      verticalAlignment: 'top',
      linkUrl: 'https://esempio.invalid/pagina',
      ...props,
    },
    children: [CHILD],
  });
}

function postListBlock(props: Record<string, unknown> = {}): BlockNode {
  return blockNodeSchema.parse({
    type: 'post_list',
    id: 'b_00000000d202',
    props: { termIds: [CAT_A], limit: null, offset: 2, showDate: false, ...props },
    children: [],
  });
}

/** Come nell'editor: il blocco cambiato torna al pannello, e `onChange` lo registra. */
function Stateful({
  initial,
  onChange,
}: {
  readonly initial: BlockNode;
  readonly onChange: (next: BlockNode) => void;
}) {
  const [block, setBlock] = useState(initial);
  return (
    <BlockInspector
      block={block}
      onChange={(next) => {
        onChange(next);
        setBlock(next);
      }}
      onColumnStructureChange={vi.fn()}
    />
  );
}

function renderInspector(block: BlockNode, onChange = vi.fn()) {
  render(
    <DensityProvider>
      <Stateful initial={block} onChange={onChange} />
    </DensityProvider>,
  );
  return onChange;
}

/** L'ultimo blocco passato a `onChange`, già verificato con lo schema condiviso. */
function lastBlock(onChange: ReturnType<typeof vi.fn>) {
  const next = onChange.mock.calls.at(-1)?.[0] as BlockNode;
  expect(blockNodeSchema.safeParse(next).success).toBe(true);
  return next as BlockNode & { props: Record<string, unknown> };
}

/** Nessuna scrittura: i pannelli cambiano solo il blocco, che si salva con il contenuto. */
function writes() {
  return apiMock.mock.calls.filter((call) => (call[1] as { method?: string } | undefined)?.method);
}

/** Le letture di un singolo media (`GET /media/:id`): il pannello non ne fa (DR-321). */
function mediaReads() {
  return apiMock.mock.calls.filter(([path]) => /^\/media\/[^?]/.test(String(path)));
}

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/media?') && path.includes('mimePrefix=image')) {
      return { items: MEDIA_ITEMS };
    }
    if (path === '/terms?taxonomy=category') return CATEGORIES;
    throw new Error(`chiamata non prevista: ${path}`);
  });
});

describe('pannello del blocco «Media e testo» (DR-320)', () => {
  it('aprirlo non cambia il blocco (1D-36)', () => {
    const onChange = renderInspector(mediaTextBlock());
    expect(screen.getByRole('button', { name: 'Cambia immagine' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Testo alternativo' })).toHaveValue(
      'Alt del blocco',
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it('senza immagine il pulsante dice «Scegli l’immagine»', () => {
    renderInspector(mediaTextBlock({ mediaId: null, mediaAlt: '' }));
    expect(screen.getByRole('button', { name: 'Scegli l’immagine' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cambia immagine' })).toBeNull();
  });

  it('mostra l’aiuto del testo alternativo e la nota sul testo accanto all’immagine', () => {
    renderInspector(mediaTextBlock());
    expect(
      screen.getByText('Che cosa mostra l’immagine, per chi non la vede.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Il testo accanto all’immagine si modifica scegliendo nell’albero i blocchi che contiene.',
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(INTERNAL_NAMES);
  });

  it('sceglie un’altra immagine con il testo scritto nel selettore: niente variante, il resto resta', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mediaTextBlock());
    await user.click(screen.getByRole('button', { name: 'Cambia immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto B di prova/ }));
    // Il selettore è l'ultimo campo con questo nome: il primo è quello del pannello.
    const fields = screen.getAllByRole('textbox', { name: 'Testo alternativo' });
    await user.type(fields[fields.length - 1]!, 'Una famiglia inventata');
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const next = lastBlock(onChange);
    expect(next.props).toEqual({
      mediaId: MEDIA_B,
      mediaAlt: 'Una famiglia inventata',
      mediaVariant: null,
      mediaPosition: 'right',
      mediaWidthPercent: null,
      verticalAlignment: 'top',
      linkUrl: 'https://esempio.invalid/pagina',
      classes: [],
    });
    expect(next.children).toEqual(mediaTextBlock().children);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(writes()).toEqual([]);
  });

  it('confermando il testo proposto dal media, il blocco lo riceve: il sito non lo legge dal media', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mediaTextBlock({ mediaId: null, mediaAlt: '' }));
    await user.click(screen.getByRole('button', { name: 'Scegli l’immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto A di prova/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    // Subito, alla conferma, e senza chiedere il media all'API: il testo arriva dal selettore.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastBlock(onChange).props).toMatchObject({
      mediaId: MEDIA_A,
      mediaAlt: 'Alt della foto A',
      mediaVariant: null,
    });
    expect(screen.getByRole('textbox', { name: 'Testo alternativo' })).toHaveValue(
      'Alt della foto A',
    );
    expect(mediaReads()).toEqual([]);
    expect(writes()).toEqual([]);
  });

  it('un testo riscritto nel selettore vince su quello proposto dal media', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mediaTextBlock());
    await user.click(screen.getByRole('button', { name: 'Cambia immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto A di prova/ }));
    const fields = screen.getAllByRole('textbox', { name: 'Testo alternativo' });
    const picker = fields[fields.length - 1]!;
    await user.clear(picker);
    await user.type(picker, 'Alt riscritto');
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(lastBlock(onChange).props).toMatchObject({
      mediaId: MEDIA_A,
      mediaAlt: 'Alt riscritto',
      mediaVariant: null,
    });
    expect(mediaReads()).toEqual([]);
  });

  it('un’immagine dichiarata decorativa ha il testo alternativo vuoto', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mediaTextBlock());
    await user.click(screen.getByRole('button', { name: 'Cambia immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto A di prova/ }));
    await user.click(screen.getByRole('checkbox', { name: /puramente decorativa/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(lastBlock(onChange).props).toMatchObject({
      mediaId: MEDIA_A,
      mediaAlt: '',
      mediaVariant: null,
    });
    // Il testo del media non entra: decorativa vuol dire testo vuoto per scelta.
    expect(mediaReads()).toEqual([]);
  });

  it('modifica il testo alternativo senza toccare il resto', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mediaTextBlock());
    const field = screen.getByRole('textbox', { name: 'Testo alternativo' });
    await user.clear(field);
    await user.type(field, 'Nuovo alt');
    const next = lastBlock(onChange);
    expect(next.props).toMatchObject({
      mediaId: MEDIA_A,
      mediaAlt: 'Nuovo alt',
      mediaVariant: '300x200',
      mediaPosition: 'right',
    });
    expect(next.children).toEqual(mediaTextBlock().children);
  });
});

describe('pannello del blocco «Elenco di contenuti» (DR-320)', () => {
  it('aprirlo non cambia il blocco (1D-36)', async () => {
    const onChange = renderInspector(postListBlock());
    await screen.findByRole('checkbox', { name: 'Famiglie di prova' });
    expect(screen.getByRole('spinbutton', { name: 'Numero di notizie' })).toHaveValue(null);
    expect(onChange).not.toHaveBeenCalled();
    expect(apiMock).toHaveBeenCalledWith('/terms?taxonomy=category', expect.anything());
  });

  it('mostra i due aiuti approvati e nessun nome interno', async () => {
    renderInspector(postListBlock());
    await screen.findByRole('checkbox', { name: 'Famiglie di prova' });
    expect(screen.getByRole('group', { name: 'Categorie' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Se non ne scegli nessuna, l’elenco mostra le notizie di tutte le categorie.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Da 1 a 50. Se lo lasci vuoto, ne mostra quante una pagina dell’archivio.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(INTERNAL_NAMES);
  });

  it('le categorie caricate si scelgono e si tolgono; gli altri campi restano', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(postListBlock());
    const famiglie = await screen.findByRole('checkbox', { name: 'Famiglie di prova' });
    const coppie = screen.getByRole('checkbox', { name: 'Coppie di prova' });
    expect(famiglie).toBeChecked();
    expect(coppie).not.toBeChecked();

    await user.click(coppie);
    expect(lastBlock(onChange).props.termIds).toEqual([CAT_A, CAT_B]);

    await user.click(famiglie);
    expect(lastBlock(onChange).props.termIds).toEqual([CAT_B]);

    await user.click(screen.getByRole('checkbox', { name: 'Coppie di prova' }));
    const next = lastBlock(onChange);
    // Nessuna categoria: il sito mostra tutte le notizie.
    expect(next.props.termIds).toEqual([]);
    expect(next.props).toMatchObject({ offset: 2, showDate: false, limit: null });
    expect(writes()).toEqual([]);
  });

  it('una categoria che non c’è più resta scelta, si mostra come «Categoria non trovata» e si toglie', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(postListBlock({ termIds: [CAT_A, CAT_GONE] }));
    const gone = await screen.findByRole('checkbox', { name: 'Categoria non trovata' });
    expect(gone).toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
    await user.click(gone);
    expect(lastBlock(onChange).props.termIds).toEqual([CAT_A]);
    expect(screen.queryByRole('checkbox', { name: 'Categoria non trovata' })).toBeNull();
  });

  it('senza categorie lo dice come il pannello delle notizie (DR-322)', async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === '/terms?taxonomy=category') return [];
      throw new Error(`chiamata non prevista: ${path}`);
    });
    const onChange = renderInspector(postListBlock({ termIds: [] }));
    expect(
      await screen.findByText(
        'Non ci sono ancora categorie: si creano dalla schermata «Categorie».',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText('Caricamento delle categorie in corso…')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('se le categorie non si caricano lo dice, e le scelte del blocco restano', async () => {
    apiMock.mockImplementation(async () => {
      throw new Error('rete inventata assente');
    });
    const onChange = renderInspector(postListBlock({ termIds: [CAT_A, CAT_GONE] }));
    expect(await screen.findByText('Le categorie non si sono caricate.')).toBeInTheDocument();
    expect(screen.getByText('Categorie non disponibili')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('numero vuoto → null, valido → il numero', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(postListBlock({ limit: 5 }));
    const field = screen.getByRole('spinbutton', { name: 'Numero di notizie' });
    expect(field).toHaveValue(5);
    await user.clear(field);
    expect(lastBlock(onChange).props.limit).toBeNull();
    await user.type(field, '12');
    expect(lastBlock(onChange).props.limit).toBe(12);
  });

  it('fuori dai limiti il numero resta nel campo con l’errore e il blocco non cambia', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(postListBlock());
    const field = screen.getByRole('spinbutton', { name: 'Numero di notizie' });
    await user.type(field, '0');
    expect(screen.getByText(/da 1 a 50/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    await user.clear(field);
    await user.type(field, '75');
    // Mentre si scrive, «7» è già valido e si scrive; «75» no, e non arriva al blocco.
    expect(onChange.mock.calls.every(([next]) => next.props.limit !== 75)).toBe(true);
    expect(lastBlock(onChange).props.limit).toBe(7);
    expect(field).toHaveValue(75);
  });
});

describe('blocchi che non si modificano nel pannello (DR-320)', () => {
  it.each([
    [
      'section',
      { fullWidth: false },
      'Il blocco «Sezione» contiene altri blocchi: per modificarli, sceglili nell’albero. La sezione si può spostare o eliminare.',
    ],
    [
      'column',
      { width: '4_4' },
      'Il blocco «Colonna» contiene altri blocchi: per modificarli, sceglili nell’albero. La colonna si può spostare o eliminare.',
    ],
    [
      'form',
      { formId: FORM_ID, origin: 'wpforms' },
      'I campi del modulo non si modificano in questa fase: il blocco «Modulo» si può spostare o eliminare.',
    ],
  ])('«%s» lo dice con il nome italiano del blocco', (type, props, text) => {
    const block = blockNodeSchema.parse({ type, id: 'b_00000000d203', props, children: [] });
    const onChange = renderInspector(block);
    expect(screen.getByText('Questo blocco non si modifica qui')).toBeInTheDocument();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(INTERNAL_NAMES);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('«Media e testo» ed «Elenco di contenuti» non mostrano più l’avviso', async () => {
    renderInspector(mediaTextBlock());
    expect(screen.queryByText('Questo blocco non si modifica qui')).toBeNull();
    const { unmount } = render(
      <DensityProvider>
        <div data-testid="elenco">
          <BlockInspector
            block={postListBlock()}
            onChange={vi.fn()}
            onColumnStructureChange={vi.fn()}
          />
        </div>
      </DensityProvider>,
    );
    const elenco = screen.getByTestId('elenco');
    await within(elenco).findByRole('checkbox', { name: 'Famiglie di prova' });
    expect(within(elenco).queryByText('Questo blocco non si modifica qui')).toBeNull();
    unmount();
  });
});
