import type * as FsPromises from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ScrubUnreadableError, scrubFile, type ScrubTools } from '../src/modules/media/scrub.js';
import {
  FFMPEG,
  FFPROBE,
  QPDF,
  assertToolsInstalled,
  buildPdf,
} from './_support/syntheticFiles.js';

/**
 * Cartella temporanea della pulizia che non si riesce a cancellare (L2): su Windows un `EBUSY`
 * non deve cambiare l'esito della pulizia né portare il percorso nel log. `rm` è sostituito
 * solo per le cartelle `amoris-scrub-*` e solo mentre `failing` è vero; il resto è il vero.
 */

const control = vi.hoisted(() => ({ failing: false }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    rm: async (...args: Parameters<typeof actual.rm>) => {
      if (control.failing && String(args[0]).includes('amoris-scrub-')) {
        throw Object.assign(new Error('resource busy or locked'), { code: 'EBUSY' });
      }
      return actual.rm(...args);
    },
  };
});

const TOOLS: ScrubTools = {
  qpdfPath: QPDF,
  ffmpegPath: FFMPEG,
  ffprobePath: FFPROBE,
  pdfTimeoutMs: 30_000,
  videoTimeoutMs: 120_000,
};

beforeAll(async () => {
  await assertToolsInstalled();
}, 60_000);

/** Registra contesto e messaggio di ogni riga d'errore. */
function captureLog() {
  const lines: { context: object; message: string }[] = [];
  return {
    lines,
    log: { error: (context: object, message: string) => lines.push({ context, message }) },
  };
}

/** Cancella davvero le cartelle rimaste da questa prova. */
async function cleanUp(known: ReadonlySet<string>): Promise<void> {
  const actual = await vi.importActual<typeof FsPromises>('node:fs/promises');
  for (const name of await readdir(tmpdir())) {
    if (name.startsWith('amoris-scrub-') && !known.has(name)) {
      await actual.rm(join(tmpdir(), name), { recursive: true, force: true });
    }
  }
}

describe('cartella temporanea non rimossa (L2)', () => {
  it('la pulizia riuscita resta riuscita e il log dice solo «cartella temporanea non rimossa»', async () => {
    const known = new Set(await readdir(tmpdir()));
    const { lines, log } = captureLog();
    control.failing = true;
    try {
      const output = await scrubFile('application/pdf', buildPdf(), TOOLS, Infinity, log);
      expect(output.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    } finally {
      control.failing = false;
      await cleanUp(known);
    }
    // Né percorso né altro: il nome della cartella e quello della cartella temporanea non escono.
    expect(lines).toEqual([{ context: {}, message: 'cartella temporanea non rimossa' }]);
  });

  it('un file illeggibile resta 400 (ScrubUnreadableError), non diventa un 500', async () => {
    const known = new Set(await readdir(tmpdir()));
    const { lines, log } = captureLog();
    control.failing = true;
    try {
      await expect(
        scrubFile('application/pdf', Buffer.from('%PDF-1.4\n% rotto\n'), TOOLS, Infinity, log),
      ).rejects.toBeInstanceOf(ScrubUnreadableError);
    } finally {
      control.failing = false;
      await cleanUp(known);
    }
    expect(lines).toEqual([{ context: {}, message: 'cartella temporanea non rimossa' }]);
  });
});
