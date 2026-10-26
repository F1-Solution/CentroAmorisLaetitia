import { schema, type Database } from '@amoris/db';
import { inArray } from 'drizzle-orm';

/** Nome dei file caricati: pulizia come `sanitize_file_name` di WordPress e unicità (S6). */

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const FALLBACK_STEM = 'file';
/** Lascia spazio al suffisso `-N` e a quelli delle derivate `-LxA` entro i 255 caratteri del segmento. */
const MAX_STEM_LENGTH = 100;

/** Toglie cartelle, accenti e caratteri non ammessi; spazi in trattini, estensione minuscola. */
export function sanitizeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const plain = base
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-');

  const dot = plain.lastIndexOf('.');
  const stemRaw = dot < 0 ? plain : plain.slice(0, dot);
  const extension = dot < 0 ? '' : plain.slice(dot + 1).toLowerCase();
  const stem = stemRaw.slice(0, MAX_STEM_LENGTH).replace(/^[.-]+|[.-]+$/g, '') || FALLBACK_STEM;
  return extension ? `${stem}.${extension}` : stem;
}

/** Quali fra i percorsi pubblici dati sono già di un media o di una sua derivata. */
export async function takenPaths(
  db: Database | Transaction,
  paths: readonly string[],
): Promise<Set<string>> {
  if (paths.length === 0) return new Set();
  const [originals, variants] = await Promise.all([
    db
      .select({ path: schema.media.publicPath })
      .from(schema.media)
      .where(inArray(schema.media.publicPath, [...paths])),
    db
      .select({ path: schema.mediaVariants.publicPath })
      .from(schema.mediaVariants)
      .where(inArray(schema.mediaVariants.publicPath, [...paths])),
  ]);
  return new Set([...originals, ...variants].map((row) => row.path));
}

export interface UniqueNameInput {
  /** Cartella `AAAA/MM`, senza barre agli estremi. */
  readonly folder: string;
  /** Nome già ripulito. */
  readonly fileName: string;
  /** Altri percorsi che il nome occuperebbe, per esempio le derivate: li aggiunge chi le genera. */
  readonly extraPaths?: (fileName: string) => readonly string[];
}

/** Primo nome libero fra `nome`, `nome-1`, `nome-2`…, con originale e percorsi candidati liberi fra originali e derivate. */
export async function uniqueFileName(
  db: Database | Transaction,
  input: UniqueNameInput,
): Promise<string> {
  const dot = input.fileName.lastIndexOf('.');
  const stem = dot < 0 ? input.fileName : input.fileName.slice(0, dot);
  const extension = dot < 0 ? '' : input.fileName.slice(dot);

  for (let attempt = 0; ; attempt += 1) {
    const candidate = attempt === 0 ? input.fileName : `${stem}-${attempt}${extension}`;
    const paths = [`/media/${input.folder}/${candidate}`, ...(input.extraPaths?.(candidate) ?? [])];
    const taken = await takenPaths(db, paths);
    if (taken.size === 0) return candidate;
  }
}
