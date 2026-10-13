import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Slider } from '../../src/render/Slider.js';
import { Video } from '../../src/render/Video.js';
import { Map } from '../../src/render/Map.js';
import { PostList } from '../../src/render/PostList.js';
import { Form } from '../../src/render/Form.js';
import { phoneWithDialCode } from '../../src/render/FormField.js';
import { testBlockId } from '../helpers.js';
import type { SliderData, FormData, PostListItem } from '../../src/render/data-maps.js';

/**
 * Resa vera dei cinque blocchi oggi segnaposto (`1E-W5`): un test per blocco
 * con dati, più le prove di sicurezza chieste in revisione (link con schema
 * non ammesso, es. `javascript:`, mai resi come `href`).
 */

const uuid = '11111111-1111-4111-8111-111111111111';

describe('Slider — carosello scritto nel progetto', () => {
  const slider: SliderData = {
    id: uuid,
    key: 'home',
    settings: {},
    slides: [
      {
        position: 0,
        mediaId: null,
        heading: 'Prima slide',
        body: null,
        linkUrl: '/pagina-sintetica/',
        linkLabel: 'Scopri',
        settings: {},
      },
      {
        position: 1,
        mediaId: null,
        heading: 'Seconda slide',
        body: null,
        linkUrl: null,
        linkLabel: null,
        settings: {},
      },
    ],
  };

  it('mostra la prima slide e passa alla successiva al clic', () => {
    const { container, getByText, getByLabelText } = render(
      <Slider
        block={{
          type: 'slider',
          id: testBlockId(),
          props: { sliderId: uuid, classes: [] },
          children: [],
        }}
        slider={slider}
      />,
    );
    expect(getByText('Prima slide')).not.toBeNull();
    expect(getByText('Scopri').getAttribute('href')).toBe('/pagina-sintetica/');
    fireEvent.click(getByLabelText('Slide successiva'));
    const slides = container.querySelectorAll('.blk-slider-slide');
    expect(slides[1]?.getAttribute('data-active')).toBe('true');
  });

  it('non rende un collegamento con schema non ammesso (javascript:)', () => {
    const dangerous: SliderData = {
      ...slider,
      slides: [
        {
          position: 0,
          mediaId: null,
          heading: 'Slide pericolosa',
          body: null,
          linkUrl: 'javascript:alert(1)',
          linkLabel: 'Clic',
          settings: {},
        },
      ],
    };
    const { queryByText } = render(
      <Slider
        block={{
          type: 'slider',
          id: testBlockId(),
          props: { sliderId: uuid, classes: [] },
          children: [],
        }}
        slider={dangerous}
      />,
    );
    expect(queryByText('Clic')).toBeNull();
  });
});

describe('Video — copertina al caricamento, player solo al clic (DR-107)', () => {
  it('mostra la copertina e carica l’incorporazione solo al clic', () => {
    const { container, getByLabelText } = render(
      <Video
        block={{
          type: 'video',
          id: testBlockId(),
          props: {
            src: 'https://youtu.be/abc123',
            provider: 'youtube',
            posterMediaId: null,
            posterSrc: null,
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(getByLabelText('Riproduci video'));
    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('src')).toContain('youtube-nocookie.com');
  });

  it('una copertina con schema non ammesso non si rende', () => {
    const { container } = render(
      <Video
        block={{
          type: 'video',
          id: testBlockId(),
          props: {
            src: 'https://youtu.be/abc123',
            provider: 'youtube',
            posterMediaId: null,
            posterSrc: 'javascript:alert(1)',
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
  });

  it('un indirizzo con schema non ammesso non diventa mai un collegamento', () => {
    const { container, getByLabelText } = render(
      <Video
        block={{
          type: 'video',
          id: testBlockId(),
          props: {
            src: 'javascript:alert(1)',
            provider: 'other',
            posterMediaId: null,
            posterSrc: null,
            classes: [],
          },
          children: [],
        }}
      />,
    );
    fireEvent.click(getByLabelText('Riproduci video'));
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('Map — copertina testuale, incorporazione solo al clic (DR-107)', () => {
  it('carica Google Maps solo dopo il clic (DR-121)', () => {
    const { container, getByText } = render(
      <Map
        block={{
          type: 'map',
          id: testBlockId(),
          props: {
            address: 'Via Roma 1',
            lat: '45.0',
            lng: '9.0',
            zoom: null,
            mouseWheel: false,
            mobileDragging: false,
            grayscale: false,
            grayscaleAmount: null,
            pins: [],
            classes: [],
          },
          children: [],
        }}
      />,
    );
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(getByText('Mostra la mappa'));
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe(
      'https://maps.google.com/maps?q=45%2C9&z=18&output=embed',
    );
  });

  it('D61: indirizzo e segnaposti restano nel markup ma non si vedono, come la sorgente', () => {
    const { container } = render(
      <Map
        block={{
          type: 'map',
          id: testBlockId(),
          props: {
            address: 'Via Roma 1',
            lat: '45.0',
            lng: '9.0',
            zoom: null,
            mouseWheel: false,
            mobileDragging: false,
            grayscale: false,
            grayscaleAmount: null,
            pins: [{ title: 'Sede sintetica', lat: '45.0', lng: '9.0', content: null }],
            classes: [],
          },
          children: [],
        }}
      />,
    );
    const details = container.querySelector('.blk-map-details');
    expect(details?.hasAttribute('hidden')).toBe(true);
    expect(details?.textContent).toContain('Via Roma 1');
    expect(details?.textContent).toContain('Sede sintetica');
    // L'indirizzo resta raggiungibile dagli ausili, nell'etichetta del pulsante.
    expect(container.querySelector('.blk-map-cover')?.getAttribute('aria-label')).toBe(
      'Mostra la mappa: Via Roma 1',
    );
  });
});

describe('PostList — elenco come il plugin Category Posts della sorgente (DR-116, 1E-W6)', () => {
  const thumb = {
    publicPath: '/media/sintetica.jpg',
    width: 1200,
    height: 800,
    altText: null,
    variants: [
      { publicPath: '/media/sintetica-150x150.jpg', width: 150, height: 150 },
      { publicPath: '/media/sintetica-300x200.jpg', width: 300, height: 200 },
    ],
  };
  const posts: readonly PostListItem[] = [
    {
      id: 'a',
      path: '/articolo-1/',
      title: 'Articolo uno',
      excerpt: null,
      summary: 'Le prime parole del testo',
      summaryTruncated: true,
      featuredMediaId: 'm1',
      publishedAt: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'b',
      path: '/articolo-2/',
      title: 'Articolo due',
      excerpt: 'Riassunto scritto a mano.',
      summary: 'Riassunto scritto a mano.',
      summaryTruncated: false,
      featuredMediaId: null,
      publishedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const block = {
    type: 'post_list' as const,
    id: testBlockId(),
    props: {
      termIds: [],
      limit: null,
      offset: 0,
      showThumbnail: true,
      showDate: false,
      showExcerpt: true,
      order: 'date_desc' as const,
      thumbnailWidth: 100,
      thumbnailHeight: 100,
      excerptMoreText: 'leggi tutto',
      defaultThumbnailMediaId: 'm0',
      classes: [],
    },
    children: [],
  };

  it('miniatura quadrata alla misura dichiarata, titolo come link, estratto con «leggi tutto» se tagliato', () => {
    const { container, getByText } = render(
      <PostList block={block} posts={posts} media={{ m1: thumb, m0: thumb }} />,
    );
    const img = container.querySelector('.cat-post-thumbnail img');
    expect(img?.getAttribute('src')).toBe('/media/sintetica-150x150.jpg');
    expect(img?.getAttribute('width')).toBe('100');
    expect(img?.getAttribute('height')).toBe('100');
    expect(img?.getAttribute('srcset')).toBeNull();
    expect(getByText('Articolo uno').getAttribute('href')).toBe('/articolo-1/');
    expect(getByText('Articolo uno').className).toBe('cat-post-title');
    expect(getByText('leggi tutto').getAttribute('href')).toBe('/articolo-1/');
    expect(container.querySelectorAll('.cat-post-excerpt-more')).toHaveLength(1);
  });

  it('senza immagine in evidenza usa la miniatura di riserva; senza showDate nessuna data', () => {
    const { container } = render(
      <PostList block={block} posts={posts} media={{ m1: thumb, m0: thumb }} />,
    );
    expect(container.querySelectorAll('.cat-post-thumbnail img')).toHaveLength(2);
    expect(container.textContent).not.toContain('2026');
  });
});

describe('Form — invio con esito letto dal servizio (DR-108)', () => {
  const form: FormData = {
    id: uuid,
    slug: 'contatti-sintetico',
    title: 'Contatti',
    confirmationMessage: 'Grazie, ti risponderemo presto.',
    requiresPayment: false,
    fields: [
      {
        id: 'f1',
        type: 'text',
        label: 'Nome',
        required: true,
        order: 0,
        description: null,
        options: {},
      },
      {
        id: 'f2',
        type: 'email',
        label: 'Email',
        required: true,
        order: 1,
        description: null,
        options: {},
      },
    ],
    payment: null,
  };

  it('il modulo di contatto di Divi rende il titolo come h1, gli altri no', () => {
    const props = (origin: 'divi' | 'wpforms') => ({
      formId: uuid,
      origin,
      showTitle: true,
      showDescription: false,
      classes: [],
    });
    const divi = render(
      <Form
        block={{ type: 'form', id: testBlockId(), props: props('divi'), children: [] }}
        form={form}
      />,
    );
    expect(divi.container.querySelector('h1')?.textContent).toBe('Contatti');
    divi.unmount();
    const wp = render(
      <Form
        block={{ type: 'form', id: testBlockId(), props: props('wpforms'), children: [] }}
        form={form}
      />,
    );
    expect(wp.container.querySelector('h1')).toBeNull();
  });

  it('rende un campo per ogni tipo noto e un campo esca nascosto', () => {
    const { container, getByLabelText } = render(
      <Form
        block={{
          type: 'form',
          id: testBlockId(),
          props: {
            formId: uuid,
            origin: 'wpforms',
            showTitle: false,
            showDescription: false,
            classes: [],
          },
          children: [],
        }}
        form={form}
      />,
    );
    expect(getByLabelText(/^Nome/)).not.toBeNull();
    expect(container.querySelector('input[name="sito_web"]')).not.toBeNull();
    expect(container.querySelector('.blk-form-trap')).not.toBeNull();
  });

  it('rende le opzioni di un «radio», con le scelte come oggetto a chiavi numeriche (dato reale)', () => {
    const formConScelte: FormData = {
      ...form,
      fields: [
        {
          id: '9',
          type: 'radio',
          label: 'Tipo di pagamento',
          required: true,
          order: 0,
          description: null,
          options: {
            choices: {
              '1': { image: '', label: 'Paypal', value: '' },
              '2': { image: '', label: 'Bonifico', value: '' },
            },
          },
        },
      ],
    };
    const { getByText } = render(
      <Form
        block={{
          type: 'form',
          id: testBlockId(),
          props: {
            formId: uuid,
            origin: 'wpforms',
            showTitle: false,
            showDescription: false,
            classes: [],
          },
          children: [],
        }}
        form={formConScelte}
      />,
    );
    expect(getByText('Paypal')).not.toBeNull();
    expect(getByText('Bonifico')).not.toBeNull();
  });

  it('mostra la conferma del servizio dopo un invio riuscito', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () =>
      new Response(
        JSON.stringify({
          ok: true,
          confirmationMessage: 'Ricevuto!',
          payment: { required: false, amount: null, url: null },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )) as typeof fetch;
    try {
      const { getByLabelText, getByText, findByText } = render(
        <Form
          block={{
            type: 'form',
            id: testBlockId(),
            props: {
              formId: uuid,
              origin: 'wpforms',
              showTitle: false,
              showDescription: false,
              classes: [],
            },
            children: [],
          }}
          form={form}
        />,
      );
      fireEvent.change(getByLabelText(/^Nome/), { target: { value: 'Mario' } });
      fireEvent.click(getByText('Invia'));
      expect(await findByText('Ricevuto!')).not.toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Form — resa come WPForms della sorgente (1E-W6, DR-133)', () => {
  const block = {
    type: 'form' as const,
    id: testBlockId(),
    props: {
      formId: uuid,
      origin: 'wpforms' as const,
      showTitle: false,
      showDescription: false,
      classes: [],
    },
    children: [],
  };
  const form: FormData = {
    id: uuid,
    slug: 'iscrizione-sintetica',
    title: 'Iscrizione',
    confirmationMessage: null,
    requiresPayment: false,
    submitText: 'Invia',
    fields: [
      {
        id: '13',
        type: 'html',
        label: '',
        required: false,
        order: 0,
        description: null,
        options: { code: '<b>Dati</b><script>alert(1)</script>' },
      },
      {
        id: '1',
        type: 'name',
        label: 'Nome',
        required: true,
        order: 1,
        description: null,
        options: {
          format: 'first-last',
          label_hide: '1',
          sublabel_hide: '1',
          first_placeholder: 'Nome',
          last_placeholder: 'Cognome',
          size: 'medium',
        },
      },
      {
        id: '9',
        type: 'radio',
        label: 'Pagamento',
        required: true,
        order: 2,
        description: null,
        options: { choices: { '1': { label: 'Online' }, '2': { label: 'Bonifico' } } },
      },
      {
        id: '10',
        type: 'html',
        label: '',
        required: false,
        order: 3,
        description: null,
        options: {
          code: '<p>Istruzioni del bonifico</p>',
          conditional_logic: '1',
          conditional_type: 'show',
          conditionals: [[{ field: '9', operator: '==', value: '2' }]],
        },
      },
    ],
    payment: null,
  };

  it('nell’ordine della definizione; HTML sanificato e reso come markup', () => {
    const { container } = render(<Form block={block} form={form} />);
    const types = [...container.querySelectorAll('.wpforms-field')].map((el) =>
      el.getAttribute('data-field-type'),
    );
    expect(types).toEqual(['html', 'name', 'radio']);
    expect(container.querySelector('.wpforms-field-html b')?.textContent).toBe('Dati');
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).not.toContain('<b>');
  });

  it('nome e cognome affiancati con il segnaposto; l’etichetta resta per gli ausili', () => {
    const { container } = render(<Form block={block} form={form} />);
    const inputs = container.querySelectorAll('.wpforms-field-name input');
    expect([...inputs].map((i) => i.getAttribute('placeholder'))).toEqual(['Nome', 'Cognome']);
    expect(container.querySelectorAll('.wpforms-field-name .wpforms-one-half')).toHaveLength(2);
    expect(
      container.querySelector('.wpforms-field-name .wpforms-label-hide')?.textContent,
    ).toContain('Nome');
  });

  it('il campo condizionato compare solo con la scelta giusta', () => {
    const { container, getByLabelText } = render(<Form block={block} form={form} />);
    expect(container.textContent).not.toContain('Istruzioni del bonifico');
    fireEvent.click(getByLabelText('Bonifico'));
    expect(container.textContent).toContain('Istruzioni del bonifico');
  });
});

describe('Form — indirizzo su più righe come WPForms (famiglia C+)', () => {
  const block = {
    type: 'form' as const,
    id: testBlockId(),
    props: {
      formId: uuid,
      origin: 'wpforms' as const,
      showTitle: false,
      showDescription: false,
      classes: [],
    },
    children: [],
  };
  const form: FormData = {
    id: uuid,
    slug: 'indirizzo-sintetico',
    title: 'Indirizzo',
    confirmationMessage: null,
    requiresPayment: false,
    submitText: 'Invia',
    fields: [
      {
        id: '4',
        type: 'address',
        label: 'Indirizzo',
        required: true,
        order: 0,
        description: null,
        options: { address2_hide: '1', country_hide: '1', size: 'medium' },
      },
    ],
    payment: null,
  };

  it('una riga per l’indirizzo, una per città e provincia, una per il CAP', () => {
    const { container } = render(<Form block={block} form={form} />);
    const rows = [...container.querySelectorAll('.wpforms-field-address .wpforms-field-row')];
    expect(rows.map((row) => row.querySelectorAll('input').length)).toEqual([1, 2, 1]);
    expect(rows.every((row) => row.classList.contains('wpforms-field-medium'))).toBe(true);
    expect(rows[1]?.querySelector('.wpforms-one-half.wpforms-first input')?.id).toContain('city');
    expect(rows[2]?.querySelector('.wpforms-one-half.wpforms-first input')?.id).toContain('postal');
  });
});

describe('telefono — prefisso del paese scelto con la bandiera (ADR-011)', () => {
  it('aggiunge il prefisso fuori dall’Italia, non se il numero ha già il «+»', () => {
    expect(phoneWithDialCode('333 1234567', { iso2: 'it', dialCode: '39' })).toBe('333 1234567');
    expect(phoneWithDialCode('79 123 45 67', { iso2: 'ch', dialCode: '41' })).toBe(
      '+41 79 123 45 67',
    );
    expect(phoneWithDialCode('+33 6 12', { iso2: 'ch', dialCode: '41' })).toBe('+33 6 12');
    expect(phoneWithDialCode('', { iso2: 'ch', dialCode: '41' })).toBe('');
    expect(phoneWithDialCode('333', null)).toBe('333');
  });
});
