/**
 * Invio di un file all'API.
 *
 * Sta accanto ad `api()` e non dentro: quella funzione serializza in JSON e
 * dichiara `content-type: application/json`, mentre qui il corpo è
 * `multipart/form-data` e l'intestazione **non va scritta a mano** — il browser
 * la compone da sé con il delimitatore, e imporla la romperebbe.
 *
 * Tutto il resto è identico e per la stessa ragione: i cookie viaggiano sempre,
 * e il doppio invio anti-CSRF di ADR-007 §3.1 controllo 7 vale anche qui,
 * perché queste sono richieste che modificano dati.
 */

import { ApiError } from './api';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

const CSRF_COOKIE = 'amoris_csrf';

function csrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
}

export interface UploadOptions {
  readonly method?: 'POST' | 'PUT';
  readonly signal?: AbortSignal;
}

export async function uploadFile<T>(
  path: string,
  file: File,
  options: UploadOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = csrfToken();
  if (token) headers['x-csrf-token'] = token;

  const form = new FormData();
  form.append('file', file, file.name);

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'POST',
    headers,
    credentials: 'include',
    body: form,
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'UNKNOWN',
      payload?.error?.message ?? 'Operazione non riuscita.',
    );
  }

  return payload as T;
}
