import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocumentView } from '../src/components/Views';

/** Scheda `/download/<slug>/`: «Ultimo aggiornamento» segue `modifiedAt` (S4, D156). Dati sintetici. */

const media = {
  'm-1': {
    id: 'm-1',
    publicPath: '/media/modulo-sintetico.pdf',
    mimeType: 'application/pdf',
    width: null,
    height: null,
    title: null,
    altText: null,
    caption: null,
    variants: [],
  },
};

const base = {
  id: 'doc-1',
  slug: 'modulo-sintetico',
  title: 'Modulo sintetico',
  description: 'Descrizione sintetica',
  mediaId: 'm-1',
  updatedAt: '2026-10-16T09:00:00Z',
  publishedAt: '2022-04-05T10:00:00Z',
  byteSize: 103209,
};

const render = (modifiedAt?: string | null) =>
  renderToStaticMarkup(
    <DocumentView document={{ ...base, modifiedAt: modifiedAt ?? null }} media={media} />,
  );

describe('data di aggiornamento della scheda del documento (S4)', () => {
  it("con modifiedAt nullo l'HTML resta identico a quello approvato", () => {
    expect(render(null)).toMatchSnapshot();
  });

  it("con modifiedAt nullo e assente l'HTML coincide", () => {
    expect(render(null)).toBe(render());
  });

  it('con modifiedAt impostato «Ultimo aggiornamento» mostra quella data, «Data di creazione» no', () => {
    const html = render('2026-10-20T08:30:00Z');
    expect(html).toMatch(
      /Ultimo aggiornamento\s*(<!-- -->)?\s*<span class="badge">20 Ottobre 2026<\/span>/,
    );
    expect(html).toMatch(
      /Data di creazione\s*(<!-- -->)?\s*<span class="badge">5 Aprile 2022<\/span>/,
    );
  });
});
