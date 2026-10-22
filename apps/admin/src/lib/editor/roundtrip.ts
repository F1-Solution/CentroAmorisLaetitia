/**
 * L'andata e ritorno: criterio 1D-36 e requisito F-05. *Aprire un contenuto e
 * salvarlo senza modifiche non deve cambiare né i blocchi né l'HTML reso.*
 *
 * È il criterio discriminante della fase, e qui sta il punto in cui può
 * rompersi: se l'editor normalizza il documento appena lo apre — riordinando
 * chiavi, aggiungendo proprietà predefinite, riscrivendo il markup a modo
 * proprio — la parità approvata decade al primo salvataggio, senza che nulla
 * segnali un guasto.
 *
 * La regola che lo impedisce è una sola: **ciò che non si tocca non si
 * riscrive.** Il documento aperto è quello letto, byte per byte; la validazione
 * serve a dire se è valido, non a metterlo in forma. Quando la forma salvata e
 * quella canonica non coincidono, la differenza si **mostra** invece di essere
 * applicata di nascosto.
 *
 * Con DR-068 il salvataggio automatico scrive su una copia di lavoro e non su
 * `contents`: questo modulo è ciò che il comando esplicito di pubblicazione
 * usa, ed è **sul contenuto** che il criterio si verifica, non sulla bozza.
 */
import {
  blockDocumentSchema,
  extractContentText,
  serializeBlockDocument,
  type BlockDocument,
} from '@amoris/blocks';

/** Ultima modifica di un contenuto: `GET /contents/:id` (wave 1G-W2). */
export type LastChange =
  | { readonly actorLabel: string; readonly occurredAt: string }
  | { readonly importedAt: string }
  | null;

/** Layout della pagina (DR-139). */
export type PageLayout = 'right_sidebar' | 'full_width' | 'no_sidebar';

/** Immagine in evidenza di una notizia, come la restituisce `GET /contents/:id` (wave 1G-W4). */
export interface FeaturedMedia {
  readonly id: string;
  readonly title: string | null;
  readonly thumbnailUrl: string;
}

export interface ContentDetail {
  readonly id: string;
  readonly type: 'page' | 'post';
  readonly status: 'draft' | 'published' | 'archived';
  readonly slug: string;
  readonly path: string;
  /** Pagina genitore; sempre nulla per una notizia (S2). */
  readonly parentId: string | null;
  readonly title: string;
  readonly excerpt: string | null;
  readonly showTitle: boolean;
  readonly pageLayout: PageLayout;
  readonly blocks: unknown;
  readonly contentHtml: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
  /** Ultima modifica dal registro, o data della sorgente importata (D127). */
  readonly lastChange?: LastChange;
  /** Pagina iniziale: il sito la serve a `/` qualunque sia il suo percorso (S3). */
  readonly isHome?: boolean;
  /** Categorie assegnate a una notizia (wave 1G-W4). */
  readonly termIds?: readonly string[];
  /** Immagine in evidenza di una notizia, o nulla (wave 1G-W4). */
  readonly featuredMedia?: FeaturedMedia | null;
}

export interface EditorState {
  readonly title: string;
  readonly excerpt: string | null;
  readonly document: BlockDocument;
}

export interface SavePayload {
  readonly title: string;
  readonly excerpt: string | null;
  readonly blocks: BlockDocument;
  readonly contentHtml: string;
  readonly contentText: string;
}

/** Uguaglianza strutturale che **non** dipende dall'ordine delle chiavi. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.hasOwn(right, key) && deepEqual(left[key], right[key]));
}

export type OpenOutcome =
  | { readonly ok: true; readonly state: EditorState; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly reason: string };

/**
 * Apre un contenuto nell'editor.
 *
 * Il documento che entra nello stato è **quello letto**, non quello prodotto da
 * Zod: `parse` applicherebbe le proprietà predefinite degli schemi e
 * riscriverebbe un documento che nessuno ha modificato. Quando la differenza
 * esiste, diventa un avviso.
 */
export function openContent(content: ContentDetail): OpenOutcome {
  const parsed = blockDocumentSchema.safeParse(content.blocks);
  if (!parsed.success) {
    return {
      ok: false,
      reason:
        'Il documento a blocchi salvato non è valido secondo il modello: l’editor non lo apre, perché salvarlo lo riscriverebbe.',
    };
  }

  const stored = content.blocks as BlockDocument;
  const warnings: string[] = [];
  const canonical = deepEqual(parsed.data, stored);

  if (!canonical) {
    warnings.push(
      'Il documento salvato non è nella forma canonica del modello: salvarlo lo completerebbe con le proprietà predefinite. Finché non si modifica nulla, resta com’è.',
    );
  }

  // Il confronto sull'HTML ha senso solo su un documento canonico: la
  // serializzazione presuppone le proprietà che alla forma non canonica
  // mancano, e il primo avviso ha già detto ciò che c'è da dire.
  if (canonical && serializeBlockDocument(stored) !== content.contentHtml) {
    warnings.push(
      'L’HTML salvato non coincide con quello che i blocchi producono oggi: al primo salvataggio verrebbe rigenerato.',
    );
  }

  return {
    ok: true,
    state: { title: content.title, excerpt: content.excerpt, document: stored },
    warnings,
  };
}

export type SaveOutcome =
  | { readonly ok: true; readonly payload: SavePayload }
  | { readonly ok: false; readonly reason: string };

/**
 * Ciò che si scriverebbe in `contents`. Puro: nessuna data, nessun valore
 * casuale.
 *
 * Il documento passa dallo schema **prima** di essere serializzato. Non è una
 * normalizzazione di comodo: è la validazione al confine che `CLAUDE.md`
 * richiede, ed è anche ciò che rende la serializzazione totale su un documento
 * arrivato dal database in forma incompleta. Su un documento già canonico —
 * il caso normale, e quello che il criterio 1D-36 misura — `parse` restituisce
 * un oggetto uguale a quello che ha ricevuto, quindi non cambia nulla.
 */
export function savePayloadOf(state: EditorState): SaveOutcome {
  const parsed = blockDocumentSchema.safeParse(state.document);
  if (!parsed.success) {
    return {
      ok: false,
      reason:
        'Il documento contiene un blocco che il modello non accetta: la modifica non si può salvare. Annullarla riporta il contenuto com’era.',
    };
  }

  const contentHtml = serializeBlockDocument(parsed.data);
  return {
    ok: true,
    payload: {
      title: state.title,
      excerpt: state.excerpt,
      blocks: parsed.data,
      contentHtml,
      contentText: extractContentText(contentHtml),
    },
  };
}

/**
 * Vero quando salvare non cambierebbe nulla. Non è un'ottimizzazione: è il
 * criterio 1D-36 detto in codice, e l'editor lo usa per **non scrivere
 * affatto** invece che per scrivere gli stessi valori.
 */
export function isUnchanged(content: ContentDetail, state: EditorState): boolean {
  const outcome = savePayloadOf(state);
  if (!outcome.ok) return false;
  const { payload } = outcome;
  return (
    payload.title === content.title &&
    // Estratto vuoto e assente sono la stessa cosa: l'API salva il vuoto come `NULL`.
    (payload.excerpt || null) === (content.excerpt || null) &&
    payload.contentHtml === content.contentHtml &&
    deepEqual(payload.blocks, content.blocks)
  );
}
