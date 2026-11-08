import { DEFAULT_MEDIA_LIMITS, type MediaLimits } from '@amoris/contracts';
import type { ScrubTools } from './modules/media/scrub.js';
import { isIP } from 'node:net';
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

/** Una variabile vuota vale come assente (`.env` e Compose le lasciano spesso così). */
const emptyAsAbsent = (value: unknown): unknown => (value === '' ? undefined : value);

/** Indirizzo o sottorete CIDR (IPv4 o IPv6). */
const isAddressOrCidr = (value: string): boolean => {
  const [address = '', bits, extra] = value.split('/');
  if (extra !== undefined || isIP(address) === 0) return false;
  if (bits === undefined) return true;
  return /^\d+$/.test(bits) && Number(bits) <= (isIP(address) === 4 ? 32 : 128);
};

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3002),
  /** Unica variabile senza valore predefinito: senza database non c'è servizio. */
  DATABASE_URL: z
    .string({ error: 'manca, ed è obbligatoria: è l’indirizzo del database' })
    .min(1, 'è vuota: serve l’indirizzo del database'),
  /**
   * Indirizzi o sottoreti (CIDR) dei proxy di cui ci si fida per `X-Forwarded-For`, separati da virgole.
   * Vuoto, ed è il predefinito sicuro: nessuna fiducia, l'indirizzo del client è quello della connessione.
   */
  TRUSTED_PROXY: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    )
    .refine((entries) => entries.every(isAddressOrCidr), {
      error: 'deve essere un elenco di indirizzi IP o sottoreti CIDR separati da virgole',
    }),
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
  /** Chiave AES-256 (32 byte esadecimali) che cifra i segreti TOTP a riposo (DR-384, DR-388). */
  TOTP_ENCRYPTION_KEY: z
    .string({
      error:
        'TOTP_ENCRYPTION_KEY manca, ed è obbligatoria: è un segreto e non ha valore predefinito',
    })
    .regex(/^[0-9a-fA-F]{64}$/, 'deve essere di 64 caratteri esadecimali (32 byte)'),
  /** DR-391: oltre questi minuti dall'ultima conferma, la gestione degli account chiede di nuovo password o codice. */
  CONFIRMATION_MAX_MINUTES: z.coerce.number().int().min(1).default(10),

  /** ADR-007 §3.1 controllo 1: parametri di Argon2id dichiarati in configurazione. */
  ARGON2_MEMORY_KIB: z.coerce.number().int().min(8192).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(2).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),

  /** ADR-007 §3.1 controllo 3. */
  SESSION_COOKIE_NAME: z.string().min(1).default('amoris_sessione'),
  CSRF_COOKIE_NAME: z.string().min(1).default('amoris_csrf'),
  /** ADR-007 §3.1 controllo 4, DR-391: inattività 8 ore, assoluta 14 giorni (in produzione non di più). */
  SESSION_IDLE_HOURS: z.coerce.number().int().min(1).default(8),
  SESSION_ABSOLUTE_DAYS: z.coerce.number().int().min(1).default(14),

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

  /**
   * Tetti HTTP per indirizzo (prefisso /64 per IPv6), in memoria e senza scritture a database:
   * accesso e invio dei form, e le letture pubbliche di ricerca e redirect.
   */
  HTTP_ANON_WRITES_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  HTTP_PUBLIC_READ_PER_MINUTE: z.coerce.number().int().min(1).default(120),

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
  /** Servizio di pulizia su rete interna (DR-359): se c'è, PDF e MP4 passano solo da lui (DR-363). */
  SCRUB_SERVICE_URL: z.preprocess(
    emptyAsAbsent,
    z.url({ protocol: /^https?$/, error: 'deve essere un indirizzo http o https' }).optional(),
  ),
  /** Gettone condiviso con il servizio di pulizia (DR-362): obbligatorio con l'indirizzo. */
  SCRUB_SERVICE_TOKEN: z.preprocess(emptyAsAbsent, secret('SCRUB_SERVICE_TOKEN').optional()),
});

/** Minimi Argon2id di OWASP: 19 MiB di memoria, 2 iterazioni. */
const PRODUCTION_ARGON2_MIN_KIB = 19456;

/** Controlli solo di produzione (R27, R9): chiavi S3, minimi Argon2, tetti di sessione, segreti distinti. */
function checkProduction(config: z.infer<typeof configSchema>, context: z.RefinementCtx): void {
  const issue = (path: string, message: string) =>
    context.addIssue({ code: 'custom', path: [path], message });
  if (!config.S3_ACCESS_KEY) issue('S3_ACCESS_KEY', 'manca, ed è obbligatoria in produzione');
  if (!config.S3_SECRET_KEY) issue('S3_SECRET_KEY', 'manca, ed è obbligatoria in produzione');
  if (config.ARGON2_MEMORY_KIB < PRODUCTION_ARGON2_MIN_KIB) {
    issue('ARGON2_MEMORY_KIB', `in produzione servono almeno ${PRODUCTION_ARGON2_MIN_KIB} KiB`);
  }
  if (config.ARGON2_TIME_COST < 2) issue('ARGON2_TIME_COST', 'in produzione servono almeno 2');
  if (config.SESSION_ABSOLUTE_DAYS > 14)
    issue('SESSION_ABSOLUTE_DAYS', 'in produzione al massimo 14 (DR-391)');
  if (config.SESSION_IDLE_HOURS > 8)
    issue('SESSION_IDLE_HOURS', 'in produzione al massimo 8 (DR-391)');
  const secrets = [
    ['IP_HASH_SALT', config.IP_HASH_SALT],
    ['CSRF_SECRET', config.CSRF_SECRET],
    ['TOTP_ENCRYPTION_KEY', config.TOTP_ENCRYPTION_KEY],
    ['SCRUB_SERVICE_TOKEN', config.SCRUB_SERVICE_TOKEN],
  ] as const;
  secrets.forEach(([name, value], index) => {
    if (value !== undefined && secrets.slice(0, index).some(([, other]) => other === value)) {
      issue(name, 'deve essere diverso dagli altri segreti');
    }
  });
}

/** Con l'indirizzo del servizio di pulizia il gettone è obbligatorio. */
const checkedSchema = configSchema.superRefine((config, context) => {
  if (config.NODE_ENV === 'production') checkProduction(config, context);
  if (config.SCRUB_SERVICE_URL !== undefined && config.SCRUB_SERVICE_TOKEN === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['SCRUB_SERVICE_TOKEN'],
      message:
        'manca, ed è obbligatoria con SCRUB_SERVICE_URL: è un segreto e non ha valore predefinito',
    });
  }
});

export type Config = z.infer<typeof configSchema>;

/** Chiavi lette dall'API: l'esempio d'ambiente di produzione le elenca tutte (1F-W2 T8). */
export const CONFIG_KEYS = Object.keys(configSchema.shape) as readonly (keyof Config)[];

/** Errore di configurazione. Porta con sé l'elenco delle variabili che non vanno. */
export class ConfigError extends Error {
  constructor(public readonly problems: readonly string[]) {
    super(`Configurazione non valida:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = checkedSchema.safeParse(env);
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
    ...(config.SCRUB_SERVICE_URL !== undefined && config.SCRUB_SERVICE_TOKEN !== undefined
      ? { service: { url: config.SCRUB_SERVICE_URL, token: config.SCRUB_SERVICE_TOKEN } }
      : {}),
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
