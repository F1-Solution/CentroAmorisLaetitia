import { eq } from 'drizzle-orm';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Writable } from 'node:stream';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { schema } from '@amoris/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  ScrubTooLargeError,
  ScrubUnavailableError,
  ScrubUnreadableError,
  classifyFailure,
  removeLeftoverScrubDirs,
  scrubFile,
  toolEnv,
  type ScrubTools,
} from '../src/modules/media/scrub.js';
import {
  createHarness,
  signIn,
  testConfig,
  type Harness,
  type Signed,
} from './_support/harness.js';
import {
  FFMPEG,
  MARKERS,
  QPDF,
  assertToolsInstalled,
  buildMp4,
  buildPdf,
  buildRepeatedOffsetMp4,
  contains,
  pdfPageCount,
  probeMp4,
} from './_support/syntheticFiles.js';

/**
 * Pulizia dei metadati di PDF e MP4 (DR-254, ADR-012): programmi veri su file sintetici.
 * Se `qpdf` o `ffmpeg` mancano la prova FALLISCE con un messaggio chiaro, non salta mai.
 */

const run = promisify(execFile);

const TOOLS: ScrubTools = {
  qpdfPath: QPDF,
  ffmpegPath: FFMPEG,
  pdfTimeoutMs: 30_000,
  videoTimeoutMs: 120_000,
};

/** Un nome che somiglia a una persona: non deve mai arrivare al log. */
const SYNTHETIC_NAME = 'verbale-maria-rossi-sintetico.pdf';

let harness: Harness;

beforeAll(async () => {
  await assertToolsInstalled();
  harness = await createHarness('api_media_scrub');
}, 180_000);

afterAll(async () => {
  await harness?.teardown();
});

function multipartOf(who: Signed, fileName: string, body: Buffer) {
  const boundary = '----prova-sintetica';
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `content-disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      `content-type: application/octet-stream\r\n\r\n`,
  );
  return {
    payload: Buffer.concat([head, body, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    headers: { ...who.writeHeaders, 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

describe('PDF (S12)', () => {
  it('toglie Info, XMP e le versioni vecchie di un aggiornamento incrementale, e tiene le pagine', async () => {
    const input = buildPdf({ pages: 3, withMetadata: true });
    for (const text of [MARKERS.author, MARKERS.oldAuthor, MARKERS.producer, MARKERS.xmp]) {
      expect(contains(input, text)).toBe(true);
    }
    const output = await scrubFile('application/pdf', input, TOOLS);
    for (const text of [MARKERS.author, MARKERS.oldAuthor, MARKERS.producer, MARKERS.xmp]) {
      expect(contains(output, text)).toBe(false);
    }
    expect(output.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(await pdfPageCount(output)).toBe(3);
  });

  it('un file che non è un PDF leggibile è ScrubUnreadableError', async () => {
    await expect(
      scrubFile('application/pdf', Buffer.from('%PDF-1.4\n% rotto\n%%EOF\n'), TOOLS),
    ).rejects.toBeInstanceOf(ScrubUnreadableError);
  });

  it('un PDF troncato si rifiuta come illeggibile', async () => {
    // Un PDF troncato a metà non si legge: qpdf risponde con un errore (uscita 2).
    const broken = buildPdf({ withMetadata: true }).subarray(0, 120);
    await expect(scrubFile('application/pdf', broken, TOOLS)).rejects.toBeInstanceOf(
      ScrubUnreadableError,
    );
  });

  it('un PDF con la sola password del proprietario si ripulisce; con quella di apertura si rifiuta', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prova-cifrato-'));
    try {
      const source = join(dir, 'in.pdf');
      await writeFile(source, buildPdf({ pages: 2, withMetadata: true }));
      const encrypt = async (userPassword: string, name: string) => {
        const target = join(dir, name);
        await run(QPDF, [
          '--encrypt',
          userPassword,
          'proprietario-sintetico',
          '256',
          '--',
          source,
          target,
        ]);
        return readFile(target);
      };
      const ownerOnly = await scrubFile('application/pdf', await encrypt('', 'a.pdf'), TOOLS);
      expect(await pdfPageCount(ownerOnly)).toBe(2);
      await expect(
        scrubFile('application/pdf', await encrypt('apertura-sintetica', 'b.pdf'), TOOLS),
      ).rejects.toBeInstanceOf(ScrubUnreadableError);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('un tipo che non è PDF né MP4 si rifiuta invece di passare a ffmpeg', async () => {
    await expect(scrubFile('image/png', buildPdf(), TOOLS)).rejects.toThrow(TypeError);
  });

  it('il file ripulito oltre il limite del tipo non si legge: ScrubTooLargeError', async () => {
    await expect(scrubFile('application/pdf', buildPdf(), TOOLS, 10)).rejects.toBeInstanceOf(
      ScrubTooLargeError,
    );
  });

  it('la cartella temporanea si cancella, su riuscita e su errore', async () => {
    const count = async () =>
      (await readdir(tmpdir())).filter((name) => name.startsWith('amoris-scrub-')).length;
    const before = await count();
    await scrubFile('application/pdf', buildPdf(), TOOLS);
    expect(await count()).toBe(before);
    await expect(
      scrubFile('application/pdf', Buffer.from('%PDF-1.4\n% rotto\n'), TOOLS),
    ).rejects.toBeInstanceOf(ScrubUnreadableError);
    expect(await count()).toBe(before);
    await expect(
      scrubFile('application/pdf', buildPdf(), { ...TOOLS, qpdfPath: 'qpdf-che-non-esiste-xyz' }),
    ).rejects.toBeInstanceOf(ScrubUnavailableError);
    expect(await count()).toBe(before);
  });

  it('programma assente → ScrubUnavailableError', async () => {
    await expect(
      scrubFile('application/pdf', buildPdf(), { ...TOOLS, qpdfPath: 'qpdf-che-non-esiste-xyz' }),
    ).rejects.toBeInstanceOf(ScrubUnavailableError);
  });

  it('tempo scaduto → ScrubUnavailableError', async () => {
    await expect(
      scrubFile('application/pdf', buildPdf(), { ...TOOLS, pdfTimeoutMs: 1 }),
    ).rejects.toBeInstanceOf(ScrubUnavailableError);
  });
});

describe('MP4 (S12)', () => {
  it.each([
    ['indice in coda', { faststart: false }],
    ['indice in testa', { faststart: true }],
  ])('toglie metadati, capitoli, XMP e tracce non audio/video: %s', async (_name, variant) => {
    const input = await buildMp4({ ...variant, withAudio: true, withMetadata: true });
    for (const text of [
      MARKERS.location,
      MARKERS.artist,
      MARKERS.chapter,
      MARKERS.subtitle,
      MARKERS.uuidXmp,
    ]) {
      expect(contains(input, text)).toBe(true);
    }
    const before = await probeMp4(input);
    expect(before.types.some((type) => type !== 'video' && type !== 'audio')).toBe(true);

    const output = await scrubFile('video/mp4', input, TOOLS);
    for (const text of [
      MARKERS.location,
      MARKERS.artist,
      MARKERS.chapter,
      MARKERS.subtitle,
      MARKERS.uuidXmp,
    ]) {
      expect(contains(output, text)).toBe(false);
    }
    const after = await probeMp4(output);
    expect(after.types.slice().sort()).toEqual(['audio', 'video']);
    expect(Math.abs(after.duration - before.duration)).toBeLessThan(0.15);
    // `moov` in testa, come chiede `+faststart`: compare prima di `mdat`.
    const moov = output.indexOf('moov');
    const mdat = output.indexOf('mdat');
    expect(moov).toBeGreaterThan(0);
    expect(moov).toBeLessThan(mdat);
  });

  it('un video senza audio esce con la sola traccia video e la stessa durata', async () => {
    const input = await buildMp4({ withAudio: false, withMetadata: true });
    const before = await probeMp4(input);
    const output = await scrubFile('video/mp4', input, TOOLS);
    const after = await probeMp4(output);
    expect(after.types).toEqual(['video']);
    expect(Math.abs(after.duration - before.duration)).toBeLessThan(0.15);
  });

  it('toglie la copertina (attached_pic) e il marcatore che porta, e tiene audio e video', async () => {
    const input = await buildMp4({ withCover: true, withMetadata: false });
    expect(contains(input, MARKERS.cover)).toBe(true);
    const before = await probeMp4(input);
    expect(before.attachedPics).toBe(1);

    const output = await scrubFile('video/mp4', input, TOOLS);
    expect(contains(output, MARKERS.cover)).toBe(false);
    const after = await probeMp4(output);
    expect(after.attachedPics).toBe(0);
    expect(after.types.slice().sort()).toEqual(['audio', 'video']);
  });

  it('un file che non è un MP4 leggibile è ScrubUnreadableError', async () => {
    const fake = Buffer.concat([
      Buffer.from([0, 0, 0, 16]),
      Buffer.from('ftypisom'),
      Buffer.alloc(8),
    ]);
    await expect(scrubFile('video/mp4', fake, TOOLS)).rejects.toBeInstanceOf(ScrubUnreadableError);
  });

  it('programma assente e tempo scaduto → ScrubUnavailableError', async () => {
    const input = await buildMp4({ withMetadata: false });
    await expect(
      scrubFile('video/mp4', input, { ...TOOLS, ffmpegPath: 'ffmpeg-che-non-esiste-xyz' }),
    ).rejects.toBeInstanceOf(ScrubUnavailableError);
    await expect(
      scrubFile('video/mp4', input, { ...TOOLS, videoTimeoutMs: 1 }),
    ).rejects.toBeInstanceOf(ScrubUnavailableError);
  });
});

describe('esiti dei programmi (L1)', () => {
  // Solo programma assente, non eseguibile o tempo scaduto sono «non disponibile» (503): ogni
  // altro esito non riuscito è il file, così lo stesso file dà lo stesso esito su Linux e Windows.
  it.each([
    ['programma assente (ENOENT)', 'unavailable', { code: 'ENOENT' }],
    ['non eseguibile (EACCES)', 'unavailable', { code: 'EACCES' }],
    ['non eseguibile (EPERM)', 'unavailable', { code: 'EPERM' }],
    ['tempo scaduto (killed)', 'unavailable', { code: null, killed: true, signal: 'SIGKILL' }],
    ['arresto anomalo', 'unreadable', { code: null, killed: false, signal: 'SIGSEGV' }],
    ['OOM killer', 'unreadable', { code: null, killed: false, signal: 'SIGKILL' }],
    ['uscita oltre 64 KB', 'unreadable', { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }],
    ['codice numerico, giudicato poi per programma', 2, { code: 2, killed: false, signal: null }],
  ] as const)('%s → %s', (_name, expected, failure) => {
    expect(classifyFailure(failure)).toBe(expected);
  });
});

describe('ambiente dei programmi (M2)', () => {
  const source = {
    PATH: '/percorso/sintetico',
    SystemRoot: 'C:\\Sintetico',
    DATABASE_URL: 'postgres://sintetico@esempio.invalid/db',
    S3_SECRET_KEY: 'segreto-sintetico',
    CSRF_SECRET: 'csrf-sintetico',
    IP_HASH_SALT: 'sale-sintetico',
  };

  it('passa il solo PATH, più SystemRoot su Windows: nessun segreto', () => {
    expect(toolEnv(source, 'win32')).toEqual({
      PATH: '/percorso/sintetico',
      SystemRoot: 'C:\\Sintetico',
    });
    expect(toolEnv(source, 'linux')).toEqual({ PATH: '/percorso/sintetico' });
    expect(toolEnv({ PATH: '/solo' }, 'win32')).toEqual({ PATH: '/solo' });
  });

  it('con l’ambiente ridotto i programmi veri si trovano e ripuliscono ancora', async () => {
    const pdf = await scrubFile('application/pdf', buildPdf({ withMetadata: true }), TOOLS);
    expect(contains(pdf, MARKERS.author)).toBe(false);
    const mp4 = await scrubFile('video/mp4', await buildMp4({ withMetadata: true }), TOOLS);
    expect(contains(mp4, MARKERS.location)).toBe(false);
  });
});

/** Nomi delle cartelle della pulizia presenti ora nella cartella temporanea. */
const scrubDirs = async (): Promise<Set<string>> =>
  new Set((await readdir(tmpdir())).filter((name) => name.startsWith('amoris-scrub-')));

/** Peso massimo raggiunto dal file d'uscita di una pulizia mentre gira, letto a intervalli brevi. */
function watchScrubOutput(known: ReadonlySet<string>): { stop: () => Promise<number> } {
  let peak = 0;
  let active = true;
  const loop = (async () => {
    let dir: string | null = null;
    while (active) {
      try {
        dir ??=
          (await readdir(tmpdir())).find(
            (name) => name.startsWith('amoris-scrub-') && !known.has(name),
          ) ?? null;
        if (dir) {
          for (const file of await readdir(join(tmpdir(), dir))) {
            if (file.startsWith('out-')) {
              peak = Math.max(peak, (await stat(join(tmpdir(), dir, file))).size);
            }
          }
        }
      } catch {
        // La cartella è già stata cancellata: il picco letto fin qui resta.
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  })();
  return {
    stop: async () => {
      active = false;
      await loop;
      return peak;
    },
  };
}

describe('MP4 che moltiplica la scrittura (H1)', () => {
  it('offset stco ripetuti: 413 in pochi secondi, uscita mai oltre il limite, nulla salvato', async () => {
    const limit = 1024 * 1024;
    // Senza limite di scrittura ffmpeg scriverebbe 10 000 volte i byte di `mdat`: decine di MB.
    const input = await buildRepeatedOffsetMp4(10_000);
    expect(input.byteLength).toBeLessThan(limit);
    const tight = await createHarness('api_media_scrub_fs', {
      MEDIA_MAX_VIDEO_BYTES: String(limit),
    });
    try {
      const who = await signIn(tight, { area: 'redazione' });
      const before = await scrubDirs();
      const watch = watchScrubOutput(before);
      const started = Date.now();
      const { payload, headers } = multipartOf(who, 'moltiplicato.mp4', input);
      const response = await tight.app.inject({ method: 'POST', url: '/media', headers, payload });
      const elapsed = Date.now() - started;
      const peak = await watch.stop();

      expect(response.statusCode, response.body).toBe(413);
      expect(response.json().error.code).toBe('MEDIA_TOO_LARGE');
      expect(elapsed).toBeLessThan(10_000);
      expect(peak).toBeLessThan(2 * limit);
      expect(await scrubDirs()).toEqual(before);
      expect(tight.store.puts).toHaveLength(0);
      expect(await tight.db.select({ id: schema.media.id }).from(schema.media)).toHaveLength(0);
    } finally {
      await tight.teardown();
    }
  });

  it('un MP4 normale sotto il limite esce come prima', async () => {
    const input = await buildMp4({ withMetadata: true });
    const output = await scrubFile('video/mp4', input, TOOLS, 100 * 1024 * 1024);
    expect((await probeMp4(output)).types.slice().sort()).toEqual(['audio', 'video']);
  });
});

describe('cartelle rimaste da una pulizia interrotta (L2)', () => {
  /** Riporta indietro la data di modifica della cartella, come se la pulizia fosse di `minutes` minuti fa. */
  async function age(dir: string, minutes: number): Promise<void> {
    const when = new Date(Date.now() - minutes * 60_000);
    await utimes(dir, when, when);
  }

  it('removeLeftoverScrubDirs cancella le sole cartelle amoris-scrub-* più vecchie di 10 minuti', async () => {
    const base = await mkdtemp(join(tmpdir(), 'prova-residui-'));
    try {
      await mkdir(join(base, 'amoris-scrub-residuo'));
      await writeFile(join(base, 'amoris-scrub-residuo', 'in-sintetico'), 'originale sintetico');
      await mkdir(join(base, 'amoris-scrub-vuota'));
      // Una pulizia in corso, anche di un'altra API, ha la cartella recente e non si tocca.
      await mkdir(join(base, 'amoris-scrub-in-corso'));
      await writeFile(join(base, 'amoris-scrub-in-corso', 'in-sintetico'), 'in corso sintetico');
      await mkdir(join(base, 'amoris-scrub-di-nove-minuti'));
      await mkdir(join(base, 'altra-cartella'));
      await writeFile(join(base, 'amoris-scrub-file-non-cartella'), 'resta');
      await age(join(base, 'amoris-scrub-residuo'), 30);
      await age(join(base, 'amoris-scrub-vuota'), 11);
      await age(join(base, 'amoris-scrub-di-nove-minuti'), 9);
      await age(join(base, 'altra-cartella'), 30);
      const lines: string[] = [];
      const removed = await removeLeftoverScrubDirs(
        { error: (_context, message) => lines.push(message) },
        base,
      );
      expect(removed).toBe(2);
      expect((await readdir(base)).sort()).toEqual([
        'altra-cartella',
        'amoris-scrub-di-nove-minuti',
        'amoris-scrub-file-non-cartella',
        'amoris-scrub-in-corso',
      ]);
      expect(lines).toEqual([]);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });

  it('all’avvio l’API cancella le cartelle rimaste vecchie e lascia quelle recenti', async () => {
    const leftover = join(tmpdir(), `amoris-scrub-prova-avvio-${process.pid}`);
    const fresh = join(tmpdir(), `amoris-scrub-prova-recente-${process.pid}`);
    await mkdir(leftover, { recursive: true });
    await writeFile(join(leftover, 'in-sintetico'), 'originale sintetico');
    await age(leftover, 30);
    await mkdir(fresh, { recursive: true });
    const app = await buildApp(testConfig(harness.config.DATABASE_URL), {
      objectStore: harness.store,
    });
    try {
      await app.ready();
      const after = await scrubDirs();
      expect(after.has(`amoris-scrub-prova-avvio-${process.pid}`)).toBe(false);
      expect(after.has(`amoris-scrub-prova-recente-${process.pid}`)).toBe(true);
    } finally {
      await app.close();
      await rm(leftover, { recursive: true, force: true });
      await rm(fresh, { recursive: true, force: true });
    }
  });
});

describe('caricamento e sostituzione (S9)', () => {
  it('POST salva il PDF ripulito, con peso e impronta del file ripulito', async () => {
    const who = await signIn(harness, { area: 'redazione' });
    const input = buildPdf({ pages: 2, withMetadata: true });
    const { payload, headers } = multipartOf(who, 'nota.pdf', input);
    const response = await harness.app.inject({ method: 'POST', url: '/media', headers, payload });
    expect(response.statusCode).toBe(201);
    const row = response.json();
    const stored = harness.store.objects.get(`media-public/${row.storageKey}`);
    expect(stored).toBeDefined();
    const bytes = stored ?? Buffer.alloc(0);
    for (const text of [MARKERS.author, MARKERS.oldAuthor, MARKERS.producer, MARKERS.xmp]) {
      expect(contains(bytes, text)).toBe(false);
    }
    expect(await pdfPageCount(bytes)).toBe(2);
    expect(row.byteSize).toBe(bytes.byteLength);
    expect(row.byteSize).not.toBe(input.byteLength);
    const [saved] = await harness.db
      .select({ checksum: schema.media.checksum })
      .from(schema.media)
      .where(eq(schema.media.id, row.id));
    expect(saved?.checksum?.toString('hex')).toBe(sha256(bytes));
  });

  it.each(['-i.pdf', 'a;b c.pdf', '$(id).pdf'])(
    'un nome ostile (%s) non raggiunge mai un comando: si carica lo stesso',
    async (name) => {
      const who = await signIn(harness, { area: 'redazione' });
      const { payload, headers } = multipartOf(who, name, buildPdf({ withMetadata: true }));
      const response = await harness.app.inject({
        method: 'POST',
        url: '/media',
        headers,
        payload,
      });
      expect(response.statusCode).toBe(201);
      const stored = harness.store.objects.get(`media-public/${response.json().storageKey}`);
      expect(contains(stored ?? Buffer.alloc(0), MARKERS.author)).toBe(false);
    },
  );

  it('POST salva l’MP4 ripulito', async () => {
    const who = await signIn(harness, { area: 'redazione' });
    const input = await buildMp4({ faststart: false, withMetadata: true });
    const { payload, headers } = multipartOf(who, 'clip.mp4', input);
    const response = await harness.app.inject({ method: 'POST', url: '/media', headers, payload });
    expect(response.statusCode).toBe(201);
    const row = response.json();
    const bytes = harness.store.objects.get(`media-public/${row.storageKey}`) ?? Buffer.alloc(0);
    expect(contains(bytes, MARKERS.location)).toBe(false);
    expect(contains(bytes, MARKERS.uuidXmp)).toBe(false);
    expect(row.byteSize).toBe(bytes.byteLength);
    expect((await probeMp4(bytes)).types.slice().sort()).toEqual(['audio', 'video']);
  });

  it('PUT sostituisce con il file ripulito, peso e impronta coerenti', async () => {
    const who = await signIn(harness, { area: 'redazione' });
    const first = multipartOf(who, 'sostituibile.pdf', buildPdf({ pages: 1 }));
    const created = await harness.app.inject({
      method: 'POST',
      url: '/media',
      headers: first.headers,
      payload: first.payload,
    });
    expect(created.statusCode).toBe(201);
    const { id, storageKey } = created.json();

    const next = multipartOf(who, 'sostituibile.pdf', buildPdf({ pages: 4, withMetadata: true }));
    const replaced = await harness.app.inject({
      method: 'PUT',
      url: `/media/${id}/file`,
      headers: next.headers,
      payload: next.payload,
    });
    expect(replaced.statusCode).toBe(200);
    const bytes = harness.store.objects.get(`media-public/${storageKey}`) ?? Buffer.alloc(0);
    for (const text of [MARKERS.author, MARKERS.oldAuthor, MARKERS.producer, MARKERS.xmp]) {
      expect(contains(bytes, text)).toBe(false);
    }
    expect(await pdfPageCount(bytes)).toBe(4);
    expect(replaced.json().byteSize).toBe(bytes.byteLength);
    const [saved] = await harness.db
      .select({ checksum: schema.media.checksum, byteSize: schema.media.byteSize })
      .from(schema.media)
      .where(eq(schema.media.id, id));
    expect(saved?.checksum?.toString('hex')).toBe(sha256(bytes));
    expect(saved?.byteSize).toBe(bytes.byteLength);
  });

  it('un PDF illeggibile è 400 MEDIA_FILE_INVALID e non scrive nulla', async () => {
    const who = await signIn(harness, { area: 'redazione' });
    const before = harness.store.puts.length;
    const { payload, headers } = multipartOf(
      who,
      'rotto.pdf',
      Buffer.from('%PDF-1.4\n% rotto\n%%EOF\n'),
    );
    const response = await harness.app.inject({ method: 'POST', url: '/media', headers, payload });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('MEDIA_FILE_INVALID');
    expect(harness.store.puts.length).toBe(before);
  });

  it('un PDF ripulito che pesa oltre il limite è 413 MEDIA_TOO_LARGE senza scritture', async () => {
    const input = buildPdf({ pages: 1 });
    const cleaned = await scrubFile('application/pdf', input, TOOLS);
    // Serve un file che la riscrittura ingrandisce: il limite sta fra i due pesi.
    expect(cleaned.byteLength).toBeGreaterThan(input.byteLength);
    const limit = input.byteLength + 1;
    const tight = await createHarness('api_media_scrub_peso', {
      MEDIA_MAX_PDF_BYTES: String(limit),
    });
    try {
      const who = await signIn(tight, { area: 'redazione' });
      const { payload, headers } = multipartOf(who, 'grande.pdf', input);
      const response = await tight.app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(response.statusCode).toBe(413);
      expect(response.json().error.code).toBe('MEDIA_TOO_LARGE');
      expect(tight.store.puts).toHaveLength(0);
      expect(await tight.db.select({ id: schema.media.id }).from(schema.media)).toHaveLength(0);
    } finally {
      await tight.teardown();
    }
  });

  it('con la pulizia occupata un’immagine si carica lo stesso', async () => {
    const who = await signIn(harness, { area: 'redazione' });
    let release: () => void = () => {};
    const holding = harness.app.mediaRuntime.scrubGate.run(
      () => new Promise<void>((resolve) => (release = resolve)),
    );
    try {
      const png = await sharp({
        create: { width: 12, height: 12, channels: 3, background: '#28c840' },
      })
        .png()
        .toBuffer();
      const { payload, headers } = multipartOf(who, 'libera.png', png);
      const response = await harness.app.inject({
        method: 'POST',
        url: '/media',
        headers,
        payload,
      });
      expect(response.statusCode).toBe(201);
    } finally {
      release();
      await holding;
    }
  });

  it('le immagini si caricano senza chiamare i programmi, anche se mancano', async () => {
    const broken = await createHarness('api_media_scrub_img', {
      QPDF_PATH: 'qpdf-che-non-esiste-xyz',
      FFMPEG_PATH: 'ffmpeg-che-non-esiste-xyz',
    });
    try {
      const who = await signIn(broken, { area: 'redazione' });
      const png = await sharp({
        create: { width: 20, height: 20, channels: 3, background: '#2840c8' },
      })
        .png()
        .toBuffer();
      const { payload, headers } = multipartOf(who, 'immagine.png', png);
      const response = await broken.app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(response.statusCode).toBe(201);
    } finally {
      await broken.teardown();
    }
  });
});

describe('programma assente o lento (S11)', () => {
  async function appWithLog(overrides: Record<string, string>) {
    const lines: string[] = [];
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const config = testConfig(harness.config.DATABASE_URL, { LOG_LEVEL: 'info', ...overrides });
    const app = await buildApp(config, { objectStore: harness.store, logStream });
    await app.ready();
    const who = await signIn({ ...harness, app } as Harness, { area: 'redazione' });
    return { app, who, lines };
  }

  const MESSAGE =
    'Il caricamento di PDF e video è sospeso: il servizio non riesce a ripulire i file. Avvisa chi gestisce il sito.';

  it.each([
    ['programma assente', { QPDF_PATH: 'qpdf-che-non-esiste-xyz' }],
    ['tempo scaduto', { SCRUB_PDF_TIMEOUT_MS: '1' }],
  ])('%s → 503 MEDIA_SCRUB_UNAVAILABLE, nessuna scrittura, nome fuori dal log', async (_n, env) => {
    const { app, who, lines } = await appWithLog(env);
    try {
      const putsBefore = harness.store.puts.length;
      const [{ total: rowsBefore }] = await harness.db
        .select({ total: schema.media.id })
        .from(schema.media)
        .then((rows) => [{ total: rows.length }]);
      const { payload, headers } = multipartOf(
        who,
        SYNTHETIC_NAME,
        buildPdf({ withMetadata: true }),
      );
      const response = await app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('MEDIA_SCRUB_UNAVAILABLE');
      expect(response.json().error.message).toBe(MESSAGE);
      expect(harness.store.puts.length).toBe(putsBefore);
      const rowsAfter = (await harness.db.select({ id: schema.media.id }).from(schema.media))
        .length;
      expect(rowsAfter).toBe(rowsBefore);
    } finally {
      await app.close();
    }
    const text = lines.join('');
    expect(text).toContain('qpdf');
    expect(text).not.toContain('maria-rossi');
    expect(text).not.toContain(MARKERS.author);
  });

  it('PUT /media/:id/file con il programma assente è 503 e riga e oggetto restano com’erano', async () => {
    const owner = await signIn(harness, { area: 'redazione' });
    const first = multipartOf(owner, 'resta.pdf', buildPdf({ pages: 1 }));
    const created = await harness.app.inject({
      method: 'POST',
      url: '/media',
      headers: first.headers,
      payload: first.payload,
    });
    const { id, storageKey } = created.json();
    const key = `media-public/${storageKey}`;
    const objectBefore = harness.store.objects.get(key);
    const [rowBefore] = await harness.db.select().from(schema.media).where(eq(schema.media.id, id));
    const putsBefore = harness.store.puts.length;

    const { app, who } = await appWithLog({ QPDF_PATH: 'qpdf-che-non-esiste-xyz' });
    try {
      const next = multipartOf(who, 'resta.pdf', buildPdf({ pages: 3, withMetadata: true }));
      const response = await app.inject({
        method: 'PUT',
        url: `/media/${id}/file`,
        headers: next.headers,
        payload: next.payload,
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('MEDIA_SCRUB_UNAVAILABLE');
    } finally {
      await app.close();
    }
    expect(harness.store.puts.length).toBe(putsBefore);
    expect(harness.store.objects.get(key)?.equals(objectBefore ?? Buffer.alloc(0))).toBe(true);
    const [rowAfter] = await harness.db.select().from(schema.media).where(eq(schema.media.id, id));
    expect(rowAfter).toEqual(rowBefore);
  });

  it('il video con ffmpeg assente è 503 e con file illeggibile 400', async () => {
    const { app, who } = await appWithLog({ FFMPEG_PATH: 'ffmpeg-che-non-esiste-xyz' });
    try {
      const { payload, headers } = multipartOf(
        who,
        'clip.mp4',
        await buildMp4({ withMetadata: false }),
      );
      const response = await app.inject({ method: 'POST', url: '/media', headers, payload });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe('MEDIA_SCRUB_UNAVAILABLE');
    } finally {
      await app.close();
    }
    const who2 = await signIn(harness, { area: 'redazione' });
    const fake = Buffer.concat([
      Buffer.from([0, 0, 0, 16]),
      Buffer.from('ftypisom'),
      Buffer.alloc(8),
    ]);
    const { payload, headers } = multipartOf(who2, 'finto.mp4', fake);
    const response = await harness.app.inject({ method: 'POST', url: '/media', headers, payload });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('MEDIA_FILE_INVALID');
  });
});
