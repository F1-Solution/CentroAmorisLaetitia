/**
 * Frammenti Divi **sintetici** (DR-010). Coprono i cinque shortcode strutturali
 * di `divi-shortcode-strategy.md` §2 (97% delle occorrenze) e la coda: video,
 * mappa (con segnaposto), form di contatto (con campo).
 */

export const sectionRowColumnTextImage = `[et_pb_section admin_label="Sezione" _builder_version="4.10" make_fullwidth="on" transparent_background="off" background_color="#ffffff" custom_padding="20px|10px|20px|10px"][et_pb_row admin_label="Riga" column_structure="1_2,1_2" use_custom_gutter="on" gutter_width="2"][et_pb_column type="1_2"][et_pb_text admin_label="Testo" text_orientation='center' use_border_color="off" border_color="#000000"]<p>Un paragrafo di prova con <strong>enfasi</strong> e un <em>corsivo</em>.</p>[/et_pb_text][/et_pb_column][et_pb_column type="1_2"][et_pb_image src="https://esempio.test/wp-content/uploads/2026/09/foto.jpg" alt="una foto di prova" align="center" show_in_lightbox="on" animation="on" animation_style="fade"][/et_pb_image][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const disabledModuleSample = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_text disabled="on"]<p>Testo mai mostrato: il modulo è disattivato.</p>[/et_pb_text][et_pb_text]<p>Testo mostrato.</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const unknownAttributeSample = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_text un_attributo_mai_visto="qualcosa"]<p style="color:red">Testo con un attributo sconosciuto.</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const nestedDeepSample = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_text]<div><p>Livello 1</p><div><p>Livello 2 con apostrofo ’ e accento città</p></div></div>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const quoteVariantsSample = `[et_pb_section][et_pb_row][et_pb_column type='4_4'][et_pb_text text_orientation="left"]<p>Attributi con virgolette miste, sia "doppie" che 'singole'.</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const videoSample = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_video src="https://www.youtube.com/watch?v=abc123" image_src="//www.centroamorislaetitia.it/wp-content/uploads/2026/09/copertina.jpg"][/et_pb_video][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const mapSample = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_map address="Via di Prova 1, Città" address_lat="43.1" address_lng="12.4" zoom_level="14" use_grayscale_filter="on"][et_pb_map_pin title="Sede di prova" pin_address_lat="43.1" pin_address_lng="12.4"]Testo del segnaposto[/et_pb_map_pin][/et_pb_map][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const contactFormSample = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_contact_form email="prova@esempio.test" title="Scrivici" success_message="Grazie"][et_pb_contact_field field_id="Nome" field_title="Nome"][/et_pb_contact_field][/et_pb_contact_form][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const catpostsOnlyOccurrence = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_text][/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section][catposts category="notizie" limit="5"]`;

export const unmappedModuleSample = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_slider][et_pb_slide][/et_pb_slide][/et_pb_slider][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const schemeRelativeImageSample = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][et_pb_image src="//www.centroamorislaetitia.it/wp-content/uploads/2026/09/relativa.jpg" alt="immagine relativa allo schema"][/et_pb_image][/et_pb_column][/et_pb_row][/et_pb_section]`;

export const unknownShortcodeSample = `[et_pb_section][et_pb_row][et_pb_column type="4_4"][mistero attributo="x"]Contenuto sconosciuto[/mistero][/et_pb_column][/et_pb_row][/et_pb_section]`;
