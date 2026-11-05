import { statfs } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { Logger } from './modules/media/derivatives.js';
import { removeLeftoverScrubDirs } from './modules/media/scrub.js';
import { createScrubServer } from './modules/media/scrubService.js';
import { readScrubServerConfig, tmpSpaceIssue } from './scrubServerConfig.js';

/**
 * Avvio del servizio di pulizia (DR-359, DR-361): solo `qpdf`, `ffmpeg` e `ffprobe`, nessun
 * database, nessun archivio. Configurazione dalle variabili d'ambiente, validata all'avvio.
 */

const EX_CONFIG = 78;

const result = readScrubServerConfig(process.env);
if (!result.ok) {
  for (const issue of result.issues) console.error(issue);
  process.exit(EX_CONFIG);
}
const config = result.config;

let freeBytes = 0;
try {
  const space = await statfs(tmpdir());
  freeBytes = space.bavail * space.bsize;
} catch {
  console.error('TMPDIR: cartella temporanea non leggibile');
  process.exit(EX_CONFIG);
}
const spaceIssue = tmpSpaceIssue(freeBytes, config.maxBodyBytes);
if (spaceIssue !== undefined) {
  console.error(spaceIssue);
  process.exit(EX_CONFIG);
}

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
  token: config.token,
  maxBodyBytes: config.maxBodyBytes,
  log,
  tools: config.tools,
});
// Tempo massimo per ricevere la richiesta intera, non per ripulirla: sulla rete interna bastano 60 s.
server.requestTimeout = 60_000;

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}

server.listen(config.port, config.host, () => {
  write(
    'info',
    { port: config.port, maxBodyBytes: config.maxBodyBytes },
    'servizio di pulizia in ascolto',
  );
});
