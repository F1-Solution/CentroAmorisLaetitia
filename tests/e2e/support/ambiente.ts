/**
 * I parametri dell'ambiente end-to-end, in un posto solo: `playwright.config.ts`
 * e `global-setup.ts` devono concordare, e due copie divergerebbero al primo
 * cambio di porta.
 *
 * **Porte proprie, diverse da quelle di sviluppo.** Un'esecuzione end-to-end
 * non deve poter parlare per sbaglio con il servizio di sviluppo della
 * macchina, che punta a un altro database: i conteggi tornerebbero sbagliati
 * senza che nulla dichiari perché. Per la stessa ragione i server non si
 * riusano mai (`reuseExistingServer: false`): se la porta è occupata, meglio
 * fermarsi che credere di stare provando ciò che non si sta provando.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * In locale i segreti del servizio e la configurazione dell'archivio a oggetti
 * stanno nel `.env` della radice; in CI arrivano dalle variabili del flusso.
 * Si carica **all'importazione di questo modulo**, perché
 * `playwright.config.ts` compone l'ambiente dei server mentre si carica, cioè
 * prima che `global-setup.ts` abbia la possibilità di fare qualunque cosa.
 *
 * L'indirizzo del database che ne arriva non viene mai usato così com'è: serve
 * solo come base da cui derivare quello dell'end-to-end (`urlPerDatabase`).
 */
export const RADICE = radiceDelProgetto();
const envLocale = path.join(RADICE, '.env');
if (existsSync(envLocale)) process.loadEnvFile(envLocale);

/**
 * La radice del monorepo, cercata risalendo da dove il comando è stato
 * lanciato. Non si usa `import.meta.dirname`: Playwright compila la
 * configurazione in CommonJS, dove `import.meta` non esiste.
 */
function radiceDelProgetto(): string {
  let corrente = process.cwd();
  for (let salita = 0; salita < 10; salita += 1) {
    if (existsSync(path.join(corrente, 'pnpm-workspace.yaml'))) return corrente;
    const sopra = path.dirname(corrente);
    if (sopra === corrente) break;
    corrente = sopra;
  }
  throw new Error('radice del monorepo non trovata: manca `pnpm-workspace.yaml` risalendo da qui.');
}

export const PORTE = {
  web: 3100,
  admin: 3101,
  api: 3102,
} as const;

/**
 * Stack di immagini dietro l'ingresso comune e Caddy (1F-W2 T10, DR-409): con `E2E_STACK_URL`
 * (per esempio `https://localhost:8443`) le prove non avviano server propri e passano
 * tutte dall'unica origine dell'ingresso, con l'API sotto `/api` come in produzione.
 */
export const STACK_URL = process.env.E2E_STACK_URL?.trim().replace(/\/+$/, '') || undefined;

export const WEB_URL = STACK_URL ?? `http://127.0.0.1:${PORTE.web}`;
export const ADMIN_URL = STACK_URL ?? `http://127.0.0.1:${PORTE.admin}`;
export const API_URL = STACK_URL ? `${STACK_URL}/api` : `http://127.0.0.1:${PORTE.api}`;

/** Database usa e getta dell'end-to-end. Ricreato da zero a ogni esecuzione. */
export const DATABASE_E2E = 'amoris_e2e';

/**
 * Le credenziali del seme sintetico. La persona è inventata e il dominio
 * `.invalid` non esiste per definizione (`apps/api/tools/seedSintetico.ts`).
 * La password vale solo per questo database usa e getta.
 */
export const ACCESSO = {
  email: 'redazione@esempio.invalid',
  password: 'password-sintetica-end-to-end',
} as const;

/** La persona con il solo ruolo `amministrazione` (DR-227), stessa password del seme. */
export const ACCESSO_AMMINISTRAZIONE = {
  email: 'amministrazione@esempio.invalid',
  password: ACCESSO.password,
} as const;

/** La persona con entrambi i ruoli: dopo l'accesso vede la scelta dell'area. */
export const ACCESSO_ENTRAMBI = {
  email: 'entrambi@esempio.invalid',
  password: ACCESSO.password,
} as const;

/** Indirizzo del database di servizio, da cui si deriva quello dell'end-to-end. */
export function urlPerDatabase(nome: string): string {
  const base =
    process.env.DATABASE_URL ?? 'postgres://amoris:sviluppo-locale@localhost:5432/amoris';
  const parsed = new URL(base);
  parsed.pathname = `/${nome}`;
  return parsed.toString();
}

/**
 * L'ambiente con cui si avviano i tre server. I segreti arrivano da fuori —
 * `.env` in locale, variabili del flusso in CI — e qui non hanno alcun valore
 * di ripiego, come ADR-007 §3.1 controllo 12 impone al servizio.
 */
export function ambienteDeiServer(): Record<string, string> {
  const env: Record<string, string> = {
    NODE_ENV: 'test',
    LOG_LEVEL: 'warn',
    DATABASE_URL: urlPerDatabase(DATABASE_E2E),
    API_HOST: '127.0.0.1',
    API_PORT: String(PORTE.api),
    CORS_ORIGINS: [WEB_URL, ADMIN_URL].join(','),
    NEXT_PUBLIC_API_URL: API_URL,
    // «Anteprima sul sito» dell'area apre il sito dell'e2e, sullo stesso host dell'area (il cookie non cambia host).
    NEXT_PUBLIC_SITE_URL: WEB_URL,
    // `next start` gira in produzione, dove il sito pretende il proprio indirizzo (DR-196).
    SITE_URL: WEB_URL,
    // Le prove non devono aspettare mezzo secondo per ogni accesso.
    LOGIN_UNIFORM_MS: '0',
    LOGIN_DELAY_STEP_MS: '0',
    // Un'esecuzione intera fa più di venti accessi: il limite di ADR-007
    // §3.1 controllo 8 è provato dai test del servizio, non da qui.
    LOGIN_MAX_PER_IP: '1000',
    LOGIN_MAX_PER_ACCOUNT: '1000',
    // Tutte le prove arrivano da 127.0.0.1: i tetti HTTP per indirizzo (1F-W4 T6h) sono provati dai test del servizio.
    HTTP_ANON_WRITES_PER_MINUTE: '100000',
    HTTP_PUBLIC_READ_PER_MINUTE: '100000',
  };

  for (const chiave of [
    'IP_HASH_SALT',
    'CSRF_SECRET',
    'TOTP_ENCRYPTION_KEY',
    'S3_ENDPOINT',
    'S3_REGION',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'S3_BUCKET_PUBLIC',
    'S3_BUCKET_PRIVATE',
    // Gli strumenti che puliscono PDF e MP4: in CI sono nel PATH, in locale `qpdf` può stare altrove.
    'QPDF_PATH',
    'FFMPEG_PATH',
    'FFPROBE_PATH',
  ]) {
    const valore = process.env[chiave];
    if (valore !== undefined) env[chiave] = valore;
  }

  return env;
}
