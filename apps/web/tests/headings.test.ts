import { describe, expect, it } from 'vitest';
import type { BlockDocument } from '@amoris/blocks';
import { promoteFirstHeading } from '../src/lib/headings';

/** DR-040, criterio 1E-14: il primo titolo diventa `<h1>` e conserva l'aspetto. Dati sintetici. */

const text = (html: string) => ({
  type: 'rich_text',
  id: 'b_000000000001',
  props: { html },
  children: [],
});

const doc = (...blocks: unknown[]) => ({ schema: 1, blocks }) as unknown as BlockDocument;

describe('titolo principale delle pagine che non lo hanno (DR-040)', () => {
  it('il primo titolo del contenuto diventa h1 con la classe del suo livello', () => {
    const { document, promoted } = promoteFirstHeading(
      doc({
        type: 'section',
        id: 'b_000000000002',
        props: {},
        children: [text('<p>Prima</p><h3 class="x">Titolo sintetico</h3><h3>Secondo</h3>')],
      }),
    );
    expect(promoted).toBe(true);
    const html = JSON.stringify(document);
    expect(html).toContain('<h1 class=\\"x come-h3\\">Titolo sintetico</h1>');
    expect(html).toContain('<h3>Secondo</h3>');
  });

  it('se il contenuto ha già un h1 non cambia nulla', () => {
    const original = doc(text('<h1>Già presente</h1><h2>Altro</h2>'));
    // Il titolo nascosto non si aggiunge: la pagina avrebbe due h1, la sorgente uno.
    expect(promoteFirstHeading(original)).toEqual({
      document: original,
      promoted: false,
      hasH1: true,
    });
  });

  it('il titolo del modulo di contatto di Divi vale come h1: niente da promuovere né da nascondere', () => {
    const original = doc(text('<h3></h3><h3>Contatti</h3>'), {
      type: 'form',
      id: 'b_000000000002',
      props: { formId: 'x', origin: 'divi', showTitle: true, showDescription: false, classes: [] },
      children: [],
    });
    expect(promoteFirstHeading(original)).toEqual({
      document: original,
      promoted: false,
      hasH1: true,
    });
  });

  it('senza titoli nel contenuto non promuove nulla', () => {
    const result = promoteFirstHeading(doc(text('<p>Solo testo</p>')));
    expect(result.promoted).toBe(false);
    expect(result.hasH1).toBe(false);
  });
});
