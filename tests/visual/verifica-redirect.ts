import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { leggiCsv } from './matrice';
import { csv } from './metadati';
import {
  attesoPer,
  campione,
  confrontoSimmetrico,
  normalizza,
  regoleDallaMatrice,
  slugStorici,
  type Regola,
} from './redirect';

/**
 * Criterio 1E-9 (`1E-W7`, T2): le 181 regole di redirect del §3.2 del mapping e
 * il controllo simmetrico del §10 di `visual-regression-plan.md` sui 293
 * indirizzi della matrice. Nessun redirect si segue: si leggono stato e
 * `location`. Ogni regola si interroga anche sulla lettura pubblica dell'API e
 * sull'istanza di riferimento.
 *
 *   SITO=http://127.0.0.1:3200 API=http://127.0.0.1:3002 WPREF_URL=http://localhost:8088 \
 *     pnpm exec tsx tests/visual/verifica-redirect.ts
 */

const RADICE = process.cwd();
const SITO = process.env.SITO ?? 'http://127.0.0.1:3200';
const API = process.env.API ?? 'http://127.0.0.1:3002';
const RIF = process.env.WPREF_URL ?? 'http://localhost:8088';
const ESITI = path.join(RADICE, 'docs/qa/verifiche');
const REGOLE_ATTESE = 181;
const FILE_A_CAMPIONE = 20;
/** Seme fisso del campione dei file a prefisso: stampato nel CSV per ripetere la scelta. */
const SEME = 20261017;

interface Risposta {
  readonly stato: number;
  readonly destinazione: string;
}

async function senzaSeguire(base: string, percorso: string): Promise<Risposta> {
  try {
    const r = await fetch(new URL(percorso, base), {
      redirect: 'manual',
      signal: AbortSignal.timeout(60_000),
    });
    await r.body?.cancel();
    return { stato: r.status, destinazione: normalizza(r.headers.get('location') ?? '') };
  } catch (errore) {
    console.error(`${base}${percorso}: ${errore instanceof Error ? errore.message : errore}`);
    return { stato: 0, destinazione: '' };
  }
}

/** La lettura pubblica dell'API: la regola che vale per un percorso, o 404. */
async function letturaPubblica(percorso: string): Promise<Risposta> {
  try {
    const r = await fetch(`${API}/public/redirect?path=${encodeURIComponent(percorso)}`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) {
      await r.body?.cancel();
      return { stato: r.status, destinazione: '' };
    }
    const regola = (await r.json()) as { targetPath: string; statusCode: number };
    return { stato: regola.statusCode, destinazione: normalizza(regola.targetPath) };
  } catch (errore) {
    console.error(`API ${percorso}: ${errore instanceof Error ? errore.message : errore}`);
    return { stato: 0, destinazione: '' };
  }
}

/** Il riferimento risponde con `/wp-content/uploads/`: si traduce come fa il sito nuovo. */
const comeNelSito = (destinazione: string): string =>
  destinazione.replace(/^\/wp-content\/uploads\//, '/media/');

function motivoDi(regola: Regola, sito: Risposta, api: Risposta): string {
  const atteso = attesoPer(regola);
  const scarti: string[] = [];
  if (sito.stato !== atteso.stato) scarti.push(`stato del sito ${sito.stato}`);
  if (sito.destinazione !== atteso.destinazione) scarti.push('destinazione del sito diversa');
  if (atteso.stato === 301 && (api.stato !== 301 || api.destinazione !== atteso.destinazione)) {
    scarti.push('lettura pubblica diversa');
  }
  if (regola.gruppo === 'allegato oscurato' && api.stato !== 404) {
    scarti.push('la lettura pubblica restituisce una regola');
  }
  return scarti.join('; ');
}

async function verificaRegole(): Promise<{ righe: string[][]; superate: number; file: string[] }> {
  const matrice = leggiCsv(path.join(RADICE, 'docs/migration/url-matrix.csv'));
  const mapping = readFileSync(
    path.join(RADICE, 'docs/migration/wp-to-postgres-mapping.md'),
    'utf-8',
  );
  const esatte = [...regoleDallaMatrice(matrice), ...slugStorici(mapping)];
  if (esatte.length + 1 !== REGOLE_ATTESE) {
    throw new Error(
      `regole attese ${REGOLE_ATTESE}, ricavate ${esatte.length + 1}: ci si ferma (§6 del piano)`,
    );
  }

  // Il prefisso si prova sui file delle pagine allegato: file pubblici della sorgente.
  const elenco = [
    ...new Set(
      esatte
        .filter((r) => r.gruppo === 'allegato')
        .map((r) => r.destinazioneSorgente)
        .filter((d) => d.startsWith('/wp-content/uploads/')),
    ),
  ].sort();
  const file = campione(elenco, FILE_A_CAMPIONE, SEME);
  const aPrefisso: Regola[] = file.map((f) => ({
    origine: f,
    gruppo: 'prefisso',
    destinazioneSorgente: '',
  }));

  const righe = [
    [
      'origine',
      'gruppo',
      'atteso_stato',
      'atteso_destinazione',
      'sito_stato',
      'sito_destinazione',
      'api_stato',
      'api_destinazione',
      'rif_stato',
      'rif_destinazione',
      'esito',
      'motivo',
    ],
  ];
  let superate = 0;
  for (const regola of esatte) {
    const atteso = attesoPer(regola);
    const sito = await senzaSeguire(SITO, regola.origine);
    const api = await letturaPubblica(normalizza(regola.origine));
    const rif = await senzaSeguire(RIF, regola.origine);
    const motivo = motivoDi(regola, sito, api);
    if (!motivo) superate += 1;
    righe.push([
      regola.origine,
      regola.gruppo,
      String(atteso.stato),
      atteso.destinazione,
      String(sito.stato),
      sito.destinazione,
      String(api.stato),
      api.destinazione,
      String(rif.stato),
      comeNelSito(rif.destinazione),
      motivo ? 'non superato' : 'superato',
      motivo,
    ]);
  }

  // Una regola sola, superata se lo sono tutti i file del campione e i file di destinazione esistono.
  let prefissoOk = true;
  for (const regola of aPrefisso) {
    const atteso = attesoPer(regola);
    const sito = await senzaSeguire(SITO, regola.origine);
    const api = await letturaPubblica(normalizza(regola.origine));
    const rif = await senzaSeguire(RIF, regola.origine);
    const file = await senzaSeguire(SITO, atteso.destinazione);
    const scarti = [motivoDi(regola, sito, api)];
    if (file.stato !== 200) scarti.push(`file di destinazione ${file.stato}`);
    if (rif.stato !== 200) scarti.push(`file assente nel riferimento (${rif.stato})`);
    const motivo = scarti.filter(Boolean).join('; ');
    if (motivo) prefissoOk = false;
    righe.push([
      regola.origine,
      regola.gruppo,
      String(atteso.stato),
      atteso.destinazione,
      String(sito.stato),
      sito.destinazione,
      String(api.stato),
      api.destinazione,
      String(rif.stato),
      '',
      motivo ? 'non superato' : 'superato',
      motivo || `campione di ${FILE_A_CAMPIONE} su ${elenco.length} file, seme ${SEME}`,
    ]);
  }
  if (prefissoOk) superate += 1;
  return { righe, superate, file };
}

async function verificaSimmetrica(): Promise<{ righe: string[][]; inversioni: number }> {
  const matrice = leggiCsv(path.join(RADICE, 'docs/migration/url-matrix.csv'));
  const righe = [['url', 'tipo', 'stato_matrice', 'stato_sito', 'destinazione_sito', 'esito']];
  let inversioni = 0;
  for (const r of matrice) {
    const atteso = Number(r['stato_misurato']);
    const sito = await senzaSeguire(SITO, r['url']!);
    const inversione = confrontoSimmetrico(atteso, sito.stato);
    if (inversione) inversioni += 1;
    // I 302 e il 404 non entrano nel controllo simmetrico: se ne registra l'esito a parte.
    const esito =
      inversione ??
      (atteso === 200 || atteso === 301
        ? sito.stato === atteso
          ? 'nessuna inversione'
          : `nessuna inversione, stato ${sito.stato}`
        : `a parte: ${sito.stato === atteso ? 'stesso stato' : `stato ${sito.stato}`}`);
    righe.push([
      r['url']!,
      r['tipo']!,
      String(atteso),
      String(sito.stato),
      sito.destinazione,
      esito,
    ]);
  }
  return { righe, inversioni };
}

async function main(): Promise<void> {
  mkdirSync(ESITI, { recursive: true });
  const regole = await verificaRegole();
  writeFileSync(path.join(ESITI, 'redirect.csv'), csv(regole.righe));
  const simmetrica = await verificaSimmetrica();
  writeFileSync(path.join(ESITI, 'redirect-simmetrico.csv'), csv(simmetrica.righe));
  console.log(
    `regole superate ${regole.superate}/${REGOLE_ATTESE}; ` +
      `indirizzi della matrice ${simmetrica.righe.length - 1}, inversioni ${simmetrica.inversioni}`,
  );
  for (const r of [...regole.righe.slice(1), ...simmetrica.righe.slice(1)]) {
    if (
      r.includes('non superato') ||
      r.at(-1)!.startsWith('inversione') ||
      r.at(-1)!.includes(', stato') ||
      r.at(-1)!.startsWith('a parte')
    ) {
      console.log(r.join(' | '));
    }
  }
}

main().catch((errore: unknown) => {
  console.error(errore);
  process.exit(1);
});
