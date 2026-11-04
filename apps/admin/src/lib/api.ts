/**
 * Unico punto da cui l'area amministrativa parla con l'API.
 *
 * Due cose non sono negoziabili e stanno qui perché non si possano scrivere
 * diverse altrove:
 *
 * 1. **I cookie viaggiano sempre** (`credentials: 'include'`). La sessione è
 *    opaca e vive nel cookie `HttpOnly`: non esiste alcun token da tenere in
 *    memoria, e non deve nascere l'abitudine di cercarne uno.
 * 2. **Il doppio invio anti-CSRF** (ADR-007 §3.1 controllo 7). La metà leggibile
 *    del token sta in un cookie non `HttpOnly`; ogni richiesta che modifica dati
 *    la rimanda nell'intestazione. Il solo `SameSite` non basta, e l'ADR lo dice.
 */

import { apiBase } from './apiBase';

const BASE = apiBase();

const CSRF_COOKIE = 'amoris_csrf';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function csrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

/** Un campo che il servizio ha rifiutato, con il motivo. */
export interface ApiErrorDetail {
  readonly path: string;
  readonly message: string;
}

/** Errore dell'API, con il codice che l'API dichiara nel suo involucro. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /**
     * I campi rifiutati, quando il servizio li elenca.
     *
     * **Fino al 2026-09-23 si buttavano via**, e ogni richiesta non valida
     * mostrava «La richiesta non è valida» e nient'altro: chi la leggeva non
     * poteva sapere quale campo correggere. Il servizio glieli manda; era
     * l'interfaccia a non guardarli.
     */
    readonly details: readonly ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Il messaggio con i campi rifiutati in coda, pronto da mostrare. */
  get fullMessage(): string {
    if (this.details.length === 0) return this.message;
    const elenco = this.details
      .map((detail) => (detail.path ? `${detail.path}: ${detail.message}` : detail.message))
      .join('; ');
    return `${this.message} ${elenco}`;
  }
}

export interface ApiOptions {
  readonly method?: string;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};

  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (MUTATING.has(method)) {
    const token = csrfToken();
    if (token) headers['x-csrf-token'] = token;
  }

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: ApiErrorDetail[] };
  } | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'UNKNOWN',
      // Il messaggio che si mostra è quello dell'API: è già scritto in italiano
      // corrente e, sui rifiuti, è deliberatamente identico in casi diversi
      // (ADR-007 §3.1 controllo 9). Riscriverlo qui lo renderebbe più preciso di
      // quanto il servizio intenda essere.
      payload?.error?.message ?? 'Operazione non riuscita.',
      payload?.error?.details ?? [],
    );
  }

  return payload as T;
}
