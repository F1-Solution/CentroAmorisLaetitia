import { z } from 'zod';

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
  schemaType: z.string().max(50).nullable().optional(),
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
});

export const contentIdParam = z.object({ id: z.string().uuid() });
