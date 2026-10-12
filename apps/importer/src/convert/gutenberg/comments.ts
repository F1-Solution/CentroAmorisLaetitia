/**
 * Analizzatore dei commenti di delimitazione dei blocchi Gutenberg
 * (`<!-- wp:nome {"attr":1} -->...<!-- /wp:nome -->`, o autochiudente
 * `<!-- wp:nome {...} /-->`). Riproduce, in forma semplificata, la grammatica
 * di `@wordpress/block-serialization-default-parser`: non è quel pacchetto —
 * nessuna dipendenza nuova (`CLAUDE.md`, `PLAN.md` §5) — ma segue la stessa
 * struttura a pila.
 *
 * Ogni blocco riconosciuto porta `innerHtml`: il contenuto grezzo fra apertura
 * e chiusura, con i commenti dei blocchi figli **rimossi** ma il loro markup
 * **conservato**. È la semplificazione che rende inutile un albero separato
 * per `wp:list-item`: il suo `<li>` resta nell'HTML del genitore `wp:list`,
 * esattamente come lo rende WordPress.
 */

export interface ParsedGutenbergBlock {
  readonly blockName: string;
  readonly attrs: Record<string, unknown>;
  /** Contenuto grezzo, senza i commenti di delimitazione, propri o dei figli. */
  readonly innerHtml: string;
  /** I blocchi figli riconosciuti, nell'ordine del documento. */
  readonly innerBlocks: readonly ParsedGutenbergBlock[];
  readonly start: number;
  readonly end: number;
}

interface CommentToken {
  readonly kind: 'open' | 'close' | 'void';
  readonly blockName: string;
  readonly attrs: Record<string, unknown>;
  readonly start: number;
  readonly end: number;
}

// Un livello di oggetto annidato negli attributi è sufficiente per i casi
// reali (`{"level":2}`, `{"mediaWidth":40,"mediaPosition":"right"}`).
const COMMENT_RE =
  /<!--\s*(\/)?wp:([a-zA-Z][a-zA-Z0-9_-]*(?:\/[a-zA-Z][a-zA-Z0-9_-]*)?)\s*((?:\{(?:[^{}]|\{[^{}]*\})*\})?)\s*(\/)?-->/g;

function tokenize(text: string): CommentToken[] {
  const tokens: CommentToken[] = [];
  for (const match of text.matchAll(COMMENT_RE)) {
    const [full, closingSlash, blockName, attrsJson, voidSlash] = match;
    const start = match.index ?? 0;
    const end = start + full.length;
    let attrs: Record<string, unknown> = {};
    if (attrsJson) {
      try {
        const parsed: unknown = JSON.parse(attrsJson);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          attrs = parsed as Record<string, unknown>;
        }
      } catch {
        // JSON non valido: attributi vuoti, non si fa fallire l'intera conversione per questo.
        attrs = {};
      }
    }
    if (closingSlash) {
      tokens.push({ kind: 'close', blockName: blockName!, attrs, start, end });
    } else if (voidSlash) {
      tokens.push({ kind: 'void', blockName: blockName!, attrs, start, end });
    } else {
      tokens.push({ kind: 'open', blockName: blockName!, attrs, start, end });
    }
  }
  return tokens;
}

interface Frame {
  readonly blockName: string;
  readonly attrs: Record<string, unknown>;
  readonly start: number;
  contentStart: number;
  readonly children: ParsedGutenbergBlock[];
  htmlParts: string[];
}

/**
 * Analizza l'intero `post_content` e restituisce i blocchi di primo livello.
 * Il testo fra un blocco e l'altro, al primo livello, di norma è solo spazio e si
 * scarta. Quando non lo è diventa un blocco `freeform` (DR-116): sulla home della
 * sorgente c'era l'elenco degli articoli, scritto in un paragrafo fuori dai blocchi.
 */
export function parseGutenbergBlocks(text: string): ParsedGutenbergBlock[] {
  const tokens = tokenize(text);
  const root: ParsedGutenbergBlock[] = [];
  const stack: Frame[] = [];

  const currentHtmlParts = (): string[] => {
    const top = stack[stack.length - 1];
    return top ? top.htmlParts : [];
  };

  let cursor = 0;

  const flushTextBefore = (tokenStart: number): void => {
    if (tokenStart <= cursor) return;
    const chunk = text.slice(cursor, tokenStart);
    if (stack.length > 0) {
      currentHtmlParts().push(chunk);
    } else if (chunk.trim() !== '') {
      root.push({
        blockName: 'freeform',
        attrs: {},
        innerHtml: chunk,
        innerBlocks: [],
        start: cursor,
        end: tokenStart,
      });
    }
  };

  for (const token of tokens) {
    flushTextBefore(token.start);
    cursor = token.end;

    // `wp:list-item` non ha un blocco corrispondente nel modello (§4 di
    // `divi-shortcode-strategy.md`): il suo `<li>` deve restare nell'HTML
    // del `wp:list` che lo contiene, come lo scrive WordPress. Si tratta il
    // suo commento come invisibile — tolto dal flusso, senza aprire un
    // livello separato — cosi' il contenuto confluisce nel frame corrente.
    if (token.blockName === 'list-item') {
      continue;
    }

    if (token.kind === 'void') {
      const block: ParsedGutenbergBlock = {
        blockName: token.blockName,
        attrs: token.attrs,
        innerHtml: '',
        innerBlocks: [],
        start: token.start,
        end: token.end,
      };
      if (stack.length > 0) {
        stack[stack.length - 1]!.children.push(block);
      } else {
        root.push(block);
      }
      continue;
    }

    if (token.kind === 'open') {
      stack.push({
        blockName: token.blockName,
        attrs: token.attrs,
        start: token.start,
        contentStart: token.end,
        children: [],
        htmlParts: [],
      });
      continue;
    }

    // close: chiude il livello più interno che porta lo stesso nome. Se non
    // corrisponde, si ignora — un commento di chiusura senza apertura non
    // deve far fallire l'intera conversione di un contenuto.
    const top = stack[stack.length - 1];
    if (!top || top.blockName !== token.blockName) {
      continue;
    }
    stack.pop();
    const block: ParsedGutenbergBlock = {
      blockName: top.blockName,
      attrs: top.attrs,
      innerHtml: top.htmlParts.join(''),
      innerBlocks: top.children,
      start: top.start,
      end: token.end,
    };
    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(block);
    } else {
      root.push(block);
    }
  }

  // Il testo dopo l'ultimo commento.
  flushTextBefore(text.length);

  return root;
}
