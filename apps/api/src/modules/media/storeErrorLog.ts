/** Un errore dell'archivio ridotto ai soli dati non personali, perché il messaggio dell'SDK può citare la chiave. */
export interface StoreErrorFields {
  readonly name: string;
  readonly code?: string;
  readonly httpStatus?: number;
}

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/** Nome, codice e stato HTTP dell'errore: mai il messaggio, la chiave o la traccia. */
export function storeErrorFields(error: unknown): StoreErrorFields {
  if (!(error instanceof Error)) return { name: 'NonError' };
  const raw = error as Error & {
    code?: unknown;
    Code?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  const code = asText(raw.Code) ?? asText(raw.code);
  const status = raw.$metadata?.httpStatusCode;
  return {
    name: error.name,
    ...(code ? { code } : {}),
    ...(typeof status === 'number' ? { httpStatus: status } : {}),
  };
}

/** Vero se l'errore viene dall'SDK dell'archivio, che lo riconosce dai metadati della risposta. */
export const isStoreError = (error: unknown): boolean =>
  error instanceof Error && typeof (error as { $metadata?: unknown }).$metadata === 'object';

/** Che cosa mettere nel campo `err` del log: l'errore ridotto se viene dall'archivio, altrimenti l'errore. */
export const loggableError = (error: unknown): unknown =>
  isStoreError(error) ? storeErrorFields(error) : error;

/** Vero se l'archivio non ha risposto entro i tempi di `createObjectStore` (W6-6: un rifiuto 503, mai un 500). */
export const isStoreTimeout = (error: unknown): boolean =>
  error instanceof Error && error.name === 'TimeoutError';
