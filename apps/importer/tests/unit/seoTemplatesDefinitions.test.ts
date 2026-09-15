import { describe, expect, it } from 'vitest';
import { SEO_TEMPLATE_DEFINITIONS } from '../../src/stages/settings/seoTemplatesDefinitions.js';

/**
 * Traduzione dei template SEO di `wp-to-postgres-mapping.md` §6.3, trascritti
 * in `1B-W0` §2.1. Confronto letterale: se qualcuno li cambia per sbaglio, il
 * test lo mostra.
 */
describe('template SEO — wp-to-postgres-mapping.md §6.3', () => {
  const byScope = new Map(SEO_TEMPLATE_DEFINITIONS.map((d) => [d.scope, d]));

  it('copre esattamente i sei ambiti documentati', () => {
    expect([...byScope.keys()].sort()).toEqual(
      ['attachment', 'category', 'home', 'page', 'post', 'search'].sort(),
    );
  });

  it.each([
    ['home', '{title} - {site_title}'],
    ['page', '{title} - {site_title}'],
    ['post', '{title} - {site_title}'],
    ['category', '{term_title} - {site_title}'],
    ['attachment', '{title} - {site_title}'],
    ['search', '{query} - {site_title}'],
  ])('ambito %s → titleTemplate %s', (scope, expected) => {
    expect(byScope.get(scope)?.titleTemplate).toBe(expected);
  });

  it('descriptionTemplate resta null ovunque: la description è calcolata, non un modello fisso', () => {
    for (const definition of SEO_TEMPLATE_DEFINITIONS) {
      expect(definition.descriptionTemplate).toBeNull();
    }
  });
});
