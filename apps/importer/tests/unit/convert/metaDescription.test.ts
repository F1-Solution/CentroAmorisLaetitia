import { describe, expect, it } from 'vitest';
import {
  descriptionFromContent,
  metaDescriptionSource,
  phpStripTags,
} from '../../../src/convert/shared/meta-description.js';
import { MEMBERS_ACCESS_MESSAGE, applyMembersRestriction } from '../../../src/stages/contents/meta.js';

/**
 * Porto dell'algoritmo di All in One SEO 5.0.1.1 per la description (DR-179, DR-180):
 * `Meta/Description.php` getPostDescription, `Utils/Tags.php` #post_excerpt/#post_content,
 * `Traits/Helpers/WpContext.php` getDescriptionFromContent. Tutti i testi sono sintetici.
 */
describe('metaDescriptionSource', () => {
  it('lascia gli apici dritti: il testo grezzo non passa da wptexturize', () => {
    expect(
      metaDescriptionSource({
        type: 'page',
        excerpt: '',
        content: '<p>Il corso "Prova" dell\'anno - edizione nuova</p>',
      }),
    ).toBe('Il corso "Prova" dell\'anno - edizione nuova');
  });

  it('decodifica le entità in modo ricorsivo, emoji comprese', () => {
    expect(
      metaDescriptionSource({
        type: 'page',
        excerpt: '',
        content: '<p>Festa &#x1f389; con &amp;amp; amici &egrave; qui&nbsp;ora &#8217;</p>',
      }),
    ).toBe('Festa 🎉 con & amici è qui ora ’');
  });

  it('toglie i tag senza aggiungere spazi', () => {
    expect(
      metaDescriptionSource({
        type: 'page',
        excerpt: '',
        content: '<h2>Titolo</h2><p>Primo</p><p>secondo <strong>forte</strong>.</p>',
      }),
    ).toBe('TitoloPrimosecondo forte.');
  });

  it('pagina Divi tutta in shortcode: il testo è vuoto e vale l’estratto', () => {
    expect(
      metaDescriptionSource({
        type: 'page',
        excerpt: 'Estratto "scritto" a mano',
        content:
          '[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_text]Testo del modulo[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]',
      }),
    ).toBe('Estratto "scritto" a mano');
  });

  it('pagina con estratto copiato: vale il testo, non l’estratto', () => {
    expect(
      metaDescriptionSource({
        type: 'page',
        excerpt: 'Estratto di un’altra pagina',
        content: '<p>Testo vero della pagina</p>',
      }),
    ).toBe('Testo vero della pagina');
  });

  it('articolo con estratto: vale l’estratto, intero e senza taglio a 55 parole', () => {
    const excerpt = Array.from({ length: 60 }, (_, i) => `e${i}`).join(' ');
    expect(
      metaDescriptionSource({ type: 'post', excerpt, content: '<p>Testo dell’articolo</p>' }),
    ).toBe(excerpt);
  });

  it('articolo senza estratto: vale il testo', () => {
    expect(
      metaDescriptionSource({ type: 'post', excerpt: '  ', content: '<p>Testo dell’articolo</p>' }),
    ).toBe('Testo dell’articolo');
  });

  it('pagina riservata da Members: solo il messaggio, mai il contenuto', () => {
    const content = applyMembersRestriction(
      '<p>Contenuto riservato sintetico</p>',
      new Map([['_members_access_role', 'socio']]),
    );
    const description = metaDescriptionSource({ type: 'page', excerpt: '', content });
    expect(description).toBe(MEMBERS_ACCESS_MESSAGE);
    expect(description).not.toContain('riservato');
  });

  it('nulla da dire: null, non una stringa vuota', () => {
    expect(metaDescriptionSource({ type: 'page', excerpt: '', content: '[et_pb_section][/et_pb_section]' })).toBeNull();
  });
});

describe('descriptionFromContent', () => {
  it('si ferma a 55 parole, senza puntini', () => {
    const words = Array.from({ length: 70 }, (_, i) => `p${i}`);
    expect(descriptionFromContent(`<p>${words.join(' ')}</p>`)).toBe(words.slice(0, 55).join(' '));
  });

  it('conta le parole prima di decodificare le entità, come wp_trim_words', () => {
    const words = Array.from({ length: 55 }, (_, i) => `p${i}`);
    words[0] = 'uno&nbsp;due';
    // «uno&nbsp;due» è una parola sola per wp_trim_words: restano tutte e 55.
    expect(descriptionFromContent(words.join(' '))).toBe(`uno due ${words.slice(1).join(' ')}`);
  });

  it('commento HTML aperto in un blocco e chiuso in un altro: resta il «-->» finale', () => {
    const content = [
      '<!-- wp:html -->',
      '<h2>ATTENZIONE: iscrizioni chiuse</h2>',
      '<!-- /wp:html -->',
      '',
      '<!-- wp:html -->',
      '<!--',
      '<!-- /wp:html -->',
      '',
      '<!-- wp:wpforms/form-selector {"formId":"1"} /-->',
      '',
      '<!-- wp:html -->',
      '-->',
      '<!-- /wp:html -->',
    ].join('\n');
    expect(descriptionFromContent(content)).toBe('ATTENZIONE: iscrizioni chiuse -->');
  });

  it('toglie figure, immagini e contenitori degli embed', () => {
    expect(
      descriptionFromContent(
        'Prima<figure class="x"><img src="a.jpg"><figcaption>Didascalia</figcaption></figure> <img src="b.jpg" /> dopo<div class="wp-block-embed__wrapper">https://example.test/v</div>',
      ),
    ).toBe('Prima dopo');
  });

  it('strip_shortcodes toglie lo shortcode registrato con il suo contenuto, lascia gli altri', () => {
    expect(
      descriptionFromContent('Uno [catposts name="News"] due [et_pb_text]via[/et_pb_text] tre [non_registrato] quattro'),
    ).toBe('Uno due tre [non_registrato] quattro');
  });

  it('lo shortcode tra doppie parentesi perde le parentesi esterne e poi cade alla pulizia successiva', () => {
    // strip_shortcodes lascia «[catposts]»; la pulizia di AIOSEO lo ripassa e lo toglie.
    expect(descriptionFromContent('Esempio [[catposts]] fine')).toBe('Esempio fine');
  });

  it('toglie script e stile con il loro contenuto', () => {
    expect(descriptionFromContent('<style>p{}</style>A<script>alert(1)</script>B')).toBe('AB');
  });

  it('un «<» seguito da spazio è testo, come in strip_tags', () => {
    expect(descriptionFromContent('<p>3 < 5 e 7 > 2</p>')).toBe('3 < 5 e 7 > 2');
  });

  it('il cuore «<3» sopravvive alla seconda pulizia', () => {
    expect(descriptionFromContent('Ti voglio bene &lt;3')).toBe('Ti voglio bene <3');
  });

  it('un tag scritto come entità viene tolto dopo la decodifica, come in AIOSEO', () => {
    expect(descriptionFromContent('Prima &lt;b&gt;forte&lt;/b&gt; dopo')).toBe('Prima forte dopo');
  });
});

describe('phpStripTags', () => {
  it('ignora il «>» fra virgolette dentro un tag', () => {
    expect(phpStripTags('<a title="1 > 0">link</a>')).toBe('link');
  });

  it('chiude il commento solo su «-->»', () => {
    expect(phpStripTags('a<!-- x > y -->b')).toBe('ab');
  });
});
