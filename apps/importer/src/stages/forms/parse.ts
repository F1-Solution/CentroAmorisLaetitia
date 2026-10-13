/**
 * Analisi di `post_content` di un form WPForms (`index.ts` per il contesto): da
 * JSON del plugin alla definizione propria, senza database (1E-W6).
 */
import type { SqlRow } from '../../source/sql/types.js';
import { paypalSettings, type PaypalSettings } from './payment.js';

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
  address: [
    'scheme',
    'address1_placeholder',
    'address2_placeholder',
    'address2_hide',
    'city_placeholder',
    'state_placeholder',
    'postal_placeholder',
    'postal_hide',
    'country_hide',
    'country_default',
  ],
  checkbox: ['choices', 'random'],
  'date-time': [
    'format',
    'date_type',
    'time_type',
    'date_placeholder',
    'date_format',
    'time_placeholder',
  ],
  email: ['placeholder', 'default_value', 'confirmation', 'confirmation_placeholder'],
  html: ['code'],
  name: ['format', 'first_placeholder', 'middle_placeholder', 'last_placeholder'],
  number: ['placeholder', 'default_value', 'min', 'max'],
  'payment-single': ['amount', 'price', 'format'],
  phone: ['format', 'placeholder'],
  radio: ['choices', 'random'],
  text: ['placeholder', 'default_value', 'limit_count', 'limit_mode'],
};

/** Presentazione e logica condizionale, valide per ogni tipo (1E-W6): la pagina le usa come la sorgente. */
const COMMON_OPTION_KEYS: readonly string[] = [
  'size',
  'label_hide',
  'sublabel_hide',
  'conditional_logic',
  'conditional_type',
  'conditionals',
];
export interface FormFieldDefinition {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly required: boolean;
  readonly order: number;
  readonly description: string | null;
  readonly options: Readonly<Record<string, unknown>>;
}

export interface FormNotificationDefinition {
  readonly name: string;
  readonly recipients: string;
  readonly subject: string;
  readonly senderName: string | null;
  readonly replyTo: string | null;
  readonly body: string;
  readonly isActive: boolean;
  readonly position: number;
}

export interface ParsedForm {
  readonly title: string;
  readonly confirmationMessage: string | null;
  readonly submitText: string | null;
  readonly submitTextProcessing: string | null;
  readonly fields: readonly FormFieldDefinition[];
  readonly notifications: readonly FormNotificationDefinition[];
  readonly requiresPayment: boolean;
  readonly payment: PaypalSettings | null;
}

export function asString(value: SqlRow[string] | undefined): string {
  return value === null || value === undefined ? '' : String(value);
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
 * Le chiavi di un oggetto annidato nell'ordine del testo JSON: `JSON.parse`
 * enumera le chiavi numeriche in ordine crescente, mentre WordPress mostra i
 * campi nell'ordine in cui sono scritti (1E-W6). Il testo è già JSON valido.
 */
export function jsonObjectKeyOrder(raw: string, path: readonly string[]): string[] {
  let i = 0;
  const ws = (): void => {
    while (i < raw.length && /\s/.test(raw[i] ?? '')) i += 1;
  };
  const str = (): string => {
    const start = i;
    i += 1;
    while (i < raw.length && raw[i] !== '"') i += raw[i] === '\\' ? 2 : 1;
    i += 1;
    return JSON.parse(raw.slice(start, i)) as string;
  };
  const skip = (): void => {
    ws();
    const open = raw[i];
    if (open === '"') {
      str();
      return;
    }
    if (open !== '{' && open !== '[') {
      while (i < raw.length && !/[,\]}\s]/.test(raw[i] ?? '')) i += 1;
      return;
    }
    const close = open === '{' ? '}' : ']';
    i += 1;
    ws();
    while (raw[i] !== close && i < raw.length) {
      if (open === '{') {
        str();
        ws();
        i += 1; // «:»
      }
      skip();
      ws();
      if (raw[i] === ',') i += 1;
      ws();
    }
    i += 1;
  };
  const keysAt = (depth: number): string[] => {
    ws();
    if (raw[i] !== '{') {
      skip();
      return [];
    }
    i += 1;
    const keys: string[] = [];
    let found: string[] = [];
    ws();
    while (raw[i] !== '}' && i < raw.length) {
      const key = str();
      ws();
      i += 1; // «:»
      if (depth === path.length) {
        keys.push(key);
        skip();
      } else if (key === path[depth]) {
        found = keysAt(depth + 1);
      } else {
        skip();
      }
      ws();
      if (raw[i] === ',') i += 1;
      ws();
    }
    i += 1;
    return depth === path.length ? keys : found;
  };
  return keysAt(0);
}

/** I valori di un oggetto nell'ordine dato, poi quelli non elencati, senza perderne nessuno. */
function inSourceOrder(record: Record<string, unknown>, order: readonly string[]): unknown[] {
  const known = order.filter((key) => key in record);
  const rest = Object.keys(record).filter((key) => !known.includes(key));
  return [...known, ...rest].map((key) => record[key]);
}

/**
 * Analizza `post_content`. Lancia se non è JSON valido o se un campo ha un
 * tipo mai misurato (`KNOWN_FIELD_TYPES`): il chiamante isola l'errore per
 * elemento (`forEachItem`), come già fa `stages/sliders/index.ts`.
 */
export function parseFormPost(raw: string): ParsedForm {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const rawFields = (parsed['fields'] ?? {}) as Record<string, unknown>;
  const settings = (parsed['settings'] ?? {}) as Record<string, unknown>;

  const fields: FormFieldDefinition[] = [];
  let order = 0;
  for (const value of inSourceOrder(rawFields, jsonObjectKeyOrder(raw, ['fields']))) {
    if (value === null || typeof value !== 'object') continue;
    const rawField = value as Record<string, unknown>;
    const type = typeof rawField['type'] === 'string' ? rawField['type'] : '';
    if (!KNOWN_FIELD_TYPES.has(type)) {
      throw new Error(`unknown-field-type`); // isolato per form, mai il tipo nel log altrove
    }
    fields.push({
      id: asString(rawField['id'] as SqlRow[string]) || String(order),
      type,
      label: typeof rawField['label'] === 'string' ? rawField['label'] : '',
      required: asBoolish(rawField['required']),
      order,
      description: asStringOrNull(rawField['description']),
      options: pickKeys(rawField, [
        ...COMMON_OPTION_KEYS,
        ...(FIELD_OPTION_KEYS_BY_TYPE[type] ?? []),
      ]),
    });
    order += 1;
  }

  const rawNotifications = (settings['notifications'] ?? {}) as Record<string, unknown>;
  const notificationsEnabled = settings['notification_enable'] !== '0';
  const notifications: FormNotificationDefinition[] = [];
  let position = 0;
  for (const value of inSourceOrder(
    rawNotifications,
    jsonObjectKeyOrder(raw, ['settings', 'notifications']),
  )) {
    if (value === null || typeof value !== 'object') continue;
    const rawNotification = value as Record<string, unknown>;
    notifications.push({
      name:
        typeof rawNotification['notification_name'] === 'string'
          ? rawNotification['notification_name']
          : `Notifica ${position + 1}`,
      recipients: typeof rawNotification['email'] === 'string' ? rawNotification['email'] : '',
      subject: typeof rawNotification['subject'] === 'string' ? rawNotification['subject'] : '',
      senderName: asStringOrNull(rawNotification['sender_name']),
      replyTo: asStringOrNull(rawNotification['replyto']),
      body: typeof rawNotification['message'] === 'string' ? rawNotification['message'] : '',
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
    payment: paypalSettings(parsed),
  };
}
