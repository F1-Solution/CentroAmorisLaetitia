/**
 * Le classi dichiarate devono concordare con le proprietà tipizzate
 * corrispondenti (`packages/blocks/src/schema/consistency.ts`,
 * `BLOCK-MODEL.md` §7.2): chi produce l'albero scrive entrambe. Qui le
 * funzioni che le derivano nello stesso punto in cui si decide la proprietà,
 * cosi' non possono divergere.
 */
import type { AllowedClass } from './blocks.js';

export function sectionClasses(props: {
  fullWidth: boolean;
  parallax: boolean;
  innerShadow: boolean;
  transparentBackground: boolean;
}): AllowedClass[] {
  const classes: AllowedClass[] = [];
  if (props.fullWidth) classes.push('is-fullwidth');
  if (props.parallax) classes.push('has-parallax');
  if (props.innerShadow) classes.push('has-inner-shadow');
  if (props.transparentBackground) classes.push('has-transparent-bg');
  return classes;
}

export function rowClasses(props: { fullWidth: boolean }): AllowedClass[] {
  const classes: AllowedClass[] = [];
  if (props.fullWidth) classes.push('is-fullwidth');
  return classes;
}

export function imageClasses(props: {
  centerOnMobile: boolean;
  lightbox: boolean;
}): AllowedClass[] {
  const classes: AllowedClass[] = [];
  if (props.centerOnMobile) classes.push('center-on-mobile');
  if (props.lightbox) classes.push('in-lightbox');
  return classes;
}

export function mapClasses(props: { grayscale: boolean }): AllowedClass[] {
  const classes: AllowedClass[] = [];
  if (props.grayscale) classes.push('map-grayscale');
  return classes;
}

const RICH_TEXT_ALIGN: Readonly<Record<string, AllowedClass>> = {
  left: 'align-left',
  center: 'align-center',
  right: 'align-right',
  justify: 'align-justify',
};

const RICH_TEXT_BACKGROUND: Readonly<Record<string, AllowedClass>> = {
  light: 'text-light',
  dark: 'text-dark',
};

export function richTextClasses(props: {
  textAlign: 'left' | 'center' | 'right' | 'justify' | null;
  backgroundLayout: 'light' | 'dark' | null;
}): AllowedClass[] {
  const classes: AllowedClass[] = [];
  if (props.textAlign !== null) classes.push(RICH_TEXT_ALIGN[props.textAlign]!);
  if (props.backgroundLayout !== null) classes.push(RICH_TEXT_BACKGROUND[props.backgroundLayout]!);
  return classes;
}
