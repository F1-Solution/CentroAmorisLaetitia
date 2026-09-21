/**
 * `slider`. Non contiene blocchi (`BLOCK-MODEL.md` §3.13). Le slide stanno in
 * `slider_slides`, non nel blocco.
 */
import { z } from 'zod';
import { classesField, EntityRef } from '../common';

export const sliderPropsSchema = z
  .object({
    sliderId: EntityRef,
    classes: classesField,
  })
  .strict();

export type SliderProps = z.infer<typeof sliderPropsSchema>;
