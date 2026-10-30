import { blockNodeSchema, type BlockNode } from '@amoris/blocks';
import { DensityProvider } from '@amoris/ui';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/lib/api';
import type * as ApiModule from '../src/lib/api';

/**
 * Wave 1G-W9, T1: immagini nell'area (W8-01, W8-06, W8-10, W8-34, W8-35). Media e testi inventati.
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

const { siteUrl } = await import('../src/lib/siteUrl');
const { ImageInsertPicker } = await import('../src/components/editor/ImageInsertPicker');
const { ContentListingPanel } = await import('../src/components/editor/ContentListingPanel');
const { ContentSeoPanel } = await import('../src/components/editor/ContentSeoPanel');
const { VideoInspector } = await import('../src/components/editor/VideoInspector');
const { BlockInspector } = await import('../src/components/editor/BlockInspector');

const SITE = 'http://localhost:3300';
const MEDIA_A = '22222222-2222-4222-8222-222222222222';
const MEDIA_B = '44444444-4444-4444-8444-444444444444';
const MEDIA = {
  items: [
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
  ],
};

beforeEach(() => {
  apiMock.mockReset();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE);
  apiMock.mockImplementation((path: string) => {
    if (path.startsWith('/media?')) return Promise.resolve(MEDIA);
    return Promise.resolve(undefined);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function thumbs(): string[] {
  return Array.from(document.querySelectorAll('.amoris-media-picker__thumb')).map(
    (node) => node.getAttribute('src') ?? '',
  );
}

describe('W8-01: le miniature chiedono l’immagine al sito', () => {
  it('siteUrl non raddoppia un indirizzo già assoluto', () => {
    expect(siteUrl('/media/x.png')).toBe(`${SITE}/media/x.png`);
    expect(siteUrl(`${SITE}/media/x.png`)).toBe(`${SITE}/media/x.png`);
  });

  it('blocco Immagine: le miniature sono indirizzi del sito', async () => {
    render(
      <DensityProvider>
        <ImageInsertPicker open onClose={vi.fn()} onInsert={vi.fn()} />
      </DensityProvider>,
    );
    await screen.findByRole('option', { name: /Foto A di prova/ });
    expect(thumbs()).toEqual([`${SITE}/media/foto-a.png`, `${SITE}/media/foto-b.png`]);
  });

  it('immagine in evidenza: anteprima e miniature del selettore sono indirizzi del sito, e si salva il percorso relativo', async () => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    render(
      <DensityProvider>
        <ContentListingPanel
          contentId="c1"
          type="page"
          featuredMedia={{
            id: MEDIA_A,
            title: 'Foto A di prova',
            thumbnailUrl: '/media/foto-a.png',
          }}
          termIds={[]}
          disabled={false}
          onSaved={onSaved}
        />
      </DensityProvider>,
    );
    expect(screen.getByRole('img', { name: 'Foto A di prova' })).toHaveAttribute(
      'src',
      `${SITE}/media/foto-a.png`,
    );
    await user.click(screen.getByRole('button', { name: 'Cambia l’immagine' }));
    await screen.findByRole('option', { name: /Foto B di prova/ });
    expect(thumbs()).toEqual([`${SITE}/media/foto-a.png`, `${SITE}/media/foto-b.png`]);
    await user.click(screen.getByRole('option', { name: /Foto B di prova/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0]?.[0].featuredMedia.thumbnailUrl).toBe('/media/foto-b.png');
  });

  it('copertina del video: miniature del sito, e nel blocco resta il percorso relativo', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const block = blockNodeSchema.parse({
      type: 'video',
      id: 'b_000000000b01',
      props: { src: 'https://www.youtube.com/watch?v=abcdefghijk', provider: 'youtube' },
      children: [],
    }) as BlockNode & { type: 'video' };
    render(
      <DensityProvider>
        <VideoInspector block={block} onChange={onChange} disabled={false} />
      </DensityProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Scegli l’anteprima' }));
    await screen.findByRole('option', { name: /Foto A di prova/ });
    expect(thumbs()).toEqual([`${SITE}/media/foto-a.png`, `${SITE}/media/foto-b.png`]);
    await user.click(screen.getByRole('option', { name: /Foto A di prova/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    expect(onChange.mock.calls.at(-1)?.[0].props.posterSrc).toBe('/media/foto-a.png');
  });
});

describe('W8-10: il selettore propone il testo alternativo del media', () => {
  it('scelto un media con testo alternativo si conferma senza riscriverlo e il blocco non lo riceve', async () => {
    const onInsert = vi.fn();
    const user = userEvent.setup();
    render(
      <DensityProvider>
        <ImageInsertPicker open onClose={vi.fn()} onInsert={onInsert} />
      </DensityProvider>,
    );
    await user.click(await screen.findByRole('option', { name: /Foto A di prova/ }));
    expect(screen.getByRole('textbox', { name: 'Testo alternativo' })).toHaveValue(
      'Alt della foto A',
    );
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    expect(onInsert).toHaveBeenCalledWith(MEDIA_A, '', false, 'Alt della foto A');
  });

  it('«decorativa» arriva come proprietà a parte', async () => {
    const onInsert = vi.fn();
    const user = userEvent.setup();
    render(
      <DensityProvider>
        <ImageInsertPicker open onClose={vi.fn()} onInsert={onInsert} />
      </DensityProvider>,
    );
    await user.click(await screen.findByRole('option', { name: /Foto A di prova/ }));
    await user.click(screen.getByRole('checkbox', { name: /puramente decorativa/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    expect(onInsert).toHaveBeenCalledWith(MEDIA_A, '', true, 'Alt della foto A');
  });
});

function imageBlock(props: Record<string, unknown> = {}): BlockNode {
  return blockNodeSchema.parse({
    type: 'image',
    id: 'b_000000000a01',
    props: { mediaId: MEDIA_A, variant: '300x150', alt: 'Alt del blocco', ...props },
    children: [],
  }) as BlockNode;
}

function inspector(block: BlockNode, onChange = vi.fn()) {
  render(
    <DensityProvider>
      <BlockInspector block={block} onChange={onChange} onColumnStructureChange={vi.fn()} />
    </DensityProvider>,
  );
  return onChange;
}

describe('W8-06: «Cambia immagine» nel blocco', () => {
  it('apre il selettore, e il cambio vale solo per il blocco: nuovo media, niente variante, alt secondo la regola', async () => {
    const onChange = inspector(imageBlock());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cambia immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto B di prova/ }));
    // Il media B non ha testo alternativo: lo chiede.
    expect(screen.getByRole('button', { name: 'Usa questo media' })).toBeDisabled();
    // Il selettore è l'ultimo campo con questo nome: il primo è quello dell'ispettore.
    const fields = screen.getAllByRole('textbox', { name: 'Testo alternativo' });
    await user.type(fields[fields.length - 1]!, 'Nuova foto');
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    const next = onChange.mock.calls.at(-1)?.[0] as Extract<BlockNode, { type: 'image' }>;
    expect(next.props.mediaId).toBe(MEDIA_B);
    expect(next.props.src).toBeNull();
    expect(next.props.variant).toBeNull();
    expect(next.props.alt).toBe('Nuova foto');
    expect(next.props.decorative).toBeFalsy();
    expect(blockNodeSchema.safeParse(next).success).toBe(true);
    // Nessuna scrittura sul media: solo letture dell'elenco.
    expect(
      apiMock.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method),
    ).toEqual([]);
  });

  it('scegliendo un media che ha già il testo alternativo, il blocco resta senza e lo legge dal media', async () => {
    const onChange = inspector(imageBlock({ alt: '' }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cambia immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto A di prova/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    const next = onChange.mock.calls.at(-1)?.[0] as Extract<BlockNode, { type: 'image' }>;
    expect(next.props.mediaId).toBe(MEDIA_A);
    expect(next.props.alt).toBe('');
  });

  it('cambiando immagine, titolo e didascalia della vecchia si azzerano e valgono quelli del nuovo media (DR-305)', async () => {
    const onChange = inspector(
      imageBlock({
        title: 'Titolo della vecchia foto',
        caption: 'Didascalia della vecchia foto',
        linkUrl: 'https://esempio.invalid/pagina',
      }),
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cambia immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto A di prova/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    const next = onChange.mock.calls.at(-1)?.[0] as Extract<BlockNode, { type: 'image' }>;
    expect(next.props.mediaId).toBe(MEDIA_A);
    expect(next.props.title).toBeNull();
    expect(next.props.caption).toBeNull();
    // Il collegamento non dipende dal file: resta.
    expect(next.props.linkUrl).toBe('https://esempio.invalid/pagina');
    expect(blockNodeSchema.safeParse(next).success).toBe(true);
  });

  it('l’avviso spiega la differenza fra «Cambia immagine» e «Sostituisci il file»', () => {
    inspector(imageBlock());
    expect(
      screen.getByText(/«Cambia immagine» cambia il file solo di questo blocco/),
    ).toBeInTheDocument();
    expect(screen.getByText(/«Sostituisci il file»/)).toBeInTheDocument();
  });

  it('i campi dicono la regola del testo del media', () => {
    inspector(imageBlock());
    expect(
      screen.getByText(/Se lo lasci vuoto, il sito usa quello scritto in Media/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Se la lasci vuota, il sito usa quella scritta in Media/),
    ).toBeInTheDocument();
  });
});

describe('W8-10: «Immagine puramente decorativa» nel blocco', () => {
  it('la spunta salva decorative e blocca il testo alternativo', async () => {
    const onChange = inspector(imageBlock());
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: /puramente decorativa/ }));
    const next = onChange.mock.calls.at(-1)?.[0] as Extract<BlockNode, { type: 'image' }>;
    expect(next.props.decorative).toBe(true);
    expect(next.props.alt).toBe('');
  });

  it('un blocco decorativo mostra la spunta attiva e il testo alternativo spento', () => {
    inspector(imageBlock({ decorative: true, alt: '' }));
    expect(screen.getByRole('checkbox', { name: /puramente decorativa/ })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Testo alternativo' })).toBeDisabled();
  });
});

describe('W8-34, W8-35: immagine di condivisione nella scheda SEO', () => {
  function seoApi(ogImageId: string | null, calls: { body?: unknown }[]) {
    apiMock.mockImplementation((path: string, options?: { method?: string; body?: unknown }) => {
      if (path === '/seo/contents/c1' && options?.method === 'PUT') {
        calls.push({ body: options.body });
        return Promise.resolve({});
      }
      if (path === '/seo/contents/c1') {
        return Promise.resolve({
          contentId: 'c1',
          title: null,
          description: null,
          canonicalUrl: null,
          ogTitle: null,
          ogDescription: null,
          ogImageId,
          robotsNoindex: false,
          robotsNofollow: false,
          schemaType: null,
          updatedAt: '2026-10-28T10:00:00.000Z',
        });
      }
      if (path === `/media/${MEDIA_A}`) return Promise.resolve(MEDIA.items[0]);
      if (path.startsWith('/media?')) return Promise.resolve(MEDIA);
      if (path.startsWith('/seo/contents/')) {
        return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Non trovato.'));
      }
      return Promise.resolve(undefined);
    });
  }

  function panel() {
    render(
      <DensityProvider>
        <ContentSeoPanel contentId="c1" path="/pagina/" disabled={false} />
      </DensityProvider>,
    );
  }

  it('dopo una ricarica la scheda nomina l’immagine scelta', async () => {
    seoApi(MEDIA_A, []);
    panel();
    expect(await screen.findByText(/Foto A di prova/)).toBeInTheDocument();
  });

  it('«Togli l’immagine» riporta l’immagine a nessuna e si salva ogImageId null', async () => {
    const calls: { body?: unknown }[] = [];
    seoApi(MEDIA_A, calls);
    panel();
    const user = userEvent.setup();
    await screen.findByText(/Foto A di prova/);
    await user.click(screen.getByRole('button', { name: 'Togli l’immagine' }));
    expect(screen.queryByText(/Foto A di prova/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Salva i metadati SEO' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0]?.body as { ogImageId: unknown }).ogImageId).toBeNull();
  });

  it('senza immagine non c’è «Togli l’immagine»', async () => {
    seoApi(null, []);
    panel();
    await screen.findByRole('button', { name: 'Salva i metadati SEO' });
    expect(screen.queryByRole('button', { name: 'Togli l’immagine' })).toBeNull();
  });

  it('il selettore non chiede il testo alternativo, ha le miniature del sito e «Usa questo media» è subito attivo', async () => {
    const calls: { body?: unknown }[] = [];
    seoApi(null, calls);
    panel();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: /Scegli immagine di condivisione/ }),
    );
    await user.click(await screen.findByRole('option', { name: /Foto B di prova/ }));
    expect(screen.queryByRole('textbox', { name: 'Testo alternativo' })).toBeNull();
    expect(thumbs()).toEqual([`${SITE}/media/foto-a.png`, `${SITE}/media/foto-b.png`]);
    const use = screen.getByRole('button', { name: 'Usa questo media' });
    expect(use).toBeEnabled();
    await user.click(use);
    await user.click(screen.getByRole('button', { name: 'Salva i metadati SEO' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0]?.body as { ogImageId: unknown }).ogImageId).toBe(MEDIA_B);
  });
});

/**
 * DR-312 (D203 B): un blocco importato (`useMediaCaption: false`) non usa la didascalia del media,
 * e l'ispettore lo dice; «Cambia immagine» ne fa un blocco scelto nell'area, che segue DR-305.
 */
describe('DR-312: didascalia dei blocchi importati', () => {
  it('per un blocco importato l’aiuto della didascalia non promette quella di Media', () => {
    inspector(imageBlock({ useMediaCaption: false }));
    expect(
      screen.getByText(/Se la lasci vuota, sotto l’immagine non compare nessuna didascalia/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Se la lasci vuota, il sito usa quella scritta in Media/)).toBeNull();
  });

  it('«Cambia immagine» su un blocco importato toglie il segno: vale la didascalia del nuovo media', async () => {
    const onChange = inspector(imageBlock({ useMediaCaption: false }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cambia immagine' }));
    await user.click(await screen.findByRole('option', { name: /Foto A di prova/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    const next = onChange.mock.calls.at(-1)?.[0] as Extract<BlockNode, { type: 'image' }>;
    expect(next.props.mediaId).toBe(MEDIA_A);
    expect(next.props.useMediaCaption).toBeUndefined();
    expect(blockNodeSchema.safeParse(next).success).toBe(true);
  });

  it('scrivere una didascalia nel blocco importato non toglie il segno', async () => {
    const onChange = inspector(imageBlock({ useMediaCaption: false }));
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Didascalia' }), 'X');
    const next = onChange.mock.calls.at(-1)?.[0] as Extract<BlockNode, { type: 'image' }>;
    expect(next.props.caption).toBe('X');
    expect(next.props.useMediaCaption).toBe(false);
  });
});
