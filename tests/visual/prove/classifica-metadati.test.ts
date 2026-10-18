import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classificaCampo, esitoFiglieSitemap } from '../classifica-metadati';

/*
 * Casi presi dalla prima misura del sito nuovo (1E-W7, 2026-10-17): ogni
 * differenza osservata deve cadere in una classe con un motivo leggibile, e solo
 * le correzioni previste da DR-040 (acceptance-criteria.md, S-1 e S-2) possono
 * uscire dal «difforme».
 */
describe('classificaCampo', () => {
  it('valori uguali dopo entità e spazi: identico', () => {
    const e = classificaCampo('title', 'Chi siamo &amp;  noi', 'Chi siamo & noi');
    assert.equal(e.esito, 'identico');
  });

  it('h1 assente nella sorgente e unico nel sito: correzione DR-040 (S-1)', () => {
    const e = classificaCampo('h1', '', 'Dove siamo');
    assert.equal(e.esito, 'correzione DR-040');
    assert.match(e.motivo, /S-1/);
  });

  it('h1 assente nella sorgente ma doppio nel sito: difforme', () => {
    const e = classificaCampo('h1', '', 'Dove siamo | Altro');
    assert.equal(e.esito, 'difforme');
  });

  it('description assente nella sorgente e presente nel sito: correzione DR-040 (S-2)', () => {
    for (const campo of ['description', 'og_description'] as const) {
      const e = classificaCampo(campo, '', 'Un testo generato dal contenuto');
      assert.equal(e.esito, 'correzione DR-040');
      assert.match(e.motivo, /S-2/);
    }
  });

  it('suffisso di paginazione tradotto: correzione DR-040', () => {
    const e = classificaCampo(
      'title',
      'News - Centro Amoris Laetitia - Page 2',
      'News - Centro Amoris Laetitia - Pagina 2',
    );
    assert.equal(e.esito, 'correzione DR-040');
    assert.match(e.motivo, /paginazione/);
  });

  it('separatori vuoti della sorgente tolti: correzione DR-040', () => {
    const e = classificaCampo(
      'title',
      '- - Vuoi diventare consulente familiare? - Centro Amoris Laetitia',
      'Vuoi diventare consulente familiare? - Centro Amoris Laetitia',
    );
    assert.equal(e.esito, 'correzione DR-040');
  });

  it('segnaposto del modello non risolti nel sito: difforme', () => {
    const e = classificaCampo(
      'title',
      '- - Vuoi diventare consulente familiare? - Centro Amoris Laetitia',
      '#separator_sa #separator_sa #post_title #separator_sa #site_title',
    );
    assert.equal(e.esito, 'difforme');
    assert.match(e.motivo, /segnaposto/);
  });

  it('description tagliata a 160 con puntini e prefisso esatto: correzione DR-040 (DR-171)', () => {
    for (const campo of ['description', 'og_description'] as const) {
      const e = classificaCampo(
        campo,
        'In questi anni l’Associazione ha cercato di camminare accanto alla comunità, offrendo consulenze, ' +
          'ascolto e accompagnamento alle famiglie del territorio, con corsi, convegni e percorsi per coppie',
        'In questi anni l’Associazione ha cercato di camminare…',
      );
      assert.equal(e.esito, 'correzione DR-040');
      assert.match(e.motivo, /DR-171/);
    }
  });

  it('description chiusa da puntini ma con prefisso diverso: difforme, troncata', () => {
    const e = classificaCampo(
      'description',
      "In questi anni l'Associazione ha cercato di camminare accanto alla comunità, offrendo consulenze",
      'In questi anni l’Associazione ha cercato di camminare…',
    );
    assert.equal(e.esito, 'difforme');
    assert.match(e.motivo, /troncata/);
  });

  it('description della sorgente sotto i 160 caratteri ma tagliata nel sito: difforme', () => {
    const e = classificaCampo(
      'description',
      'Un testo breve della sorgente, che non andava tagliato',
      'Un testo breve della sorgente…',
    );
    assert.equal(e.esito, 'difforme');
  });

  it('description chiusa da puntini oltre i 160 caratteri: difforme', () => {
    const lungo = 'parola '.repeat(30).trim();
    const e = classificaCampo('description', `${lungo} e ancora altro`, `${lungo}…`);
    assert.equal(e.esito, 'difforme');
  });

  it('canonical autoreferenziale della pagina 2 dell’archivio: correzione DR-040 (DR-175)', () => {
    const e = classificaCampo('canonical', '/category/news/', '/category/news/page/2/');
    assert.equal(e.esito, 'correzione DR-040');
    assert.match(e.motivo, /DR-175/);
  });

  it('canonical verso un’altra pagina: difforme', () => {
    const e = classificaCampo('canonical', '/category/news/', '/category/eventi/page/2/');
    assert.equal(e.esito, 'difforme');
  });

  it('paginazione indicizzabile al posto di noindex: correzione DR-040 (DR-175)', () => {
    const e = classificaCampo(
      'robots',
      'noindex, nofollow, max-image-preview:large',
      'max-image-preview:large',
      '/category/news/page/2/',
    );
    assert.equal(e.esito, 'correzione DR-040');
    assert.match(e.motivo, /DR-175/);
  });

  it('noindex tolto fuori dalla paginazione: difforme', () => {
    const e = classificaCampo(
      'robots',
      'noindex, nofollow, max-image-preview:large',
      'max-image-preview:large',
      '/?s=corso',
    );
    assert.equal(e.esito, 'difforme');
  });

  it('robots diversi oltre il noindex: difforme', () => {
    const e = classificaCampo('robots', 'noindex, nofollow, max-image-preview:large', 'noarchive');
    assert.equal(e.esito, 'difforme');
  });

  it('solo apici tipografici al posto di quelli dritti: difforme, apici', () => {
    const e = classificaCampo(
      'description',
      'Quest\'anno l\'offerta formativa "vasta"',
      'Quest’anno l’offerta formativa “vasta”',
    );
    assert.equal(e.esito, 'difforme');
    assert.match(e.motivo, /apici/);
  });

  it('valore presente nella sorgente e assente nel sito: difforme, assente', () => {
    const e = classificaCampo('schema_types', 'Organization,WebPage', '');
    assert.equal(e.esito, 'difforme');
    assert.match(e.motivo, /assente nel sito/);
  });

  it('carattere perso nella baseline (�) vale come jolly', () => {
    const e = classificaCampo(
      'title',
      'Laboratori di genitorialit� - Centro',
      'Laboratori di genitorialità - Centro',
    );
    assert.equal(e.esito, 'identico');
  });

  it('stato HTTP diverso: difforme senza eccezioni', () => {
    const e = classificaCampo('http', '200', '404');
    assert.equal(e.esito, 'difforme');
  });
});

/*
 * M1 (DR-170, DR-182, DR-185): i tipi del JSON-LD si confrontano come insieme;
 * mancano `Person` (e l'`ImageObject` del suo Gravatar, negli articoli senza
 * immagine in evidenza) per scelta, e il logo dell'organizzazione aggiunge un
 * `ImageObject` dove la sorgente non l'aveva.
 */
describe('classificaCampo: schema_types', () => {
  const ARTICOLO_RIF =
    'BlogPosting,BreadcrumbList,ImageObject,ListItem,Organization,Person,WebPage,WebSite';

  it('stessi tipi in ordine diverso: identico', () => {
    const e = classificaCampo(
      'schema_types',
      'WebSite,WebPage,Organization',
      'Organization,WebPage,WebSite',
    );
    assert.equal(e.esito, 'identico');
  });

  it('articolo con immagine: manca solo Person, correzione DR-040 (DR-182)', () => {
    const e = classificaCampo(
      'schema_types',
      ARTICOLO_RIF,
      'BlogPosting,BreadcrumbList,ImageObject,ListItem,Organization,WebPage,WebSite',
    );
    assert.equal(e.esito, 'correzione DR-040');
    assert.match(e.motivo, /Person esclusa \(DR-182\)/);
  });

  it('articolo senza immagine: mancano Person e il Gravatar, correzione DR-040 (DR-182)', () => {
    const e = classificaCampo(
      'schema_types',
      ARTICOLO_RIF,
      'BlogPosting,BreadcrumbList,ListItem,Organization,WebPage,WebSite',
    );
    assert.equal(e.esito, 'correzione DR-040');
    assert.match(e.motivo, /Person esclusa \(DR-182\)/);
  });

  it('logo dell’organizzazione: ImageObject in più, correzione DR-040 (DR-185)', () => {
    const e = classificaCampo(
      'schema_types',
      'BreadcrumbList,ListItem,Organization,WebPage,WebSite',
      'BreadcrumbList,ImageObject,ListItem,Organization,WebPage,WebSite',
    );
    assert.equal(e.esito, 'correzione DR-040');
    assert.match(e.motivo, /DR-185/);
  });

  it('prova negativa: manca un tipo diverso da Person, difforme', () => {
    const e = classificaCampo(
      'schema_types',
      ARTICOLO_RIF,
      'BreadcrumbList,ImageObject,ListItem,Organization,WebPage,WebSite',
    );
    assert.equal(e.esito, 'difforme');
  });

  it('prova negativa: ImageObject mancante senza Person nella sorgente, difforme', () => {
    const e = classificaCampo(
      'schema_types',
      'BreadcrumbList,ImageObject,ListItem,Organization,WebPage,WebSite',
      'BreadcrumbList,ListItem,Organization,WebPage,WebSite',
    );
    assert.equal(e.esito, 'difforme');
  });

  it('prova negativa: tipo in più che non è il logo, difforme', () => {
    const e = classificaCampo(
      'schema_types',
      'BreadcrumbList,ListItem,Organization,WebPage,WebSite',
      'BreadcrumbList,ListItem,Organization,Person,WebPage,WebSite',
    );
    assert.equal(e.esito, 'difforme');
  });
});

describe('esitoFiglieSitemap (DR-177)', () => {
  it('stesso numero di figlie: identico', () => {
    assert.equal(esitoFiglieSitemap(0, 0), 'identico');
  });

  it('indice con figlie nella sorgente, sitemap unica nel sito: correzione DR-177', () => {
    assert.equal(esitoFiglieSitemap(5, 0), 'correzione DR-177');
  });

  it('prova negativa: il sito con un indice diverso da quello della sorgente, difforme', () => {
    assert.equal(esitoFiglieSitemap(5, 2), 'difforme');
    assert.equal(esitoFiglieSitemap(0, 3), 'difforme');
  });
});
