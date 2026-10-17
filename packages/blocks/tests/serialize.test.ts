import { describe, expect, it } from 'vitest';
import { serializeBlock, serializeBlockDocument } from '../src/serialize/serialize.js';
import { extractContentText } from '../src/serialize/text-extract.js';
import type { BlockDocument } from '../src/schema/document.js';
import { testBlockId, makeRichText } from './helpers.js';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('serializeBlock — involucro per tipo (§6.2)', () => {
  it('section: <section class="blk blk-section" id="...">', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'section',
      id,
      props: {
        fullWidth: false,
        transparentBackground: false,
        backgroundColor: null,
        backgroundMediaId: null,
        parallax: false,
        innerShadow: false,
        customWidth: { mode: 'default', value: null },
        padding: { base: null, tablet: null, phone: null },
        classes: [],
      },
      children: [],
    });
    expect(out).toBe(`<section class="blk blk-section" id="${id}"></section>`);
  });

  it('row: <div class="blk blk-row" id="...">, con le classi dichiarate in coda', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'row',
      id,
      props: {
        columnStructure: '1_2,1_2',
        fullWidth: true,
        customWidth: { mode: 'default', value: null },
        gutter: { custom: false, width: null },
        backgroundColor: null,
        backgroundMediaId: null,
        padding: { base: null, tablet: null, phone: null },
        classes: ['is-fullwidth'],
      },
      children: [],
    });
    expect(out).toBe(`<div class="blk blk-row is-fullwidth" id="${id}"></div>`);
  });

  it("rich_text: props.html copiato così com'è, nessuna doppia sanificazione (regola 11)", () => {
    const html = '<p>Ciao &amp; benvenuto</p>';
    const node = makeRichText(html);
    expect(serializeBlock(node)).toBe(`<div class="blk blk-text" id="${node.id}">${html}</div>`);
  });

  it('image: <img alt="..."> e figcaption solo se c\'è didascalia', () => {
    const id = testBlockId();
    const withoutCaption = serializeBlock({
      type: 'image',
      id,
      props: {
        mediaId: uuid,
        src: null,
        variant: null,
        alt: 'una foto',
        title: null,
        caption: null,
        linkUrl: null,
        linkNewWindow: false,
        align: null,
        alignTablet: null,
        forceFullWidth: false,
        lightbox: false,
        centerOnMobile: false,
        animation: null,
        classes: [],
      },
      children: [],
    });
    expect(withoutCaption).toBe(
      `<figure class="blk blk-image" id="${id}"><img alt="una foto"></figure>`,
    );
  });

  it('image: con didascalia', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'image',
      id,
      props: {
        mediaId: uuid,
        src: null,
        variant: null,
        alt: '',
        title: null,
        caption: 'una didascalia',
        linkUrl: null,
        linkNewWindow: false,
        align: null,
        alignTablet: null,
        forceFullWidth: false,
        lightbox: false,
        centerOnMobile: false,
        animation: null,
        classes: [],
      },
      children: [],
    });
    expect(out).toBe(
      `<figure class="blk blk-image" id="${id}"><img alt=""><figcaption>una didascalia</figcaption></figure>`,
    );
  });

  it('separator: elemento vuoto, senza barra finale né chiusura (regola 8)', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'separator',
      id,
      props: { style: 'default', classes: [] },
      children: [],
    });
    expect(out).toBe(`<hr class="blk blk-separator" id="${id}">`);
  });

  it('form, post_list, video, slider: sempre il tag di chiusura, anche vuoti (regola 9)', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'form',
      id,
      props: {
        formId: uuid,
        origin: 'wpforms',
        showTitle: false,
        showDescription: false,
        classes: [],
      },
      children: [],
    });
    expect(out).toBe(`<div class="blk blk-form" id="${id}"></div>`);
  });

  it('map: indirizzo e titoli dei segnaposto come testo', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'map',
      id,
      props: {
        address: 'Via Roma 1',
        lat: '45.0',
        lng: '9.0',
        zoom: null,
        mouseWheel: false,
        mobileDragging: false,
        grayscale: false,
        grayscaleAmount: null,
        pins: [
          { title: 'Ingresso', lat: '45.0', lng: '9.0', html: null },
          { title: null, lat: '45.1', lng: '9.1', html: null },
        ],
        classes: [],
      },
      children: [],
    });
    expect(out).toBe(`<div class="blk blk-map" id="${id}">Via Roma 1 Ingresso</div>`);
  });

  it('document: label se presente', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'document',
      id,
      props: { documentId: uuid, label: 'Scarica il modulo', display: 'link', classes: [] },
      children: [],
    });
    expect(out).toBe(`<div class="blk blk-document" id="${id}">Scarica il modulo</div>`);
  });

  it("html: props.html copiato così com'è, come rich_text", () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'html',
      id,
      props: {
        html: '<center>vecchio</center>',
        reason: 'divi_unmapped_markup',
        detail: null,
        classes: [],
      },
      children: [],
    });
    expect(out).toBe(`<div class="blk blk-raw" id="${id}"><center>vecchio</center></div>`);
  });
});

describe('serializeBlock — escaping (§6.3, regole 5, 6, 7)', () => {
  it('nel testo si sostituiscono &, <, >', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'document',
      id,
      props: {
        documentId: uuid,
        label: 'Tom & Jerry <ok> "virgolette"',
        display: 'link',
        classes: [],
      },
      children: [],
    });
    expect(out).toContain('Tom &amp; Jerry &lt;ok&gt; "virgolette"');
  });

  it('nei valori di attributo si sostituiscono &, <, " ma non >', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'image',
      id,
      props: {
        mediaId: uuid,
        src: null,
        variant: null,
        alt: 'A & B < "C" > D',
        title: null,
        caption: null,
        linkUrl: null,
        linkNewWindow: false,
        align: null,
        alignTablet: null,
        forceFullWidth: false,
        lightbox: false,
        centerOnMobile: false,
        animation: null,
        classes: [],
      },
      children: [],
    });
    expect(out).toContain('alt="A &amp; B &lt; &quot;C&quot; > D"');
  });

  it('i caratteri non ASCII si scrivono direttamente (regola 7)', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'document',
      id,
      props: { documentId: uuid, label: 'società perché già così', display: 'link', classes: [] },
      children: [],
    });
    expect(out).toContain('società perché già così');
  });
});

describe('serializeBlock — ordine degli attributi (§6.3, regola 3)', () => {
  it('class sempre prima, poi id: nessun altro attributo introdotto sui contenitori', () => {
    const id = testBlockId();
    const out = serializeBlock({
      type: 'column',
      id,
      props: {
        width: '1_2',
        padding: { base: null, tablet: null, phone: null },
        classes: ['align-center'],
      },
      children: [],
    });
    const classIndex = out.indexOf('class=');
    const idIndex = out.indexOf('id=');
    expect(classIndex).toBeGreaterThanOrEqual(0);
    expect(idIndex).toBeGreaterThan(classIndex);
  });
});

describe('determinismo (§6.4)', () => {
  function sampleDocument(): BlockDocument {
    return {
      schema: 1,
      blocks: [
        {
          type: 'section',
          id: testBlockId(),
          props: {
            fullWidth: false,
            transparentBackground: false,
            backgroundColor: '#fff',
            backgroundMediaId: null,
            parallax: false,
            innerShadow: false,
            customWidth: { mode: 'default', value: null },
            padding: { base: null, tablet: null, phone: null },
            classes: [],
          },
          children: [
            {
              type: 'row',
              id: testBlockId(),
              props: {
                columnStructure: '1_1',
                fullWidth: false,
                customWidth: { mode: 'default', value: null },
                gutter: { custom: false, width: null },
                backgroundColor: null,
                backgroundMediaId: null,
                padding: { base: null, tablet: null, phone: null },
                classes: [],
              },
              children: [
                {
                  type: 'column',
                  id: testBlockId(),
                  props: {
                    width: '1_1',
                    padding: { base: null, tablet: null, phone: null },
                    classes: [],
                  },
                  children: [makeRichText('<p>Contenuto <strong>di prova</strong></p>')],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  it('serializza(d) === serializza(d): stessa stringa ogni volta', () => {
    const doc = sampleDocument();
    expect(serializeBlockDocument(doc)).toBe(serializeBlockDocument(doc));
    expect(serializeBlockDocument(doc)).toBe(serializeBlockDocument(doc));
  });

  it("l'ordine delle chiavi nell'oggetto JavaScript non influisce sull'output", () => {
    const doc = sampleDocument();
    const reordered: BlockDocument = { blocks: doc.blocks, schema: 1 };
    expect(serializeBlockDocument(doc)).toBe(serializeBlockDocument(reordered));
  });

  it('nessuno spazio bianco introdotto dal serializzatore (regola 2)', () => {
    const doc = sampleDocument();
    const html = serializeBlockDocument(doc);
    expect(html).not.toMatch(/>\s+</);
  });
});

describe('extractContentText (§6.1)', () => {
  it('toglie i tag e riduce gli spazi; i blocchi vanno a capo (DR-146)', () => {
    const html = '<div class="blk blk-section" id="b_1"><p>Ciao   mondo</p>\n<p>Altro</p></div>';
    expect(extractContentText(html)).toBe('Ciao mondo\nAltro');
  });

  it('una frase non attraversa due paragrafi, una parola in grassetto sì (DR-146)', () => {
    const text = extractContentText(
      '<p>Iscrizioni al corso</p><p>Per informazioni <strong>scrivere</strong></p>',
    );
    expect(text).toBe('Iscrizioni al corso\nPer informazioni scrivere');
    expect(text.toLowerCase()).not.toContain('corso per');
  });

  it('a capo anche per righe di elenco, celle e interruzioni di riga', () => {
    expect(extractContentText('<ul><li>uno</li><li>due</li></ul>')).toBe('uno\ndue');
    expect(extractContentText('<table><tr><td>a</td><td>b</td></tr></table>')).toBe('a\nb');
    expect(extractContentText('<p>riga<br>seguente</p>')).toBe('riga\nseguente');
  });

  it('decodifica le entità di base', () => {
    expect(extractContentText('<p>Tom &amp; Jerry</p>')).toBe('Tom & Jerry');
  });
});
