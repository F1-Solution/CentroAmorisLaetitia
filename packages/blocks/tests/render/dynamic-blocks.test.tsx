import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Slider } from '../../src/render/Slider.js';
import { Video } from '../../src/render/Video.js';
import { Map } from '../../src/render/Map.js';
import { PostList } from '../../src/render/PostList.js';
import { Form } from '../../src/render/Form.js';
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
});

describe('PostList — elenco reale con gli articoli risolti dal servizio', () => {
  const posts: readonly PostListItem[] = [
    {
      id: 'a',
      path: '/articolo-1/',
      title: 'Articolo uno',
      excerpt: 'Un estratto.',
      featuredMediaId: null,
      publishedAt: '2026-01-02T00:00:00.000Z',
    },
  ];

  it('rende titolo, data ed estratto di ogni articolo', () => {
    const { getByText } = render(
      <PostList
        block={{
          type: 'post_list',
          id: testBlockId(),
          props: {
            termIds: [],
            limit: null,
            offset: 1,
            showThumbnail: true,
            showDate: true,
            showExcerpt: true,
            order: 'date_desc',
            classes: [],
          },
          children: [],
        }}
        posts={posts}
      />,
    );
    expect(getByText('Articolo uno').getAttribute('href')).toBe('/articolo-1/');
    expect(getByText('Un estratto.')).not.toBeNull();
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
