import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formaConfrontabile, primaDifferenza } from '../confrontoHtml';

/*
 * W8-07: due letture della stessa pagina, senza salvataggi, differiscono solo nei dati di
 * idratazione di Next (`self.__next_f.push`), scritti in ordine variabile. La regola di
 * DR-202 li ignora; ogni altra differenza, anche nell'`<head>`, resta. HTML sintetico.
 */

const pagina = (corpo: string, idratazione: readonly string[], titolo = 'Pagina') =>
  `<!DOCTYPE html><html lang="it"><head><title>${titolo}</title></head><body>${corpo}` +
  idratazione.map((dati) => `<script>self.__next_f.push(${dati})</script>`).join('') +
  '</body></html>';

const A = '[1,"0:{\\"a\\":1}\\n"]';
const B = '[1,"1:I[\\"chunk\\",[]]\\n"]';

describe('confrontoHtml (DR-202, W8-07)', () => {
  it('ignora i dati di idratazione, anche in ordine diverso', () => {
    const prima = formaConfrontabile(200, pagina('<p>Testo</p>', [A, B]));
    const dopo = formaConfrontabile(200, pagina('<p>Testo</p>', [B, A]));
    assert.notEqual(pagina('<p>Testo</p>', [A, B]), pagina('<p>Testo</p>', [B, A]));
    assert.equal(primaDifferenza(prima, dopo), null);
  });

  it('una differenza visibile, nel corpo o nell’head, resta', () => {
    const base = formaConfrontabile(200, pagina('<p>Testo</p>', [A]));
    assert.notEqual(
      primaDifferenza(base, formaConfrontabile(200, pagina('<p>Altro</p>', [A]))),
      null,
    );
    assert.notEqual(
      primaDifferenza(base, formaConfrontabile(200, pagina('<p>Testo</p>', [A], 'Titolo'))),
      null,
    );
    assert.notEqual(
      primaDifferenza(base, formaConfrontabile(404, pagina('<p>Testo</p>', [A]))),
      null,
    );
  });
});
