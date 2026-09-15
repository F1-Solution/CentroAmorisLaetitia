/**
 * `map`. Non contiene blocchi (`BLOCK-MODEL.md` §3.8). I segnaposto sono
 * proprietà della mappa, non blocchi. Lat/lng restano stringhe: si conservano
 * per essere riconsegnate identiche, non per fare aritmetica (arbitrario e
 * dichiarato, §3.8).
 */
import { z } from 'zod';
import { classesField } from '../common.js';

const latLngPattern = /^-?\d+(\.\d+)?$/;

const mapPinSchema = z
  .object({
    title: z.string().nullable(),
    lat: z.string().regex(latLngPattern),
    lng: z.string().regex(latLngPattern),
    html: z.string().nullable(),
  })
  .strict();

export const mapPropsSchema = z
  .object({
    address: z.string().min(1),
    lat: z.string().regex(latLngPattern),
    lng: z.string().regex(latLngPattern),
    zoom: z.number().int().min(1).max(21).nullable().default(null),
    mouseWheel: z.boolean().default(false),
    mobileDragging: z.boolean().default(false),
    grayscale: z.boolean().default(false),
    grayscaleAmount: z.number().min(0).max(100).nullable().default(null),
    pins: z.array(mapPinSchema).default([]),
    classes: classesField,
  })
  .strict();

export type MapProps = z.infer<typeof mapPropsSchema>;
export type MapPin = z.infer<typeof mapPinSchema>;
