/**
 * I dati a runtime che la lettura pubblica (DR-104) o l'anteprima aggiungono al
 * documento a blocchi, perché `slider`, `form` e `post_list` non portano il loro
 * contenuto nel documento stesso (`BLOCK-MODEL.md` §3.10, §3.11, §3.13). Stessa
 * forma del pattern già usato per `MediaMap`: senza la mappa, il blocco resta un
 * segnaposto (l'anteprima non sempre la passa).
 */

export interface SliderSlideData {
  readonly position: number;
  readonly mediaId: string | null;
  readonly heading: string | null;
  readonly body: string | null;
  readonly linkUrl: string | null;
  readonly linkLabel: string | null;
  readonly settings: unknown;
}

export interface SliderData {
  readonly id: string;
  readonly key: string;
  readonly settings: unknown;
  readonly slides: readonly SliderSlideData[];
}

export type SlidersMap = Readonly<Record<string, SliderData>>;

/** Un campo della definizione del form (ADR-010 §4.1–§4.2). */
export interface FormFieldData {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly required: boolean;
  readonly order: number;
  readonly description: string | null;
  readonly options: Readonly<Record<string, unknown>>;
}

/** Il rimando di pagamento di DR-039: importo e collegamento, se configurato. */
export interface FormPaymentData {
  readonly amount: number | null;
  readonly url: string | null;
}

export interface FormData {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly confirmationMessage: string | null;
  readonly requiresPayment: boolean;
  readonly fields: readonly FormFieldData[];
  readonly payment: FormPaymentData | null;
  /** Testo del pulsante della sorgente (`submit_text`, `submit_text_processing`). */
  readonly submitText?: string | null;
  readonly submitTextProcessing?: string | null;
}

export type FormsMap = Readonly<Record<string, FormData>>;

/** Un articolo nell'elenco di `post_list`, già filtrato e ordinato dal servizio. */
export interface PostListItem {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly excerpt: string | null;
  /** Il riassunto scritto a mano, o le prime parole del testo, come `get_the_excerpt()`. */
  readonly summary: string | null;
  /** Vero se `summary` è stato tagliato: si aggiunge il link «leggi tutto». */
  readonly summaryTruncated: boolean;
  readonly featuredMediaId: string | null;
  readonly publishedAt: string | null;
}

/** Chiave l'identificativo del blocco `post_list`: più elenchi nella stessa pagina. */
export type PostListsMap = Readonly<Record<string, readonly PostListItem[]>>;
