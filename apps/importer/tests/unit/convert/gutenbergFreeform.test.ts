import { describe, expect, it } from 'vitest';
import { convertContent } from '../../../src/convert/index.js';

/**
 * HTML fuori dai blocchi Gutenberg (DR-116). Il lettore lo scartava, convinto che
 * fosse solo spazio fra un blocco e l'altro: sulla home della sorgente c'era invece
 * l'elenco degli articoli, `[catposts]`, in un paragrafo libero. Dati sintetici.
 */

const MEDIA_UUID = '33333333-3333-4333-8333-333333333333';

const heading =
  '<!-- wp:heading -->\n<h2 class="wp-block-heading">Avviso sintetico</h2>\n<!-- /wp:heading -->';

describe('HTML fuori dai blocchi Gutenberg (DR-116)', () => {
  it('uno shortcode da solo in un paragrafo libero diventa il suo blocco', () => {
    const result = convertContent({
      legacyContentId: 900,
      postContent: `${heading}\n\n<p><span style="font-size: revert;">[catposts name="Notizie" number="10" thumb="true" date="1" excerpt="1"]</span></p>`,
    });
    expect(result.document.blocks.map((b) => b.type)).toEqual(['rich_text', 'post_list']);
    const list = result.document.blocks[1]!;
    if (list.type !== 'post_list') throw new Error('atteso post_list');
    expect(list.props.limit).toBe(10);
    expect(list.props.showThumbnail).toBe(true);
    expect(list.props.showDate).toBe(true);
    expect(list.props.showExcerpt).toBe(true);
  });

  it('il testo libero diventa testo, prima, fra e dopo i blocchi', () => {
    const result = convertContent({
      legacyContentId: 901,
      postContent: `<p>Prima</p>\n${heading}\n<p>Fra</p>\n${heading}\n<p>Dopo</p>`,
    });
    const html = result.document.blocks
      .map((b) => (b.type === 'rich_text' ? b.props.html : ''))
      .join('|');
    expect(html).toContain('Prima');
    expect(html).toContain('Fra');
    expect(html).toContain('Dopo');
  });

  it('lo spazio fra un blocco e l’altro resta ignorato', () => {
    const result = convertContent({
      legacyContentId: 902,
      postContent: `${heading}\n\n   \n${heading}\n`,
    });
    expect(result.document.blocks.map((b) => b.type)).toEqual(['rich_text', 'rich_text']);
  });

  it('i flag dello shortcode spenti restano spenti', () => {
    const result = convertContent({
      legacyContentId: 903,
      postContent: `${heading}\n<p>[catposts name="Notizie" thumb="0" date="" excerpt="0"]</p>`,
    });
    const list = result.document.blocks.find((b) => b.type === 'post_list');
    if (list?.type !== 'post_list') throw new Error('atteso post_list');
    expect([list.props.showThumbnail, list.props.showDate, list.props.showExcerpt]).toEqual([
      false,
      false,
      false,
    ]);
  });

  // DR-130: nel plugin «offset» è «inizia dall'articolo N», contato da 1.
  it('«offset» 1 non salta nulla, «offset» 3 salta i primi due (DR-130)', () => {
    const offsetOf = (value: string) => {
      const result = convertContent({
        legacyContentId: 904,
        postContent: `${heading}\n<p>[catposts name="News" number="10" offset="${value}"]</p>`,
      });
      const list = result.document.blocks.find((b) => b.type === 'post_list');
      if (list?.type !== 'post_list') throw new Error('atteso post_list');
      return list.props.offset;
    };
    expect(offsetOf('1')).toBe(0);
    expect(offsetOf('3')).toBe(2);
  });

  it('miniatura in alto: niente data, come il modello del plugin; misure, estratto e riserva diventano proprietà', () => {
    const result = convertContent({
      legacyContentId: 906,
      postContent: `${heading}\n<p>[catposts name="News" thumb="1" date="1" thumb_top="1" thumb_w="100" thumb_h="100" excerpt_length="100" excerpt_more_text="leggi tutto" default_thumbnail="/wp-content/uploads/2017/09/sintetica.jpg"]</p>`,
      resolvers: { resolveMedia: (src) => (src.endsWith('sintetica.jpg') ? MEDIA_UUID : null) },
    });
    const list = result.document.blocks.find((b) => b.type === 'post_list');
    if (list?.type !== 'post_list') throw new Error('atteso post_list');
    expect(list.props.showDate).toBe(false);
    expect(list.props.thumbnailWidth).toBe(100);
    expect(list.props.thumbnailHeight).toBe(100);
    expect(list.props.excerptWords).toBe(100);
    expect(list.props.excerptMoreText).toBe('leggi tutto');
    expect(list.props.defaultThumbnailMediaId).toBe(MEDIA_UUID);
    expect(result.issues.filter((i) => i.code === 'unexpected-catposts-param')).toHaveLength(0);
  });

  it('senza «offset» nello shortcode, resta 0', () => {
    const result = convertContent({
      legacyContentId: 905,
      postContent: `${heading}\n<p>[catposts name="Notizie" number="10"]</p>`,
    });
    const list = result.document.blocks.find((b) => b.type === 'post_list');
    if (list?.type !== 'post_list') throw new Error('atteso post_list');
    expect(list.props.offset).toBe(0);
  });
});
