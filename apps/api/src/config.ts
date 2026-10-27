import { DEFAULT_MEDIA_LIMITS, type MediaLimits } from '@amoris/contracts';
import type { ScrubTools } from './modules/media/scrub.js';
import { z } from 'zod';

/**
 * Configurazione del servizio, letta dalle variabili d'ambiente e validata
 * all'avvio (ADR-009 §4.3).
 *
 * Se manca o è malformata una variabile obbligatoria il servizio **non parte** e
 * dice quale: un servizio che parte con una configurazione incompleta e fallisce
 * più tardi è molto più difficile da diagnosticare.
 *
 * ADR-007 §3.1 controllo 12 — i segreti arrivano **solo** da qui e non hanno
 * valore predefinito: se mancano, il servizio si rifiuta di partire. I parametri
 * non segreti hanno invece un predefinito dichiarato, perché il controllo 1
 * chiede che i parametri di Argon2id siano in configurazione, non che siano
 * obbligatori.
 */

/** Segreto: almeno 32 caratteri, nessun valore predefinito, nessuna eccezione. */
const secret = (nome: string) =>
  z
    .string({ error: `${nome} manca, ed è obbligatoria: è un segreto e non ha valore predefinito` })
    .min(32, `${nome} è troppo corta: servono almeno 32 caratteri`);

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  /** Unica variabile senza valore predefinito: senza database non c'è servizio. */
  DATABASE_URL: z
    .string({ error: 'manca, ed è obbligatoria: è l’indirizzo del database' })
    .min(1, 'è vuota: serve l’indirizzo del database'),
  /** Origini ammesse, separate da virgole. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  /** Sale del digest degli indirizzi IP: a registro non finisce mai un IP in chiaro. */
  IP_HASH_SALT: secret('IP_HASH_SALT'),
  /** Segreto da cui si deriva il token anti-CSRF legato alla sessione. */
  CSRF_SECRET: secret('CSRF_SECRET'),

  /** ADR-007 §3.1 controllo 1: parametri di Argon2id dichiarati in configurazione. */
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(8192).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),

  /** ADR-007 §3.1 controllo 3. */
  SESSION_COOKIE_NAME: z.string().min(1).default('amoris_sessione'),
  CSRF_COOKIE_NAME: z.string().min(1).default('amoris_csrf'),
  /** ADR-007 §3.1 controllo 4: inattività 12 ore, assoluta 30 giorni. */
  SESSION_IDLE_HOURS: z.coerce.number().int().min(1).default(12),
  SESSION_ABSOLUTE_DAYS: z.coerce.number().int().min(1).default(30),

  /** ADR-007 §3.1 controllo 8. */
  LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
  LOGIN_MAX_PER_ACCOUNT: z.coerce.number().int().min(1).default(5),
  LOGIN_MAX_PER_IP: z.coerce.number().int().min(1).default(20),
  /** Ritardo progressivo: millisecondi per ogni tentativo fallito, con tetto. */
  LOGIN_DELAY_STEP_MS: z.coerce.number().int().min(0).default(250),
  LOGIN_DELAY_MAX_MS: z.coerce.number().int().min(0).default(2000),
  /**
   * ADR-007 §3.1 controllo 9: il tempo di risposta dell'accesso è uniforme.
   * Ogni tentativo occupa almeno questo tempo, riuscito o fallito che sia.
   */
  LOGIN_UNIFORM_MS: z.coerce.number().int().min(0).default(350),

  /**
   * ADR-010 §4.4: limitazione per indirizzo IP e per form, senza captcha di
   * terze parti. `FORM_MIN_SECONDS` è la marca temporale minima dal
   * caricamento del form all'invio.
   */
  FORM_SUBMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(60),
  FORM_SUBMIT_MAX_PER_IP: z.coerce.number().int().min(1).default(20),
  FORM_SUBMIT_MAX_PER_FORM_AND_IP: z.coerce.number().int().min(1).default(5),
  FORM_SUBMIT_MIN_SECONDS: z.coerce.number().int().min(0).default(3),

  /** Archivio a oggetti (ADR-004). Serve al modulo dei media. */
  S3_ENDPOINT: z.string().min(1).default('http://127.0.0.1:9000'),
  S3_REGION: z.string().min(1).default('eu-south-1'),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_BUCKET_PUBLIC: z.string().min(1).default('media-public'),
  S3_BUCKET_PRIVATE: z.string().min(1).default('media-private'),
  /** Tempi massimi di attesa dell'archivio: il blocco della cartella non resta tenuto all'infinito. */
  S3_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1).default(5000),
  S3_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1).default(30000),

  /** Limiti dei file caricati nei media (1G-14, D147-A): le prove li abbassano. */
  MEDIA_MAX_IMAGE_BYTES: z.coerce.number().int().min(1).default(DEFAULT_MEDIA_LIMITS.imageBytes),
  MEDIA_MAX_IMAGE_PIXELS: z.coerce.number().int().min(1).default(DEFAULT_MEDIA_LIMITS.imagePixels),
  MEDIA_MAX_PDF_BYTES: z.coerce.number().int().min(1).default(DEFAULT_MEDIA_LIMITS.pdfBytes),
  MEDIA_MAX_VIDEO_BYTES: z.coerce.number().int().min(1).default(DEFAULT_MEDIA_LIMITS.videoBytes),
  /** Elaborazioni di immagini insieme, posti in coda e fili di `sharp`: oltre, 503. */
  MEDIA_MAX_CONCURRENT: z.coerce.number().int().min(1).default(2),
  MEDIA_QUEUE_LENGTH: z.coerce.number().int().min(0).default(4),
  MEDIA_IMAGE_THREADS: z.coerce.number().int().min(1).default(2),
  /** Tetto per indirizzo di caricamenti e sostituzioni, e attesa massima dei blocchi del database. */
  MEDIA_WRITES_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  MEDIA_LOCK_TIMEOUT_MS: z.coerce.number().int().min(1).default(10000),
  /** Programmi che ripuliscono i metadati di PDF e MP4 (ADR-012) e tempi massimi in millisecondi. */
  QPDF_PATH: z.string().min(1).default('qpdf'),
  FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  FFPROBE_PATH: z.string().min(1).default('ffprobe'),
  SCRUB_PDF_TIMEOUT_MS: z.coerce.number().int().min(1).default(30000),
  SCRUB_VIDEO_TIMEOUT_MS: z.coerce.number().int().min(1).default(120000),
});

export type Config = z.infer<typeof configSchema>;

/** Errore di configurazione. Porta con sé l'elenco delle variabili che non vanno. */
export class ConfigError extends Error {
  constructor(public readonly problems: readonly string[]) {
    super(`Configurazione non valida:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(sconosciuta)';
    return `${name}: ${issue.message}`;
  });
  throw new ConfigError(problems);
}

/** Programmi e tempi della pulizia dei metadati letti dalla configurazione. */
export function scrubToolsOf(config: Config): ScrubTools {
  return {
    qpdfPath: config.QPDF_PATH,
    ffmpegPath: config.FFMPEG_PATH,
    ffprobePath: config.FFPROBE_PATH,
    pdfTimeoutMs: config.SCRUB_PDF_TIMEOUT_MS,
    videoTimeoutMs: config.SCRUB_VIDEO_TIMEOUT_MS,
  };
}

/** Limiti dei media letti dalla configurazione. */
export function mediaLimitsOf(config: Config): MediaLimits {
  return {
    imageBytes: config.MEDIA_MAX_IMAGE_BYTES,
    imagePixels: config.MEDIA_MAX_IMAGE_PIXELS,
    pdfBytes: config.MEDIA_MAX_PDF_BYTES,
    videoBytes: config.MEDIA_MAX_VIDEO_BYTES,
  };
}
