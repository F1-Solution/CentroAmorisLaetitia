import { DEFAULT_MEDIA_LIMITS } from '@amoris/contracts';
import { z } from 'zod';
import type { ScrubTools } from './modules/media/scrub.js';

/**
 * Configurazione del servizio di pulizia (DR-359, DR-361), letta dalle variabili d'ambiente.
 *
 * Il limite dei file ricevuti non ha una chiave propria: è il più grande fra
 * `MEDIA_MAX_PDF_BYTES` e `MEDIA_MAX_VIDEO_BYTES`, le stesse chiavi dell'API, così un file
 * accettato dall'API non torna mai «troppo grande» dal servizio (1F-W2 T6).
 */

const schema = z.object({
  SCRUB_HOST: z.string().min(1).default('127.0.0.1'),
  SCRUB_PORT: z.coerce.number().int().min(0).max(65535).default(3003),
  /** Gettone condiviso con l'API (DR-362): almeno 32 caratteri, nessun predefinito. */
  SCRUB_SERVICE_TOKEN: z
    .string({ error: 'manca, ed è obbligatoria: è un segreto e non ha valore predefinito' })
    .min(32, 'è troppo corta: servono almeno 32 caratteri'),
  MEDIA_MAX_PDF_BYTES: z.coerce.number().int().min(1).default(DEFAULT_MEDIA_LIMITS.pdfBytes),
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().int().min(1).default(DEFAULT_MEDIA_LIMITS.videoBytes),
  QPDF_PATH: z.string().min(1).default('qpdf'),
  FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  FFPROBE_PATH: z.string().min(1).default('ffprobe'),
  SCRUB_PDF_TIMEOUT_MS: z.coerce.number().int().min(1).default(30000),
  SCRUB_VIDEO_TIMEOUT_MS: z.coerce.number().int().min(1).default(120000),
});

/** Chiavi lette dal servizio di pulizia: l'esempio d'ambiente di produzione le elenca (1F-W2 T8). */
export const SCRUB_SERVER_CONFIG_KEYS = Object.keys(schema.shape) as readonly string[];

export interface ScrubServerConfig {
  readonly host: string;
  readonly port: number;
  readonly token: string;
  /** File ricevuti al massimo: il più grande dei limiti di PDF e video dell'API. */
  readonly maxBodyBytes: number;
  readonly tools: ScrubTools;
}

export type ScrubServerConfigResult =
  | { readonly ok: true; readonly config: ScrubServerConfig }
  | { readonly ok: false; readonly issues: readonly string[] };

/** Valida l'ambiente; gli errori nominano la chiave e non ne ripetono mai il valore. */
export function readScrubServerConfig(
  env: Readonly<Record<string, string | undefined>>,
): ScrubServerConfigResult {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || '(sconosciuta)'}: ${issue.message}`,
      ),
    };
  }
  const data = parsed.data;
  return {
    ok: true,
    config: {
      host: data.SCRUB_HOST,
      port: data.SCRUB_PORT,
      token: data.SCRUB_SERVICE_TOKEN,
      maxBodyBytes: Math.max(data.MEDIA_MAX_PDF_BYTES, data.MEDIA_MAX_VIDEO_BYTES),
      tools: {
        qpdfPath: data.QPDF_PATH,
        ffmpegPath: data.FFMPEG_PATH,
        ffprobePath: data.FFPROBE_PATH,
        pdfTimeoutMs: data.SCRUB_PDF_TIMEOUT_MS,
        videoTimeoutMs: data.SCRUB_VIDEO_TIMEOUT_MS,
      },
    },
  };
}

/**
 * La cartella temporanea deve contenere l'originale e il file ripulito del caso più grande;
 * con un `tmpfs` troppo piccolo il servizio non parte invece di fallire a metà di un caricamento.
 */
export function tmpSpaceIssue(freeBytes: number, maxBodyBytes: number): string | undefined {
  const needed = 2 * maxBodyBytes;
  if (freeBytes >= needed) return undefined;
  const mib = (bytes: number) => Math.ceil(bytes / (1024 * 1024));
  return `TMPDIR: spazio libero ${mib(freeBytes)} MiB, ne servono almeno ${mib(needed)} MiB (originale e file ripulito del caso più grande)`;
}
