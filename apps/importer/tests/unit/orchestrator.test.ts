/**
 * Il contratto dell'orchestratore (`run/orchestrator.ts`, wave `1D-W5c`):
 * ordine obbligato, dipendenze, isolamento della fase fallita, una sola
 * `IdMap` per esecuzione, e `plan` che non lascia nulla.
 *
 * Si prova con fasi finte e non con quelle vere, perché il contratto vale a
 * prescindere da che cosa le fasi facciano: usare le sedici vere renderebbe il
 * test una misura della sorgente, che è un'altra cosa e sta in `tests/real/`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { schema, type Database } from '@amoris/db';
import { runImport } from '../../src/run/orchestrator.js';
import type { Stage, StageContext } from '../../src/stages/context.js';
import type { StageName, StageResult } from '../../src/stages/types.js';
import { createIssueSink } from '../../src/persistence/issueSink.js';
import { createRun } from '../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from './_support/dbHarness.js';
import { fakeSourceReader } from './_support/fakeSource.js';
import { fakeObjectStore } from './_support/fakeStorage.js';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase('orchestrator');
});

afterEach(async () => {
  await database.teardown();
});

const NIENTE: StageResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

/** Una fase finta che registra di essere stata eseguita e restituisce ciò che le si dice. */
function fakeStage(
  name: StageName,
  dependsOn: readonly StageName[],
  run: (ctx: StageContext) => Promise<StageResult>,
): Stage {
  return { name, dependsOn, expected: async () => null, run };
}

async function esegui(
  db: Database,
  stages: readonly Stage[],
  mode: 'plan' | 'apply' = 'apply',
  onlyStage: StageName | null = null,
) {
  const runId = await createRun(db, {
    isDryRun: mode === 'plan',
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
  const issues = createIssueSink(db, mode, runId);
  const outcome = await runImport({
    db,
    source: fakeSourceReader({}),
    storage: fakeObjectStore(),
    runId,
    mode,
    issues,
    options: { only: null, forceContentIds: [], verbose: false },
    ipHashSalt: null,
    onlyStage,
    stages,
  });
  return { runId, outcome, issues };
}

describe('orchestratore', () => {
  it("esegue le fasi nell'ordine in cui le riceve", async () => {
    const eseguite: StageName[] = [];
    const stages = [
      fakeStage('settings', ['preflight'], async () => {
        eseguite.push('settings');
        return NIENTE;
      }),
      fakeStage('users', ['preflight'], async () => {
        eseguite.push('users');
        return NIENTE;
      }),
      fakeStage('media', ['users'], async () => {
        eseguite.push('media');
        return NIENTE;
      }),
    ];

    await esegui(database.db, stages);
    expect(eseguite).toEqual(['settings', 'users', 'media']);
  });

  it('non esegue una fase la cui dipendente non è stata eseguita', async () => {
    const eseguite: StageName[] = [];
    // `media` dipende da `users`, che qui non c'è: non deve partire.
    const stages = [
      fakeStage('media', ['users'], async () => {
        eseguite.push('media');
        return NIENTE;
      }),
    ];

    const { outcome } = await esegui(database.db, stages);
    expect(eseguite).toEqual([]);
    expect(outcome.skippedStages).toEqual(['media']);
  });

  it('una fase fallita non ferma le altre, ma ferma le sue dipendenti', async () => {
    const eseguite: StageName[] = [];
    const stages = [
      fakeStage('users', ['preflight'], async () => {
        throw new Error('fallimento voluto');
      }),
      // Dipende da `users`, che è fallita: non parte.
      fakeStage('media', ['users'], async () => {
        eseguite.push('media');
        return NIENTE;
      }),
      // Non dipende da `users`: parte lo stesso.
      fakeStage('terms', ['preflight'], async () => {
        eseguite.push('terms');
        return NIENTE;
      }),
    ];

    const { outcome } = await esegui(database.db, stages);
    expect(eseguite).toEqual(['terms']);
    expect(outcome.aborted?.stage).toBe('users');
    expect(outcome.skippedStages).toEqual(['media']);
  });

  it("l'annullamento di una fase fallita non porta via ciò che le altre hanno scritto", async () => {
    const stages = [
      fakeStage('terms', ['preflight'], async (ctx) => {
        await ctx.tx.insert(schema.terms).values({
          taxonomy: 'category',
          slug: 'sopravvissuto',
          name: 'Termine che resta',
          path: '/sopravvissuto/',
        });
        return { ...NIENTE, created: 1 };
      }),
      fakeStage('users', ['preflight'], async (ctx) => {
        await ctx.tx.insert(schema.users).values({
          email: 'nessuno@esempio.invalid',
          fullName: 'Persona di fantasia',
        });
        throw new Error('fallimento dopo aver scritto');
      }),
    ];

    await esegui(database.db, stages);

    const termini = await database.db.select({ slug: schema.terms.slug }).from(schema.terms);
    const utenti = await database.db.select({ email: schema.users.email }).from(schema.users);
    expect(termini.map((t) => t.slug)).toContain('sopravvissuto');
    // La fase fallita è stata annullata dalla propria transazione (§4.3).
    expect(utenti).toEqual([]);
  });

  it('una sola IdMap per esecuzione: una fase vede gli identificatori della precedente (§6.1)', async () => {
    let trovato: string | null = 'non-eseguita';
    const stages = [
      fakeStage('users', ['preflight'], async (ctx) => {
        const [utente] = await ctx.tx
          .insert(schema.users)
          .values({ email: 'autore@esempio.invalid', fullName: 'Autore di fantasia', legacyId: 7 })
          .returning({ id: schema.users.id });
        await ctx.ids.remember(ctx.tx, 'wp_users', 7, 'user', utente!.id, ctx.runId, 'created');
        return { ...NIENTE, created: 1 };
      }),
      fakeStage('media', ['users'], async (ctx) => {
        trovato = await ctx.ids.find(ctx.tx, 'wp_users', 7, 'user');
        return NIENTE;
      }),
    ];

    await esegui(database.db, stages, 'plan');
    // In `plan` la ricerca non può passare dal database — la transazione
    // dell'esecuzione verrà annullata — ma la sovrapposizione in memoria la
    // ricorda. Con una `IdMap` per fase qui ci sarebbe `null`.
    expect(trovato).not.toBeNull();
    expect(trovato).not.toBe('non-eseguita');
  });

  it('in plan una fase vede le righe della precedente, e alla fine non resta nulla', async () => {
    let vistiDallaSeconda = -1;
    const stages = [
      fakeStage('terms', ['preflight'], async (ctx) => {
        await ctx.tx.insert(schema.terms).values({
          taxonomy: 'category',
          slug: 'solo-in-prova',
          name: 'Termine di prova',
          path: '/solo-in-prova/',
        });
        return { ...NIENTE, created: 1 };
      }),
      fakeStage('contents', ['media', 'terms'], async (ctx) => {
        const righe = await ctx.tx.select({ slug: schema.terms.slug }).from(schema.terms);
        vistiDallaSeconda = righe.length;
        return NIENTE;
      }),
    ];

    // `contents` dipende anche da `media`: si passa una fase `media` che non fa
    // nulla, senza dipendenti proprie, così da soddisfare il controllo.
    await esegui(
      database.db,
      [fakeStage('media', ['preflight'], async () => NIENTE), ...stages],
      'plan',
      null,
    );

    // Senza la transazione unica dell'esecuzione questa sarebbe zero.
    expect(vistiDallaSeconda).toBe(1);

    const rimasti = await database.db.select({ slug: schema.terms.slug }).from(schema.terms);
    expect(rimasti).toEqual([]);
  });

  it('con --stage esegue quella sola fase, senza pretendere le dipendenti', async () => {
    const eseguite: StageName[] = [];
    const stages = [
      fakeStage('users', ['preflight'], async () => {
        eseguite.push('users');
        return NIENTE;
      }),
      fakeStage('media', ['users'], async () => {
        eseguite.push('media');
        return NIENTE;
      }),
    ];

    const { outcome } = await esegui(database.db, stages, 'apply', 'media');
    expect(eseguite).toEqual(['media']);
    expect(outcome.skippedStages).toEqual([]);
  });
});
