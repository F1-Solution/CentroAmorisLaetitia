/**
 * Frammenti Gutenberg **sintetici** (DR-010): nessun contenuto reale del
 * Centro. Uno per ciascuno dei 12 tipi di `ADR-005` §1.1, più il marcatore
 * `wp:divi/placeholder`.
 */

export const paragraphRun = `<!-- wp:paragraph --><p>Primo capoverso di prova.</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Secondo capoverso, sempre di fantasia.</p><!-- /wp:paragraph -->
<!-- wp:heading {"level":2} --><h2>Un titolo di prova</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>Terzo capoverso, dopo il titolo.</p><!-- /wp:paragraph -->`;

export const listSample = `<!-- wp:list --><ul class="wp-block-list"><!-- wp:list-item --><li>Voce A</li><!-- /wp:list-item --><!-- wp:list-item --><li>Voce B, con àccento</li><!-- /wp:list-item --></ul><!-- /wp:list -->`;

export const imageSample = `<!-- wp:image {"id":42,"sizeSlug":"large"} --><figure class="wp-block-image size-large"><img src="https://esempio.test/uploads/2026/09/prova.jpg" alt="testo alternativo di prova" class="wp-image-42"/><figcaption>Una didascalia di prova</figcaption></figure><!-- /wp:image -->`;

export const columnsSample = `<!-- wp:columns --><div class="wp-block-columns"><!-- wp:column {"width":"33.33%"} --><div class="wp-block-column"><!-- wp:paragraph --><p>Colonna sinistra</p><!-- /wp:paragraph --></div><!-- /wp:column --><!-- wp:column {"width":"66.66%"} --><div class="wp-block-column"><!-- wp:paragraph --><p>Colonna destra</p><!-- /wp:paragraph --></div><!-- /wp:column --></div><!-- /wp:columns -->`;

export const mediaTextSample = `<!-- wp:media-text {"mediaId":7,"mediaPosition":"right","verticalAlignment":"top","mediaWidth":40} --><div class="wp-block-media-text has-media-on-the-right"><figure class="wp-block-media-text__media"><img src="https://esempio.test/uploads/2026/09/altra-prova.jpg" alt="figura di prova"/></figure><div class="wp-block-media-text__content"><!-- wp:paragraph --><p>Testo accanto all'immagine.</p><!-- /wp:paragraph --></div></div><!-- /wp:media-text -->`;

export const separatorSample = `<!-- wp:separator {"className":"is-style-wide"} --><hr class="wp-block-separator has-alpha-channel-opacity is-style-wide"/><!-- /wp:separator -->`;

export const formSelectorSample = `<!-- wp:wpforms/form-selector {"formId":"123","displayTitle":true,"displayDesc":false} /-->`;

export const htmlBlockSample = `<!-- wp:html --><div class="qualcosa-di-non-standard"><center>testo centrato di prova</center></div><!-- /wp:html -->`;

export const shortcodeBlockSample = `<!-- wp:shortcode -->[catposts category="prova" limit="3"]<!-- /wp:shortcode -->`;

export const diviPlaceholderSample = `<!-- wp:divi/placeholder /-->`;

export const mixedDocumentSample = [
  paragraphRun,
  imageSample,
  columnsSample,
  separatorSample,
  formSelectorSample,
  diviPlaceholderSample,
].join('\n');
