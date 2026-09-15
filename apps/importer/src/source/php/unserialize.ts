/**
 * Lettore del formato serializzato di PHP (`IMPORTER-DESIGN.md` §3.8). Scritto
 * in casa: le lunghezze del formato sono in **byte**, non in caratteri, e un
 * lettore che confonde le due cose rompe ogni stringa con un accento.
 *
 * Riconosce `N;` `b:` `i:` `d:` `s:` `a:`. Gli oggetti `O:` non si accettano:
 * nessuna delle chiavi classificate ne contiene, e un `O:` comparso è un fatto
 * nuovo — si segnala come errore invece di essere interpretato alla cieca.
 */

export type PhpValue = null | boolean | number | string | readonly PhpValue[] | PhpMap;
export type PhpMap = ReadonlyMap<string | number, PhpValue>;

export class PhpUnserializeError extends Error {
  constructor(
    message: string,
    public readonly offset: number,
  ) {
    super(message);
    this.name = 'PhpUnserializeError';
  }
}

/**
 * Analizza una stringa PHP serializzata. Lavora sui **byte** UTF-8, perché le
 * lunghezze dichiarate da `s:N:"..."` sono in byte: una stringa `"città"`
 * dichiara una lunghezza maggiore del numero di caratteri.
 */
export function phpUnserialize(input: string): PhpValue {
  const bytes = Buffer.from(input, 'utf8');
  const [value, next] = parseValue(bytes, 0);
  const trailing = bytes.subarray(next).toString('utf8').trim();
  if (trailing.length > 0) {
    throw new PhpUnserializeError(`testo in eccesso dopo il valore letto: ${JSON.stringify(trailing.slice(0, 40))}`, next);
  }
  return value;
}

function parseValue(bytes: Buffer, offset: number): [PhpValue, number] {
  const tag = String.fromCharCode(bytes[offset] ?? 0);
  switch (tag) {
    case 'N':
      expect(bytes, offset + 1, ';');
      return [null, offset + 2];
    case 'b': {
      expect(bytes, offset + 1, ':');
      const digit = String.fromCharCode(bytes[offset + 2] ?? 0);
      expect(bytes, offset + 3, ';');
      return [digit === '1', offset + 4];
    }
    case 'i': {
      expect(bytes, offset + 1, ':');
      const end = indexOfByte(bytes, ';'.charCodeAt(0), offset + 2);
      const raw = bytes.subarray(offset + 2, end).toString('latin1');
      return [Number(raw), end + 1];
    }
    case 'd': {
      expect(bytes, offset + 1, ':');
      const end = indexOfByte(bytes, ';'.charCodeAt(0), offset + 2);
      const raw = bytes.subarray(offset + 2, end).toString('latin1');
      return [Number(raw), end + 1];
    }
    case 's': {
      expect(bytes, offset + 1, ':');
      const lengthEnd = indexOfByte(bytes, ':'.charCodeAt(0), offset + 2);
      const byteLength = Number(bytes.subarray(offset + 2, lengthEnd).toString('latin1'));
      const stringStart = lengthEnd + 2; // salta ':"'
      const stringEnd = stringStart + byteLength;
      const value = bytes.subarray(stringStart, stringEnd).toString('utf8');
      expect(bytes, stringEnd, '"');
      expect(bytes, stringEnd + 1, ';');
      return [value, stringEnd + 2];
    }
    case 'a': {
      expect(bytes, offset + 1, ':');
      const countEnd = indexOfByte(bytes, ':'.charCodeAt(0), offset + 2);
      const count = Number(bytes.subarray(offset + 2, countEnd).toString('latin1'));
      expect(bytes, countEnd + 1, '{');
      let cursor = countEnd + 2;
      const map = new Map<string | number, PhpValue>();
      for (let i = 0; i < count; i += 1) {
        const [key, afterKey] = parseValue(bytes, cursor);
        const [value, afterValue] = parseValue(bytes, afterKey);
        map.set(key as string | number, value);
        cursor = afterValue;
      }
      expect(bytes, cursor, '}');
      return [map, cursor + 1];
    }
    case 'O':
      throw new PhpUnserializeError(
        "oggetto PHP ('O:') incontrato: nessuna chiave classificata ne contiene, è un fatto nuovo da trattare",
        offset,
      );
    default:
      throw new PhpUnserializeError(`marcatore di tipo non riconosciuto: '${tag}'`, offset);
  }
}

function indexOfByte(bytes: Buffer, byte: number, from: number): number {
  const index = bytes.indexOf(byte, from);
  if (index === -1) {
    throw new PhpUnserializeError(`carattere atteso '${String.fromCharCode(byte)}' non trovato`, from);
  }
  return index;
}

function expect(bytes: Buffer, offset: number, char: string): void {
  const actual = String.fromCharCode(bytes[offset] ?? 0);
  if (actual !== char) {
    throw new PhpUnserializeError(`atteso '${char}' alla posizione ${offset}, trovato '${actual}'`, offset);
  }
}

/** Converte un `PhpValue` in una struttura JSON-compatibile, per i test e per il rapporto. */
export function phpValueToJson(value: PhpValue): unknown {
  if (value instanceof Map) {
    const isSequential = isSequentialArray(value);
    if (isSequential) {
      return Array.from(value.values()).map(phpValueToJson);
    }
    const out: Record<string, unknown> = {};
    for (const [key, v] of value) out[String(key)] = phpValueToJson(v);
    return out;
  }
  return value;
}

function isSequentialArray(map: PhpMap): boolean {
  let expected = 0;
  for (const key of map.keys()) {
    if (key !== expected) return false;
    expected += 1;
  }
  return true;
}
