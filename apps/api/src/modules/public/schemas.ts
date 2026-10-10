import { z } from 'zod';

/** Un percorso del sito: assoluto, senza schema né dominio. */
const sitePath = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^\/[^\s]*$/, 'un percorso comincia con «/» e non contiene spazi');

export const pathQuery = z.object({ path: sitePath });

export const keyParam = z.object({ key: z.string().min(1).max(100) });

export const slugParam = z.object({ slug: z.string().min(1).max(200) });

export const mediaSchema = z.object({
  id: z.string(),
  publicPath: z.string(),
  mimeType: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  title: z.string().nullable(),
  altText: z.string().nullable(),
  caption: z.string().nullable(),
  variants: z.array(
    z.object({ publicPath: z.string(), width: z.number().int(), height: z.number().int() }),
  ),
});

const seoSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  canonicalPath: z.string(),
  robots: z.string(),
  ogTitle: z.string(),
  ogDescription: z.string().nullable(),
  ogType: z.string(),
  ogImagePath: z.string().nullable(),
});

const termSchema = z.object({
  id: z.string(),
  taxonomy: z.string(),
  slug: z.string(),
  name: z.string(),
  path: z.string(),
});

const documentSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  mediaId: z.string(),
  updatedAt: z.string(),
});

const sliderSchema = z.object({
  id: z.string(),
  key: z.string(),
  settings: z.unknown(),
  slides: z.array(
    z.object({
      position: z.number().int(),
      mediaId: z.string().nullable(),
      heading: z.string().nullable(),
      body: z.string().nullable(),
      linkUrl: z.string().nullable(),
      linkLabel: z.string().nullable(),
      settings: z.unknown(),
    }),
  ),
});

export const contentResponse = z.object({
  content: z.object({
    id: z.string(),
    type: z.enum(['page', 'post']),
    path: z.string(),
    slug: z.string(),
    title: z.string(),
    showTitle: z.boolean(),
    excerpt: z.string().nullable(),
    blocks: z.unknown(),
    featuredMediaId: z.string().nullable(),
    publishedAt: z.string().nullable(),
    updatedAt: z.string(),
  }),
  seo: seoSchema,
  terms: z.array(termSchema),
  /** Ogni media citato dai blocchi o in evidenza, se pubblico: chiave l'identificativo. */
  media: z.record(z.string(), mediaSchema),
  sliders: z.record(z.string(), sliderSchema),
  /** Solo i documenti pubblici: un blocco che ne cita uno riservato non lo trova qui. */
  documents: z.record(z.string(), documentSchema),
});

type MenuNode = {
  id: string;
  label: string;
  href: string;
  target: string | null;
  cssClasses: string | null;
  children: MenuNode[];
};

const menuNode: z.ZodType<MenuNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    label: z.string(),
    href: z.string(),
    target: z.string().nullable(),
    cssClasses: z.string().nullable(),
    children: z.array(menuNode),
  }),
);

export const menuResponse = z.object({ key: z.string(), items: z.array(menuNode) });

export const settingsResponse = z.record(z.string(), z.unknown());

export const redirectResponse = z.object({
  targetPath: z.string(),
  statusCode: z.number().int(),
});

export const postsQuery = z.object({
  /** Identificativi di tassonomia separati da virgola. */
  termIds: z
    .string()
    .max(2000)
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : []))
    .pipe(z.array(z.string().uuid()).max(20)),
  // Tetto basso: una pagina lontanissima costringe il database a scorrere e scartare
  // centinaia di migliaia di righe, a una richiesta anonima.
  page: z.coerce.number().int().min(1).max(200).default(1),
  perPage: z.coerce.number().int().min(1).max(50).default(10),
  order: z.enum(['date_desc', 'date_asc', 'title_asc']).default('date_desc'),
});

export const postsResponse = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      title: z.string(),
      excerpt: z.string().nullable(),
      summary: z.string().nullable(),
      featuredMediaId: z.string().nullable(),
      publishedAt: z.string().nullable(),
    }),
  ),
  media: z.record(z.string(), mediaSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    perPage: z.number().int(),
  }),
});

export const termResponse = z.object({
  term: termSchema.extend({ description: z.string().nullable() }),
  seo: z.object({ title: z.string(), robots: z.string() }),
});

export const documentResponse = z.object({
  document: documentSchema,
  media: z.record(z.string(), mediaSchema),
});

export const sitemapResponse = z.object({
  entries: z.array(z.object({ path: z.string(), kind: z.string(), updatedAt: z.string() })),
});
