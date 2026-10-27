import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

/** File sintetici per le prove della pulizia dei metadati: nessun dato reale, tutto generato qui. */

const run = promisify(execFile);

export const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg';
export const FFPROBE = process.env.FFPROBE_PATH ?? 'ffprobe';
export const QPDF = process.env.QPDF_PATH ?? 'qpdf';

/** Stringhe che non devono mai sopravvivere alla pulizia. */
export const MARKERS = {
  author: 'AUTORE-SINTETICO-ATTUALE',
  oldAuthor: 'AUTORE-SINTETICO-VECCHIO',
  producer: 'PROGRAMMA-SINTETICO',
  xmp: 'XMP-SINTETICO-CREATORE',
  location: '+45.4642+009.1900',
  artist: 'ARTISTA-SINTETICO',
  chapter: 'CAPITOLO-SINTETICO',
  subtitle: 'SOTTOTITOLO-SINTETICO',
  uuidXmp: 'XMP-SINTETICO-VIDEO',
  cover: 'COPERTINA-SINTETICA-EXIF',
} as const;

const concat = (...parts: (Buffer | string)[]): Buffer =>
  Buffer.concat(
    parts.map((part) => (typeof part === 'string' ? Buffer.from(part, 'latin1') : part)),
  );

type PdfObject = readonly [number, string];

/** Scrive gli oggetti di una revisione, con la propria tabella `xref` e il suo trailer. */
function writeRevision(
  prefix: Buffer,
  objects: readonly PdfObject[],
  trailer: string,
  contiguous: boolean,
): Buffer {
  let out = prefix;
  const offsets = new Map<number, number>();
  for (const [number, body] of objects) {
    offsets.set(number, out.length);
    out = concat(out, `${number} 0 obj\n${body}\nendobj\n`);
  }
  const xrefAt = out.length;
  const entry = (offset: number) => `${String(offset).padStart(10, '0')} 00000 n \n`;
  let xref = 'xref\n';
  if (contiguous) {
    xref += `0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const [number] of objects) xref += entry(offsets.get(number) ?? 0);
  } else {
    for (const [number] of objects) xref += `${number} 1\n${entry(offsets.get(number) ?? 0)}`;
  }
  return concat(out, `${xref}trailer\n${trailer}\nstartxref\n${xrefAt}\n%%EOF\n`);
}

const stream = (dictionary: string, content: string): string =>
  `<< ${dictionary} /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`;

export interface PdfOptions {
  readonly pages?: number;
  /** Se presente: dizionario Info, flusso XMP nel catalogo e un aggiornamento incrementale. */
  readonly withMetadata?: boolean;
  /** Parola scritta nel testo visibile di ogni pagina. */
  readonly visibleText?: string;
}

/** PDF valido e minimo; con `withMetadata` porta Info vecchio, XMP e un aggiornamento che li riscrive. */
export function buildPdf(options: PdfOptions = {}): Buffer {
  const pages = options.pages ?? 2;
  const withMetadata = options.withMetadata ?? false;
  const text = options.visibleText ?? 'testo visibile sintetico';
  const first = 3;
  const pageNumbers = Array.from({ length: pages }, (_, index) => first + index * 2);
  const objects: PdfObject[] = [
    [
      1,
      `<< /Type /Catalog /Pages 2 0 R${withMetadata ? ` /Metadata ${first + pages * 2 + 1} 0 R` : ''} >>`,
    ],
    [
      2,
      `<< /Type /Pages /Kids [${pageNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages} >>`,
    ],
  ];
  for (const number of pageNumbers) {
    objects.push([
      number,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents ${number + 1} 0 R >>`,
    ]);
    objects.push([number + 1, stream('', `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`)]);
  }
  const infoNumber = first + pages * 2;
  objects.push([
    infoNumber,
    withMetadata
      ? `<< /Author (${MARKERS.oldAuthor}) /Title (Titolo sintetico) >>`
      : '<< /Title (Titolo sintetico) >>',
  ]);
  if (withMetadata) {
    const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><dc:creator>${MARKERS.xmp}</dc:creator></x:xmpmeta>`;
    objects.push([infoNumber + 1, stream('/Type /Metadata /Subtype /XML', xmp)]);
  }
  const size = objects.length + 1;
  const base = writeRevision(
    Buffer.from('%PDF-1.7\n', 'latin1'),
    objects,
    `<< /Size ${size} /Root 1 0 R /Info ${infoNumber} 0 R >>`,
    true,
  );
  if (!withMetadata) return base;

  const startxref = Number(/startxref\n(\d+)/.exec(base.toString('latin1'))?.[1]);
  const update: PdfObject = [
    infoNumber,
    `<< /Author (${MARKERS.author}) /Producer (${MARKERS.producer}) /Creator (${MARKERS.producer}) /CreationDate (D:20200101000000Z) /Title (Titolo sintetico) >>`,
  ];
  return writeRevision(
    base,
    [update],
    `<< /Size ${size} /Root 1 0 R /Info ${infoNumber} 0 R /Prev ${startxref} >>`,
    false,
  );
}

/** Quante pagine ha un PDF, secondo `qpdf` (che deve poterlo leggere). */
export async function pdfPageCount(pdf: Buffer, qpdf = QPDF): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), 'prova-pdf-'));
  try {
    const file = join(dir, 'file.pdf');
    await writeFile(file, pdf);
    const { stdout } = await run(qpdf, ['--show-npages', file]);
    return Number(stdout.trim());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface Mp4Options {
  /** Con `true` l'indice `moov` sta in testa al file. */
  readonly faststart?: boolean;
  readonly withAudio?: boolean;
  /** Metadati, capitoli, sottotitoli, traccia timecode e riquadro XMP `uuid`. */
  readonly withMetadata?: boolean;
  /** Copertina JPEG (traccia `attached_pic`) con un marcatore in un segmento COM. */
  readonly withCover?: boolean;
  /** Formato della copertina: `jpeg` se assente; `png` prova una traccia `png` fuori elenco. */
  readonly coverFormat?: 'jpeg' | 'png';
  /** Codec video: `h264` se assente (DR-264); `mpeg4` serve a provare il rifiuto. */
  readonly videoCodec?: 'h264' | 'hevc' | 'mpeg4';
  /** Codec audio: `aac` se assente (DR-264); `mp3` e `ac3` servono a provare il rifiuto. */
  readonly audioCodec?: 'aac' | 'mp3' | 'ac3';
}

const VIDEO_ENCODERS = { h264: 'libx264', hevc: 'libx265', mpeg4: 'mpeg4' } as const;
const AUDIO_ENCODERS = { aac: 'aac', mp3: 'libmp3lame', ac3: 'ac3' } as const;

/** JPEG sintetico con un commento che porta il marcatore, come farebbe un EXIF. */
async function coverJpeg(): Promise<Buffer> {
  const jpeg = await sharp({
    create: { width: 16, height: 16, channels: 3, background: '#c82828' },
  })
    .jpeg()
    .toBuffer();
  const text = Buffer.from(MARKERS.cover, 'latin1');
  const comment = Buffer.alloc(4);
  comment.writeUInt16BE(0xfffe, 0);
  comment.writeUInt16BE(text.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, 2), comment, text, jpeg.subarray(2)]);
}

/** PNG sintetico piccolo, come copertina. */
const coverPng = (): Promise<Buffer> =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: '#2840c8' } })
    .png()
    .toBuffer();

/** Riquadro `uuid` con il GUID dell'XMP, in coda al file. */
function xmpUuidBox(): Buffer {
  const payload = Buffer.from(
    `<x:xmpmeta><dc:creator>${MARKERS.uuidXmp}</dc:creator></x:xmpmeta>`,
    'latin1',
  );
  const guid = Buffer.from('BE7ACFCB97A942E89C71999491E3AFAC', 'hex');
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + guid.length + payload.length, 0);
  head.write('uuid', 4, 'latin1');
  return Buffer.concat([head, guid, payload]);
}

/** MP4 breve generato con `ffmpeg -f lavfi`; con `withMetadata` porta posizione, artista, capitoli, sottotitoli, timecode e XMP. */
export async function buildMp4(options: Mp4Options = {}): Promise<Buffer> {
  const {
    faststart = false,
    withAudio = true,
    withMetadata = true,
    withCover = false,
    coverFormat = 'jpeg',
    videoCodec = 'h264',
    audioCodec = 'aac',
  } = options;
  const dir = await mkdtemp(join(tmpdir(), 'prova-mp4-'));
  try {
    const out = join(dir, 'out.mp4');
    const args = ['-y', '-nostdin', '-hide_banner', '-loglevel', 'error'];
    args.push('-f', 'lavfi', '-i', 'testsrc=duration=2:size=64x64:rate=10');
    if (withAudio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440:duration=2');
    const maps = ['-map', '0:v'];
    if (withAudio) maps.push('-map', '1:a');
    const codecs = ['-c:v', VIDEO_ENCODERS[videoCodec]];
    if (videoCodec === 'h264') codecs.push('-pix_fmt', 'yuv420p');
    if (withAudio) codecs.push('-c:a', AUDIO_ENCODERS[audioCodec]);
    const extra: string[] = [];
    if (withMetadata) {
      const srt = join(dir, 'sub.srt');
      const meta = join(dir, 'meta.txt');
      await writeFile(srt, `1\n00:00:00,000 --> 00:00:01,000\n${MARKERS.subtitle}\n`);
      await writeFile(
        meta,
        `;FFMETADATA1\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=1000\ntitle=${MARKERS.chapter}\n`,
      );
      const base = withAudio ? 2 : 1;
      args.push('-i', srt, '-i', meta);
      maps.push('-map', `${base}:s`);
      codecs.push('-c:s', 'mov_text');
      extra.push(
        '-map_metadata',
        String(base + 1),
        '-map_chapters',
        String(base + 1),
        '-metadata',
        `location=${MARKERS.location}`,
        '-metadata',
        `artist=${MARKERS.artist}`,
        '-timecode',
        '01:02:03:04',
      );
    }
    if (withCover) {
      const cover = join(dir, coverFormat === 'png' ? 'cover.png' : 'cover.jpg');
      await writeFile(cover, coverFormat === 'png' ? await coverPng() : await coverJpeg());
      const inputs = args.filter((one) => one === '-i').length;
      args.push('-i', cover);
      maps.push('-map', String(inputs));
      codecs.push('-c:v:1', 'copy', '-disposition:v:1', 'attached_pic');
    }
    args.push(...maps, ...codecs, ...extra);
    // `use_metadata_tags` porta la posizione nel riquadro `meta` con chiavi, come le camere.
    const flags = [faststart ? '+faststart' : '', withMetadata ? '+use_metadata_tags' : ''].join(
      '',
    );
    if (flags) args.push('-movflags', flags);
    args.push(out);
    await run(FFMPEG, args);
    const file = await readFile(out);
    return withMetadata ? Buffer.concat([file, xmpUuidBox()]) : file;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

interface Mp4Box {
  readonly type: string;
  readonly start: number;
  readonly end: number;
}

/** Riquadri MP4 fra `start` e `end`, senza scendere nei figli. */
function mp4Boxes(file: Buffer, start: number, end: number): Mp4Box[] {
  const boxes: Mp4Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    const size = file.readUInt32BE(at);
    const length = size === 0 ? end - at : size;
    boxes.push({ type: file.toString('latin1', at + 4, at + 8), start: at, end: at + length });
    at += length;
  }
  return boxes;
}

const mp4Box = (type: string, payload: Buffer): Buffer => {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + payload.length, 0);
  head.write(type, 4, 'latin1');
  return Buffer.concat([head, payload]);
};

const uint32s = (values: readonly number[]): Buffer => {
  const out = Buffer.alloc(4 * values.length);
  values.forEach((value, index) => out.writeUInt32BE(value >>> 0, index * 4));
  return out;
};

/**
 * MP4 sintetico la cui tabella `stco` ripete lo stesso offset: `samples` campioni puntano tutti
 * all'intero `mdat`, così `ffmpeg -c copy` scrive `samples` volte i suoi byte (H1).
 */
export async function buildRepeatedOffsetMp4(samples: number): Promise<Buffer> {
  const source = await buildMp4({ withAudio: false, withMetadata: false, faststart: false });
  const top = mp4Boxes(source, 0, source.length);
  const ftyp = top.find((box) => box.type === 'ftyp');
  const mdat = top.find((box) => box.type === 'mdat');
  const moov = top.find((box) => box.type === 'moov');
  if (!ftyp || !mdat || !moov) throw new Error('MP4 sintetico senza ftyp, mdat o moov');
  const sampleBytes = mdat.end - mdat.start - 8;
  // Il nuovo file è ftyp, mdat, moov: i dati di mdat iniziano subito dopo la sua intestazione.
  const dataOffset = ftyp.end - ftyp.start + 8;
  const containers = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf']);

  const rebuild = (box: Mp4Box): Buffer => {
    if (box.type === 'stbl') {
      const stsd = mp4Boxes(source, box.start + 8, box.end).find((kid) => kid.type === 'stsd');
      if (!stsd) throw new Error('MP4 sintetico senza stsd');
      return mp4Box(
        'stbl',
        Buffer.concat([
          source.subarray(stsd.start, stsd.end),
          mp4Box('stts', uint32s([0, 1, samples, 1])),
          mp4Box('stsc', uint32s([0, 1, 1, 1, 1])),
          mp4Box('stsz', uint32s([0, sampleBytes, samples])),
          mp4Box('stco', uint32s([0, samples, ...new Array<number>(samples).fill(dataOffset)])),
        ]),
      );
    }
    if (box.type === 'edts' || box.type === 'udta') return Buffer.alloc(0);
    if (containers.has(box.type)) {
      return mp4Box(box.type, Buffer.concat(mp4Boxes(source, box.start + 8, box.end).map(rebuild)));
    }
    return source.subarray(box.start, box.end);
  };

  return Buffer.concat([
    source.subarray(ftyp.start, ftyp.end),
    mp4Box('mdat', source.subarray(mdat.start + 8, mdat.end)),
    rebuild(moov),
  ]);
}

export interface Mp4Probe {
  readonly types: readonly string[];
  readonly duration: number;
  /** Tracce che sono una copertina (`attached_pic`). */
  readonly attachedPics: number;
}

/** Tipi delle tracce (in ordine) e durata, secondo `ffprobe`. */
export async function probeMp4(mp4: Buffer): Promise<Mp4Probe> {
  const dir = await mkdtemp(join(tmpdir(), 'prova-probe-'));
  try {
    const file = join(dir, 'file.mp4');
    await writeFile(file, mp4);
    const { stdout } = await run(FFPROBE, [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type:stream_disposition=attached_pic:format=duration',
      '-of',
      'json',
      file,
    ]);
    const parsed = JSON.parse(stdout) as {
      streams: { codec_type: string; disposition?: { attached_pic?: number } }[];
      format: { duration: string };
    };
    return {
      types: parsed.streams.map((one) => one.codec_type),
      duration: Number(parsed.format.duration),
      attachedPics: parsed.streams.filter((one) => one.disposition?.attached_pic === 1).length,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Vero se i byte contengono la stringa (in latino-1, come la si è scritta). */
export const contains = (bytes: Buffer, text: string): boolean =>
  bytes.includes(Buffer.from(text, 'latin1'));

/** Vero se `ffmpeg` ha l'encoder: le prove `hevc` saltano solo se manca (e lo dicono), mai in silenzio. */
export async function hasEncoder(name: string): Promise<boolean> {
  const { stdout } = await run(FFMPEG, ['-hide_banner', '-encoders']);
  return stdout.split(/\r?\n/).some((line) => line.trim().split(/\s+/)[1] === name);
}

/** Fallisce con un messaggio chiaro se mancano i programmi: la CI non deve mai saltare queste prove. */
export async function assertToolsInstalled(): Promise<void> {
  const missing: string[] = [];
  for (const [name, path, flag] of [
    ['qpdf', QPDF, '--version'],
    ['ffmpeg', FFMPEG, '-version'],
    ['ffprobe', FFPROBE, '-version'],
  ] as const) {
    try {
      await run(path, [flag]);
    } catch {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Programmi mancanti per le prove della pulizia dei metadati: ${missing.join(', ')}. ` +
        'Installali o impostali con QPDF_PATH, FFMPEG_PATH e FFPROBE_PATH (vedi HO-032).',
    );
  }
}
