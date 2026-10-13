/** Mesi abbreviati come li scrive il tema in italiano. */
const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

/**
 * Il testo degli articoli nell'archivio, come lo tronca il tema
 * (`et_divi.divi_use_excerpt = false`, `truncate_post(270)`): i primi 270
 * caratteri, tagliati all'ultimo spazio, con «...».
 */
export function archiveSummary(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= 270) return clean;
  const cut = clean.slice(0, 270);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}...`;
}

/**
 * La data nella riga dei metadati degli articoli, come la scrive il tema:
 * giorno, mese abbreviato con l'iniziale maiuscola, anno («1 Dic 2017»). È una
 * regola di presentazione del tema, non un contenuto.
 */
export function postDate(iso: string | null): string {
  if (!iso) return '';
  const parts = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(iso));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  // `Number` toglie lo zero che alcune versioni di Intl mettono davanti al giorno.
  return `${Number(value('day'))} ${MESI[Number(value('month')) - 1] ?? ''} ${value('year')}`;
}
