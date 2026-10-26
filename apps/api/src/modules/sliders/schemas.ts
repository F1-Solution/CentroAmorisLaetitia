import { z } from 'zod';

/** Caroselli nell'area Redazione (S16): i testi della slide sono testo, mai HTML. */

export const idParam = z.object({ id: z.string().uuid() });

export const sliderSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slideCount: z.number().int().nonnegative(),
  usedInCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

const slideSchema = z.object({
  id: z.string().uuid(),
  position: z.number().int().positive(),
  mediaId: z.string().uuid().nullable(),
  heading: z.string().nullable(),
  body: z.string().nullable(),
  image: z.object({ fileName: z.string(), publicPath: z.string() }).nullable(),
});

export const editorialSliderSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  updatedAt: z.string(),
  slides: z.array(slideSchema),
  usedIn: z.array(z.object({ id: z.string().uuid(), title: z.string(), type: z.string() })),
});

/** Testo vuoto o di soli spazi vale `null`. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .transform((value) => (value === '' ? null : value));

/** L'elenco ordinato delle slide, da 1 a 50 voci. */
export const replaceBody = z.object({
  slides: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        mediaId: z.string().uuid("Scegli un'immagine per ogni slide."),
        heading: optionalText(300, 'Il titolo può avere al massimo 300 caratteri.'),
        body: optionalText(2000, 'Il testo può avere al massimo 2000 caratteri.'),
      }),
    )
    .min(1, "Un carosello ha almeno un'immagine.")
    .max(50, 'Un carosello ha al massimo 50 immagini.'),
});
