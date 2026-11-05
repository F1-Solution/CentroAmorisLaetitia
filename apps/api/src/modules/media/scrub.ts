import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Logger } from './derivatives.js';

/** Pulizia dei metadati di PDF e MP4 con `qpdf`, `ffmpeg` e `ffprobe` in processi separati (DR-254, DR-264, ADR-012). */

/** Servizio di pulizia su rete interna (DR-359) e gettone condiviso (DR-362). */
export interface ScrubServiceTarget {
  readonly url: string;
  readonly token: string;
}

export interface ScrubTools {
  /** Se c'è, PDF e MP4 si ripuliscono solo attraverso il servizio, mai con i programmi locali (DR-363). */
  readonly service?: ScrubServiceTarget;
  readonly qpdfPath: string;
  readonly ffmpegPath: string;
  readonly ffprobePath: string;
  readonly pdfTimeoutMs: number;
  readonly videoTimeoutMs: number;
}

/** Dati non personali di un'esecuzione: mai il nome del file né l'uscita del programma. */
export interface ScrubTrace {
  readonly tool: 'qpdf' | 'ffmpeg' | 'ffprobe';
  readonly exitCode: number | null;
  readonly durationMs: number;
}

/** Il programma non legge il file: da rifiutare come file danneggiato. */
export class ScrubUnreadableError extends Error {
  constructor(public readonly trace: ScrubTrace) {
    super('file non leggibile dal programma di pulizia');
    this.name = 'ScrubUnreadableError';
  }
}

/** Il file ripulito pesa più del limite del suo tipo: non si legge. */
export class ScrubTooLargeError extends Error {
  constructor() {
    super('file ripulito oltre il limite di peso');
    this.name = 'ScrubTooLargeError';
  }
}

/** Il programma manca o non risponde in tempo: il servizio non può ripulire. */
export class ScrubUnavailableError extends Error {
  constructor(public readonly trace: ScrubTrace) {
    super('programma di pulizia non disponibile');
    this.name = 'ScrubUnavailableError';
  }
}

/** Uscita dei programmi letta al massimo per 64 KB, poi scartata. */
const MAX_OUTPUT_BYTES = 64 * 1024;

/** Prefisso delle cartelle temporanee della pulizia. */
const SCRUB_DIR_PREFIX = 'amoris-scrub-';

/** Ciò che `execFile` riporta di un'esecuzione non riuscita. */
export interface ExecFailure {
  readonly code?: unknown;
  readonly killed?: boolean;
  readonly signal?: string | null;
}

/** Codici di avvio di un programma assente o non eseguibile. */
const UNAVAILABLE_CODES: ReadonlySet<unknown> = new Set(['ENOENT', 'EACCES', 'EPERM']);

/**
 * Esito di un'esecuzione non riuscita (L1): il codice d'uscita da giudicare, «non disponibile» solo
 * per programma assente, non eseguibile o tempo scaduto, e il file illeggibile in ogni altro caso.
 */
export function classifyFailure(failure: ExecFailure): number | 'unavailable' | 'unreadable' {
  if (failure.killed === true) return 'unavailable';
  if (typeof failure.code === 'number') return failure.code;
  return UNAVAILABLE_CODES.has(failure.code) ? 'unavailable' : 'unreadable';
}

/** Ambiente dei programmi: il solo `PATH`, più `SystemRoot` su Windows, mai segreti né configurazione (M2). */
export function toolEnv(
  source: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  return {
    ...(source.PATH !== undefined ? { PATH: source.PATH } : {}),
    ...(platform === 'win32' && source.SystemRoot !== undefined
      ? { SystemRoot: source.SystemRoot }
      : {}),
  };
}

/** Esito di un'esecuzione: la traccia e l'uscita standard (al massimo `MAX_OUTPUT_BYTES`). */
interface ToolRun {
  readonly trace: ScrubTrace;
  readonly stdout: string;
}

/** Esegue il programma senza shell, con tempo massimo, uscita limitata e ambiente ridotto; restituisce traccia e uscita standard. */
function execTool(
  tool: ScrubTrace['tool'],
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<ToolRun> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    try {
      execFile(
        command,
        [...args],
        {
          timeout: timeoutMs,
          killSignal: 'SIGKILL',
          maxBuffer: MAX_OUTPUT_BYTES,
          windowsHide: true,
          env: toolEnv(),
        },
        (error, stdout) => {
          const durationMs = Date.now() - started;
          if (!error) return resolve({ trace: { tool, exitCode: 0, durationMs }, stdout });
          const verdict = classifyFailure(error as ExecFailure);
          if (typeof verdict === 'number') {
            return resolve({ trace: { tool, exitCode: verdict, durationMs }, stdout: '' });
          }
          const trace = { tool, exitCode: null, durationMs };
          return reject(
            verdict === 'unavailable'
              ? new ScrubUnavailableError(trace)
              : new ScrubUnreadableError(trace),
          );
        },
      );
    } catch {
      // Un errore sincrono all'avvio (per esempio EINVAL su Windows con un `.cmd`) è un programma non eseguibile.
      reject(new ScrubUnavailableError({ tool, exitCode: null, durationMs: Date.now() - started }));
    }
  });
}

async function runTool(
  tool: ScrubTrace['tool'],
  command: string,
  args: readonly string[],
  timeoutMs: number,
): Promise<ScrubTrace> {
  return (await execTool(tool, command, args, timeoutMs)).trace;
}

/** Cancella una cartella temporanea; se non si riesce lo annota senza il percorso e l'esito non cambia (L2). */
async function removeDir(dir: string, log: Logger | undefined): Promise<boolean> {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 3 });
    return true;
  } catch {
    log?.error({}, 'cartella temporanea non rimossa');
    return false;
  }
}

/** Età oltre la quale una cartella della pulizia è un residuo: ben oltre la scadenza di un MP4 (120 s). */
export const LEFTOVER_MIN_AGE_MS = 10 * 60 * 1000;

/** Vero se la cartella non cambia da più di `LEFTOVER_MIN_AGE_MS`; se non si legge, non si tocca. */
async function isStale(dir: string, now: number): Promise<boolean> {
  try {
    return now - (await stat(dir)).mtimeMs > LEFTOVER_MIN_AGE_MS;
  } catch {
    return false;
  }
}

/** Cancella all'avvio le cartelle di una pulizia interrotta, che contengono originali non ripuliti (L2). */
export async function removeLeftoverScrubDirs(
  log?: Logger,
  base: string = tmpdir(),
): Promise<number> {
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    log?.error({}, 'cartella temporanea non letta');
    return 0;
  }
  const now = Date.now();
  const leftovers = entries.filter(
    (entry) => entry.isDirectory() && entry.name.startsWith(SCRUB_DIR_PREFIX),
  );
  let removed = 0;
  for (const entry of leftovers) {
    const dir = join(base, entry.name);
    // Una cartella recente può essere una pulizia in corso di un'altra API o di un'altra prova.
    if ((await isStale(dir, now)) && (await removeDir(dir, log))) removed += 1;
  }
  return removed;
}

/** `qpdf` riscrive il file da capo: l'uscita 0 e la 3 (avvisi, file scritto) valgono come riuscita. */
const isQpdfSuccess = (exitCode: number | null): boolean => exitCode === 0 || exitCode === 3;

function pdfArgs(input: string, output: string): string[] {
  return ['--no-warn', '--remove-info', '--remove-metadata', input, output];
}

/** Codec audio e video ammessi in un MP4 (DR-264): ogni altro fa rifiutare il file. */
const ALLOWED_CODECS: readonly string[] = ['h264', 'hevc', 'aac'];

/** Tracce di un MP4 lette da `ffprobe`. */
interface ProbedStream {
  readonly codec_type?: unknown;
  readonly codec_name?: unknown;
}

/** Vero se c'è almeno una traccia audio o video e ognuna ha un codec ammesso; sottotitoli e dati non contano. */
export function hasOnlyAllowedCodecs(json: string): boolean {
  let streams: unknown;
  try {
    streams = (JSON.parse(json) as { streams?: unknown } | null)?.streams;
  } catch {
    return false;
  }
  if (!Array.isArray(streams)) return false;
  const media = (streams as (ProbedStream | null)[]).filter(
    (stream) => stream?.codec_type === 'video' || stream?.codec_type === 'audio',
  );
  return (
    media.length > 0 &&
    media.every(
      (stream) =>
        typeof stream?.codec_name === 'string' && ALLOWED_CODECS.includes(stream.codec_name),
    )
  );
}

/** Argomenti di `ffprobe` sul file d'uscita: stesse protezioni di `ffmpeg`, con la whitelist dei codec. */
export function probeArgs(input: string): string[] {
  return [
    '-v',
    'error',
    '-protocol_whitelist',
    'file',
    '-codec_whitelist',
    ALLOWED_CODECS.join(','),
    '-f',
    'mov',
    '-show_entries',
    'stream=codec_type,codec_name',
    '-of',
    'json',
    input,
  ];
}

/** Rifiuta l'uscita con un codec audio o video fuori elenco: la sola `-codec_whitelist` di `ffmpeg` non rifiuta l'audio. */
async function assertAllowedCodecs(
  output: string,
  tools: ScrubTools,
  timeoutMs: number,
): Promise<void> {
  const { trace, stdout } = await execTool(
    'ffprobe',
    tools.ffprobePath,
    probeArgs(output),
    timeoutMs,
  );
  if (trace.exitCode !== 0 || !hasOnlyAllowedCodecs(stdout)) throw new ScrubUnreadableError(trace);
}

function mp4Args(input: string, output: string, maxBytes: number): string[] {
  return [
    '-nostdin',
    '-hide_banner',
    '-loglevel',
    'error',
    '-protocol_whitelist',
    'file',
    '-codec_whitelist',
    ALLOWED_CODECS.join(','),
    '-f',
    'mov',
    '-i',
    input,
    '-map',
    '0:V?',
    '-map',
    '0:a?',
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-c',
    'copy',
    '-fflags',
    '+bitexact',
    '-movflags',
    '+faststart',
    // Limite di scrittura: un indice che ripete gli stessi byte non riempie il disco (H1).
    ...(Number.isFinite(maxBytes) ? ['-fs', String(maxBytes)] : []),
    '-f',
    'mp4',
    '-y',
    output,
  ];
}

/** Ripulisce il file: nomi temporanei generati, cartella propria sempre cancellata. */
export async function scrubFile(
  mime: string,
  input: Buffer,
  tools: ScrubTools,
  maxBytes = Number.POSITIVE_INFINITY,
  log?: Logger,
): Promise<Buffer> {
  if (mime !== 'application/pdf' && mime !== 'video/mp4') {
    throw new TypeError('tipo non ripulibile');
  }
  const dir = await mkdtemp(join(tmpdir(), SCRUB_DIR_PREFIX));
  try {
    const source = join(dir, `in-${randomUUID()}`);
    const target = join(dir, `out-${randomUUID()}`);
    await writeFile(source, input);
    const isPdf = mime === 'application/pdf';
    const trace = isPdf
      ? await runTool('qpdf', tools.qpdfPath, pdfArgs(source, target), tools.pdfTimeoutMs)
      : await runTool(
          'ffmpeg',
          tools.ffmpegPath,
          mp4Args(source, target, maxBytes),
          tools.videoTimeoutMs,
        );
    const succeeded = isPdf ? isQpdfSuccess(trace.exitCode) : trace.exitCode === 0;
    if (!succeeded) throw new ScrubUnreadableError(trace);
    const { size } = await stat(target);
    if (size === 0) throw new ScrubUnreadableError(trace);
    if (size > maxBytes) throw new ScrubTooLargeError();
    // Scadenza unica per file: `ffprobe` riceve il tempo che resta a `ffmpeg`.
    if (!isPdf) {
      await assertAllowedCodecs(
        target,
        tools,
        Math.max(1, tools.videoTimeoutMs - trace.durationMs),
      );
    }
    return await readFile(target);
  } finally {
    await removeDir(dir, log);
  }
}
