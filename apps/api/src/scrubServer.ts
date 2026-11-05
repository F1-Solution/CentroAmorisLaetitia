import { DEFAULT_MEDIA_LIMITS } from '@amoris/contracts';
import { z } from 'zod';
import type { Logger } from './modules/media/derivatives.js';
import { removeLeftoverScrubDirs } from './modules/media/scrub.js';
import { createScrubServer } from './modules/media/scrubService.js';

/**
 * Avvio del servizio di pulizia (DR-359, DR-361): solo `qpdf`, `ffmpeg` e `ffprobe`, nessun
 * database, nessun archivio. Configurazione dalle variabili d'ambiente, validata all'avvio.
 */

const schema = z.object({
  SCRUB_HOST: z.string().min(1).default('127.0.0.1'),
  SCRUB_PORT: z.coerce.number().int().min(0).max(65535).default(3003),
  /** Gettone condiviso con l'API (DR-362): almeno 32 caratteri, nessun predefinito. */
  SCRUB_SERVICE_TOKEN: z
    .string({ error: 'manca, ed è obbligatoria: è un segreto e non ha valore predefinito' })
    .min(32, 'è troppo corta: servono almeno 32 caratteri'),
  /** File ricevuti al massimo: il più grande dei limiti di PDF e video dell'API. */
  SCRUB_MAX_BODY_BYTES: z.coerce
    .number()
    .int()
    .min(1)
    .default(Math.max(DEFAULT_MEDIA_LIMITS.pdfBytes, DEFAULT_MEDIA_LIMITS.videoBytes)),
  QPDF_PATH: z.string().min(1).default('qpdf'),
  FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  FFPROBE_PATH: z.string().min(1).default('ffprobe'),
  SCRUB_PDF_TIMEOUT_MS: z.coerce.number().int().min(1).default(30000),
  SCRUB_VIDEO_TIMEOUT_MS: z.coerce.number().int().min(1).default(120000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(`${issue.path.join('.') || '(sconosciuta)'}: ${issue.message}`);
  }
  process.exit(78); // EX_CONFIG
}
const config = parsed.data;

/** Righe JSON su stdout: solo messaggio e contesto non personale (programma, uscita, durata). */
const write = (level: string, context: object, message: string): void => {
  process.stdout.write(
    `${JSON.stringify({ level, time: Date.now(), ...context, msg: message })}\n`,
  );
};
const log: Logger = {
  error: (context, message) => write('error', context, message),
  warn: (context, message) => write('warn', context, message),
};

await removeLeftoverScrubDirs(log);

const server = createScrubServer({
  token: config.SCRUB_SERVICE_TOKEN,
  maxBodyBytes: config.SCRUB_MAX_BODY_BYTES,
  log,
  tools: {
    qpdfPath: config.QPDF_PATH,
    ffmpegPath: config.FFMPEG_PATH,
    ffprobePath: config.FFPROBE_PATH,
    pdfTimeoutMs: config.SCRUB_PDF_TIMEOUT_MS,
    videoTimeoutMs: config.SCRUB_VIDEO_TIMEOUT_MS,
  },
});
// Tempo massimo per ricevere la richiesta intera, non per ripulirla: sulla rete interna bastano 60 s.
server.requestTimeout = 60_000;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}

server.listen(config.SCRUB_PORT, config.SCRUB_HOST, () => {
  write('info', { port: config.SCRUB_PORT }, 'servizio di pulizia in ascolto');
});
