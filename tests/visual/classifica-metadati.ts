import { coincide, decodifica, type Campo } from './metadati';

/**
 * Classificazione di una differenza di metadati fra la sorgente
 * (`seo-rendered-baseline.csv`) e il sito nuovo, criterio 1E-8.
 *
 * Solo le correzioni previste da DR-040 (`acceptance-criteria.md`, S-1 e S-2, il
 * suffisso di paginazione in italiano) e da DR-171, DR-175, DR-182 e DR-185, registrate
 * come sue estensioni, escono dal «difforme»; il motivo di un
 * difforme serve a raggrupparli per la decisione dell'utente, non lo assolve.
 */

export type EsitoMetadato = 'identico' | 'correzione DR-040' | 'difforme';

export interface Classificazione {
  readonly esito: EsitoMetadato;
  readonly motivo: string;
}

const normale = (s: string): string => decodifica(s).replace(/\s+/g, ' ').trim();

const senzaApici = (s: string): string =>
  s.replace(/[‘’′]/g, "'").replace(/[“”″]/g, '"').replace(/[–—]/g, '-');

/** I separatori vuoti di All in One SEO lasciano «- - » in testa o in coda al titolo. */
const senzaSeparatoriVuoti = (s: string): string =>
  s
    .replace(/^(?:-\s+)+/, '')
    .replace(/(?:\s+-)+$/, '')
    .trim();

const paginaInItaliano = (s: string): string => s.replace(/ - Page (\d+)$/, ' - Pagina $1');

function correzione(campo: Campo, rif: string, sito: string, url: string): string | null {
  if (campo === 'h1' && rif === '' && sito !== '' && !sito.includes(' | ')) {
    return 'h1 restituito (S-1)';
  }
  if ((campo === 'description' || campo === 'og_description') && rif === '' && sito !== '') {
    return 'description assente nella sorgente (S-2)';
  }
  if (
    (campo === 'description' || campo === 'og_description') &&
    sito.endsWith('…') &&
    sito.length <= 161 &&
    rif.length > 160 &&
    rif.startsWith(sito.slice(0, -1).trimEnd())
  ) {
    return 'taglio a 160 caratteri (DR-171)';
  }
  if (campo === 'canonical' && /^(.*\/)page\/\d+\/$/.exec(sito)?.[1] === rif) {
    return 'canonical autoreferenziale della paginazione (DR-175)';
  }
  if (campo === 'robots' && /\/page\/\d+\/$/.test(url) && rif === `noindex, nofollow, ${sito}`) {
    return 'paginazione indicizzabile (DR-175)';
  }
  if (campo === 'title' || campo === 'og_title') {
    if (/ - Page \d+$/.test(rif) && coincide(paginaInItaliano(rif), sito)) {
      return 'suffisso di paginazione in italiano';
    }
    const pulito = senzaSeparatoriVuoti(rif);
    if (pulito !== rif && coincide(pulito, sito)) return 'separatori vuoti della sorgente tolti';
  }
  return null;
}

const insieme = (s: string): Set<string> => new Set(s.split(',').filter(Boolean));

const uguali = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((t) => b.has(t));

/**
 * Tipi del JSON-LD (M1): `Person` esclusa (DR-182), con l'`ImageObject` del suo Gravatar
 * quando era l'unico; `ImageObject` in più dal logo dell'organizzazione (DR-185).
 */
function correzioneSchema(rif: string, sito: string): string | null {
  const r = insieme(rif);
  const s = insieme(sito);
  const motivi: string[] = [];
  if (r.has('Person') && !s.has('Person')) {
    r.delete('Person');
    if (r.has('ImageObject') && !s.has('ImageObject')) r.delete('ImageObject');
    motivi.push('Person esclusa (DR-182)');
  }
  if (s.has('ImageObject') && !r.has('ImageObject')) {
    s.delete('ImageObject');
    motivi.push('logo dell’organizzazione (DR-185)');
  }
  return motivi.length > 0 && uguali(r, s) ? motivi.join('; ') : null;
}

/** «sitemap: figlie»: sitemap unica contro l'indice della sorgente (DR-177). */
export function esitoFiglieSitemap(
  rif: number,
  sito: number,
): 'identico' | 'correzione DR-177' | 'difforme' {
  if (rif === sito) return 'identico';
  return rif > 0 && sito === 0 ? 'correzione DR-177' : 'difforme';
}

function motivoDifforme(rif: string, sito: string): string {
  if (sito === '') return 'assente nel sito';
  if (rif === '') return 'assente nella sorgente';
  if (/#[a-z_]+/.test(sito)) return 'segnaposto del modello non risolti';
  const r = senzaApici(rif);
  const s = senzaApici(sito);
  if (coincide(r, s)) return 'apici tipografici';
  const ascii = (t: string): string => t.replace(/[^\x20-\x7e]/g, '?');
  if (s.endsWith('…') && ascii(r).startsWith(ascii(s.slice(0, -1).trimEnd()))) return 'troncata';
  return 'diversa';
}

/**
 * `rif` e `sito` come li riporta `leggiMetadati`: percorsi relativi, testo grezzo;
 * `url` è il percorso misurato, per le regole che valgono solo sulla paginazione.
 */
export function classificaCampo(
  campo: Campo,
  rif: string,
  sito: string,
  url = '',
): Classificazione {
  if (coincide(rif, sito)) return { esito: 'identico', motivo: '' };
  const r = normale(rif);
  const s = normale(sito);
  if (campo === 'schema_types' && r !== '' && s !== '') {
    if (uguali(insieme(r), insieme(s))) return { esito: 'identico', motivo: '' };
    const motivo = correzioneSchema(r, s);
    if (motivo) return { esito: 'correzione DR-040', motivo };
  }
  if (campo !== 'http') {
    const motivo = correzione(campo, r, s, url);
    if (motivo) return { esito: 'correzione DR-040', motivo };
  }
  return { esito: 'difforme', motivo: motivoDifforme(r, s) };
}
