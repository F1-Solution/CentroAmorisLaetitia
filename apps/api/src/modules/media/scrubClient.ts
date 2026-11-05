import {
  ScrubTooLargeError,
  ScrubUnavailableError,
  ScrubUnreadableError,
  type ScrubServiceTarget,
  type ScrubTrace,
} from './scrub.js';

/** Cliente del servizio di pulizia (DR-359): stessi esiti della pulizia locale, mai ripiego su di essa (DR-363). */

export type ScrubMime = 'application/pdf' | 'video/mp4';

/** Tempi massimi dei programmi: l'attesa del servizio li supera di poco, per la rete. */
export interface ScrubTimeouts {
  readonly pdfTimeoutMs: number;
  readonly videoTimeoutMs: number;
}

/** Margine sull'attesa per trasferire il file e la risposta sulla rete interna. */
export const SERVICE_MARGIN_MS = 5_000;

const TOOLS: ReadonlySet<unknown> = new Set(['qpdf', 'ffmpeg', 'ffprobe']);

/** Traccia rimandata dal servizio, solo se ha la forma attesa; altrimenti quella del programma principale. */
function traceOf(value: unknown, fallback: ScrubTrace): ScrubTrace {
  const trace = (value as { trace?: Partial<ScrubTrace> } | null)?.trace;
  if (
    trace &&
    TOOLS.has(trace.tool) &&
    (trace.exitCode === null || Number.isInteger(trace.exitCode)) &&
    Number.isFinite(trace.durationMs)
  ) {
    return {
      tool: trace.tool as ScrubTrace['tool'],
      exitCode: trace.exitCode ?? null,
      durationMs: Number(trace.durationMs),
    };
  }
  return fallback;
}

async function jsonOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Invia il file al servizio e ne riceve la copia ripulita; un servizio assente, lento o che rifiuta il gettone è «non disponibile». */
export async function scrubViaService(
  mime: ScrubMime,
  input: Buffer,
  target: ScrubServiceTarget,
  timeouts: ScrubTimeouts,
  maxBytes = Number.POSITIVE_INFINITY,
): Promise<Buffer> {
  const started = Date.now();
  const tool: ScrubTrace['tool'] = mime === 'application/pdf' ? 'qpdf' : 'ffmpeg';
  const unavailable = () =>
    new ScrubUnavailableError({ tool, exitCode: null, durationMs: Date.now() - started });
  const waitMs =
    (mime === 'application/pdf' ? timeouts.pdfTimeoutMs : timeouts.videoTimeoutMs) +
    SERVICE_MARGIN_MS;

  let response: Response;
  try {
    response = await fetch(new URL('/scrub', target.url), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${target.token}`,
        'content-type': mime,
        ...(Number.isFinite(maxBytes) ? { 'x-max-bytes': String(maxBytes) } : {}),
      },
      // Vista sugli stessi byte, senza copia; nessun reindirizzamento: gettone e file vanno solo al servizio.
      body: new Uint8Array(input.buffer, input.byteOffset, input.byteLength),
      redirect: 'error',
      signal: AbortSignal.timeout(waitMs),
    });
  } catch {
    throw unavailable();
  }

  if (response.status === 200) {
    let body: Buffer;
    try {
      body = Buffer.from(await response.arrayBuffer());
    } catch {
      throw unavailable();
    }
    if (body.length === 0) throw new ScrubUnreadableError({ tool, exitCode: null, durationMs: 0 });
    if (body.length > maxBytes) throw new ScrubTooLargeError();
    return body;
  }
  const payload = await jsonOf(response);
  if (response.status === 413) throw new ScrubTooLargeError();
  if (response.status === 422) {
    throw new ScrubUnreadableError(
      traceOf(payload, { tool, exitCode: null, durationMs: Date.now() - started }),
    );
  }
  // 401, 503 e ogni altra risposta: il servizio non può ripulire.
  throw new ScrubUnavailableError(
    traceOf(payload, { tool, exitCode: null, durationMs: Date.now() - started }),
  );
}
