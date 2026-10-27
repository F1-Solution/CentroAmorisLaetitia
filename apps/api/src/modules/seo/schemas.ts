import { SEO_SCHEMA_TYPE_MESSAGE, SEO_SCHEMA_TYPES } from '@amoris/contracts';
import { z } from 'zod';

/** Solo i tipi che il sito sa produrre; `null` = predefinito (DR-278). */
const schemaTypeBody = z.enum(SEO_SCHEMA_TYPES, { error: SEO_SCHEMA_TYPE_MESSAGE }).nullable();

export const templateSchema = z.object({
  scope: z.string(),
  titleTemplate: z.string(),
  descriptionTemplate: z.string().nullable(),
  robotsDirectives: z.array(z.string()),
  ogType: z.string().nullable(),
  schemaType: z.string().nullable(),
  updatedAt: z.string(),
});

export const templateBody = z.object({
  titleTemplate: z.string().min(1).max(500),
  descriptionTemplate: z.string().max(1000).nullable().optional(),
  robotsDirectives: z.array(z.string().min(1).max(50)).max(10).optional(),
  ogType: z.string().max(50).nullable().optional(),
  schemaType: schemaTypeBody.optional(),
});

export const scopeParam = z.object({ scope: z.string().min(1).max(50) });

export const contentSeoSchema = z.object({
  contentId: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  canonicalUrl: z.string().nullable(),
  ogTitle: z.string().nullable(),
  ogDescription: z.string().nullable(),
  ogImageId: z.string().nullable(),
  robotsNoindex: z.boolean(),
  robotsNofollow: z.boolean(),
  schemaType: z.string().nullable(),
  updatedAt: z.string(),
});

export const contentSeoBody = z.object({
  title: z.string().max(500).nullable().optional(),
  description: z.string().max(1000).nullable().optional(),
  canonicalUrl: z.string().max(2000).nullable().optional(),
  ogTitle: z.string().max(500).nullable().optional(),
  ogDescription: z.string().max(1000).nullable().optional(),
  ogImageId: z.string().uuid().nullable().optional(),
  robotsNoindex: z.boolean().optional(),
  robotsNofollow: z.boolean().optional(),
  schemaType: schemaTypeBody.optional(),
});

/** Nomi in italiano dei campi SEO, per il registro delle operazioni: mai i valori (DR-278). */
const CONTENT_SEO_LABELS: readonly (readonly [keyof z.infer<typeof contentSeoBody>, string])[] = [
  ['title', 'Titolo SEO'],
  ['description', 'Descrizione'],
  ['canonicalUrl', 'Indirizzo canonico'],
  ['ogTitle', 'Titolo di condivisione'],
  ['ogDescription', 'Descrizione di condivisione'],
  ['ogImageId', 'Immagine di condivisione'],
  ['robotsNoindex', 'Non indicizzare'],
  ['robotsNofollow', 'Non seguire i collegamenti'],
  ['schemaType', 'Tipo di dati strutturati'],
];

/** I campi inviati che cambiano rispetto alla sovrascrittura salvata (assente = tutto vuoto). */
export function contentSeoChangedLabels(
  before: Readonly<Record<string, unknown>> | null,
  body: z.infer<typeof contentSeoBody>,
): string[] {
  const stored = (key: string): unknown =>
    before?.[key] ?? (key === 'robotsNoindex' || key === 'robotsNofollow' ? false : null);
  return CONTENT_SEO_LABELS.filter(
    ([key]) => body[key] !== undefined && body[key] !== stored(key),
  ).map(([, label]) => label);
}

export const contentIdParam = z.object({ id: z.string().uuid() });

/** I campi di un modello SEO che una modifica cambia, in italiano per il registro (DR-278). */
export function templateChangedLabels(
  before: Readonly<Record<string, unknown>> | null,
  body: z.infer<typeof templateBody>,
): string[] {
  const after: Record<string, unknown> = {
    titleTemplate: body.titleTemplate,
    descriptionTemplate: body.descriptionTemplate ?? null,
    robotsDirectives: body.robotsDirectives ?? [],
    ogType: body.ogType ?? null,
    schemaType: body.schemaType ?? null,
  };
  const labels: readonly (readonly [string, string])[] = [
    ['titleTemplate', 'Modello del titolo'],
    ['descriptionTemplate', 'Modello della descrizione'],
    ['robotsDirectives', 'Direttive robots'],
    ['ogType', 'Tipo Open Graph'],
    ['schemaType', 'Tipo di dati strutturati'],
  ];
  return labels
    .filter(([key]) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after[key]))
    .map(([, label]) => label);
}
