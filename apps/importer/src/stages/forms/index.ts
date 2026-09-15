/**
 * Fase 11 `forms` (`importer-spec.md` §4): produce `forms` e
 * `form_notifications`.
 *
 * Sorgente: i 25 `wp_posts` con `post_type = 'wpforms'` e
 * `post_status = 'publish'` (misurato — ADR-010 §1.1). I 3 nel cestino si
 * scartano senza contarli come saltati: `expected()` conta solo i 25
 * pubblicati.
 *
 * `post_content` è **JSON** (non serializzato PHP), con chiavi di primo
 * livello `fields, id, field_id, settings, payments, meta` (misurato). Un
 * valore che non fa `JSON.parse`, o un campo di tipo mai visto fra i dieci
 * misurati (`address, checkbox, date-time, email, html, name, number,
 * payment-single, phone, radio, text` — ADR-010 §1.2), fa fallire **solo
 * quel form**: l'errore si propaga fuori da `parseFormPost` e lo isola
 * `forEachItem`, come già fa `stages/sliders/index.ts` per un JSON malformato.
 *
 * ## Forma di `forms.definition`
 *
 * Non si copia l'intero blob del plugin: si tiene una forma propria, un
 * campo per riga con `id, type, label, required, order` più le sole chiavi
 * `options` che servono a rendere **quel tipo** di campo
 * (`FIELD_OPTION_KEYS_BY_TYPE`), scartando il resto (CSS, condizioni,
 * integrazioni di terze parti mai usate su questa sorgente). `order` è
 * l'indice di enumerazione delle chiavi di `fields`: essendo chiavi
 * numeriche, JavaScript le enumera già in ordine ascendente, che è l'ordine
 * di visualizzazione del form.
 *
 * `requiresPayment` è vero quando la definizione contiene un campo
 * `payment-single` (misurato: 22 form su 25). ADR-010 §4.2 esclude questo
 * tipo dai campi resi in Fase 1: il flag è ciò che impedisce di pubblicare un
 * form che sembri funzionante senza esserlo, in attesa della decisione D14.
 *
 * ## Notifiche
 *
 * `settings.notifications` è una mappa id -> notifica; si scrive una riga
 * `form_notifications` per voce (39 in totale sui 25 form). Idempotenza:
 * `forms.legacyId` ha un vincolo di unicità, ma si usa comunque
 * `import_id_map` con entità `form`, come le altre fasi con identità
 * numerica sorgente (`sliders`, `documents`) — così una futura modifica
 * manuale di `forms.legacy_id` non disallinea la corrispondenza. Le
 * notifiche non hanno una propria voce in `import_id_map`: si cancellano e
 * si reinseriscono ad ogni riesecuzione, come fa `documents` con
 * `document_terms`.
 */
import { eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';

const KNOWN_FIELD_TYPES: ReadonlySet<string> = new Set([
  'address',
  'checkbox',
  'date-time',
  'email',
  'html',
  'name',
  'number',
  'payment-single',
  'phone',
  'radio',
  'text',
]);

/**
 * Chiavi facoltative della definizione grezza del plugin tenute per tipo di
 * campo: quanto basta a rendere il campo secondo ADR-010 §4.2, non l'intero
 * blob. `payment-single` è incluso solo perché la sua presenza determina
 * `requiresPayment`: le sue chiavi non producono alcun rendering in Fase 1.
 */
const FIELD_OPTION_KEYS_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  address: ['scheme'],
  checkbox: ['choices', 'random'],
  'date-time': ['format', 'date_type', 'time_type'],
  email: ['placeholder', 'default_value', 'confirmation'],
  html: ['code'],
  name: ['format'],
  number: ['placeholder', 'default_value', 'min', 'max'],
  'payment-single': ['amount', 'price'],
  phone: ['format', 'placeholder'],
  radio: ['choices', 'random'],
  text: ['placeholder', 'default_value', 'limit_count', 'limit_mode'],
};

interface FormFieldDefinition {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly required: boolean;
  readonly order: number;
  readonly description: string | null;
  readonly options: Readonly<Record<string, unknown>>;
}

interface FormNotificationDefinition {
  readonly name: string;
  readonly recipients: string;
  readonly subject: string;
  readonly senderName: string | null;
  readonly replyTo: string | null;
  readonly body: string;
  readonly isActive: boolean;
  readonly position: number;
}

interface ParsedForm {
  readonly title: string;
  readonly confirmationMessage: string | null;
  readonly submitText: string | null;
  readonly submitTextProcessing: string | null;
  readonly fields: readonly FormFieldDefinition[];
  readonly notifications: readonly FormNotificationDefinition[];
  readonly requiresPayment: boolean;
}

interface FormRow {
  readonly legacyId: number;
  readonly slug: string;
  readonly postTitle: string;
  readonly rawContent: string;
}

function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

function asBoolish(value: unknown): boolean {
  return value === '1' || value === 1 || value === true;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function pickKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

/**
 * Confermazioni: `settings.confirmations` è a sua volta una mappa; si tiene
 * solo il messaggio della prima, perché ADR-010 §1.1 misura una conferma
 * sempre "messaggio nella pagina, mai un redirect" su tutti e 25 i form —
 * non c'è, su questa sorgente, un secondo tipo di conferma da rappresentare.
 */
function firstConfirmationMessage(confirmations: unknown): string | null {
  if (confirmations === null || typeof confirmations !== 'object') return null;
  for (const value of Object.values(confirmations as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue;
    const message = (value as Record<string, unknown>)['message'];
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return null;
}

/**
 * Analizza `post_content`. Lancia se non è JSON valido o se un campo ha un
 * tipo mai misurato (`KNOWN_FIELD_TYPES`): il chiamante isola l'errore per
 * elemento (`forEachItem`), come già fa `stages/sliders/index.ts`.
 */
function parseFormPost(raw: string): ParsedForm {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const rawFields = (parsed['fields'] ?? {}) as Record<string, unknown>;
  const settings = (parsed['settings'] ?? {}) as Record<string, unknown>;

  const fields: FormFieldDefinition[] = [];
  let order = 0;
  for (const value of Object.values(rawFields)) {
    if (value === null || typeof value !== 'object') continue;
    const raw = value as Record<string, unknown>;
    const type = typeof raw['type'] === 'string' ? raw['type'] : '';
    if (!KNOWN_FIELD_TYPES.has(type)) {
      throw new Error(`unknown-field-type`); // isolato per form, mai il tipo nel log altrove
    }
    fields.push({
      id: asString(raw['id'] as SqlRow[string]) || String(order),
      type,
      label: typeof raw['label'] === 'string' ? raw['label'] : '',
      required: asBoolish(raw['required']),
      order,
      description: asStringOrNull(raw['description']),
      options: pickKeys(raw, FIELD_OPTION_KEYS_BY_TYPE[type] ?? []),
    });
    order += 1;
  }

  const rawNotifications = (settings['notifications'] ?? {}) as Record<string, unknown>;
  const notificationsEnabled = settings['notification_enable'] !== '0';
  const notifications: FormNotificationDefinition[] = [];
  let position = 0;
  for (const value of Object.values(rawNotifications)) {
    if (value === null || typeof value !== 'object') continue;
    const raw = value as Record<string, unknown>;
    notifications.push({
      name:
        typeof raw['notification_name'] === 'string'
          ? raw['notification_name']
          : `Notifica ${position + 1}`,
      recipients: typeof raw['email'] === 'string' ? raw['email'] : '',
      subject: typeof raw['subject'] === 'string' ? raw['subject'] : '',
      senderName: asStringOrNull(raw['sender_name']),
      replyTo: asStringOrNull(raw['replyto']),
      body: typeof raw['message'] === 'string' ? raw['message'] : '',
      isActive: notificationsEnabled,
      position,
    });
    position += 1;
  }

  return {
    title: typeof settings['form_title'] === 'string' ? settings['form_title'] : '',
    confirmationMessage: firstConfirmationMessage(settings['confirmations']),
    submitText: asStringOrNull(settings['submit_text']),
    submitTextProcessing: asStringOrNull(settings['submit_text_processing']),
    fields,
    notifications,
    requiresPayment: fields.some((f) => f.type === 'payment-single'),
  };
}

async function loadFormRows(ctx: StageContext): Promise<readonly FormRow[]> {
  const rows = await ctx.source.rows('wp_posts');
  const result: FormRow[] = [];
  for (const row of rows as readonly SqlRow[]) {
    if (asString(row['post_type']) !== 'wpforms') continue;
    if (asString(row['post_status']) !== 'publish') continue; // i 3 nel cestino decadono, ADR-010 §1.1
    result.push({
      legacyId: asNumber(row['ID']),
      slug: asString(row['post_name']),
      postTitle: asString(row['post_title']),
      rawContent: asString(row['post_content']),
    });
  }
  return result;
}

export const formsStage: Stage = {
  name: 'forms',
  dependsOn: [],

  async expected(ctx: StageContext) {
    return (await loadFormRows(ctx)).length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const rows = await loadFormRows(ctx);

    return forEachItem(
      ctx.tx,
      rows,
      (row): ItemKey => ({ sourceTable: 'wp_posts', sourceId: row.legacyId }),
      async (row, tx) => {
        const parsed = parseFormPost(row.rawContent); // JSON/campo sconosciuto: lancia qui, isolato sul solo form

        const existingId = await ctx.ids.find(tx, 'wp_posts', row.legacyId, 'form');
        const [written] = await tx
          .insert(schema.forms)
          .values({
            id: existingId ?? undefined,
            slug: row.slug,
            title: parsed.title || row.postTitle,
            definition: {
              fields: parsed.fields,
              submitText: parsed.submitText,
              submitTextProcessing: parsed.submitTextProcessing,
            },
            confirmationMessage: parsed.confirmationMessage,
            requiresPayment: parsed.requiresPayment,
            legacyId: row.legacyId,
          })
          .onConflictDoUpdate({
            target: schema.forms.id,
            set: {
              slug: row.slug,
              title: parsed.title || row.postTitle,
              definition: {
                fields: parsed.fields,
                submitText: parsed.submitText,
                submitTextProcessing: parsed.submitTextProcessing,
              },
              confirmationMessage: parsed.confirmationMessage,
              requiresPayment: parsed.requiresPayment,
              legacyId: row.legacyId,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.forms.id });
        if (!written) throw new Error('inserimento di forms non ha restituito una riga');

        await ctx.ids.remember(
          tx,
          'wp_posts',
          row.legacyId,
          'form',
          written.id,
          ctx.mode === 'apply' ? ctx.runId : null,
          existingId ? 'updated' : 'created',
        );

        // Notifiche: cancellate e reinserite ad ogni esecuzione, come
        // `document_terms` in `stages/documents/index.ts` — non hanno una
        // propria voce in `import_id_map`.
        await tx
          .delete(schema.formNotifications)
          .where(eq(schema.formNotifications.formId, written.id));
        for (const notification of parsed.notifications) {
          await tx.insert(schema.formNotifications).values({
            formId: written.id,
            name: notification.name,
            recipients: notification.recipients,
            subject: notification.subject,
            senderName: notification.senderName,
            replyTo: notification.replyTo,
            body: notification.body,
            isActive: notification.isActive,
            position: notification.position,
          });
        }

        return existingId ? 'updated' : 'created';
      },
      async (key, error) => {
        await ctx.issues.record({
          severity: 'error',
          stage: 'forms',
          code: 'item-import-failed',
          sourceTable: key.sourceTable,
          sourceId: key.sourceId,
          detail: error instanceof Error ? error.name : 'unknown-error',
        });
      },
    );
  },
};
