/**
 * Porto di `wpautop()` (`wp-includes/formatting.php` della sorgente, riga 446):
 * il contenuto «fuori dai blocchi» e i moduli di testo di Divi arrivano con gli
 * «a capo» singoli della sorgente, non con `<p>`/`<br>` — nella sorgente li
 * aggiungeva questo filtro a ogni resa. Qui si applica una sola volta, in
 * importazione, allo stesso frammento che prima diventava `rich_text`
 * (`buildRichTextOrFallback`): senza, i paragrafi si leggono come un unico
 * blocco di testo (rilievo della `1E-W6`).
 */

const ALL_BLOCKS =
  '(?:table|thead|tfoot|caption|col|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|pre|form|map|area|blockquote|address|style|p|h[1-6]|hr|fieldset|legend|section|article|aside|hgroup|header|footer|nav|figure|figcaption|details|menu|summary)';

/** Sostituisce gli «a capo» dentro i tag HTML con un segnaposto, come `wp_replace_in_html_tags`. */
function replaceNewlinesInsideTags(text: string): string {
  return text.replace(/<[^<>]+>/g, (tag) => tag.replaceAll('\n', ' <!-- wpnl --> '));
}

export function wpautop(testo: string, br = true): string {
  if (testo.trim() === '') return '';

  let text = `${testo}\n`;
  const preTags = new Map<string, string>();

  // I tag <pre> non si toccano: si sostituiscono con segnaposto e si rimettono alla fine.
  if (text.includes('<pre')) {
    const parti = text.split('</pre>');
    const ultima = parti.pop() ?? '';
    let ricostruito = '';
    let i = 0;
    for (const parte of parti) {
      const inizio = parte.indexOf('<pre');
      if (inizio === -1) {
        ricostruito += parte;
        continue;
      }
      const nome = `<pre wp-pre-tag-${i}></pre>`;
      preTags.set(nome, `${parte.slice(inizio)}</pre>`);
      ricostruito += parte.slice(0, inizio) + nome;
      i += 1;
    }
    text = ricostruito + ultima;
  }

  // Due <br> consecutivi valgono una riga vuota, cioè un nuovo paragrafo.
  text = text.replace(/<br\s*\/?>\s*<br\s*\/?>/g, '\n\n');

  // Una riga vuota prima e dopo un tag di blocco.
  text = text.replace(new RegExp(`(<${ALL_BLOCKS}[\\s/>])`, 'g'), '\n\n$1');
  text = text.replace(new RegExp(`(</${ALL_BLOCKS}>)`, 'g'), '$1\n\n');
  text = text.replace(/(<hr\s*\/?>)/g, '$1\n\n');

  text = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  text = replaceNewlinesInsideTags(text);

  if (text.includes('<option')) {
    text = text.replace(/\s*<option/g, '<option');
    text = text.replace(/<\/option>\s*/g, '</option>');
  }
  if (text.includes('</object>')) {
    text = text.replace(/(<object[^>]*>)\s*/g, '$1');
    text = text.replace(/\s*<\/object>/g, '</object>');
    text = text.replace(/\s*(<\/?(?:param|embed)[^>]*>)\s*/g, '$1');
  }
  if (text.includes('<source') || text.includes('<track')) {
    text = text.replace(/([<[](?:audio|video)[^>\]]*[>\]])\s*/g, '$1');
    text = text.replace(/\s*([<[]\/(?:audio|video)[>\]])/g, '$1');
    text = text.replace(/\s*(<(?:source|track)[^>]*>)\s*/g, '$1');
  }
  if (text.includes('<figcaption')) {
    text = text.replace(/\s*(<figcaption[^>]*>)/g, '$1');
    text = text.replace(/<\/figcaption>\s*/g, '</figcaption>');
  }

  // Non più di una riga vuota consecutiva.
  text = text.replace(/\n\n+/g, '\n\n');

  const paragrafi = text.split(/\n\s*\n/).filter((p) => p !== '');
  text = paragrafi.map((p) => `<p>${p.replace(/^\n+|\n+$/g, '')}</p>\n`).join('');

  text = text.replace(/<p>\s*<\/p>/g, '');
  text = text.replace(/<p>([^<]+)<\/(div|address|form)>/g, '<p>$1</p></$2>');
  text = text.replace(new RegExp(`<p>\\s*(</?${ALL_BLOCKS}[^>]*>)\\s*</p>`, 'g'), '$1');
  text = text.replace(/<p>(<li.+?)<\/p>/g, '$1');
  text = text.replace(/<p><blockquote([^>]*)>/gi, '<blockquote$1><p>');
  text = text.replaceAll('</blockquote></p>', '</p></blockquote>');
  text = text.replace(new RegExp(`<p>\\s*(</?${ALL_BLOCKS}[^>]*>)`, 'g'), '$1');
  text = text.replace(new RegExp(`(</?${ALL_BLOCKS}[^>]*>)\\s*</p>`, 'g'), '$1');

  if (br) {
    // Il contenuto di <script>, <style>, <svg>, <math> non si tocca.
    const preservati: string[] = [];
    text = text.replace(/<(script|style|svg|math)[\s\S]*?<\/\1>/g, (match) => {
      preservati.push(match);
      return `<WPPreserveBlock${preservati.length - 1} />`;
    });

    text = text.replaceAll('<br>', '<br />').replaceAll('<br/>', '<br />');
    text = text.replace(/(?<!<br \/>)\s*\n/g, '<br />\n');

    text = text.replace(
      /<WPPreserveBlock(\d+) \/>/g,
      (_match, i: string) => preservati[Number(i)]!,
    );
  }

  text = text.replace(new RegExp(`(</?${ALL_BLOCKS}[^>]*>)\\s*<br \\/>`, 'g'), '$1');
  text = text.replace(/<br \/>(\s*<\/?(?:p|li|div|dl|dd|dt|th|pre|td|ul|ol)[^>]*>)/g, '$1');
  text = text.replace(/\n<\/p>$/, '</p>');

  for (const [nome, originale] of preTags) {
    text = text.replaceAll(nome, originale);
  }
  text = text.replaceAll(' <!-- wpnl --> ', '\n').replaceAll('<!-- wpnl -->', '\n');

  return text;
}
