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
import { contentsStage } from '../../../src/stages/contents/index.js';
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

/** Una pagina pubblicata con il modulo di contatto di Divi (DR-094): forma del caso reale, dati inventati. */
const DIVI_PAGE: SqlRow = {
  ID: 42,
  post_type: 'page',
  post_status: 'publish',
  post_name: 'contatti',
  post_title: 'Contatti',
  post_author: 0,
  post_excerpt: '',
  post_date: '2020-03-01 09:00:00',
  post_parent: 0,
  menu_order: 0,
  post_content:
    '[et_pb_section][et_pb_row][et_pb_column type="4_4"]' +
    '[et_pb_contact_form email="segreteria@esempio.invalid" title="Richiesta informazioni" success_message="Grazie." custom_message="Nome: %%Name%%"]' +
    '[et_pb_contact_field field_id="Name" field_title="Nome"][/et_pb_contact_field]' +
    '[et_pb_contact_field field_id="Message" field_title="Messaggio" field_type="text"][/et_pb_contact_field]' +
    '[/et_pb_contact_form][/et_pb_column][/et_pb_row][/et_pb_section]',
};

describe('fase forms — modulo di contatto di Divi (DR-094)', () => {
  it('crea un form proprio con la sua notifica, e la rieseguita non duplica nulla', async () => {
    const fresh = await createTestDatabase('amoris_importer_forms_divi');
    try {
      const source = fakeSourceReader({ wp_posts: [DIVI_PAGE] });
      for (const expected of ['created', 'updated'] as const) {
        const runId = await newApplyRunId(fresh.db);
        const result = await runStage(formsStage, {
          db: fresh.db,
          storage: fakeObjectStore(),
          source,
          runId,
          mode: 'apply',
          issues: createIssueSink(fresh.db, 'apply', runId),
          options: OPTIONS,
        });
        expect(result[expected]).toBe(1);
        expect(result.errors).toBe(0);
      }

      const forms = await fresh.db.select().from(schema.forms);
      expect(forms).toHaveLength(1);
      expect(forms[0]).toMatchObject({
        slug: 'contatto-richiesta-informazioni',
        title: 'Richiesta informazioni',
        confirmationMessage: 'Grazie.',
        requiresPayment: false,
        legacyId: null,
      });
      const ids = await fresh.db
        .select()
        .from(schema.importIdMap)
        .where(eq(schema.importIdMap.sourceTable, 'divi_contact_form'));
      expect(ids.map((row) => [row.sourceId, row.entity, row.entityId])).toEqual([
        [42, 'form', forms[0]!.id],
      ]);
      // DR-098: una notifica come nella sorgente, e la riesecuzione non la duplica.
      const notifications = await fresh.db.select().from(schema.formNotifications);
      expect(notifications).toHaveLength(1);
      expect(notifications[0]).toMatchObject({
        formId: forms[0]!.id,
        recipients: 'segreteria@esempio.invalid',
        subject: 'Richiesta informazioni',
        position: 0,
        isActive: true,
      });
    } finally {
      await fresh.teardown();
    }
  });

  it('la pagina cita il form con un blocco `form`, non con il blocco di riserva', async () => {
    const fresh = await createTestDatabase('amoris_importer_forms_divi_contents');
    try {
      const source = fakeSourceReader({ wp_posts: [DIVI_PAGE], wp_postmeta: [], wp_options: [] });
      for (const stage of [formsStage, contentsStage]) {
        const runId = await newApplyRunId(fresh.db);
        const issues = createIssueSink(fresh.db, 'apply', runId);
        const result = await runStage(stage, {
          db: fresh.db,
          storage: fakeObjectStore(),
          source,
          runId,
          mode: 'apply',
          issues,
          options: OPTIONS,
        });
        expect(result.errors).toBe(0);
        expect(issues.collected).toEqual([]);
      }
      const [form] = await fresh.db.select().from(schema.forms);
      const [page] = await fresh.db.select().from(schema.contents);
      const text = JSON.stringify(page!.blocks);
      expect(text).toContain(`"formId":"${form!.id}"`);
      expect(text).not.toContain('et_pb_contact_form');
      expect(text).not.toContain('"type":"html"');
    } finally {
      await fresh.teardown();
    }
  });

  it('uno slug già occupato da un altro form si segnala con il suo nome, non come errore generico', async () => {
    const fresh = await createTestDatabase('amoris_importer_forms_divi_slug');
    try {
      await fresh.db.insert(schema.forms).values({
        slug: 'contatto-richiesta-informazioni',
        title: 'Un altro form',
        definition: { fields: [] },
      });
      const runId = await newApplyRunId(fresh.db);
      const issues = createIssueSink(fresh.db, 'apply', runId);
      const result = await runStage(formsStage, {
        db: fresh.db,
        storage: fakeObjectStore(),
        source: fakeSourceReader({ wp_posts: [DIVI_PAGE] }),
        runId,
        mode: 'apply',
        issues,
        options: OPTIONS,
      });
      expect(result.errors).toBe(1);
      expect(issues.collected.map((i) => [i.code, i.sourceTable, i.sourceId, i.detail])).toEqual([
        ['item-import-failed', 'divi_contact_form', 42, 'divi-form-slug-conflict'],
      ]);
    } finally {
      await fresh.teardown();
    }
  });
});
