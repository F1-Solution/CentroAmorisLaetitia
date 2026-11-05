import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Logger } from './derivatives.js';
import {
  ScrubTooLargeError,
  ScrubUnavailableError,
  ScrubUnreadableError,
  scrubFile,
  type ScrubTools,
} from './scrub.js';

/**
 * Servizio di pulizia su rete interna (DR-359, DR-361): riceve un PDF o un MP4 dall'API, lo
 * ripulisce con `scrubFile` e lo rimanda. Riconosce l'API dal gettone condiviso (DR-362).
 * Nel log solo programma, uscita e durata, mai il contenuto.
 */

export interface ScrubServerOptions {
  readonly token: string;
  readonly tools: ScrubTools;
  /** File più grandi si rifiutano con 413 prima di tenerli in memoria. */
  readonly maxBodyBytes: number;
  readonly log?: Logger;
}

/** Pulizie insieme al massimo, come il semaforo dell'API: resta nel limite di memoria del contenitore. */
export const MAX_ACTIVE = 1;

const MIMES: ReadonlySet<string> = new Set(['application/pdf', 'video/mp4']);

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Confronto a tempo costante del gettone: si confrontano le impronte, di lunghezza fissa. */
function isAuthorized(header: string | undefined, expected: Buffer): boolean {
  const match = /^Bearer (.+)$/.exec(header ?? '');
  return match?.[1] !== undefined && timingSafeEqual(digest(match[1]), expected);
}

/** Risposta JSON a una richiesta già letta per intero. */
function sendJson(response: ServerResponse, status: number, body: object): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

/** Rifiuto prima di leggere il file (gettone, tipo, servizio occupato): risposta subito, connessione chiusa. */
function refuse(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  body: object,
): void {
  const unread = !request.complete;
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...(unread ? { connection: 'close' } : {}),
  });
  response.end(JSON.stringify(body), () => {
    if (unread) request.destroy();
  });
}

/** Scarta il resto del corpo fino a `limit` byte, così il cliente legge il 413 invece di una connessione interrotta. */
function drain(request: IncomingMessage, limit: number): Promise<boolean> {
  if (request.complete) return Promise.resolve(true);
  if (request.destroyed) return Promise.resolve(false);
  return new Promise((resolve) => {
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        request.destroy();
        resolve(false);
      }
    });
    request.on('end', () => resolve(true));
    request.on('error', () => resolve(false));
    request.on('close', () => resolve(request.complete));
    request.resume();
  });
}

class BodyTooLargeError extends Error {}

/** Legge il corpo al massimo per `limit` byte; oltre, smette di tenerlo e lascia il resto a `drain`. */
function readBody(request: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(request.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) {
    return Promise.reject(new BodyTooLargeError());
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        request.off('data', onData);
        request.off('end', onEnd);
        request.pause();
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => resolve(Buffer.concat(chunks));
    request.on('data', onData);
    request.on('end', onEnd);
    request.once('error', reject);
    request.once('close', () => {
      if (!request.complete) reject(new Error('richiesta interrotta'));
    });
  });
}

/** Limite del file ripulito chiesto dall'API: intero positivo, oppure nessun limite. */
function maxBytesOf(header: string | string[] | undefined): number | null {
  if (header === undefined) return Number.POSITIVE_INFINITY;
  const value = Number(header);
  return typeof header === 'string' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** Legge il file, lo ripulisce e risponde con lo stesso esito della pulizia locale. */
async function scrubAndReply(
  request: IncomingMessage,
  response: ServerResponse,
  options: ScrubServerOptions,
  mime: string,
  maxBytes: number,
): Promise<void> {
  let body: Buffer;
  try {
    body = await readBody(request, options.maxBodyBytes);
  } catch (error) {
    // Si scarta fino al doppio del limite, senza tenerlo: oltre, la connessione si chiude.
    if (error instanceof BodyTooLargeError && (await drain(request, 2 * options.maxBodyBytes))) {
      sendJson(response, 413, { error: 'too-large' });
    } else {
      response.destroy();
    }
    return;
  }
  try {
    const cleaned = await scrubFile(mime, body, options.tools, maxBytes, options.log);
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': cleaned.length,
    });
    response.end(cleaned);
  } catch (error) {
    if (error instanceof ScrubTooLargeError) {
      sendJson(response, 413, { error: 'too-large' });
    } else if (error instanceof ScrubUnreadableError) {
      options.log?.warn?.({ ...error.trace }, 'file rifiutato dalla pulizia dei metadati');
      sendJson(response, 422, { error: 'unreadable', trace: error.trace });
    } else if (error instanceof ScrubUnavailableError) {
      options.log?.error({ ...error.trace }, 'pulizia dei metadati non disponibile');
      sendJson(response, 503, { error: 'unavailable', trace: error.trace });
    } else {
      throw error;
    }
  }
}

interface Slots {
  active: number;
}

async function handleScrub(
  request: IncomingMessage,
  response: ServerResponse,
  options: ScrubServerOptions,
  token: Buffer,
  slots: Slots,
): Promise<void> {
  if (!isAuthorized(request.headers.authorization, token)) {
    refuse(request, response, 401, { error: 'unauthorized' });
    return;
  }
  const mime = (request.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
  if (!MIMES.has(mime)) {
    refuse(request, response, 415, { error: 'unsupported-type' });
    return;
  }
  const maxBytes = maxBytesOf(request.headers['x-max-bytes']);
  if (maxBytes === null) {
    refuse(request, response, 400, { error: 'bad-max-bytes' });
    return;
  }
  if (slots.active >= MAX_ACTIVE) {
    refuse(request, response, 503, { error: 'busy' });
    return;
  }
  slots.active += 1;
  try {
    await scrubAndReply(request, response, options, mime, maxBytes);
  } finally {
    slots.active -= 1;
  }
}

/** Crea il servizio; l'avvio (`listen`) resta a chi lo usa. */
export function createScrubServer(options: ScrubServerOptions): Server {
  const token = digest(options.token);
  const slots: Slots = { active: 0 };
  return createServer((request, response) => {
    const path = (request.url ?? '').split('?')[0];
    if (path === '/health/live' && (request.method === 'GET' || request.method === 'HEAD')) {
      refuse(request, response, 200, { status: 'ok' });
      return;
    }
    if (path !== '/scrub' || request.method !== 'POST') {
      refuse(request, response, 404, { error: 'not-found' });
      return;
    }
    handleScrub(request, response, options, token, slots).catch(() => {
      options.log?.error({}, 'errore inatteso del servizio di pulizia');
      if (!response.headersSent) refuse(request, response, 500, { error: 'internal' });
      else response.destroy();
    });
  });
}
