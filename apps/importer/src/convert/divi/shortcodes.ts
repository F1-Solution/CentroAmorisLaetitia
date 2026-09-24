/**
 * Analizzatore degli shortcode Divi (e non-Divi): `[tag attr="valore"]...[/tag]`
 * oppure autochiudente `[tag attr="valore" /]`. Annidato: `et_pb_section` >
 * `et_pb_row` > `et_pb_column` > `et_pb_text`/`et_pb_image`/…
 *
 * Scritto in casa, come `IMPORTER-DESIGN.md` §2 vuole per il codice di
 * migrazione: nessuna dipendenza nuova. La stessa struttura a pila del
 * commento Gutenberg (`gutenberg/comments.ts`), applicata alla sintassi degli
 * shortcode.
 */

export interface ParsedShortcode {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  /** Contenuto grezzo fra apertura e chiusura, con gli shortcode figli **intatti** (non rimossi). */
  readonly content: string;
  readonly children: readonly ParsedShortcode[];
  readonly raw: string;
  readonly selfClosing: boolean;
  readonly start: number;
  readonly end: number;
}

interface ShortcodeToken {
  readonly kind: 'open' | 'close' | 'void';
  readonly tag: string;
  readonly attrs: Record<string, string>;
  readonly start: number;
  readonly end: number;
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]/]+))/g;

// Attributi con virgolette doppie o singole, o senza virgolette (rari, ma il
// controllo di prova richiede entrambe le forme di virgolette).
const SHORTCODE_RE =
  /\[(\/)?([a-zA-Z][a-zA-Z0-9_]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s\]/]+))*)\s*(\/)?\]/g;

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of raw.matchAll(ATTR_RE)) {
    const name = match[1]!;
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[name] = value;
  }
  return attrs;
}

function tokenize(text: string): ShortcodeToken[] {
  const tokens: ShortcodeToken[] = [];
  for (const match of text.matchAll(SHORTCODE_RE)) {
    const [full, closingSlash, tag, attrsRaw, voidSlash] = match;
    const start = match.index ?? 0;
    const end = start + full.length;
    if (closingSlash) {
      tokens.push({ kind: 'close', tag: tag!, attrs: {}, start, end });
    } else if (voidSlash) {
      tokens.push({ kind: 'void', tag: tag!, attrs: parseAttrs(attrsRaw ?? ''), start, end });
    } else {
      tokens.push({ kind: 'open', tag: tag!, attrs: parseAttrs(attrsRaw ?? ''), start, end });
    }
  }
  return tokens;
}

interface Frame {
  readonly tag: string;
  readonly attrs: Record<string, string>;
  readonly start: number;
  readonly children: ParsedShortcode[];
  contentParts: string[];
}

/**
 * Analizza il testo per intero e restituisce gli shortcode di primo livello.
 * Uno shortcode aperto ma mai chiuso prima della fine del testo si chiude
 * comunque, con tutto ciò che segue come contenuto: non si perde nulla per un
 * tag di chiusura mancante (fedeltà, `ADR-005` §4).
 */
export function parseShortcodes(text: string): ParsedShortcode[] {
  const tokens = tokenize(text);
  const root: ParsedShortcode[] = [];
  const stack: Frame[] = [];

  let cursor = 0;

  const currentParts = (): string[] => {
    const top = stack[stack.length - 1];
    return top ? top.contentParts : [];
  };

  const flushTextBefore = (tokenStart: number): void => {
    if (tokenStart > cursor) {
      currentParts().push(text.slice(cursor, tokenStart));
    }
  };

  const pushFinished = (block: ParsedShortcode): void => {
    if (stack.length > 0) {
      stack[stack.length - 1]!.children.push(block);
    } else {
      root.push(block);
    }
  };

  for (const token of tokens) {
    flushTextBefore(token.start);
    cursor = token.end;

    if (token.kind === 'void') {
      pushFinished({
        tag: token.tag,
        attrs: token.attrs,
        content: '',
        children: [],
        raw: text.slice(token.start, token.end),
        selfClosing: true,
        start: token.start,
        end: token.end,
      });
      continue;
    }

    if (token.kind === 'open') {
      stack.push({
        tag: token.tag,
        attrs: token.attrs,
        start: token.start,
        children: [],
        contentParts: [],
      });
      continue;
    }

    // close: chiude il livello più interno con lo stesso tag. Un tag di
    // chiusura senza apertura corrispondente si ignora.
    const matchIndex = [...stack].reverse().findIndex((frame) => frame.tag === token.tag);
    if (matchIndex === -1) {
      continue;
    }
    // Chiude ogni livello più interno fino al tag corrispondente incluso: un
    // caso reale di annidamento scorretto non deve far perdere il resto.
    for (let i = 0; i <= matchIndex; i += 1) {
      const frame = stack.pop()!;
      const end = i === 0 ? token.end : frame.start;
      const content = frame.contentParts.join('');
      pushFinished({
        tag: frame.tag,
        attrs: frame.attrs,
        content,
        children: frame.children,
        raw: text.slice(frame.start, end),
        selfClosing: false,
        start: frame.start,
        end,
      });
    }
  }

  // Ciò che resta aperto alla fine del testo si chiude comunque: nulla si perde.
  while (stack.length > 0) {
    const frame = stack.pop()!;
    const content = frame.contentParts.join('') + text.slice(cursor);
    cursor = text.length;
    pushFinished({
      tag: frame.tag,
      attrs: frame.attrs,
      content,
      children: frame.children,
      raw: text.slice(frame.start),
      selfClosing: false,
      start: frame.start,
      end: text.length,
    });
  }

  return root;
}
