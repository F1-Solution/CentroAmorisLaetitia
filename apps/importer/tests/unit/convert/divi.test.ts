import { describe, expect, it } from 'vitest';
import { convertContent } from '../../../src/convert/index.js';
import {
  sectionRowColumnTextImage,
  disabledModuleSample,
  unknownAttributeSample,
  nestedDeepSample,
  quoteVariantsSample,
  videoSample,
  mapSample,
  contactFormSample,
  catpostsOnlyOccurrence,
  unmappedModuleSample,
  schemeRelativeImageSample,
  unknownShortcodeSample,
} from '../../fixtures/convert/divi-samples.js';

const FORM_UUID = '22222222-2222-4222-8222-222222222222';

describe('convertContent — famiglia Divi', () => {
  it('margini personalizzati di riga, testo e immagine e padding a zero del CSS di riga (R)', () => {
    const result = convertContent({
      legacyContentId: 103,
      postContent:
        '[et_pb_section][et_pb_row custom_margin="-23px|auto||auto||" custom_css_main_element=" padding-bottom: 0;"]' +
        '[et_pb_column type="4_4"][et_pb_text custom_margin="||30px|||"]<p>Uno</p>[/et_pb_text]' +
        '[et_pb_image src="https://esempio.test/wp-content/uploads/2026/09/foto.jpg" custom_margin="||10px|"][/et_pb_image]' +
        '[/et_pb_column][/et_pb_row][et_pb_row custom_css_main_element="padding: 0;" custom_padding="5px|||"]' +
        '[et_pb_column type="4_4"][et_pb_text]<p>Due</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]',
      resolvers: { resolveMedia: () => null },
    });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const [first, second] = section.children;
    if (first?.type !== 'row' || second?.type !== 'row') throw new Error('attese due righe');
    expect(first.props.margin.base).toEqual({
      top: '-23px',
      right: null,
      bottom: null,
      left: null,
    });
    expect(first.props.padding.base).toEqual({ top: null, right: null, bottom: '0px', left: null });
    // `custom_padding` vince sul CSS libero per il lato che imposta.
    expect(second.props.padding.base).toEqual({
      top: '5px',
      right: '0px',
      bottom: '0px',
      left: '0px',
    });
    const column = first.children[0]!;
    if (column.type !== 'column') throw new Error('atteso column');
    const [text, image] = column.children;
    if (text?.type !== 'rich_text' || image?.type !== 'image')
      throw new Error('attesi testo e immagine');
    expect(text.props.margin.base?.bottom).toBe('30px');
    expect(image.props.margin.base?.bottom).toBe('10px');
    expect(result.issues.some((i) => i.detail?.includes('custom_margin'))).toBe(false);
  });

  it('prova negativa: altro CSS libero di riga non si traduce e si segnala (R)', () => {
    const result = convertContent({
      legacyContentId: 104,
      postContent:
        '[et_pb_section][et_pb_row custom_css_main_element="color: red;"][et_pb_column type="4_4"]' +
        '[et_pb_text]<p>Tre</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]',
    });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const row = section.children[0]!;
    if (row.type !== 'row') throw new Error('atteso row');
    expect(row.props.padding.base).toBeNull();
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'unknown-divi-attribute',
        detail: 'et_pb_row.custom_css_main_element',
      }),
    );
  });

  it('riconosce la famiglia Divi da uno shortcode et_pb_', () => {
    const result = convertContent({ legacyContentId: 100, postContent: sectionRowColumnTextImage });
    expect(result.family).toBe('divi');
  });

  it('il contenuto nel marcatore wp:divi/placeholder si converte come Divi, senza paragrafi vuoti', () => {
    const result = convertContent({
      legacyContentId: 102,
      postContent: `<!-- wp:divi/placeholder -->\n${sectionRowColumnTextImage}\n<!-- /wp:divi/placeholder -->`,
      resolvers: { resolveMedia: () => null },
    });
    expect(result.family).toBe('divi');
    expect(result.document.blocks).toHaveLength(1);
    expect(result.document.blocks[0]!.type).toBe('section');
  });

  it('section > row > column > text/image, con columnStructure coerente e attributi conservati', () => {
    const result = convertContent({
      legacyContentId: 101,
      postContent: sectionRowColumnTextImage,
      resolvers: { resolveMedia: () => null },
    });
    expect(result.document.blocks).toHaveLength(1);
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    expect(section.props.fullWidth).toBe(true);
    expect(section.props.classes).toContain('is-fullwidth');
    expect(section.props.backgroundColor).toBe('#ffffff');

    const row = section.children[0]!;
    if (row.type !== 'row') throw new Error('atteso row');
    expect(row.props.gutter).toEqual({ custom: true, width: 2 });
    expect(row.children).toHaveLength(2);
    const widths = row.children.map((c) => (c.type === 'column' ? c.props.width : null));
    expect(row.props.columnStructure).toBe(widths.join(','));
    expect(widths).toEqual(['1_2', '1_2']);

    const textColumn = row.children[0]!;
    if (textColumn.type !== 'column') throw new Error('atteso column');
    const text = textColumn.children[0]!;
    if (text.type !== 'rich_text') throw new Error('atteso rich_text');
    expect(text.props.textAlign).toBe('center');
    expect(text.props.classes).toContain('align-center');
    expect(text.props.html).toContain('<strong>enfasi</strong>');

    const imageColumn = row.children[1]!;
    if (imageColumn.type !== 'column') throw new Error('atteso column');
    const image = imageColumn.children[0]!;
    if (image.type !== 'image') throw new Error('atteso image');
    expect(image.props.lightbox).toBe(true);
    expect(image.props.classes).toContain('in-lightbox');
    expect(image.props.animation).toEqual({ style: 'fade', direction: null });
  });

  it('un modulo disabled="on" non si converte affatto', () => {
    const result = convertContent({ legacyContentId: 102, postContent: disabledModuleSample });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const column = section.children[0]!.children[0]!;
    if (column.type !== 'column') throw new Error('atteso column');
    expect(column.children).toHaveLength(1);
    const text = column.children[0]!;
    if (text.type !== 'rich_text') throw new Error('atteso rich_text');
    expect(text.props.html).toContain('Testo mostrato');
    expect(text.props.html).not.toContain('mai mostrato');
  });

  it('un attributo Divi sconosciuto produce una riga import_issues e non finisce in stile in linea', () => {
    const result = convertContent({ legacyContentId: 103, postContent: unknownAttributeSample });
    const unknownAttr = result.issues.find(
      (i) =>
        i.code === 'unknown-divi-attribute' && i.detail === 'et_pb_text.un_attributo_mai_visto',
    );
    expect(unknownAttr).toBeDefined();

    const styleIssue = result.issues.find(
      (i) => i.code === 'sanitize-removed' && i.detail === 'p.style',
    );
    expect(styleIssue).toBeDefined();

    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const text = section.children[0]!.children[0]!.children[0]!;
    if (text.type !== 'rich_text') throw new Error('atteso rich_text');
    expect(text.props.html).not.toContain('style=');
  });

  it('shortcode annidati in profondità non perdono testo, apostrofi e accenti', () => {
    const result = convertContent({ legacyContentId: 104, postContent: nestedDeepSample });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const text = section.children[0]!.children[0]!.children[0]!;
    if (text.type !== 'rich_text') throw new Error('atteso rich_text');
    expect(text.props.html).toContain('Livello 1');
    expect(text.props.html).toContain('Livello 2');
    expect(text.props.html).toContain('città');
  });

  it('attributi con apici doppi e singoli si analizzano allo stesso modo', () => {
    const result = convertContent({ legacyContentId: 105, postContent: quoteVariantsSample });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const column = section.children[0]!.children[0]!;
    if (column.type !== 'column') throw new Error('atteso column');
    expect(column.props.width).toBe('4_4');
    const text = column.children[0]!;
    if (text.type !== 'rich_text') throw new Error('atteso rich_text');
    expect(text.props.textAlign).toBe('left');
    expect(text.props.html).toContain('doppie');
    expect(text.props.html).toContain('singole');
  });

  it('et_pb_video deriva il provider e normalizza gli URL relativi allo schema', () => {
    const result = convertContent({ legacyContentId: 106, postContent: videoSample });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const video = section.children[0]!.children[0]!.children[0]!;
    if (video.type !== 'video') throw new Error('atteso video');
    expect(video.props.provider).toBe('youtube');
    expect(video.props.posterSrc).toBe('/wp-content/uploads/2026/09/copertina.jpg');
    expect(result.issues.some((i) => i.code === 'same-site-url-normalized')).toBe(true);
  });

  it('et_pb_video con un .mp4 dello stesso sito: provider «file», calcolato sull’indirizzo riscritto (DR-184)', () => {
    const result = convertContent({
      legacyContentId: 108,
      postContent:
        '[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_video src="https://www.centroamorislaetitia.it/wp-content/uploads/2026/09/prova.mp4"][/et_pb_video][/et_pb_column][/et_pb_row][/et_pb_section]',
    });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const video = section.children[0]!.children[0]!.children[0]!;
    if (video.type !== 'video') throw new Error('atteso video');
    expect(video.props.provider).toBe('file');
    // L'indirizzo resta quello originale: lo riscrive la fase `rewrite`.
    expect(video.props.src).toContain('/wp-content/uploads/2026/09/prova.mp4');
  });

  it('et_pb_map conserva i segnaposto come proprietà, non come blocchi', () => {
    const result = convertContent({ legacyContentId: 107, postContent: mapSample });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const map = section.children[0]!.children[0]!.children[0]!;
    if (map.type !== 'map') throw new Error('atteso map');
    expect(map.props.address).toBe('Via di Prova 1, Città');
    expect(map.props.lat).toBe('43.1');
    expect(map.props.pins).toHaveLength(1);
    expect(map.props.pins[0]!.title).toBe('Sede di prova');
    expect(map.props.grayscale).toBe(true);
    expect(map.props.classes).toContain('map-grayscale');
  });

  it('et_pb_contact_form con risolutore produce un blocco form di origine divi', () => {
    const result = convertContent({
      legacyContentId: 108,
      postContent: contactFormSample,
      resolvers: { resolveForm: () => FORM_UUID },
    });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const form = section.children[0]!.children[0]!.children[0]!;
    if (form.type !== 'form') throw new Error('atteso form');
    expect(form.props.origin).toBe('divi');
    expect(form.props.formId).toBe(FORM_UUID);
  });

  it('[catposts] con parametri sconosciuti li conta, e i parametri noti diventano proprietà', () => {
    const result = convertContent({ legacyContentId: 109, postContent: catpostsOnlyOccurrence });
    const postList = result.document.blocks.find((b) => b.type === 'post_list');
    expect(postList).toBeDefined();
    if (postList!.type !== 'post_list') throw new Error('atteso post_list');
    expect(postList!.props.limit).toBe(5);
  });

  it('un modulo Divi non mappato diventa un blocco html con reason divi_unmapped_module', () => {
    const result = convertContent({ legacyContentId: 110, postContent: unmappedModuleSample });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const fallback = section.children[0]!.children[0]!.children[0]!;
    if (fallback.type !== 'html') throw new Error('atteso html');
    expect(fallback.props.reason).toBe('divi_unmapped_module');
    expect(fallback.props.detail).toBe('et_pb_slider');
  });

  it('un src di immagine relativo allo schema del sito si normalizza e si conta', () => {
    const result = convertContent({ legacyContentId: 111, postContent: schemeRelativeImageSample });
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const image = section.children[0]!.children[0]!.children[0]!;
    if (image.type !== 'image') throw new Error('atteso image');
    expect(image.props.src).toBe('/wp-content/uploads/2026/09/relativa.jpg');
    expect(
      result.issues.some(
        (i) => i.code === 'same-site-url-normalized' && i.detail === 'et_pb_image.src',
      ),
    ).toBe(true);
  });

  it('uno shortcode sconosciuto produce una riga unknown-shortcode e diventa rich_text', () => {
    const result = convertContent({ legacyContentId: 112, postContent: unknownShortcodeSample });
    expect(
      result.issues.some((i) => i.code === 'unknown-shortcode' && i.detail === 'mistero'),
    ).toBe(true);
    const section = result.document.blocks[0]!;
    if (section.type !== 'section') throw new Error('atteso section');
    const converted = section.children[0]!.children[0]!.children[0]!;
    expect(converted.type).toBe('rich_text');
  });
});
