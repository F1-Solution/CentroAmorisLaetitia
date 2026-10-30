import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Wave 1G-W9, T1b (DR-312, D203 B): la migrazione mette `useMediaCaption: false` sui blocchi
 * Immagine dei contenuti importati (con `legacy_id`), a ogni livello dell'albero, nelle pagine,
 * nelle copie di lavoro e nelle revisioni; non tocca i contenuti creati nell'area né un valore già
 * presente, e rieseguita non cambia nulla. Database usa e getta, dati inventati (DR-010).
 *
 * Le migrazioni si applicano tutte prima di inserire i dati: per provare l'effetto sui dati la
 * prova riesegue poi il file SQL della migrazione, che per questo dev'essere idempotente.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(here, '..', 'drizzle');
const TAG = '0011_immagini_importate_senza_didascalia_del_media';

const DB_DI_PROVA = `amoris_test_t1b_${process.pid}`;
const baseUrl =
  process.env.DATABASE_URL ?? 'postgres://amoris:sviluppo-locale@localhost:5432/amoris';

function urlPerDatabase(nome: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${nome}`;
  return parsed.toString();
}

let admin: ReturnType<typeof postgres>;
let sql: ReturnType<typeof postgres>;

const MEDIA_ID = '22222222-2222-4222-8222-222222222222';

function image(id: string, extra: Record<string, unknown> = {}) {
  return { type: 'image', id, props: { mediaId: MEDIA_ID, caption: null, ...extra }, children: [] };
}

/** Sezione > riga > colonna > immagine, più un'immagine al primo livello e un testo. */
function documento(prefix: string, extra: Record<string, unknown> = {}) {
  return {
    schema: 1,
    blocks: [
      image(`${prefix}_top`, extra),
      { type: 'rich_text', id: `${prefix}_txt`, props: { html: '<p>x</p>' }, children: [] },
      {
        type: 'section',
        id: `${prefix}_sec`,
        props: {},
        children: [
          {
            type: 'row',
            id: `${prefix}_row`,
            props: {},
            children: [
              {
                type: 'column',
                id: `${prefix}_col`,
                props: {},
                children: [image(`${prefix}_deep`, extra)],
              },
            ],
          },
        ],
      },
    ],
  };
}

interface Img {
  id: string;
  props: Record<string, unknown>;
}

/** Tutti i blocchi Immagine di un documento, a ogni profondità. */
function immagini(doc: unknown): Img[] {
  const out: Img[] = [];
  const visit = (nodes: unknown): void => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes as { type: string; children?: unknown }[]) {
      if (node.type === 'image') out.push(node as unknown as Img);
      visit(node.children);
    }
  };
  visit((doc as { blocks: unknown }).blocks);
  return out;
}

async function migrazione(): Promise<string> {
  return readFile(path.join(migrationsFolder, `${TAG}.sql`), 'utf8');
}

/** Esegue le istruzioni come il migratore di drizzle: una per volta, nella stessa sessione. */
async function applica(): Promise<void> {
  const istruzioni = (await migrazione()).split('--> statement-breakpoint');
  await sql.begin(async (tx) => {
    for (const istruzione of istruzioni) await tx.unsafe(istruzione);
  });
}

beforeAll(async () => {
  admin = postgres(urlPerDatabase('postgres'), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${DB_DI_PROVA}" with (force)`);
  await admin.unsafe(`create database "${DB_DI_PROVA}"`);
  sql = postgres(urlPerDatabase(DB_DI_PROVA), { max: 1, onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder });
});

afterAll(async () => {
  await sql?.end({ timeout: 5 });
  await admin?.unsafe(`drop database if exists "${DB_DI_PROVA}" with (force)`);
  await admin?.end({ timeout: 5 });
});

describe('DR-312: migrazione dei blocchi Immagine importati', () => {
  it('è nel registro delle migrazioni di drizzle', async () => {
    const journal = JSON.parse(
      await readFile(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: { tag: string }[] };
    expect(journal.entries.map((e) => e.tag)).toContain(TAG);
  });

  it('segna i blocchi importati, lascia stare i nuovi, e rieseguita non cambia nulla', async () => {
    const [user] = await sql<{ id: string }[]>`
      insert into users (email, full_name) values ('t1b@esempio.invalid', 'Persona inventata')
      returning id`;
    const [importata] = await sql<{ id: string }[]>`
      insert into contents (type, slug, path, title, legacy_id, blocks)
      values ('page', 'importata', '/importata/', 'Importata', 9001,
              ${JSON.stringify(documento('imp'))}::jsonb)
      returning id`;
    const [conValore] = await sql<{ id: string }[]>`
      insert into contents (type, slug, path, title, legacy_id, blocks)
      values ('page', 'gia-segnata', '/gia-segnata/', 'Già segnata', 9002,
              ${JSON.stringify(documento('val', { useMediaCaption: true }))}::jsonb)
      returning id`;
    const [nuova] = await sql<{ id: string }[]>`
      insert into contents (type, slug, path, title, blocks)
      values ('page', 'nuova', '/nuova/', 'Nuova', ${JSON.stringify(documento('new'))}::jsonb)
      returning id`;
    await sql`
      insert into content_drafts (content_id, author_id, title, blocks, base_updated_at)
      values (${importata!.id}, ${user!.id}, 'Copia', ${JSON.stringify(documento('drf'))}::jsonb, now())`;
    await sql`
      insert into content_revisions (content_id, revision_no, title, blocks)
      values (${importata!.id}, 1, 'Revisione', ${JSON.stringify(documento('rev'))}::jsonb),
             (${nuova!.id}, 1, 'Revisione nuova', ${JSON.stringify(documento('rnw'))}::jsonb)`;

    await applica();

    const leggi = async () => ({
      contents: await sql<{ id: string; blocks: unknown }[]>`select id, blocks from contents`,
      drafts: await sql<{ blocks: unknown }[]>`select blocks from content_drafts`,
      revisions: await sql<
        { content_id: string; blocks: unknown }[]
      >`select content_id, blocks from content_revisions`,
    });
    const dopo = await leggi();
    const docDi = (id: string) => dopo.contents.find((r) => r.id === id)!.blocks;

    // Contenuto importato: entrambe le immagini, anche quella annidata, hanno il segno.
    const imp = immagini(docDi(importata!.id));
    expect(imp).toHaveLength(2);
    expect(imp.every((b) => b.props.useMediaCaption === false)).toBe(true);
    // Il resto del documento resta identico.
    const atteso = documento('imp');
    for (const b of immagini(atteso)) b.props.useMediaCaption = false;
    expect(docDi(importata!.id)).toEqual(atteso);

    // Un valore già presente non si sovrascrive.
    expect(immagini(docDi(conValore!.id)).map((b) => b.props.useMediaCaption)).toEqual([
      true,
      true,
    ]);
    // Un contenuto creato nell'area non si tocca.
    expect(docDi(nuova!.id)).toEqual(documento('new'));

    // Copia di lavoro e revisione del contenuto importato: segnate; revisione del nuovo: no.
    expect(immagini(dopo.drafts[0]!.blocks).every((b) => b.props.useMediaCaption === false)).toBe(
      true,
    );
    const revImp = dopo.revisions.find((r) => r.content_id === importata!.id)!;
    const revNew = dopo.revisions.find((r) => r.content_id === nuova!.id)!;
    expect(immagini(revImp.blocks).every((b) => b.props.useMediaCaption === false)).toBe(true);
    expect(revNew.blocks).toEqual(documento('rnw'));

    // Rieseguita, non cambia nulla.
    await applica();
    expect(await leggi()).toEqual(dopo);
  });

  it('non lascia funzioni d’appoggio nello schema pubblico', async () => {
    const righe = await sql<{ n: string }[]>`
      select count(*)::text as n from pg_proc
      where pronamespace = 'public'::regnamespace and proname like 'amoris%'`;
    expect(Number(righe[0]?.n)).toBe(0);
  });
});
