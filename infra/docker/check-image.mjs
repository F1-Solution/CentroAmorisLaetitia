#!/usr/bin/env node
/**
 * Controllo dei file di un'immagine (1F-W2 T9, criterio W2-8).
 *
 *   node infra/docker/check-image.mjs <immagine>
 *
 * Legge il file system dell'immagine da `docker export`, senza avviarla, e fallisce se trova:
 * - file d'ambiente (`.env`, `.env.*`; `.env.example` ammesso);
 * - chiavi o certificati fuori dalle cartelle dei certificati di sistema;
 * - cartelle di sorgenti private (`source-private`, `source-readonly`, `.reference`) o `.git`;
 * - indirizzi `localhost` o `127.0.0.1` nel codice che Next manda al browser (DR-360).
 *
 * Esce con 0 se l'immagine è pulita, 1 se trova file vietati (elencati su stderr), 2 se
 * l'immagine manca o Docker non risponde. Usa solo moduli di Node: gira anche fuori dal monorepo.
 */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOCK = 512;

/** Cartelle dei certificati delle autorità, che le immagini di base portano di serie. */
const SYSTEM_CERT_DIRS = [
  'etc/ssl/',
  // Alpine: collegamenti di compatibilità al pacchetto dei certificati di sistema.
  'etc/ssl1.1/',
  'etc/ca-certificates/',
  'usr/share/ca-certificates/',
  'usr/lib/ssl/',
  'usr/local/share/ca-certificates/',
];
const PRIVATE_DIRS = new Set(['source-private', 'source-readonly', '.reference', '.git']);
const KEY_FILE = /(\.(pem|key|pfx|p12|jks)|^id_(rsa|dsa|ecdsa|ed25519))$/i;
// `.env`, `.env.<qualcosa>` e `<nome>.env`, come `ambiente/production.env`.
const ENV_FILE = /^\.env(\..+)?$|\.env$/;
const BROWSER_CODE = /^app\/apps\/[^/]+\/\.next\/static\//;
// Un indirizzo vero (schema o porta), non la parola: le librerie di URL e di link nominano «localhost».
const LOCAL_ADDRESS =
  /https?:\/\/(?:localhost|127\.0\.0\.1)\b|\b(?:localhost|127\.0\.0\.1):\d{2,5}\b/;

/** Motivo per cui il percorso è vietato, o `undefined`. */
export function pathIssue(filePath) {
  const segments = filePath.split('/');
  const name = segments.at(-1) ?? '';
  if (segments.some((segment) => PRIVATE_DIRS.has(segment))) return 'sorgente privata o storia Git';
  if (ENV_FILE.test(name) && name !== '.env.example') return "file d'ambiente";
  if (KEY_FILE.test(name) && !SYSTEM_CERT_DIRS.some((dir) => filePath.startsWith(dir))) {
    return 'chiave o certificato';
  }
  return undefined;
}

/** Il contenuto serve solo per il codice del browser. */
export function wantsContent(filePath) {
  return BROWSER_CODE.test(filePath);
}

export function contentIssue(filePath, content) {
  if (BROWSER_CODE.test(filePath) && LOCAL_ADDRESS.test(content.toString('latin1'))) {
    return 'indirizzo locale nel codice del browser';
  }
  return undefined;
}

function cString(buffer, start, length) {
  const field = buffer.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString('utf8');
}

function octal(buffer, start, length) {
  const text = cString(buffer, start, length).trim();
  return text === '' ? 0 : Number.parseInt(text, 8);
}

/** Record PAX: «<lunghezza> <chiave>=<valore>\n». */
function paxRecords(content) {
  const records = {};
  let offset = 0;
  while (offset < content.length) {
    const space = content.indexOf(0x20, offset);
    if (space === -1) break;
    const length = Number.parseInt(content.subarray(offset, space).toString('utf8'), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = content.subarray(space + 1, offset + length - 1).toString('utf8');
    const equals = record.indexOf('=');
    if (equals > 0) records[record.slice(0, equals)] = record.slice(equals + 1);
    offset += length;
  }
  return records;
}

const normalize = (filePath) => filePath.replace(/^(\.\/|\/)+/, '');

/**
 * Legge un archivio tar in streaming e chiama `onEntry({ path, type, content })` per ogni voce;
 * `content` c'è solo se `wantContent(path)`. Gestisce PAX e i nomi lunghi GNU.
 */
export async function scanTar(stream, wantContent, onEntry) {
  let buffer = Buffer.alloc(0);
  let state = 'header';
  let remaining = 0;
  let padding = 0;
  let entry;
  let chunks = [];
  let pax = {};
  let longName;

  const finish = () => {
    const content = entry.collect ? Buffer.concat(chunks) : undefined;
    if (entry.type === 'x') pax = paxRecords(content);
    else if (entry.type === 'L') longName = cString(content, 0, content.length);
    else if (entry.type !== 'g' && entry.type !== 'K') {
      onEntry({ path: entry.path, type: entry.type, content });
      pax = {};
      longName = undefined;
    }
    chunks = [];
    state = 'header';
  };

  for await (const chunk of stream) {
    buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
    for (;;) {
      if (state === 'header') {
        if (buffer.length < BLOCK) break;
        const header = buffer.subarray(0, BLOCK);
        buffer = buffer.subarray(BLOCK);
        if (header.every((byte) => byte === 0)) continue;
        const type = String.fromCharCode(header[156] || 0x30);
        // `K` (nome lungo del collegamento) è una voce di servizio come `L`, non un file.
        const meta = type === 'x' || type === 'g' || type === 'L' || type === 'K';
        const prefix = cString(header, 345, 155);
        const name = cString(header, 0, 100);
        const filePath = normalize(
          meta ? name : (pax.path ?? longName ?? (prefix ? `${prefix}/${name}` : name)),
        );
        const size = !meta && pax.size !== undefined ? Number(pax.size) : octal(header, 124, 12);
        if (!Number.isSafeInteger(size) || size < 0) {
          throw new Error(`dimensione non valida nell'archivio tar: ${filePath}`);
        }
        const regular = type === '0' || type === '7';
        entry = { path: filePath, type, collect: meta || (regular && wantContent(filePath)) };
        remaining = size;
        padding = (BLOCK - (size % BLOCK)) % BLOCK;
        state = 'body';
        continue;
      }
      if (state === 'body') {
        const take = Math.min(remaining, buffer.length);
        if (entry.collect && take > 0) chunks.push(buffer.subarray(0, take));
        buffer = buffer.subarray(take);
        remaining -= take;
        if (remaining > 0) break;
        state = 'padding';
      }
      if (buffer.length < padding) break;
      buffer = buffer.subarray(padding);
      padding = 0;
      finish();
    }
  }
  if (state !== 'header') throw new Error('archivio tar troncato');
}

/** Controlla l'immagine; restituisce i file vietati e il numero di voci lette. */
export async function checkImage(image) {
  const created = spawnSync('docker', ['create', image, '/controllo-file'], { encoding: 'utf8' });
  if (created.status !== 0) {
    throw new Error(`docker create ${image}: ${created.stderr.trim()}`);
  }
  const container = created.stdout.trim();
  const findings = [];
  let entries = 0;
  try {
    const exporter = spawn('docker', ['export', container], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    exporter.stderr.on('data', (data) => {
      stderr += data;
    });
    const exited = new Promise((resolve) => exporter.on('close', resolve));
    await scanTar(exporter.stdout, wantsContent, ({ path: filePath, content }) => {
      entries += 1;
      const issue = pathIssue(filePath) ?? (content ? contentIssue(filePath, content) : undefined);
      if (issue) findings.push({ path: filePath, issue });
    });
    const code = await exited;
    if (code !== 0) throw new Error(`docker export ${image}: ${stderr.trim()}`);
  } finally {
    spawnSync('docker', ['rm', container], { encoding: 'utf8' });
  }
  return { findings, entries };
}

async function main() {
  const image = process.argv[2] ?? '';
  if (image === '') {
    process.stderr.write('uso: node infra/docker/check-image.mjs <immagine>\n');
    return 2;
  }
  let result;
  try {
    result = await checkImage(image);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  if (result.findings.length > 0) {
    for (const { path: filePath, issue } of result.findings) {
      process.stderr.write(`vietato (${issue}): /${filePath}\n`);
    }
    process.stderr.write(`${image}: ${result.findings.length} file vietati\n`);
    return 1;
  }
  process.stdout.write(`${image}: ${result.entries} voci, nessun file vietato\n`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
