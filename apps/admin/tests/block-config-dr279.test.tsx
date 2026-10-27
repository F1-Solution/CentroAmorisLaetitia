import { blockNodeSchema, type BlockNode } from '@amoris/blocks';
import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import { CREATABLE_TYPES, UNCREATABLE_REASON } from '../src/lib/editor/tree';

/**
 * DR-279 (wave 1G-W7, T2f): nel pannello del blocco si configurano «Video», «Mappa» e
 * «Documento» già presenti nella pagina. Restano non inseribili.
 *
 * - Video: un MP4 pubblico della libreria oppure un indirizzo YouTube, validato qui e
 *   ricondotto alla forma `watch?v=` (l'API lo rivaluta); anteprima facoltativa.
 * - Mappa: indirizzo, coordinate, zoom, interruttori e segnaposto; l'html dei segnaposto
 *   non si modifica e si conserva.
 * - Documento: solo fra i documenti pubblici della schermata «Documenti».
 *
 * Ogni modifica passa da `onChange` con un blocco che lo schema condiviso accetta; un
 * valore non valido resta nel campo, con l'errore, e non arriva al documento.
 *
 * Media, documenti e indirizzi sono inventati.
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

const YOUTUBE = 'https://www.youtube.com/watch?v=aBcDeFgHi_-';
const VIDEO_A = '/media/2026/01/video-a.mp4';
const VIDEO_B = '/media/2026/01/video-b.mp4';
const VIDEO_PRIVATE = '/media/2026/01/video-riservato.mp4';
const POSTER = '/media/2026/01/anteprima.png';
const DOC_A = '11111111-1111-4111-8111-111111111111';
const DOC_B = '22222222-2222-4222-8222-222222222222';

const MEDIA_VIDEOS = {
  items: [
    {
      id: 'm1',
      publicPath: VIDEO_A,
      fileName: 'video-a.mp4',
      title: 'Video A',
      mimeType: 'video/mp4',
      isPrivate: false,
    },
    {
      id: 'm2',
      publicPath: VIDEO_B,
      fileName: 'video-b.mp4',
      title: null,
      mimeType: 'video/mp4',
      isPrivate: false,
    },
    {
      id: 'm3',
      publicPath: VIDEO_PRIVATE,
      fileName: 'video-riservato.mp4',
      title: 'Riservato',
      mimeType: 'video/mp4',
      isPrivate: true,
    },
    {
      id: 'm4',
      publicPath: '/media/2026/01/video.webm',
      fileName: 'video.webm',
      title: 'WebM',
      mimeType: 'video/webm',
      isPrivate: false,
    },
  ],
};

const MEDIA_IMAGES = {
  items: [
    {
      id: 'i1',
      publicPath: POSTER,
      fileName: 'anteprima.png',
      title: 'Anteprima',
      mimeType: 'image/png',
      isPrivate: false,
    },
    {
      id: 'i2',
      publicPath: '/media/2026/01/riservata.png',
      fileName: 'riservata.png',
      title: 'Riservata',
      mimeType: 'image/png',
      isPrivate: true,
    },
  ],
};

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

function videoBlock(props: Record<string, unknown> = {}): BlockNode {
  return blockNodeSchema.parse({
    type: 'video',
    id: 'b_00000000a001',
    props: { src: VIDEO_A, provider: 'file', ...props },
    children: [],
  });
}

const PIN_HTML = '<p>Fumetto <strong>importato</strong></p>';

function mapBlock(props: Record<string, unknown> = {}): BlockNode {
  return blockNodeSchema.parse({
    type: 'map',
    id: 'b_00000000a002',
    props: {
      address: 'Via Sintetica 1',
      lat: '41.9',
      lng: '12.5',
      pins: [{ title: 'Sede', lat: '41.9', lng: '12.5', html: PIN_HTML }],
      ...props,
    },
    children: [],
  });
}

function documentBlock(props: Record<string, unknown> = {}): BlockNode {
  return blockNodeSchema.parse({
    type: 'document',
    id: 'b_00000000a003',
    props: { documentId: DOC_A, ...props },
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

beforeEach(() => {
  apiMock.mockReset();
  apiMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/media?') && path.includes('mimePrefix=video')) return MEDIA_VIDEOS;
    if (path.startsWith('/media?') && path.includes('mimePrefix=image')) return MEDIA_IMAGES;
    if (path === '/documents') return DOCUMENTS;
    throw new Error(`chiamata non prevista: ${path}`);
  });
});

describe('restano non inseribili (DR-279)', () => {
  // Il documento è diventato inseribile con DR-287 (T2k della 1G-W7): restano video e mappa.
  it('video e mappa non sono fra i tipi creabili e il motivo resta', () => {
    for (const type of ['video', 'map'] as const) {
      expect(CREATABLE_TYPES).not.toContain(type);
    }
    const reason = UNCREATABLE_REASON.toLowerCase();
    expect(reason).toContain('video');
    expect(reason).toContain('mappa');
  });
});

describe('pannello del blocco «Video» (DR-279)', () => {
  it('aprirlo non cambia il blocco (1D-36)', async () => {
    const onChange = renderInspector(videoBlock());
    await screen.findByRole('combobox', { name: 'Video della libreria' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sceglie un altro MP4 pubblico della libreria; i riservati e i non MP4 non si offrono', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(videoBlock());
    const select = await screen.findByRole('combobox', { name: 'Video della libreria' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    const values = within(select)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);
    expect(values).toEqual([VIDEO_A, VIDEO_B]);
    await user.selectOptions(select, VIDEO_B);
    expect(lastBlock(onChange).props).toMatchObject({ src: VIDEO_B, provider: 'file' });
  });

  it('passa a YouTube: l’indirizzo valido si scrive in forma canonica', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(videoBlock());
    await user.click(screen.getByRole('radio', { name: 'Indirizzo YouTube' }));
    const field = screen.getByRole('textbox', { name: 'Indirizzo YouTube' });
    await user.type(field, 'https://youtu.be/aBcDeFgHi_-');
    expect(lastBlock(onChange).props).toMatchObject({ src: YOUTUBE, provider: 'youtube' });
  });

  it('passato a YouTube senza un indirizzo valido, avvisa che il video non è cambiato (giro 1)', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(videoBlock());
    await user.click(screen.getByRole('radio', { name: 'Indirizzo YouTube' }));
    expect(screen.getByText(/Il video non è ancora cambiato/)).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Indirizzo YouTube' }),
      'https://vimeo.com/1',
    );
    expect(screen.getByText(/Il video non è ancora cambiato/)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    const field = screen.getByRole('textbox', { name: 'Indirizzo YouTube' });
    await user.clear(field);
    await user.type(field, YOUTUBE);
    expect(screen.queryByText(/Il video non è ancora cambiato/)).toBeNull();
  });

  it.each([
    ['un altro host', 'https://vimeo.com/12345'],
    ['un host che finge', 'https://youtube.com.evil.example/watch?v=aBcDeFgHi_-'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,ciao'],
    ['http', 'http://www.youtube.com/watch?v=aBcDeFgHi_-'],
  ])('rifiuta %s in italiano e non scrive nulla', async (_caso, value) => {
    const user = userEvent.setup();
    const onChange = renderInspector(videoBlock({ src: YOUTUBE, provider: 'youtube' }));
    const field = screen.getByRole('textbox', { name: 'Indirizzo YouTube' });
    expect(field).toHaveValue(YOUTUBE);
    await user.clear(field);
    await user.type(field, value);
    expect(await screen.findByText(/Serve un indirizzo YouTube/)).toBeInTheDocument();
    expect(onChange.mock.calls.every(([next]) => next.props.src === YOUTUBE)).toBe(true);
  });

  it('sceglie un’anteprima fra le immagini pubbliche e la toglie', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(videoBlock());
    await user.click(screen.getByRole('button', { name: 'Scegli l’anteprima' }));
    const option = await screen.findByRole('option', { name: 'Anteprima' });
    expect(screen.queryByRole('option', { name: 'Riservata' })).toBeNull();
    await user.click(option);
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    expect(lastBlock(onChange).props).toMatchObject({ posterSrc: POSTER, posterMediaId: null });
  });

  it('un’anteprima presente si toglie', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(videoBlock({ posterSrc: POSTER }));
    await user.click(screen.getByRole('button', { name: 'Togli l’anteprima' }));
    expect(lastBlock(onChange).props).toMatchObject({ posterSrc: null, posterMediaId: null });
  });
});

describe('pannello del blocco «Mappa» (DR-279)', () => {
  it('aprirlo non cambia il blocco (1D-36)', () => {
    const onChange = renderInspector(mapBlock());
    expect(screen.getByRole('textbox', { name: 'Indirizzo' })).toHaveValue('Via Sintetica 1');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cambia indirizzo, coordinate e zoom', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mapBlock());
    const lat = screen.getByRole('textbox', { name: 'Latitudine' });
    await user.clear(lat);
    await user.type(lat, '45.4642');
    expect(lastBlock(onChange).props.lat).toBe('45.4642');
    const zoom = screen.getByRole('spinbutton', { name: 'Zoom' });
    await user.clear(zoom);
    await user.type(zoom, '12');
    expect(lastBlock(onChange).props.zoom).toBe(12);
  });

  it('coordinate e zoom fuori regola restano nel campo con l’errore', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mapBlock());
    const lng = screen.getByRole('textbox', { name: 'Longitudine' });
    await user.clear(lng);
    await user.type(lng, '12,5');
    expect(screen.getByText(/numero con il punto/)).toBeInTheDocument();
    // Mentre si scrive, «12» è già valido e si scrive; «12,5» no, e non arriva al blocco.
    expect(onChange.mock.calls.at(-1)?.[0].props.lng).toBe('12');
    const zoom = screen.getByRole('spinbutton', { name: 'Zoom' });
    await user.clear(zoom);
    await user.type(zoom, '30');
    expect(screen.getByText(/da 1 a 21/)).toBeInTheDocument();
    expect(onChange.mock.calls.every(([next]) => next.props.lng !== '12,5')).toBe(true);
    expect(onChange.mock.calls.every(([next]) => next.props.zoom !== 30)).toBe(true);
  });

  it('la scala di grigi porta con sé la sua classe (§7.2) e la quantità', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mapBlock());
    await user.click(screen.getByRole('checkbox', { name: 'Scala di grigi' }));
    expect(lastBlock(onChange).props).toMatchObject({
      grayscale: true,
      classes: ['map-grayscale'],
    });
    await user.click(screen.getByRole('checkbox', { name: 'Rotella del mouse per lo zoom' }));
    expect(lastBlock(onChange).props.mouseWheel).toBe(true);
    await user.click(screen.getByRole('checkbox', { name: 'Trascinamento sui telefoni' }));
    expect(lastBlock(onChange).props.mobileDragging).toBe(true);
  });

  it('il segnaposto cambia titolo e coordinate; l’html resta e non ha un campo', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mapBlock());
    const pin = screen.getByRole('group', { name: 'Segnaposto 1' });
    const title = within(pin).getByRole('textbox', { name: 'Titolo' });
    await user.clear(title);
    await user.type(title, 'Nuova sede');
    const next = lastBlock(onChange);
    expect(next.props.pins).toEqual([
      { title: 'Nuova sede', lat: '41.9', lng: '12.5', html: PIN_HTML },
    ]);
    // Nessun campo mostra o modifica l'HTML del fumetto.
    expect(screen.queryByDisplayValue(PIN_HTML)).toBeNull();
    expect(within(pin).getByText(/non si modifica/)).toBeInTheDocument();
  });

  it('aggiunge e toglie un segnaposto; il nuovo non ha html', async () => {
    const user = userEvent.setup();
    const onChange = renderInspector(mapBlock());
    await user.click(screen.getByRole('button', { name: 'Aggiungi un segnaposto' }));
    const added = lastBlock(onChange).props.pins as { html: string | null }[];
    expect(added).toHaveLength(2);
    expect(added[1]?.html).toBeNull();
    await user.click(
      within(screen.getByRole('group', { name: 'Segnaposto 1' })).getByRole('button', {
        name: 'Togli il segnaposto',
      }),
    );
    // Resta il nuovo, e i campi mostrano i suoi valori, non quelli del segnaposto tolto.
    expect(lastBlock(onChange).props.pins).toEqual([
      { title: null, lat: '41.9', lng: '12.5', html: null },
    ]);
    const rimasto = screen.getByRole('group', { name: 'Segnaposto 1' });
    expect(within(rimasto).getByRole('textbox', { name: 'Titolo' })).toHaveValue('');
    expect(within(rimasto).queryByText(/non si modifica/)).toBeNull();
  });
});

describe('pannello del blocco «Documento» (DR-279)', () => {
  it('aprirlo non cambia il blocco (1D-36)', async () => {
    const onChange = renderInspector(documentBlock());
    await screen.findByRole('combobox', { name: 'Documento' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sceglie fra i documenti pubblici e cambia l’etichetta; la visualizzazione salvata resta', async () => {
    const user = userEvent.setup();
    // `display` non ha effetto sul sito: non si offre, e il valore importato si conserva (giro 1).
    const onChange = renderInspector(documentBlock({ display: 'button' }));
    const select = await screen.findByRole('combobox', { name: 'Documento' });
    await waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(2));
    await user.selectOptions(select, DOC_B);
    expect(lastBlock(onChange).props.documentId).toBe(DOC_B);

    await user.type(screen.getByRole('textbox', { name: 'Etichetta' }), 'S');
    expect(lastBlock(onChange).props.label).toBe('S');

    expect(screen.queryByRole('group', { name: 'Visualizzazione' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(onChange.mock.calls.every(([next]) => next.props.display === 'button')).toBe(true);
  });

  it('un documento non più fra i pubblici lo dice', async () => {
    const gone = '33333333-3333-4333-8333-333333333333';
    renderInspector(documentBlock({ documentId: gone }));
    const select = await screen.findByRole('combobox', { name: 'Documento' });
    await waitFor(() =>
      expect(
        within(select).getByRole('option', { name: 'Documento non disponibile' }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(/non è fra quelli pubblici/)).toBeInTheDocument();
  });
});
