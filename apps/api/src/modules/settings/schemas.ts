import { z } from 'zod';

export const settingSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  label: z.string(),
  description: z.string().nullable(),
  isSecret: z.boolean(),
  updatedAt: z.string(),
});

/** Solo nomi IANA, come li accetta il sito: canonici per Intl, «UTC» o un alias scritto con le maiuscole giuste. */
function isTimeZone(value: string): boolean {
  let resolved: string;
  try {
    resolved = new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return false;
  }
  if (resolved !== 'UTC' && !Intl.supportedValuesOf('timeZone').includes(resolved)) return false;
  // «europe/rome» si risolve in «Europe/Rome»: è lo stesso nome scritto male, non un alias.
  return value === resolved || value.toLowerCase() !== resolved.toLowerCase();
}

/** Un intero, anche scritto come testo: la schermata rimanda testo per un valore rimasto `null`. */
const integer = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value) ? Number(value) : value),
    z.number().int().min(min).max(max),
  );

export const keyParam = z.object({ key: z.string().min(1).max(200) });

/**
 * Forma del valore per le chiavi che il sito pubblico legge come dati
 * dell'organizzazione (DR-185); le altre chiavi restano libere come prima.
 */
export const SETTING_VALUE_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  'contact.address': z.string().max(500).nullable(),
  'contact.phone': z.string().max(50),
  // Solo http e https: `url()` accetterebbe anche `javascript:` e `data:`.
  'social.profiles': z
    .array(
      z
        .string()
        .url()
        .max(500)
        .regex(/^https?:\/\//i),
    )
    .max(20),
  // DR-270: valori che il sito pubblico usa per date, lingua ed elenchi.
  'content.posts_per_page': integer(1, 50),
  'site.start_of_week': integer(0, 6),
  'site.date_format': z.string().max(100),
  'site.time_format': z.string().max(100),
  // Lingua nella forma di WordPress: «it_IT», «en», «de_DE_formal».
  'site.locale': z.string().regex(/^[a-z]{2,3}(?:_(?:[A-Z]{2}|\d{3}))?(?:_[A-Za-z0-9]+)?$/),
  'site.timezone': z.string().refine(isTimeZone),
};

/** Il motivo del rifiuto, in italiano, per le chiavi che il sito pubblico legge (DR-270). */
export const SETTING_VALUE_MESSAGES: Readonly<Record<string, string>> = {
  'content.posts_per_page': '«Articoli per pagina» deve essere un numero intero da 1 a 50.',
  'site.start_of_week':
    '«Primo giorno della settimana» deve essere un numero da 0 (domenica) a 6 (sabato).',
  'site.date_format': '«Formato data» deve essere un testo di al massimo 100 caratteri.',
  'site.time_format': '«Formato ora» deve essere un testo di al massimo 100 caratteri.',
  'site.locale': '«Lingua del sito» deve essere un codice come it_IT o en_US.',
  'site.timezone': '«Fuso orario» deve essere un fuso come Europe/Rome o UTC.',
};

export const updateBody = z.object({
  value: z.unknown(),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});
