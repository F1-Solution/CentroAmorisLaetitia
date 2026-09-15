import { describe, expect, it } from 'vitest';
import { checkPostTypesClassified } from '../../../src/preflight/checks/04-post-types-classified.js';

describe('preflight — controllo 4: post_type classificati', () => {
  it('passa per i tipi noti', () => {
    const result = checkPostTypesClassified(['page', 'post', 'attachment']);
    expect(result.ok).toBe(true);
  });

  it('fallisce su un post_type sconosciuto comparso in una sorgente sintetica alterata', () => {
    const result = checkPostTypesClassified(['page', 'plugin_nuovo_tipo']);
    expect(result.ok).toBe(false);
    expect(result.detail?.unclassifiedTypes).toEqual(['plugin_nuovo_tipo']);
  });
});
