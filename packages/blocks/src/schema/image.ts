/** `image`. Non contiene blocchi (`BLOCK-MODEL.md` §3.5). */
import { z } from 'zod';
import { classesField, EntityRef } from '../common';

const animationSchema = z
  .object({
    style: z.string(),
    direction: z.string().nullable(),
  })
  .strict();

export const imagePropsSchema = z
  .object({
    mediaId: EntityRef.nullable().default(null),
    /** Usato solo se `mediaId` è `null`. */
    src: z.string().nullable().default(null),
    variant: z
      .string()
      .regex(/^\d+x\d+$/)
      .nullable()
      .default(null),
    alt: z.string().default(''),
    title: z.string().nullable().default(null),
    caption: z.string().nullable().default(null),
    linkUrl: z.string().nullable().default(null),
    linkNewWindow: z.boolean().default(false),
    align: z.enum(['left', 'center', 'right']).nullable().default(null),
    alignTablet: z.enum(['left', 'center', 'right']).nullable().default(null),
    forceFullWidth: z.boolean().default(false),
    lightbox: z.boolean().default(false),
    centerOnMobile: z.boolean().default(false),
    animation: animationSchema.nullable().default(null),
    classes: classesField,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.mediaId === null && v.src === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['src'],
        message: 'almeno uno fra mediaId e src deve essere non nullo',
      });
    }
  });

export type ImageProps = z.infer<typeof imagePropsSchema>;
