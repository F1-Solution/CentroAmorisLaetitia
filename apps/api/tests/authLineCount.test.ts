import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countAuthLines, THRESHOLD } from '../tools/countAuthLines.js';

/**
 * Criterio di uscita 18: «la logica di autenticazione è stata **contata in
 * righe** e il numero è riportato nell'audit, con l'esito rispetto alla soglia
 * di ADR-007 §6», portata da 300 a 500 il 2026-09-21 da DR-070.
 *
 * Il numero non si affida alla memoria: sta in `auth-line-count.json`, accanto a
 * questo file, e il test fallisce appena il codice si discosta dalla misura
 * dichiarata. Un modulo che cresce lo si vede nel diff della dichiarazione, non
 * quando è troppo tardi.
 *
 * **La soglia resta superata nella lettura del totale**, ed è dichiarato per
 * ciascuna delle due letture: con 500, il nucleo la rispetta e il totale no. La
 * conseguenza — la contromisura 3 del §6 di ADR-007, che impone di adottare
 * Better Auth — è una decisione di architettura e non si prende qui: è derogata
 * da DR-066 e la deroga resta iscritta nel registro delle decisioni.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const declarationPath = path.join(here, 'auth-line-count.json');

interface Declaration {
  readonly soglia: number;
  readonly nucleo: number;
  readonly totale: number;
  readonly esitoNucleo: string;
  readonly esitoTotale: string;
  readonly esitoRispettoAllaSoglia: string;
  readonly perFile: Record<string, number>;
}

describe('conteggio delle righe della logica di autenticazione', () => {
  it('coincide con la misura dichiarata, file per file', async () => {
    const declaration = JSON.parse(await readFile(declarationPath, 'utf8')) as Declaration;
    const measured = await countAuthLines();

    const perFile = Object.fromEntries(measured.perFile.map((e) => [e.file, e.lines]));
    expect(perFile).toEqual(declaration.perFile);
    expect(measured.core).toBe(declaration.nucleo);
    expect(measured.total).toBe(declaration.totale);
  });

  it('la soglia dichiarata è quella di ADR-007 §6, e l’esito è scritto per esteso', async () => {
    const declaration = JSON.parse(await readFile(declarationPath, 'utf8')) as Declaration;
    expect(declaration.soglia).toBe(THRESHOLD);

    // L'esito dichiarato deve corrispondere alla misura: dichiarare «rispettata»
    // una soglia superata è l'unico modo in cui questo controllo potrebbe mentire.
    // Le letture sono due e si dichiarano separatamente, perché una soglia alzata
    // rende facile far sparire la differenza dentro un esito solo.
    const outcome = (measure: number) => (measure > THRESHOLD ? 'superata' : 'rispettata');

    expect(declaration.esitoNucleo).toBe(outcome(declaration.nucleo));
    expect(declaration.esitoTotale).toBe(outcome(declaration.totale));
    expect(declaration.esitoRispettoAllaSoglia).toBe(
      declaration.esitoNucleo === 'superata' || declaration.esitoTotale === 'superata'
        ? 'superata'
        : 'rispettata',
    );
  });
});
