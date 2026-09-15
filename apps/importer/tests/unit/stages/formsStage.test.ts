/**
 * Fase `forms` (`importer-spec.md` §4, ADR-010). Dati **sintetici**: nessun
 * valore di questa sorgente vera. Copre: le sole `publish` diventano `forms`,
 * le `trash` decadono; il conteggio delle notifiche; `requiresPayment`; un
 * `post_content` non JSON e un tipo di campo mai visto producono un
 * `import_issues` e non fermano la fase; la riesecuzione aggiorna, non
 * duplica le notifiche.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { formsStage } from '../../../src/stages/forms/index.js';
import { runStage } from '../../../src/stages/runStage.js';
import { createIssueSink } from '../../../src/persistence/issueSink.js';
import { createRun } from '../../../src/persistence/importRuns.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';
import { fakeSourceReader } from '../_support/fakeSource.js';
import { fakeObjectStore } from '../_support/fakeStorage.js';
import type { SqlRow } from '../../../src/source/sql/types.js';
import type { Database } from '@amoris/db';

async function newApplyRunId(db: Database): Promise<string> {
  return createRun(db, {
    isDryRun: false,
    sourceLabel: 'BackupDB-2026-09-13',
    importerVersion: '0.0.0-test',
  });
}

const OPTIONS = { only: null, forceContentIds: [], verbose: false } as const;

function fieldsOf(...fields: readonly Record<string, unknown>[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  fields.forEach((f, i) => {
    out[String(i + 1)] = f;
  });
  return out;
}

function notificationsOf(
  ...notifications: readonly Record<string, unknown>[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  notifications.forEach((n, i) => {
    out[String(i + 1)] = n;
  });
  return out;
}

const NAME_FIELD = {
  id: '1',
  type: 'name',
  label: 'Nome e cognome',
  required: '1',
  format: 'simple',
};
const EMAIL_FIELD = {
  id: '2',
  type: 'email',
  label: 'Email',
  required: '1',
  placeholder: 'nome@example.invalid',
};
const PAYMENT_FIELD = {
  id: '3',
  type: 'payment-single',
  label: 'Quota',
  required: '1',
  amount: '50.00',
};

const ADMIN_NOTIFICATION = {
  notification_name: 'Amministratore',
  email: '{admin_email}',
  subject: 'Nuova iscrizione',
  sender_name: 'Centro Amoris Laetitia',
  sender_address: 'noreply@example.invalid',
  replyto: '',
  message: 'È arrivata una nuova iscrizione.',
};
const USER_NOTIFICATION = {
  notification_name: 'Conferma utente',
  email: '{field_id="2"}',
  subject: 'Conferma iscrizione',
  sender_name: 'Centro Amoris Laetitia',
  sender_address: 'noreply@example.invalid',
  replyto: '',
  message: 'Grazie per la tua iscrizione.',
};

function formPostContent(options: {
  readonly title: string;
  readonly fields: Record<string, unknown>;
  readonly notifications: Record<string, unknown>;
}): string {
  return JSON.stringify({
    fields: options.fields,
    id: 1,
    field_id: Object.keys(options.fields).length + 1,
    settings: {
      form_title: options.title,
      notification_enable: '1',
      notifications: options.notifications,
      confirmations: { 1: { type: 'message', message: 'Grazie per l’iscrizione.' } },
    },
    payments: {},
    meta: {},
  });
}

const FORM_ROWS: readonly SqlRow[] = [
  {
    ID: 201,
    post_type: 'wpforms',
    post_status: 'publish',
    post_name: 'iscrizione-gruppo-lettura',
    post_title: 'Iscrizione gruppo di lettura',
    post_content: formPostContent({
      title: 'Iscrizione gruppo di lettura',
      fields: fieldsOf(NAME_FIELD, EMAIL_FIELD),
      notifications: notificationsOf(ADMIN_NOTIFICATION),
    }),
  },
  {
    ID: 202,
    post_type: 'wpforms',
    post_status: 'publish',
    post_name: 'iscrizione-corso-coppie',
    post_title: 'Iscrizione corso per coppie',
    post_content: formPostContent({
      title: 'Iscrizione corso per coppie',
      fields: fieldsOf(NAME_FIELD, EMAIL_FIELD, PAYMENT_FIELD),
      notifications: notificationsOf(ADMIN_NOTIFICATION, USER_NOTIFICATION),
    }),
  },
  {
    ID: 203,
    post_type: 'wpforms',
    post_status: 'trash',
    post_name: 'form-cestinato',
    post_title: 'Form cestinato',
    post_content: formPostContent({
      title: 'Form cestinato',
      fields: fieldsOf(NAME_FIELD),
      notifications: notificationsOf(),
    }),
  },
  {
    ID: 204,
    post_type: 'wpforms',
    post_status: 'publish',
    post_name: 'form-corrotto',
    post_title: 'Form corrotto',
    post_content: 'questo non è JSON valido {{{',
  },
  {
    ID: 205,
    post_type: 'wpforms',
    post_status: 'publish',
    post_name: 'form-tipo-sconosciuto',
    post_title: 'Form con tipo sconosciuto',
    post_content: formPostContent({
      title: 'Form con tipo sconosciuto',
      fields: fieldsOf({ id: '1', type: 'un-tipo-mai-visto', label: 'Campo strano', required: '' }),
      notifications: notificationsOf(),
    }),
  },
];

function buildFormsSource() {
  return fakeSourceReader({ wp_posts: FORM_ROWS });
}

let testDb: TestDatabase;

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_forms');
});

afterAll(async () => {
  await testDb.teardown();
});

describe('fase forms', () => {
  it('importa le publish valide, isola il post_content non JSON e il tipo di campo sconosciuto, ignorando le trash', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(formsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildFormsSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(2); // 201, 202
    expect(result.errors).toBe(2); // 204 (JSON non valido), 205 (tipo sconosciuto)
    // 203 è trash: se fosse stato elaborato, il totale sarebbe 5, non 4.
    expect(result.created + result.errors).toBe(4);

    const forms = await testDb.db.select().from(schema.forms);
    expect(forms).toHaveLength(2);
    expect(forms.some((f) => f.legacyId === 203)).toBe(false);

    const failures = issues.collected.filter((i) => i.code === 'item-import-failed');
    expect(failures).toHaveLength(2);
    expect(failures.every((f) => f.sourceTable === 'wp_posts')).toBe(true);
    expect(new Set(failures.map((f) => f.sourceId))).toEqual(new Set([204, 205]));
    expect(failures.some((f) => f.sourceId === 203)).toBe(false);
    // Il dettaglio è generico (nome dell'errore), mai un frammento della sorgente:
    // `SyntaxError` per il JSON non valido, `Error` per il tipo di campo sconosciuto.
    expect(failures.every((f) => ['Error', 'SyntaxError'].includes(f.detail ?? ''))).toBe(true);
  });

  it('requiresPayment è vero solo per il form con un campo payment-single', async () => {
    const withPayment = await testDb.db
      .select()
      .from(schema.forms)
      .where(eq(schema.forms.slug, 'iscrizione-corso-coppie'));
    const withoutPayment = await testDb.db
      .select()
      .from(schema.forms)
      .where(eq(schema.forms.slug, 'iscrizione-gruppo-lettura'));

    expect(withPayment[0]?.requiresPayment).toBe(true);
    expect(withoutPayment[0]?.requiresPayment).toBe(false);
  });

  it('scrive una riga form_notifications per notifica, 3 in totale sui due form validi', async () => {
    const notifications = await testDb.db.select().from(schema.formNotifications);
    expect(notifications).toHaveLength(3); // 1 + 2
  });

  it('rieseguita aggiorna sul posto e non duplica le notifiche', async () => {
    const runId = await newApplyRunId(testDb.db);
    const issues = createIssueSink(testDb.db, 'apply', runId);
    const result = await runStage(formsStage, {
      db: testDb.db,
      storage: fakeObjectStore(),
      source: buildFormsSource(),
      runId,
      mode: 'apply',
      issues,
      options: OPTIONS,
    });

    expect(result.created).toBe(0);
    expect(result.updated).toBe(2);
    expect(result.errors).toBe(2);

    const forms = await testDb.db.select().from(schema.forms);
    expect(forms).toHaveLength(2);

    const notifications = await testDb.db.select().from(schema.formNotifications);
    expect(notifications).toHaveLength(3); // non duplicate
  });
});
