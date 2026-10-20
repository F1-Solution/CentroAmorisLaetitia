import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { usersStage } from '../../../src/stages/users/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';
import type { Database } from '@amoris/db';

/** Vedi `settingsStage.test.ts`: `import_id_map.run_id` è vincolato a `import_runs`. */
async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

/**
 * Dati **sintetici**: un solo utente di fantasia su un dominio di esempio
 * (DR-010). Nessun dato reale della persona vera che la sorgente contiene.
 */
const ADMIN_CAPABILITIES = 'a:1:{s:13:"administrator";b:1;}';

function buildUsersSource(options?: { withSecondBrokenUser?: boolean }) {
  const users: SqlRow[] = [
    {
      ID: 1,
      user_login: 'redattore-prova',
      user_email: 'redattore@esempio.test',
      display_name: 'Redattore Di Prova',
      user_registered: '2020-01-15 10:00:00',
    },
  ];
  const usermeta: SqlRow[] = [
    { umeta_id: 1, user_id: 1, meta_key: 'first_name', meta_value: 'Redattore' },
    { umeta_id: 2, user_id: 1, meta_key: 'last_name', meta_value: 'Di Prova' },
    { umeta_id: 3, user_id: 1, meta_key: 'wp_capabilities', meta_value: ADMIN_CAPABILITIES },
  ];

  if (options?.withSecondBrokenUser) {
    users.push({
      ID: 2,
      user_login: 'senza-email',
      user_email: '',
      display_name: 'Utente Senza Email',
      user_registered: '2021-06-01 09:00:00',
    });
  }

  return fakeSourceReader({ wp_users: users, wp_usermeta: usermeta });
}

const OPTIONS = { only: null, forceContentIds: [], verbose: false } as const;

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_users');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase users', () => {
  it('crea l’utente, il ruolo editor, i permessi e li collega', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(usersStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildUsersSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(1);
    expect(result.errors).toBe(0);

    const users = await testDb.db.select().from(schema.users);
    expect(users).toHaveLength(1);
    expect(users[0]?.passwordHash).toBeNull();
    expect(users[0]?.mustChangePassword).toBe(true);
    expect(users[0]?.legacyId).toBe(1);

    const roles = await testDb.db.select().from(schema.roles).where(eq(schema.roles.key, 'editor'));
    expect(roles).toHaveLength(1);
    expect(roles[0]?.isSystem).toBe(true);
    expect(roles[0]?.label).toBe('Redazione');

    // Otto permessi e tre per `amministrazione` li semina la migrazione (DR-227); i cinque di `editor` la fase.
    const permissions = await testDb.db.select().from(schema.permissions);
    expect(permissions).toHaveLength(8);

    const rolePermissions = await testDb.db.select().from(schema.rolePermissions);
    expect(rolePermissions).toHaveLength(8);

    const userRoles = await testDb.db.select().from(schema.userRoles);
    expect(userRoles).toHaveLength(1);

    const idMapRow = await testDb.db
      .select()
      .from(schema.importIdMap)
      .where(eq(schema.importIdMap.entity, 'user'));
    expect(idMapRow).toHaveLength(1);
    expect(idMapRow[0]?.sourceTable).toBe('wp_users');
    expect(idMapRow[0]?.sourceId).toBe(1);
    expect(idMapRow[0]?.entityId).toBe(users[0]?.id);
  });

  it('rieseguita aggiorna sul posto, l’identificatore non cambia', async () => {
    const [before] = await testDb.db.select().from(schema.users);
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(usersStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildUsersSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);

    const users = await testDb.db.select().from(schema.users);
    expect(users).toHaveLength(1);
    expect(users[0]?.id).toBe(before?.id);

    // Nessuna riga di collegamento duplicata.
    const userRoles = await testDb.db.select().from(schema.userRoles);
    expect(userRoles).toHaveLength(1);
  });

  it('un elemento sintetico corrotto (email assente) produce un errore e non ferma la fase', async () => {
    const fresh = await createTestDatabase('amoris_importer_users_isolation');
    try {
      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(usersStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildUsersSource({ withSecondBrokenUser: true }),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(1); // l'utente valido
      expect(result.errors).toBe(1); // l'utente senza email

      const users = await fresh.db.select().from(schema.users);
      expect(users).toHaveLength(1);
      expect(users[0]?.legacyId).toBe(1);

      const failure = issues.collected.find((i) => i.code === 'item-import-failed');
      expect(failure).toBeDefined();
      expect(failure?.severity).toBe('error');
      expect(failure?.sourceTable).toBe('wp_users');
      expect(failure?.sourceId).toBe(2);
      // Nessun dato personale nel dettaglio: solo il nome della classe dell'errore.
      expect(failure?.detail).not.toMatch(/senza-email|Utente Senza Email/);
    } finally {
      await fresh.teardown();
    }
  });

  it('in modo plan non scrive nulla: si annulla di proposito', async () => {
    const fresh = await createTestDatabase('amoris_importer_users_plan');
    try {
      const runId = randomUUID();
      const issues = createIssueSink(fresh.db, 'plan', runId);
      const result = await runStage(usersStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: buildUsersSource(),
        runId,
        mode: 'plan',
        issues,
        options: OPTIONS,
      });

      expect(result.created).toBe(1);

      const users = await fresh.db.select().from(schema.users);
      expect(users).toHaveLength(0);
      // Resta il solo ruolo seminato dalla migrazione: `editor` non è stato scritto.
      const roles = await fresh.db.select().from(schema.roles);
      expect(roles.map((role) => role.key)).toEqual(['amministrazione']);
      const idMapRows = await fresh.db.select().from(schema.importIdMap);
      expect(idMapRows).toHaveLength(0);
    } finally {
      await fresh.teardown();
    }
  });
});
