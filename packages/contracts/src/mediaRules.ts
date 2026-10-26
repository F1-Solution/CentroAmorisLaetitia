/** Tipi di file ammessi nell'archivio dei media, limiti e messaggi (1G-14, D147-A), condivisi da API e area. */

/** Un tipo ammesso. */
export interface MediaRule {
  /** Tipo riconosciuto dal contenuto, mai quello dichiarato dal browser. */
  readonly mime: string;
  /** Estensioni ammesse nel nome, in minuscolo e senza punto. */
  readonly extensions: readonly string[];
  readonly maxBytes: number;
  /** Solo immagini. */
  readonly maxPixels?: number;
  /** Vero per le immagini da cui si ricavano le dimensioni derivate. */
  readonly derivatives: boolean;
}

/** Limiti configurabili: i default sono quelli di D147-A. */
export interface MediaLimits {
  readonly imageBytes: number;
  readonly imagePixels: number;
  readonly pdfBytes: number;
  readonly videoBytes: number;
}

const MIB = 1024 * 1024;

export const DEFAULT_MEDIA_LIMITS: MediaLimits = {
  imageBytes: 20 * MIB,
  imagePixels: 50_000_000,
  pdfBytes: 20 * MIB,
  videoBytes: 100 * MIB,
};

/** Codici stabili dei rifiuti, con lo stato HTTP con cui l'API li risponde. */
export const MEDIA_ERROR_STATUS = {
  MEDIA_TYPE_NOT_ALLOWED: 415,
  MEDIA_TOO_LARGE: 413,
  MEDIA_TOO_MANY_PIXELS: 413,
  MEDIA_FILE_INVALID: 400,
  MEDIA_NAME_MISMATCH: 400,
  MEDIA_NOT_MULTIPART: 406,
  MEDIA_TYPE_CHANGED: 409,
  MEDIA_IN_USE: 409,
  MEDIA_VARIANT_IN_USE: 409,
  MEDIA_UPLOAD_INVALID: 400,
  MEDIA_TOO_MANY_PARTS: 413,
  MEDIA_BUSY: 503,
} as const;

export type MediaErrorCode = keyof typeof MEDIA_ERROR_STATUS;

/** Elenco dei tipi ammessi con i limiti dati; SVG e HTML non ci sono mai. */
export function mediaRules(limits: MediaLimits = DEFAULT_MEDIA_LIMITS): readonly MediaRule[] {
  const image = (mime: string, extensions: readonly string[]): MediaRule => ({
    mime,
    extensions,
    maxBytes: limits.imageBytes,
    maxPixels: limits.imagePixels,
    derivatives: true,
  });
  return [
    image('image/jpeg', ['jpg', 'jpeg']),
    image('image/png', ['png']),
    image('image/webp', ['webp']),
    { mime: 'application/pdf', extensions: ['pdf'], maxBytes: limits.pdfBytes, derivatives: false },
    { mime: 'video/mp4', extensions: ['mp4'], maxBytes: limits.videoBytes, derivatives: false },
  ];
}

export const MEDIA_RULES: readonly MediaRule[] = mediaRules();

export function ruleForMime(
  mime: string,
  rules: readonly MediaRule[] = MEDIA_RULES,
): MediaRule | undefined {
  return rules.find((rule) => rule.mime === mime);
}

/** Estensione del nome in minuscolo e senza punto, vuota se manca. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

export function formatMegabytes(bytes: number): string {
  const value = bytes / MIB;
  return `${Number.isInteger(value) ? value : value.toFixed(1).replace('.', ',')} MB`;
}

const LABELS: Readonly<Record<string, string>> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'application/pdf': 'PDF',
  'video/mp4': 'MP4',
};

/** Nome leggibile di un tipo, per i messaggi. */
export function mediaTypeLabel(mime: string): string {
  return LABELS[mime] ?? mime;
}

/** Per esempio «JPEG, PNG, WebP, PDF e MP4». */
export function allowedTypesText(rules: readonly MediaRule[] = MEDIA_RULES): string {
  const labels = rules.map((rule) => mediaTypeLabel(rule.mime));
  const last = labels[labels.length - 1];
  return labels.length < 2 ? labels.join('') : `${labels.slice(0, -1).join(', ')} e ${last}`;
}

/** Testi dei rifiuti, in italiano chiaro per chi redige. */
export const mediaMessages = {
  typeNotAllowed: (fileName: string, rules: readonly MediaRule[] = MEDIA_RULES) =>
    `Il file «${fileName}» non è di un tipo ammesso. Si possono caricare ${allowedTypesText(rules)}.`,
  tooLarge: (fileName: string, rule: MediaRule) =>
    `Il file «${fileName}» pesa troppo: per i file ${mediaTypeLabel(rule.mime)} il limite è ${formatMegabytes(rule.maxBytes)}.`,
  tooLargeAny: (maxBytes: number) =>
    `Il file pesa troppo: il limite massimo è ${formatMegabytes(maxBytes)}.`,
  tooManyPixels: (fileName: string, maxPixels: number) =>
    `L'immagine «${fileName}» ha troppi pixel: il limite è ${Math.round(maxPixels / 1_000_000)} milioni di pixel. Riducila e riprova.`,
  fileInvalid: (fileName: string) =>
    `Il file «${fileName}» è danneggiato o non si riesce a leggere. Prova a esportarlo di nuovo.`,
  nameMismatch: (fileName: string, rule: MediaRule) =>
    `Il nome «${fileName}» non corrisponde al contenuto, che è un file ${mediaTypeLabel(rule.mime)}: l'estensione dovrebbe essere ${rule.extensions.map((extension) => `.${extension}`).join(' o ')}.`,
  notMultipart: () => 'La richiesta deve portare un file, inviato come modulo multipart/form-data.',
  typeChanged: (newMime: string, currentMime: string) =>
    `Il file nuovo è di tipo ${mediaTypeLabel(newMime)}, quello sostituito è ${mediaTypeLabel(currentMime)}. La sostituzione conserva indirizzo e nome del file, quindi il tipo deve coincidere.`,
  inUse: (titles: string) =>
    `Il media è citato da questi contenuti e non si elimina finché lo citano: ${titles}.`,
  variantInUse: (titles: string, isImage = true) =>
    isImage
      ? `Il file nuovo farebbe sparire dimensioni dell'immagine che questi contenuti usano: ${titles}. Usa un'immagine almeno così grande e con le stesse proporzioni, oppure carica un media nuovo e mettilo al posto di questo in quei contenuti.`
      : `Il file nuovo toglierebbe un'anteprima del documento che questi contenuti usano: ${titles}. Carica un documento nuovo e mettilo al posto di questo in quei contenuti.`,
  uploadInvalid: () =>
    'Il caricamento non è arrivato intero o la richiesta non è ben formata. Riprova a caricare il file.',
  tooManyParts: () => 'Si carica un file alla volta: la richiesta ne porta più di uno.',
  busy: () => 'Il servizio sta elaborando altri file: riprova fra qualche istante.',
  animatedNotAllowed: (fileName: string) =>
    `L'immagine «${fileName}» è animata e non si ammette: si possono caricare solo immagini ferme. Esporta un solo fotogramma e riprova.`,
} as const;
