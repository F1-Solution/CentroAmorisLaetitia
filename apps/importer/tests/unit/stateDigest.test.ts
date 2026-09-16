/**
 * La fotografia strutturale dello stato (`verify/stateDigest.ts`, wave
 * `1D-W5c`), che è lo strumento con cui si dimostra il criterio di
 * accettazione della fase: **due `apply` di fila producono lo stesso stato**
 * (`importer-spec.md` §11, `IMPORTER-DESIGN.md` §6.5).
 *
 * Prima di usarla come prova bisogna provare lei: una fotografia che dicesse
 * «uguale» per due stati diversi farebbe passare un import che ha perso righe.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { schema } from '@amoris/db';
import {
  diffStateDigests,
  domainTables,
  stateDigest,
  tableDigest,
} from '../../src/verify/stateDigest.js';
import { createRun } from '../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from './_support/dbHarness.js';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase('statedigest');
});

afterEach(async () => {
  await database.teardown();
});

async function nuovoTermine(slug: string, name = 'Termine di prova'): Promise<string> {
  const [row] = await database.db
    .insert(schema.terms)
    .values({ taxonomy: 'category', slug, name, path: `/${slug}/` })
    .returning({ id: schema.terms.id });
  return row!.id;
}

describe('fotografia strutturale dello stato', () => {
  it('due stati uguali producono la stessa fotografia', async () => {
    await nuovoTermine('primo');
    const prima = await stateDigest(database.db);
    const dopo = await stateDigest(database.db);
    expect(diffStateDigests(prima, dopo)).toEqual([]);
  });

  it('una riga in più cambia la fotografia', async () => {
    const prima = await stateDigest(database.db);
    await nuovoTermine('aggiunto');
    const differenze = diffStateDigests(prima, await stateDigest(database.db));
    expect(differenze.map((d) => d.table)).toEqual(['terms']);
    expect(differenze[0]?.before?.rows).toBe(0);
    expect(differenze[0]?.after?.rows).toBe(1);
  });

  it('un valore cambiato, a parità di numero di righe, cambia la fotografia', async () => {
    const id = await nuovoTermine('stabile', 'Nome di partenza');
    const prima = await tableDigest(database.db, 'terms');

    await database.db
      .update(schema.terms)
      .set({ name: 'Nome diverso' })
      .where(eq(schema.terms.id, id));

    const dopo = await tableDigest(database.db, 'terms');
    expect(dopo.rows).toBe(prima.rows);
    expect(dopo.digest).not.toBe(prima.digest);
  });

  it("l'ordine fisico delle righe non conta", async () => {
    await nuovoTermine('alfa');
    await nuovoTermine('beta');
    const prima = await tableDigest(database.db, 'terms');

    // `CLUSTER` non è disponibile senza un indice adatto: si riscrive la
    // tabella con un aggiornamento che non cambia alcun valore, e che in
    // PostgreSQL sposta comunque le righe.
    await database.db.execute(sql`update terms set position = position`);

    expect((await tableDigest(database.db, 'terms')).digest).toBe(prima.digest);
  });

  it('created_at e updated_at non entrano nel confronto', async () => {
    const id = await nuovoTermine('con-date');
    const prima = await tableDigest(database.db, 'terms');

    await database.db
      .update(schema.terms)
      .set({ updatedAt: new Date('2030-01-01T00:00:00Z') })
      .where(eq(schema.terms.id, id));

    // È l'importer stesso a muovere `updated_at` a ogni riesecuzione: se
    // entrasse nel confronto, due esecuzioni identiche risulterebbero diverse.
    expect((await tableDigest(database.db, 'terms')).digest).toBe(prima.digest);
  });

  it('il registro dell\'importazione resta fuori dalla fotografia', async () => {
    const tabelle = await domainTables(database.db);
    expect(tabelle).not.toContain('import_runs');
    expect(tabelle).not.toContain('import_issues');
    expect(tabelle).not.toContain('import_id_map');

    const prima = await stateDigest(database.db);
    await createRun(database.db, {
      isDryRun: false,
      sourceLabel: 'BackupDB-2026-09-13',
      importerVersion: '0.0.0-test',
    });
    // Una seconda esecuzione aggiunge una riga di registro: deve poter farlo
    // senza che la fotografia dichiari lo stato cambiato.
    expect(diffStateDigests(prima, await stateDigest(database.db))).toEqual([]);
  });

  it('sessioni, audit log e cronologia dei contenuti sono dentro la fotografia (§6.3)', async () => {
    // L'importer non le tocca mai, e il modo in cui lo si prova è includerle:
    // se una riesecuzione le cambiasse, la fotografia lo direbbe.
    const tabelle = await domainTables(database.db);
    expect(tabelle).toContain('sessions');
    expect(tabelle).toContain('audit_log');
    expect(tabelle).toContain('content_revisions');
  });

  it('la fotografia non contiene alcun valore delle righe', async () => {
    await nuovoTermine('marcatore-canarino', 'MARCATORE-CANARINO-IRRIPETIBILE-9f3e1c');
    const json = JSON.stringify(await stateDigest(database.db));
    // Solo nomi di tabella, conteggi e digest: nessun valore, per la regola 1
    // di `database-schema.md` §7.
    expect(json).not.toContain('MARCATORE-CANARINO');
    expect(json).not.toContain('marcatore-canarino');
  });
});
