/**
 * Serializzatore del campo `err` di ogni riga di log dell'API. Un errore di query
 * (Drizzle, postgres-js o qualunque valore con `query` e parametri) può portare
 * nel messaggio, nei parametri, in `detail` o in `where` i valori scritti, quindi
 * dati personali: si riduce a nome, codice SQL e nome del vincolo. Vale solo per
 * ciò che passa sotto `err`: si scrive sempre `log.error({ err }, 'messaggio')`,
 * mai `log.error(err)`.
 */

/** Ciò che resta nel log di un errore di query. */
export interface QueryErrorFields {
  readonly type?: string;
  readonly code?: string;
  readonly constraint?: string;
}

/** Profondità massima seguita: basta per gli involucri reali e ferma le strutture patologiche. */
const MAX_DEPTH = 5;

/** Elementi tenuti per ogni array: il resto si conta e si omette. */
const MAX_ITEMS = 50;

/** Codice SQLSTATE: cinque caratteri, cifre e maiuscole. */
const SQLSTATE = /^[0-9A-Z]{5}$/;

type Fields = Record<string, unknown>;

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/** Il nome della classe, come lo scrive il serializzatore predefinito (Drizzle lascia `name` a «Error»). */
const typeOf = (error: Error): string => asText(error.constructor?.name) ?? error.name;

/** Vero per un errore che dichiara una query: Drizzle, postgres-js o con `query` e parametri. */
export function isQueryError(error: Error): boolean {
  const type = typeOf(error);
  if (type === 'DrizzleQueryError' || type === 'PostgresError') return true;
  return 'query' in error && ('params' in error || 'parameters' in error);
}

/** Oggetto che non è un `Error` ma porta una query: `query` con parametri, o `detail`/`where` con un codice SQL. */
function isQueryLike(value: object): boolean {
  if ('query' in value && ('params' in value || 'parameters' in value)) return true;
  const code = (value as Fields).code;
  return ('detail' in value || 'where' in value) && typeof code === 'string' && SQLSTATE.test(code);
}

/** Codice SQL e vincolo, cercati anche nella causa che Drizzle avvolge. */
function codeAndConstraint(value: object): QueryErrorFields {
  const own = value as Fields;
  const cause = (typeof own.cause === 'object' && own.cause !== null ? own.cause : {}) as Fields;
  const code = asText(own.code) ?? asText(cause.code);
  const constraint = asText(own.constraint_name) ?? asText(cause.constraint_name);
  return { ...(code ? { code } : {}), ...(constraint ? { constraint } : {}) };
}

/** Nome, codice SQL e vincolo di un errore di query. */
export function queryErrorFields(error: Error): QueryErrorFields {
  return { type: typeOf(error), ...codeAndConstraint(error) };
}

const isPlainObject = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
};

/** Un errore ordinario: tipo, messaggio, traccia, campi propri, causa ed errori interni, ciascuno ridotto. */
function plainErrorFields(error: Error, depth: number, ancestors: Set<object>): Fields {
  const fields: Fields = { type: typeOf(error), message: error.message, stack: error.stack };
  for (const [key, value] of Object.entries(error)) {
    if (key !== 'cause' && !(key in fields)) fields[key] = reduce(value, depth + 1, ancestors);
  }
  if (error.cause !== undefined) fields.cause = reduce(error.cause, depth + 1, ancestors);
  // `errors` di AggregateError non è enumerabile: senza questo gli errori interni sparirebbero.
  const inner = (error as { errors?: unknown }).errors;
  if (Array.isArray(inner)) fields.errors = reduce(inner, depth + 1, ancestors);
  return fields;
}

/** Al più `MAX_ITEMS` elementi, ciascuno ridotto, con il conto di quelli omessi. */
function reduceArray(items: readonly unknown[], depth: number, ancestors: Set<object>): unknown[] {
  const kept = items.slice(0, MAX_ITEMS).map((item) => reduce(item, depth + 1, ancestors));
  const omitted = items.length - kept.length;
  return omitted > 0 ? [...kept, `[altri ${omitted} elementi omessi]`] : kept;
}

/** Applica la regola a un valore qualunque; i cicli e la profondità sono limitati. */
function reduce(value: unknown, depth: number, ancestors: Set<object>): unknown {
  if (typeof value !== 'object' || value === null) return value;
  if (value instanceof Error && isQueryError(value)) return queryErrorFields(value);
  if (!(value instanceof Error) && isQueryLike(value)) return codeAndConstraint(value);
  if (ancestors.has(value)) return '[ciclo]';
  if (depth >= MAX_DEPTH) return value instanceof Error ? { type: typeOf(value) } : '[omesso]';
  ancestors.add(value);
  try {
    if (value instanceof Error) return plainErrorFields(value, depth, ancestors);
    if (Array.isArray(value)) return reduceArray(value, depth, ancestors);
    if (!isPlainObject(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, reduce(item, depth + 1, ancestors)]),
    );
  } finally {
    ancestors.delete(value);
  }
}

/** Il valore da scrivere sotto `err`: gli errori di query ridotti, gli altri per esteso. */
export function serializeLogError(value: unknown): unknown {
  return reduce(value, 0, new Set());
}
