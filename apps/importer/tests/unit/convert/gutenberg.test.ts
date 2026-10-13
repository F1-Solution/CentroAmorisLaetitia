import { describe, expect, it } from 'vitest';
import { convertContent } from '../../../src/convert/index.js';
import {
  paragraphRun,
  listSample,
  imageSample,
  columnsSample,
  mediaTextSample,
  separatorSample,
  formSelectorSample,
  htmlBlockSample,
  shortcodeBlockSample,
  diviPlaceholderSample,
} from '../../fixtures/convert/gutenberg-samples.js';

describe('convertContent — famiglia Gutenberg', () => {
  it('riconosce la famiglia Gutenberg da un contenuto con commenti wp:', () => {
    const result = convertContent({ legacyContentId: 1, postContent: paragraphRun });
    expect(result.family).toBe('gutenberg');
  });

  it('fonde i paragrafi contigui in un solo rich_text (§4.1) e non fonde oltre il titolo', () => {
    const result = convertContent({ legacyContentId: 2, postContent: paragraphRun });
    const types = result.document.blocks.map((b) => b.type);
    expect(types).toEqual(['rich_text', 'rich_text', 'rich_text']);
    const first = result.document.blocks[0]!;
    if (first.type !== 'rich_text') throw new Error('atteso rich_text');
    expect(first.props.html).toContain('Primo capoverso');
    expect(first.props.html).toContain('Secondo capoverso');
  });

  it('wp:list con wp:list-item produce un solo rich_text con <ul><li>', () => {
    const result = convertContent({ legacyContentId: 3, postContent: listSample });
    expect(result.document.blocks).toHaveLength(1);
    const block = result.document.blocks[0]!;
    if (block.type !== 'rich_text') throw new Error('atteso rich_text');
    expect(block.props.html).toContain('<ul');
    expect(block.props.html).toContain('<li>Voce A</li>');
    expect(block.props.html).toContain('Voce B');
  });

  it('wp:image produce un blocco image con alt, didascalia e src', () => {
    const result = convertContent({ legacyContentId: 4, postContent: imageSample });
    expect(result.document.blocks).toHaveLength(1);
    const block = result.document.blocks[0]!;
    if (block.type !== 'image') throw new Error('atteso image');
    expect(block.props.alt).toBe('testo alternativo di prova');
    expect(block.props.caption).toBe('Una didascalia di prova');
    expect(block.props.src).toContain('prova.jpg');
  });

  it('D59: wp:image con dimensione ridotta ricorda la variante, se il media si risolve', () => {
    const postContent =
      '<!-- wp:image {"id":9,"sizeSlug":"large"} -->\n' +
      '<figure class="wp-block-image size-large"><img src="/wp-content/uploads/2022/09/sintetica-731x1024.jpg" alt="" class="wp-image-9"/></figure>\n' +
      '<!-- /wp:image -->';
    const resolved = convertContent({
      legacyContentId: 41,
      postContent,
      resolvers: { resolveMedia: () => '33333333-3333-4333-8333-333333333333' },
    });
    const image = resolved.document.blocks[0]!;
    if (image.type !== 'image') throw new Error('atteso image');
    expect(image.props.variant).toBe('731x1024');

    // Senza media risolto resta l'indirizzo com'è e nessuna variante.
    const unresolved = convertContent({ legacyContentId: 42, postContent });
    const fallback = unresolved.document.blocks[0]!;
    if (fallback.type !== 'image') throw new Error('atteso image');
    expect(fallback.props.variant).toBeNull();
  });

  it('D59: wp:image a dimensione piena non ha variante', () => {
    const result = convertContent({
      legacyContentId: 43,
      postContent:
        '<!-- wp:image {"id":9,"sizeSlug":"full"} -->\n' +
        '<figure class="wp-block-image size-full"><img src="/wp-content/uploads/2022/09/sintetica.jpg" alt=""/></figure>\n' +
        '<!-- /wp:image -->',
      resolvers: { resolveMedia: () => '33333333-3333-4333-8333-333333333333' },
    });
    const image = result.document.blocks[0]!;
    if (image.type !== 'image') throw new Error('atteso image');
    expect(image.props.variant).toBeNull();
  });

  it('wp:columns produce row > column con columnStructure coerente', () => {
    const result = convertContent({ legacyContentId: 5, postContent: columnsSample });
    expect(result.document.blocks).toHaveLength(1);
    const row = result.document.blocks[0]!;
    if (row.type !== 'row') throw new Error('atteso row');
    expect(row.children).toHaveLength(2);
    const widths = row.children.map((c) => (c.type === 'column' ? c.props.width : null));
    expect(row.props.columnStructure).toBe(widths.join(','));
    // DR-134: la riga ricorda di essere nata da Gutenberg.
    expect(row.props.layout).toBe('flex');
  });

  it('wp:media-text produce media_text con figlio rich_text', () => {
    const result = convertContent({ legacyContentId: 6, postContent: mediaTextSample });
    expect(result.document.blocks).toHaveLength(1);
    const block = result.document.blocks[0]!;
    if (block.type !== 'media_text') throw new Error('atteso media_text');
    expect(block.props.mediaPosition).toBe('right');
    expect(block.props.verticalAlignment).toBe('top');
    expect(block.props.mediaWidthPercent).toBe(40);
    expect(block.children).toHaveLength(1);
    expect(block.children[0]!.type).toBe('rich_text');
  });

  it('wp:separator legge lo stile da is-style-wide', () => {
    const result = convertContent({ legacyContentId: 7, postContent: separatorSample });
    const block = result.document.blocks[0]!;
    if (block.type !== 'separator') throw new Error('atteso separator');
    expect(block.props.style).toBe('wide');
  });

  it('wp:wpforms/form-selector con risolutore produce un blocco form', () => {
    const result = convertContent({
      legacyContentId: 8,
      postContent: formSelectorSample,
      resolvers: { resolveForm: () => '11111111-1111-4111-8111-111111111111' },
    });
    const block = result.document.blocks[0]!;
    if (block.type !== 'form') throw new Error('atteso form');
    expect(block.props.origin).toBe('wpforms');
    expect(block.props.showTitle).toBe(true);
  });

  it('wp:wpforms/form-selector senza risolutore diventa blocco di riserva, contato', () => {
    const result = convertContent({ legacyContentId: 9, postContent: formSelectorSample });
    const block = result.document.blocks[0]!;
    expect(block.type).toBe('html');
    expect(result.issues.some((i) => i.code === 'unresolved-form-reference')).toBe(true);
  });

  it('wp:html nasce già come blocco di riserva con reason wp_html_block', () => {
    const result = convertContent({ legacyContentId: 10, postContent: htmlBlockSample });
    const block = result.document.blocks[0]!;
    if (block.type !== 'html') throw new Error('atteso html');
    expect(block.props.reason).toBe('wp_html_block');
  });

  it('wp:shortcode con [catposts] produce un blocco post_list', () => {
    const result = convertContent({ legacyContentId: 11, postContent: shortcodeBlockSample });
    const block = result.document.blocks[0]!;
    expect(block.type).toBe('post_list');
  });

  it('wp:divi/placeholder è un marcatore e si scarta', () => {
    const result = convertContent({ legacyContentId: 12, postContent: diviPlaceholderSample });
    expect(result.document.blocks).toHaveLength(0);
  });

  it('ogni blocco prodotto convalida contro il proprio schema Zod (via blockDocumentSchema)', () => {
    const result = convertContent({ legacyContentId: 13, postContent: columnsSample });
    // `convertContent` chiama già `blockDocumentSchema.parse`: se questo test
    // arriva qui senza eccezioni, il documento è valido.
    expect(result.document.schema).toBe(1);
  });
});
