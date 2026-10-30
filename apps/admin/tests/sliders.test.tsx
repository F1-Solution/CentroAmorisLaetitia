import { DensityProvider } from '@amoris/ui';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../src/lib/api';
import type * as SessionModule from '../src/lib/session';

/**
 * Wave 1G-W6, T4c: schermata «Caroselli» in Redazione (S19, DR-257). Titoli, testi e
 * nomi di file sono inventati.
 */

const apiMock = vi.fn();
let permissions: string[] = ['content.read', 'content.write'];

const { ApiError } = await vi.importActual<typeof ApiModule>('../src/lib/api');

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof ApiModule>('../src/lib/api');
  return { ...actual, api: (path: string, options?: unknown) => apiMock(path, options) };
});

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

const { SliderList } = await import('../src/components/sliders/SliderList');
const { SliderEditor } = await import('../src/components/sliders/SliderEditor');
const { AREA_DEFINITIONS } = await import('../src/lib/areas');
const { actionLabel, entityTypeLabel } = await import('../src/lib/auditLabels');

const SLIDER_ID = '66666666-6666-4666-8666-666666666666';
const uuid = (n: number): string => `77777777-7777-4777-8777-${String(n).padStart(12, '0')}`;
const media = (n: number): string => `88888888-8888-4888-8888-${String(n).padStart(12, '0')}`;

function slide(n: number, extra: Record<string, unknown> = {}) {
  return {
    id: uuid(n),
    position: n,
    mediaId: media(n) as string | null,
    heading: `Titolo ${n}`,
    body: null as string | null,
    image: { fileName: `immagine-${n}.jpg`, publicPath: `/media/2025/03/immagine-${n}.jpg` } as {
      fileName: string;
      publicPath: string;
    } | null,
    ...extra,
  };
}

function sliderWith(slides: ReturnType<typeof slide>[], usedIn: unknown[] = []) {
  return {
    id: SLIDER_ID,
    title: 'Carosello di prova',
    updatedAt: '2026-10-01T10:00:00.000Z',
    slides,
    usedIn,
  };
}

const MEDIA_LIST = {
  items: [
    {
      id: media(90),
      publicPath: '/media/nuova.jpg',
      fileName: 'nuova.jpg',
      title: 'Nuova',
      isPrivate: false,
    },
    {
      id: media(91),
      publicPath: '/media/riservata.jpg',
      fileName: 'riservata.jpg',
      title: 'Riservata',
      isPrivate: true,
    },
  ],
};

let current = sliderWith([slide(1), slide(2), slide(3)]);

function writes(): unknown[][] {
  return apiMock.mock.calls.filter((call) => (call[1] as { method?: string })?.method === 'PUT');
}

function paginaDi(href: string): string {
  return resolve(__dirname, '../src/app', href.replace(/^\//, ''), 'page.tsx');
}

beforeEach(() => {
  apiMock.mockReset();
  permissions = ['content.read', 'content.write'];
  current = sliderWith([slide(1), slide(2), slide(3)]);
  apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
    if (path === '/sliders' && !options?.method) {
      return [
        {
          id: SLIDER_ID,
          title: 'Carosello di prova',
          slideCount: 3,
          usedInCount: 2,
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      ];
    }
    if (path === `/sliders/${SLIDER_ID}` && !options?.method) return current;
    if (path.startsWith('/media?')) return MEDIA_LIST;
    throw new Error(`chiamata non prevista: ${path}`);
  });
});

describe('voce di navigazione e registro', () => {
  it('«Caroselli» sta in Corredo dopo «Documenti» e punta a pagine esistenti', () => {
    const corredo = AREA_DEFINITIONS.redazione.groups.find((group) => group.id === 'corredo');
    const ids = corredo?.sections.map((section) => section.id) ?? [];
    expect(ids.indexOf('caroselli')).toBe(ids.indexOf('documenti') + 1);
    expect(corredo?.sections.find((s) => s.id === 'caroselli')).toMatchObject({
      label: 'Caroselli',
      href: '/redazione/caroselli',
    });
    expect(existsSync(paginaDi('/redazione/caroselli'))).toBe(true);
    expect(existsSync(paginaDi('/redazione/caroselli/[id]'))).toBe(true);
  });

  it('ogni voce di Redazione ha la sua pagina (nessun 404, 1G-20)', () => {
    for (const { sections } of AREA_DEFINITIONS.redazione.groups) {
      for (const { href } of sections) expect(existsSync(paginaDi(href)), href).toBe(true);
    }
  });

  it('«slider.update» si legge «Ha modificato il carosello»', () => {
    expect(actionLabel('slider.update')).toBe('Ha modificato il carosello');
    expect(entityTypeLabel('slider')).toBe('Carosello');
  });
});

describe('elenco dei caroselli', () => {
  it('mostra titolo, numero di immagini e di pagine che lo mostrano, con il collegamento alla scheda', async () => {
    render(
      <DensityProvider>
        <SliderList />
      </DensityProvider>,
    );
    const riga = await screen.findByRole('row', { name: /Carosello di prova/ });
    expect(within(riga).getByRole('link', { name: 'Carosello di prova' })).toHaveAttribute(
      'href',
      `/redazione/caroselli/${SLIDER_ID}`,
    );
    expect(within(riga).getByText('3')).toBeInTheDocument();
    expect(within(riga).getByText('2')).toBeInTheDocument();
  });

  it('con l’API in errore mostra il messaggio del servizio', async () => {
    apiMock.mockRejectedValue(new ApiError(500, 'INTERNAL', 'Errore del servizio.'));
    render(
      <DensityProvider>
        <SliderList />
      </DensityProvider>,
    );
    expect(await screen.findByText(/Errore del servizio\./)).toBeInTheDocument();
  });
});

describe('scheda del carosello', () => {
  async function ready(): Promise<ReturnType<typeof userEvent.setup>> {
    const user = userEvent.setup();
    render(
      <DensityProvider>
        <SliderEditor sliderId={SLIDER_ID} />
      </DensityProvider>,
    );
    await screen.findByRole('group', { name: 'Slide 1' });
    return user;
  }

  const group = (n: number): HTMLElement => screen.getByRole('group', { name: `Slide ${n}` });
  const headings = (): string[] =>
    screen.getAllByRole('textbox', { name: 'Titolo' }).map((el) => (el as HTMLInputElement).value);

  it('mostra le slide in ordine con miniatura, «Titolo», «Testo» e il testo d’aiuto', async () => {
    await ready();
    expect(headings()).toEqual(['Titolo 1', 'Titolo 2', 'Titolo 3']);
    expect(within(group(1)).getByRole('img')).toHaveAttribute(
      'src',
      '/media/2025/03/immagine-1.jpg',
    );
    expect(within(group(1)).getByRole('textbox', { name: 'Testo' })).toBeInTheDocument();
    expect(
      within(group(1)).getByText(
        'È anche la descrizione dell’immagine per chi usa un lettore di schermo.',
      ),
    ).toBeInTheDocument();
  });

  it('un titolo importato con HTML si mostra senza tag e, se non toccato, si salva com’era (W8-26)', async () => {
    const imported = '<div align="center">Famiglia<br>in cammino<i class="fa-heart"></i></div>';
    current = sliderWith([slide(1, { heading: imported }), slide(2)]);
    const user = await ready();
    // Revisione T2, I1: il titolo formattato si mostra su più righe, un a capo per riga.
    expect(headings()[0]).toBe('Famiglia\nin cammino');
    expect(headings()[0]).not.toContain('<');
    await user.type(within(group(2)).getByRole('textbox', { name: 'Testo' }), 'Un testo');
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === `/sliders/${SLIDER_ID}/slides` && options?.method === 'PUT') return current;
      throw new Error(`chiamata non prevista: ${path}`);
    });
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    const body = (writes()[0]?.[1] as { body: { slides: { heading: string | null }[] } }).body;
    expect(body.slides[0]?.heading).toBe(imported);
  });

  // Revisione T2, I1 (DR-307): correggere una parola non deve togliere in silenzio a capo e
  // centratura; ciò che la persona scrive esce protetto, e una nota dice come appare sul sito.
  it('un titolo importato modificato conserva a capo e allineamento e protegge il testo (W8-26)', async () => {
    const imported = '<div align="center">Famiglia<br>in cammino<i class="fa-heart"></i></div>';
    current = sliderWith([slide(1, { heading: imported }), slide(2)]);
    const user = await ready();
    expect(
      within(group(1)).getByText(
        'Sul sito il titolo è centrato e va a capo dove va a capo qui. Sul sito il titolo termina con un cuore.',
      ),
    ).toBeInTheDocument();
    expect(within(group(2)).queryByText(/Sul sito il titolo è/)).toBeNull();
    const field = within(group(1)).getByRole('textbox', { name: 'Titolo' });
    await user.clear(field);
    await user.type(field, 'Famiglie{Enter}in viaggio <b>');
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === `/sliders/${SLIDER_ID}/slides` && options?.method === 'PUT') return current;
      throw new Error(`chiamata non prevista: ${path}`);
    });
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    const body = (writes()[0]?.[1] as { body: { slides: { heading: string | null }[] } }).body;
    expect(body.slides[0]?.heading).toBe(
      // T2b (DR-311): il cuore dell'originale torna in coda.
      '<div align="center">Famiglie<br>in viaggio &lt;b&gt; <i class="fa-heart"></i></div>',
    );
    expect(body.slides[1]?.heading).toBe('Titolo 2');
  });

  // T2b (DR-311): il cuore della sorgente si vede sul sito, quindi modificando il titolo resta.
  it('un titolo importato modificato conserva l’icona del cuore', async () => {
    const imported = '<div align="center">Famiglia<br>in cammino <i class="fa-heart"></i></div>';
    current = sliderWith([slide(1, { heading: imported }), slide(2)]);
    const user = await ready();
    const field = within(group(1)).getByRole('textbox', { name: 'Titolo' });
    await user.clear(field);
    await user.type(field, 'Famiglie{Enter}in viaggio');
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === `/sliders/${SLIDER_ID}/slides` && options?.method === 'PUT') return current;
      throw new Error(`chiamata non prevista: ${path}`);
    });
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    const body = (writes()[0]?.[1] as { body: { slides: { heading: string | null }[] } }).body;
    expect(body.slides[0]?.heading).toBe(
      '<div align="center">Famiglie<br>in viaggio <i class="fa-heart"></i></div>',
    );
  });

  // Revisione T2b, M2 (DR-307): il cuore non si vede nel campo, quindi la nota dice che sul
  // sito il titolo termina con un cuore; un titolo formattato senza cuore non lo dice.
  it('la nota di un titolo con il cuore dice che sul sito termina con un cuore', async () => {
    const withHeart = '<div align="center">Famiglia<br>in cammino <i class="fa-heart"></i></div>';
    const withoutHeart = '<div align="center">Famiglia<br>in cammino</div>';
    current = sliderWith([slide(1, { heading: withHeart }), slide(2, { heading: withoutHeart })]);
    await ready();
    expect(
      within(group(1)).getByText(
        'Sul sito il titolo è centrato e va a capo dove va a capo qui. Sul sito il titolo termina con un cuore.',
      ),
    ).toBeInTheDocument();
    expect(
      within(group(2)).getByText('Sul sito il titolo è centrato e va a capo dove va a capo qui.'),
    ).toBeInTheDocument();
    expect(within(group(2)).queryByText(/cuore/)).toBeNull();
  });

  // Ri-revisione T2: un titolo semplice esce protetto come quello formattato, così `<b>`
  // scritto come testo resta visibile sul sito; riaperto, resta un titolo semplice.
  it('un titolo semplice con caratteri speciali si salva protetto e si riapre semplice', async () => {
    current = sliderWith([slide(1), slide(2, { heading: 'Lui &amp; lei &lt;b&gt;' })]);
    const user = await ready();
    expect(headings()[1]).toBe('Lui & lei <b>');
    expect(within(group(2)).queryByText(/Sul sito il titolo/)).toBeNull();
    const field = within(group(1)).getByRole('textbox', { name: 'Titolo' });
    await user.clear(field);
    await user.type(field, 'a <b> & c');
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === `/sliders/${SLIDER_ID}/slides` && options?.method === 'PUT') return current;
      throw new Error(`chiamata non prevista: ${path}`);
    });
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    await waitFor(() => expect(writes()).toHaveLength(1));
    const body = (writes()[0]?.[1] as { body: { slides: { heading: string | null }[] } }).body;
    expect(body.slides[0]?.heading).toBe('a &lt;b&gt; &amp; c');
    // Il titolo semplice non toccato torna identico.
    expect(body.slides[1]?.heading).toBe('Lui &amp; lei &lt;b&gt;');
  });

  // Da T1 (W8-01): le miniature puntano al sito pubblico, come nel resto dell'area.
  it('le miniature delle slide e del selettore usano l’indirizzo del sito', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://sito.example.invalid/');
    try {
      const user = await ready();
      expect(within(group(1)).getByRole('img')).toHaveAttribute(
        'src',
        'https://sito.example.invalid/media/2025/03/immagine-1.jpg',
      );
      await user.click(within(group(2)).getByRole('button', { name: 'Cambia immagine' }));
      const option = await screen.findByRole('option', { name: /Nuova/ });
      // La miniatura del selettore è decorativa (alt vuoto): la si cerca come elemento.
      expect(option.querySelector('img')).toHaveAttribute(
        'src',
        'https://sito.example.invalid/media/nuova.jpg',
      );
      await user.click(option);
      await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
      expect(within(group(2)).getByRole('img')).toHaveAttribute(
        'src',
        'https://sito.example.invalid/media/nuova.jpg',
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('«Sposta giù» e «Sposta su» cambiano l’ordine; i bordi sono spenti', async () => {
    const user = await ready();
    expect(within(group(1)).getByRole('button', { name: 'Sposta su' })).toBeDisabled();
    expect(within(group(3)).getByRole('button', { name: 'Sposta giù' })).toBeDisabled();

    await user.click(within(group(1)).getByRole('button', { name: 'Sposta giù' }));
    expect(headings()).toEqual(['Titolo 2', 'Titolo 1', 'Titolo 3']);

    await user.click(within(group(3)).getByRole('button', { name: 'Sposta su' }));
    expect(headings()).toEqual(['Titolo 2', 'Titolo 3', 'Titolo 1']);
  });

  it('«Togli» toglie la slide dall’elenco', async () => {
    const user = await ready();
    await user.click(within(group(2)).getByRole('button', { name: 'Togli' }));
    expect(headings()).toEqual(['Titolo 1', 'Titolo 3']);
  });

  it('l’ultima slide non si toglie e il motivo è scritto', async () => {
    current = sliderWith([slide(1)]);
    await ready();
    expect(within(group(1)).getByRole('button', { name: 'Togli' })).toBeDisabled();
    expect(screen.getByText('Un carosello ha almeno un’immagine.')).toBeInTheDocument();
  });

  it('«Aggiungi un’immagine» aggiunge una slide in coda con l’immagine scelta, e offre solo immagini pubbliche', async () => {
    const user = await ready();
    await user.click(screen.getByRole('button', { name: 'Aggiungi un’immagine' }));
    expect(await screen.findByRole('option', { name: /Nuova/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Riservata/ })).toBeNull();
    const query = String(
      apiMock.mock.calls.map((call) => call[0] as string).find((p) => p.startsWith('/media?')),
    );
    expect(query).toContain('mimePrefix=image%2F');

    await user.click(screen.getByRole('option', { name: /Nuova/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));

    expect(headings()).toEqual(['Titolo 1', 'Titolo 2', 'Titolo 3', '']);
    expect(within(group(4)).getByRole('img')).toHaveAttribute('src', '/media/nuova.jpg');
  });

  it('«Cambia immagine» sostituisce l’immagine della sola slide scelta', async () => {
    const user = await ready();
    await user.click(within(group(2)).getByRole('button', { name: 'Cambia immagine' }));
    await user.click(await screen.findByRole('option', { name: /Nuova/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));
    expect(within(group(2)).getByRole('img')).toHaveAttribute('src', '/media/nuova.jpg');
    expect(within(group(1)).getByRole('img')).toHaveAttribute(
      'src',
      '/media/2025/03/immagine-1.jpg',
    );
    expect(headings()).toEqual(['Titolo 1', 'Titolo 2', 'Titolo 3']);
  });

  it('«Salva» invia l’elenco intero nell’ordine mostrato, con gli id solo delle slide esistenti', async () => {
    const user = await ready();
    await user.click(within(group(1)).getByRole('button', { name: 'Sposta giù' }));
    // Dopo lo spostamento la slide 1 è quella che prima era la seconda: il testo va alla seconda.
    await user.type(within(group(2)).getByRole('textbox', { name: 'Testo' }), 'Un testo');
    await user.click(within(group(3)).getByRole('button', { name: 'Togli' }));
    await user.click(screen.getByRole('button', { name: 'Aggiungi un’immagine' }));
    await user.click(await screen.findByRole('option', { name: /Nuova/ }));
    await user.click(screen.getByRole('button', { name: 'Usa questo media' }));

    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (path === `/sliders/${SLIDER_ID}/slides` && options?.method === 'PUT') return current;
      throw new Error(`chiamata non prevista: ${path}`);
    });
    await user.click(screen.getByRole('button', { name: 'Salva' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toEqual([
      `/sliders/${SLIDER_ID}/slides`,
      {
        method: 'PUT',
        body: {
          slides: [
            { id: uuid(2), mediaId: media(2), heading: 'Titolo 2', body: null },
            { id: uuid(1), mediaId: media(1), heading: 'Titolo 1', body: 'Un testo' },
            { mediaId: media(90), heading: null, body: null },
          ],
        },
      },
    ]);
    expect(await screen.findByText('Modifiche salvate.')).toBeInTheDocument();
  });

  it('un rifiuto dell’API si legge in italiano e l’elenco mostrato resta com’era', async () => {
    const user = await ready();
    await user.click(within(group(1)).getByRole('button', { name: 'Sposta giù' }));
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'PUT') {
        throw new ApiError(400, 'SLIDER_MEDIA_INVALID', 'Un’immagine non è utilizzabile.');
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByText(/Un’immagine non è utilizzabile\./)).toBeInTheDocument();
    expect(headings()).toEqual(['Titolo 2', 'Titolo 1', 'Titolo 3']);
  });

  it('un errore di validazione per campo compare sul campo', async () => {
    const user = await ready();
    await user.type(within(group(1)).getByRole('textbox', { name: 'Testo' }), 'x');
    apiMock.mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'PUT') {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Richiesta non valida.', [
          { path: '/slides/0/heading', message: 'Il titolo può avere al massimo 300 caratteri.' },
        ]);
      }
      throw new Error(`chiamata non prevista: ${path}`);
    });
    await user.click(screen.getByRole('button', { name: 'Salva' }));
    expect(
      await within(group(1)).findByText('Il titolo può avere al massimo 300 caratteri.'),
    ).toBeInTheDocument();
  });

  it('una slide senza immagine mostra «Immagine mancante» e non si salva finché non si risolve', async () => {
    current = sliderWith([slide(1), slide(2, { mediaId: null, image: null })]);
    const user = await ready();
    expect(within(group(2)).getByText('Immagine mancante')).toBeInTheDocument();
    await user.type(within(group(1)).getByRole('textbox', { name: 'Testo' }), 'x');
    expect(screen.getByRole('button', { name: 'Salva' })).toBeDisabled();

    await user.click(within(group(2)).getByRole('button', { name: 'Togli' }));
    expect(screen.getByRole('button', { name: 'Salva' })).toBeEnabled();
  });

  it('«Pagine che lo mostrano» elenca i contenuti con il collegamento all’editor', async () => {
    current = sliderWith(
      [slide(1)],
      [
        { id: 'p1', title: 'Pagina di prova', type: 'page' },
        { id: 'n1', title: 'Notizia di prova', type: 'post' },
      ],
    );
    await ready();
    expect(screen.getByRole('link', { name: 'Pagina di prova' })).toHaveAttribute(
      'href',
      '/redazione/pagine/p1',
    );
    expect(screen.getByRole('link', { name: 'Notizia di prova' })).toHaveAttribute(
      'href',
      '/redazione/notizie/n1',
    );
  });

  it('W9-N3: un contenuto senza titolo in «Dove compare» si chiama «Senza titolo»', async () => {
    current = sliderWith([slide(1)], [{ id: 'p1', title: '', type: 'page' }]);
    await ready();
    expect(screen.getByRole('link', { name: 'Senza titolo' })).toHaveAttribute(
      'href',
      '/redazione/pagine/p1',
    );
  });

  it('se nessuna pagina lo mostra lo dice e spiega come farlo vedere', async () => {
    await ready();
    expect(screen.getByText(/Nessuna pagina lo mostra\./)).toHaveTextContent(
      'Nessuna pagina lo mostra. Per farlo vedere sul sito, inserisci il blocco «Presentazione a scorrimento» in una pagina.',
    );
  });

  describe('focus della tastiera e annunci (A2)', () => {
    const button = (n: number, name: string): HTMLElement =>
      within(group(n)).getByRole('button', { name });

    /** Il testo sta in una regione `aria-live="polite"`, che il lettore di schermo legge da sé. */
    function expectAnnounced(text: string): void {
      expect(screen.getByText(text).closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
    }

    it('dopo «Sposta giù» il focus resta su «Sposta giù» della slide spostata', async () => {
      const user = await ready();
      await user.click(button(1, 'Sposta giù'));
      expect(headings()).toEqual(['Titolo 2', 'Titolo 1', 'Titolo 3']);
      expect(document.activeElement).toBe(button(2, 'Sposta giù'));
      expectAnnounced('Slide spostata in posizione 2 di 3.');
    });

    it('dopo «Sposta su» il focus resta su «Sposta su» della slide spostata', async () => {
      const user = await ready();
      await user.click(button(3, 'Sposta su'));
      expect(headings()).toEqual(['Titolo 1', 'Titolo 3', 'Titolo 2']);
      expect(document.activeElement).toBe(button(2, 'Sposta su'));
      expectAnnounced('Slide spostata in posizione 2 di 3.');
    });

    it('al bordo il comando si spegne e il focus va al comando opposto della stessa slide', async () => {
      const user = await ready();
      await user.click(button(2, 'Sposta giù'));
      expect(headings()).toEqual(['Titolo 1', 'Titolo 3', 'Titolo 2']);
      expect(button(3, 'Sposta giù')).toBeDisabled();
      expect(document.activeElement).toBe(button(3, 'Sposta su'));
      expectAnnounced('Slide spostata in posizione 3 di 3.');

      await user.click(button(2, 'Sposta su'));
      expect(headings()).toEqual(['Titolo 3', 'Titolo 1', 'Titolo 2']);
      expect(button(1, 'Sposta su')).toBeDisabled();
      expect(document.activeElement).toBe(button(1, 'Sposta giù'));
      expectAnnounced('Slide spostata in posizione 1 di 3.');
    });

    it('dopo «Togli» il focus va al primo comando attivo della slide che ne prende il posto', async () => {
      const user = await ready();
      await user.click(button(2, 'Togli'));
      expect(headings()).toEqual(['Titolo 1', 'Titolo 3']);
      expect(document.activeElement).toBe(button(2, 'Sposta su'));
      expectAnnounced('Slide tolta.');

      // Rimasta una sola slide, spostamenti e «Togli» sono spenti: il primo comando attivo è «Cambia immagine».
      await user.click(button(1, 'Togli'));
      expect(headings()).toEqual(['Titolo 3']);
      expect(document.activeElement).toBe(button(1, 'Cambia immagine'));
      expectAnnounced('Slide tolta.');
    });

    it('togliendo l’ultima slide il focus va al primo comando della precedente', async () => {
      const user = await ready();
      await user.click(button(3, 'Togli'));
      expect(headings()).toEqual(['Titolo 1', 'Titolo 2']);
      expect(document.activeElement).toBe(button(2, 'Sposta su'));
      expectAnnounced('Slide tolta.');
    });
  });

  it('senza il permesso di scrittura non si modifica nulla', async () => {
    permissions = ['content.read'];
    await ready();
    expect(screen.queryByRole('button', { name: 'Salva' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Aggiungi un’immagine' })).toBeNull();
    expect(screen.getAllByRole('textbox', { name: 'Titolo' })[0]).toBeDisabled();
  });
});
