import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Test di **integrazione** su PostgreSQL vero, come impone DR-007.
 *
 * Non verifica che lo schema esista — quello lo fa `pnpm db:verify` — ma che i
 * vincoli **respingano davvero** ciò che devono respingere. Un vincolo scritto e
 * mai provato è una promessa, non una garanzia.
 *
 * Costruisce un database usa e getta, ci applica le migrazioni e alla fine lo
 * distrugge. Tutti i dati usati sono inventati (DR-010).
 */

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

const DB_DI_PROVA = `amoris_test_${process.pid}`;

const baseUrl =
  process.env.DATABASE_URL ?? 'postgres://amoris:sviluppo-locale@localhost:5432/amoris';

function urlPerDatabase(nome: string): string {
  const parsed = new URL(baseUrl);
  parsed.pathname = `/${nome}`;
  return parsed.toString();
}

let admin: ReturnType<typeof postgres>;
let sql: ReturnType<typeof postgres>;

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

describe('lo schema si applica', () => {
  it('crea tutte le tabelle della forma canonica', async () => {
    const righe = await sql<{ n: string }[]>`
      select count(*)::text as n
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'`;
    // 33 dal 2026-09-20: DR-068 aggiunge `content_drafts`, le copie di lavoro
    // dell'editor. Erano 32 dalla Fase 1B.
    expect(Number(righe[0]?.n)).toBe(33);
  });

  it('installa le estensioni che lo schema usa davvero', async () => {
    const righe = await sql<{ extname: string }[]>`
      select extname from pg_extension where extname in ('pgcrypto', 'citext', 'unaccent')`;
    expect(righe.map((r) => r.extname).sort()).toEqual(['citext', 'pgcrypto', 'unaccent']);
  });
});

describe('i vincoli respingono ciò che devono', () => {
  it('rifiuta un percorso di contenuto che non ha la forma dei permalink', async () => {
    await expect(
      sql`insert into contents (type, slug, path, title) values ('page', 'prova', 'senza-barre', 'Prova')`,
    ).rejects.toThrow(/contents_path_shape/);
  });

  it('rifiuta un contenuto pubblicato senza data di pubblicazione', async () => {
    await expect(
      sql`insert into contents (type, status, slug, path, title)
          values ('page', 'published', 'prova', '/prova/', 'Prova')`,
    ).rejects.toThrow(/contents_published_has_date/);
  });

  it('rifiuta un percorso di media fuori da /media/', async () => {
    await expect(
      sql`insert into media (storage_key, public_path, file_name, mime_type, byte_size, checksum, uploaded_at)
          values ('2026/09/foto.jpg', '/altrove/foto.jpg', 'foto.jpg', 'image/jpeg', 1024,
                  decode('00', 'hex'), now())`,
    ).rejects.toThrow(/media_public_path_shape/);
  });

  it('rifiuta un redirect che punta a se stesso', async () => {
    await expect(
      sql`insert into redirects (source_path, target_path) values ('/vecchio/', '/vecchio/')`,
    ).rejects.toThrow(/redirects_no_self_loop/);
  });

  it('rifiuta una voce di menu che dichiara un tipo e ne punta un altro', async () => {
    const [menu] = await sql<{ id: string }[]>`
      insert into menus (key, label) values ('principale', 'Menu principale') returning id`;
    await expect(
      sql`insert into menu_items (menu_id, kind, label, url)
          values (${menu!.id}, 'content', 'Voce incoerente', 'https://esempio.invalid/')`,
    ).rejects.toThrow(/menu_items_target_matches_kind/);
  });
});

describe('la ricerca full-text è in italiano e non può divergere', () => {
  it('genera il vettore di ricerca da sola, e trova la forma flessa', async () => {
    await sql`insert into contents (type, slug, path, title, content_text)
              values ('page', 'famiglia', '/famiglia/', 'Percorsi per la famiglia',
                      'Incontri di gruppo per le famiglie del territorio')`;

    const righe = await sql<{ title: string }[]>`
      select title from contents
      where search_vector @@ to_tsquery('italian', 'famiglia')`;

    expect(righe).toHaveLength(1);
    expect(righe[0]?.title).toBe('Percorsi per la famiglia');
  });
});
