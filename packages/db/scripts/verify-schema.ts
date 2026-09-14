/**
 * Dimostra che lo schema Drizzle e la forma canonica `docs/architecture/schema.sql`
 * producono lo **stesso** database.
 *
 * Non confronta i due file: costruisce due database veri sullo stesso server —
 * uno applicando le migrazioni, l'altro applicando lo schema canonico — poi
 * interroga il catalogo di PostgreSQL e confronta tabelle, colonne, tipi
 * enumerati, vincoli e indici. Alla fine li distrugge entrambi.
 *
 * I nomi di vincoli e indici sono deliberatamente ignorati: drizzle-kit nomina
 * le chiavi esterne in modo diverso da PostgreSQL, e un nome diverso non è una
 * differenza di struttura. Le differenze di nome sono riportate come nota.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(here, '..', 'drizzle');
const canonicalPath = path.join(here, '..', '..', '..', 'docs', 'architecture', 'schema.sql');

const CANONICAL_DB = 'amoris_verify_canonical';
const DRIZZLE_DB = 'amoris_verify_drizzle';

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  console.error('DATABASE_URL non è impostata. Copia .env.example in .env e riprova.');
  process.exit(1);
}

function urlForDatabase(name: string): string {
  const parsed = new URL(baseUrl!);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** Righe del catalogo, normalizzate a stringa e ordinate: il confronto è fra insiemi. */
const QUERIES = {
  tabelle: `
    select table_name || ''
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'`,
  colonne: `
    select table_name || ' . ' || column_name
         || ' :: ' || udt_name
         || ' | null=' || is_nullable
         || ' | default=' || regexp_replace(coalesce(column_default, ''), '\\s+', ' ', 'g')
         || ' | generated=' || regexp_replace(coalesce(generation_expression, ''), '\\s+', ' ', 'g')
    from information_schema.columns
    where table_schema = 'public'`,
  'tipi enumerati': `
    select t.typname || ' = ' || e.enumlabel || ' (' || e.enumsortorder::text || ')'
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace`,
  vincoli: `
    select c.conrelid::regclass::text || ' [' || c.contype::text || '] '
         || regexp_replace(pg_get_constraintdef(c.oid), '\\s+', ' ', 'g')
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public'`,
  indici: `
    select tablename || ' :: '
         || regexp_replace(
              regexp_replace(indexdef, 'INDEX [^ ]+ ON', 'INDEX ON'),
              '\\s+', ' ', 'g')
    from pg_indexes
    where schemaname = 'public'`,
  'nomi dei vincoli': `
    select c.conrelid::regclass::text || ' [' || c.contype::text || '] ' || c.conname
    from pg_constraint c
    join pg_class r on r.oid = c.conrelid
    join pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and c.contype in ('u', 'c', 'p')`,
} as const;

type Catalogo = Record<keyof typeof QUERIES, string[]>;

async function leggiCatalogo(url: string): Promise<Catalogo> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const risultato = {} as Catalogo;
    for (const [nome, query] of Object.entries(QUERIES) as [keyof typeof QUERIES, string][]) {
      const righe = await sql.unsafe<{ column: string }[]>(query);
      risultato[nome] = righe.map((r) => String(Object.values(r)[0])).sort();
    }
    return risultato;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function differenze(atteso: string[], trovato: string[]): { mancanti: string[]; in_piu: string[] } {
  const a = new Set(atteso);
  const b = new Set(trovato);
  return {
    mancanti: atteso.filter((x) => !b.has(x)),
    in_piu: trovato.filter((x) => !a.has(x)),
  };
}

const admin = postgres(urlForDatabase('postgres'), { max: 1, onnotice: () => {} });

async function ricrea(nome: string): Promise<void> {
  await admin.unsafe(`drop database if exists "${nome}" with (force)`);
  await admin.unsafe(`create database "${nome}"`);
}

let uscita = 0;

try {
  console.error('Costruzione dei due database di confronto…');
  await ricrea(CANONICAL_DB);
  await ricrea(DRIZZLE_DB);

  // 1. La forma canonica, applicata cosí com'è.
  const canonico = postgres(urlForDatabase(CANONICAL_DB), { max: 1, onnotice: () => {} });
  try {
    await canonico.unsafe(await readFile(canonicalPath, 'utf8'));
  } finally {
    await canonico.end({ timeout: 5 });
  }

  // 2. Le migrazioni di Drizzle.
  const migrato = postgres(urlForDatabase(DRIZZLE_DB), { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(migrato), { migrationsFolder });
  } finally {
    await migrato.end({ timeout: 5 });
  }

  const [atteso, trovato] = await Promise.all([
    leggiCatalogo(urlForDatabase(CANONICAL_DB)),
    leggiCatalogo(urlForDatabase(DRIZZLE_DB)),
  ]);

  console.error('');
  for (const nome of Object.keys(QUERIES) as (keyof typeof QUERIES)[]) {
    const { mancanti, in_piu } = differenze(atteso[nome], trovato[nome]);
    const soloNomi = nome === 'nomi dei vincoli';
    const totale = atteso[nome].length;

    if (mancanti.length === 0 && in_piu.length === 0) {
      console.error(`  OK   ${nome}: ${totale} voci, identiche.`);
      continue;
    }
    if (soloNomi) {
      console.error(
        `  nota ${nome}: ${mancanti.length} nomi diversi. Non è una differenza di struttura.`,
      );
      continue;
    }
    uscita = 1;
    console.error(`  DIFF ${nome}: ${mancanti.length} mancanti, ${in_piu.length} in più.`);
    for (const riga of mancanti) console.error(`         manca:  ${riga}`);
    for (const riga of in_piu) console.error(`         in più: ${riga}`);
  }

  console.error('');
  console.error(
    uscita === 0
      ? 'Lo schema Drizzle corrisponde alla forma canonica.'
      : 'Lo schema Drizzle NON corrisponde alla forma canonica: vedi le differenze qui sopra.',
  );
} catch (error) {
  uscita = 1;
  console.error('Verifica fallita:', error instanceof Error ? error.message : error);
} finally {
  await admin.unsafe(`drop database if exists "${CANONICAL_DB}" with (force)`).catch(() => {});
  await admin.unsafe(`drop database if exists "${DRIZZLE_DB}" with (force)`).catch(() => {});
  await admin.end({ timeout: 5 });
}

process.exit(uscita);
