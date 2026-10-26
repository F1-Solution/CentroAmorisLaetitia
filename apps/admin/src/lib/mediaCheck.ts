import {
  allowedTypesText,
  extensionOf,
  MEDIA_RULES,
  mediaMessages,
  type MediaRule,
} from '@amoris/contracts/mediaRules';

/** Valore di `accept`: i tipi e le estensioni ammessi, mai SVG né HTML. */
export const MEDIA_ACCEPT = MEDIA_RULES.flatMap((rule) => [
  rule.mime,
  ...rule.extensions.map((extension) => `.${extension}`),
]).join(',');

/** Riga che dichiara i tipi ammessi accanto a «Carica» e a «Sostituisci». */
export const MEDIA_ALLOWED_HINT = `Tipi ammessi: ${allowedTypesText()}.`;

function ruleForName(fileName: string): MediaRule | undefined {
  const extension = extensionOf(fileName);
  return MEDIA_RULES.find((rule) => rule.extensions.includes(extension));
}

/** Controllo di tipo e peso prima dell’invio, con gli stessi testi dell’API: il contenuto lo verifica lei. */
export function checkMediaFile(file: File): string | null {
  const rule = ruleForName(file.name);
  if (!rule) return mediaMessages.typeNotAllowed(file.name);
  if (file.size > rule.maxBytes) return mediaMessages.tooLarge(file.name, rule);
  return null;
}

/** «1 dimensione derivata» / «3 dimensioni derivate». */
export function derivedSizes(count: number): string {
  return count === 1 ? '1 dimensione derivata' : `${count} dimensioni derivate`;
}
