import { describe, expect, it } from 'vitest';
import {
  RESERVED_DOCUMENT_SLUGS,
  documentSlugFromTitle,
  nextFreeSlug,
} from '../src/modules/documents/slug.js';

/**
 * Wave 1G-W7, T2h (DR-281): lo slug di un documento creato dall'area segue la regola con cui
 * WordPress ha dato il `post_name` ai download di Download Manager, che l'importer copia così
 * com'è: `sanitize_title()` nel contesto «save» (accenti tolti, minuscole, punteggiatura via,
 * spazi e lineette in `-`) e `wp_unique_post_slug()` per i doppioni (`-2`, `-3`, … e i nomi
 * dei feed e `embed` mai liberi). Titoli inventati.
 */

describe('slug dal titolo (sanitize_title, contesto «save»)', () => {
  it.each([
    ['Modulo per consulenze', 'modulo-per-consulenze'],
    ['Modulo d’iscrizione: «Corsi» 2026 — à è ì ò ù', 'modulo-discrizione-corsi-2026-a-e-i-o-u'],
    ["L'amore è più forte", 'lamore-e-piu-forte'],
    ['Modulo v1.2 / 2026', 'modulo-v1-2-2026'],
    ['Scheda <b>nuova</b>', 'scheda-nuova'],
    ['Perché & come', 'perche-come'],
    ['Straße Œuvre Æther', 'strasse-oeuvre-aether'],
    ['50% di sconto', '50-di-sconto'],
    ['Nome_con_trattino basso', 'nome_con_trattino-basso'],
    ['Foto 10×15', 'foto-10x15'],
    ['Parola\u00a0unita – e lineetta', 'parola-unita-e-lineetta'],
    ['  --Spazi   ai bordi--  ', 'spazi-ai-bordi'],
    ['MAIUSCOLE Ò', 'maiuscole-o'],
    ['Puntini… e «virgolette» “curve”', 'puntini-e-virgolette-curve'],
  ])('«%s» → %s', (title, expected) => {
    expect(documentSlugFromTitle(title)).toBe(expected);
  });

  it('un titolo senza lettere latine né cifre ripiega su «documento»', () => {
    expect(documentSlugFromTitle('€ ☺')).toBe('documento');
    expect(documentSlugFromTitle('!!!')).toBe('documento');
  });

  it('lo slug non supera i 200 caratteri e non finisce con un trattino', () => {
    const slug = documentSlugFromTitle(`${'a'.repeat(199)} b`);
    expect(slug.length).toBeLessThanOrEqual(200);
    expect(slug).toBe('a'.repeat(199));
  });
});

describe('doppioni e nomi riservati (wp_unique_post_slug)', () => {
  it('uno slug libero resta com’è', () => {
    expect(nextFreeSlug('modulo', new Set())).toBe('modulo');
  });

  it('uno slug preso riceve -2, poi -3', () => {
    expect(nextFreeSlug('modulo', new Set(['modulo']))).toBe('modulo-2');
    expect(nextFreeSlug('modulo', new Set(['modulo', 'modulo-2']))).toBe('modulo-3');
  });

  it('i nomi dei feed ed «embed» non sono mai liberi', () => {
    expect([...RESERVED_DOCUMENT_SLUGS].sort()).toEqual(
      ['atom', 'embed', 'feed', 'rdf', 'rss', 'rss2'].sort(),
    );
    for (const reserved of RESERVED_DOCUMENT_SLUGS) {
      expect(nextFreeSlug(reserved, new Set())).toBe(`${reserved}-2`);
    }
  });

  it('con il suffisso lo slug resta entro i 200 caratteri', () => {
    const base = 'a'.repeat(200);
    const slug = nextFreeSlug(base, new Set([base]));
    expect(slug).toBe(`${'a'.repeat(198)}-2`);
    expect(slug.length).toBe(200);
  });
});
