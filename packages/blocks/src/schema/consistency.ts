/**
 * §7.2: alcune informazioni sono **sia** una proprietà tipizzata **sia** una
 * classe dichiarata (per esempio `fullWidth` e `is-fullwidth`). Una verifica
 * controlla che non si contraddicano.
 */
import type { z } from 'zod';
import type { BlockNode } from './block';

interface BooleanConsistencyRule {
  readonly blockType: BlockNode['type'];
  readonly className: string;
  readonly test: (props: never) => boolean;
}

const BOOLEAN_RULES: readonly BooleanConsistencyRule[] = [
  {
    blockType: 'section',
    className: 'is-fullwidth',
    test: (p) => (p as { fullWidth: boolean }).fullWidth,
  },
  {
    blockType: 'row',
    className: 'is-fullwidth',
    test: (p) => (p as { fullWidth: boolean }).fullWidth,
  },
  {
    blockType: 'section',
    className: 'has-parallax',
    test: (p) => (p as { parallax: boolean }).parallax,
  },
  {
    blockType: 'section',
    className: 'has-inner-shadow',
    test: (p) => (p as { innerShadow: boolean }).innerShadow,
  },
  {
    blockType: 'section',
    className: 'has-transparent-bg',
    test: (p) => (p as { transparentBackground: boolean }).transparentBackground,
  },
  {
    blockType: 'image',
    className: 'center-on-mobile',
    test: (p) => (p as { centerOnMobile: boolean }).centerOnMobile,
  },
  {
    blockType: 'image',
    className: 'in-lightbox',
    test: (p) => (p as { lightbox: boolean }).lightbox,
  },
  {
    blockType: 'map',
    className: 'map-grayscale',
    test: (p) => (p as { grayscale: boolean }).grayscale,
  },
];

const RICH_TEXT_ALIGN_CLASSES: Readonly<Record<string, string>> = {
  left: 'align-left',
  center: 'align-center',
  right: 'align-right',
  justify: 'align-justify',
};

const RICH_TEXT_BACKGROUND_CLASSES: Readonly<Record<string, string>> = {
  light: 'text-light',
  dark: 'text-dark',
};

export function checkClassConsistency(
  node: BlockNode,
  ctx: z.RefinementCtx,
  path: (string | number)[],
): void {
  const classes = node.props.classes as readonly string[];

  for (const rule of BOOLEAN_RULES) {
    if (rule.blockType !== node.type) {
      continue;
    }
    const should = rule.test(node.props as never);
    const has = classes.includes(rule.className);
    if (should !== has) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, 'props', 'classes'],
        message: has
          ? `la classe "${rule.className}" è presente ma la proprietà corrispondente è falsa (§7.2)`
          : `la proprietà corrispondente richiede la classe "${rule.className}", assente (§7.2)`,
      });
    }
  }

  if (node.type === 'rich_text') {
    for (const [value, className] of Object.entries(RICH_TEXT_ALIGN_CLASSES)) {
      const should = node.props.textAlign === value;
      const has = classes.includes(className);
      if (should !== has) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'props', 'classes'],
          message: `"textAlign" e la classe "${className}" non concordano (§7.2)`,
        });
      }
    }
    for (const [value, className] of Object.entries(RICH_TEXT_BACKGROUND_CLASSES)) {
      const should = node.props.backgroundLayout === value;
      const has = classes.includes(className);
      if (should !== has) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'props', 'classes'],
          message: `"backgroundLayout" e la classe "${className}" non concordano (§7.2)`,
        });
      }
    }
  }
}
