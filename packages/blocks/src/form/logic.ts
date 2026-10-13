/**
 * Logica dei form condivisa fra il browser e il server (1E-W6, DR-133): la
 * visibilità condizionale come WPForms e le scelte con la loro chiave. Funzioni
 * pure, senza React, così l'API valuta esattamente ciò che la pagina mostra.
 */

/** Il minimo di un campo che serve a valutarne la visibilità. */
export interface LogicField {
  readonly id: string;
  readonly type: string;
  readonly options: Readonly<Record<string, unknown>>;
}

/** Valore di un campo: testo, scelte multiple o sotto-campi (nome, email, indirizzo). */
export type FieldValue = string | readonly string[] | Readonly<Record<string, string>>;

export type FormValues = Readonly<Record<string, FieldValue | undefined>>;

export interface ChoiceEntry {
  readonly key: string;
  readonly label: string;
}

interface Rule {
  readonly field: string;
  readonly operator: string;
  readonly value: string;
}

function listOf(raw: unknown): readonly unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, unknown>);
  return [];
}

export interface CompositeKey {
  readonly key: string;
  /** Affiancato a metà riga, come `wpforms-one-half`. */
  readonly half: boolean;
  /** Mai obbligatorio, anche se il campo lo è (la seconda riga dell'indirizzo). */
  readonly optional: boolean;
}

function on(options: Readonly<Record<string, unknown>>, key: string): boolean {
  return options[key] === '1' || options[key] === true;
}

/**
 * I sotto-campi di nome, email con conferma e indirizzo (DR-133), nell'ordine in
 * cui la sorgente li affianca. Unica definizione per la pagina e per il server.
 */
export function compositeKeys(
  field: Pick<LogicField, 'type' | 'options'>,
): readonly CompositeKey[] | null {
  const { options } = field;
  const part = (key: string, half: boolean, optional = false): CompositeKey => ({
    key,
    half,
    optional,
  });
  if (field.type === 'name' && options['format'] === 'first-last') {
    return [part('first', true), part('last', true)];
  }
  if (field.type === 'email' && on(options, 'confirmation')) {
    return [part('primary', true), part('secondary', true)];
  }
  if (field.type === 'address') {
    return [
      part('address1', false),
      ...(on(options, 'address2_hide') ? [] : [part('address2', false, true)]),
      part('city', true),
      part('state', true),
      part('postal', true),
      ...(on(options, 'country_hide') ? [] : [part('country', true)]),
    ];
  }
  return null;
}

/** Le scelte di un campo `radio` o `checkbox`, con la chiave che le condizioni usano. */
export function choiceEntries(options: Readonly<Record<string, unknown>>): readonly ChoiceEntry[] {
  const raw = options['choices'];
  const entries: [string, unknown][] = Array.isArray(raw)
    ? raw.map((choice, index) => [String(index + 1), choice])
    : raw && typeof raw === 'object'
      ? Object.entries(raw as Record<string, unknown>)
      : [];
  return entries.flatMap(([key, choice]) => {
    if (typeof choice === 'string') return [{ key, label: choice }];
    if (choice && typeof choice === 'object') {
      const record = choice as Record<string, unknown>;
      const label =
        typeof record['label'] === 'string' && record['label'] !== ''
          ? record['label']
          : typeof record['value'] === 'string'
            ? record['value']
            : '';
      return label !== '' ? [{ key, label }] : [];
    }
    return [];
  });
}

function rulesOf(options: Readonly<Record<string, unknown>>): readonly (readonly Rule[])[] {
  return listOf(options['conditionals']).map((group) =>
    listOf(group).flatMap((rule) => {
      if (!rule || typeof rule !== 'object') return [];
      const record = rule as Record<string, unknown>;
      return [
        {
          field: String(record['field'] ?? ''),
          operator: String(record['operator'] ?? '=='),
          value: String(record['value'] ?? ''),
        },
      ];
    }),
  );
}

/** Il valore del campo bersaglio come testo confrontabile; per le scelte, le etichette selezionate. */
function selectedValues(value: FieldValue | undefined): readonly string[] {
  if (value === undefined) return [];
  if (typeof value === 'string') return value === '' ? [] : [value];
  if (Array.isArray(value)) return value;
  return Object.values(value).filter((v) => v !== '');
}

function ruleHolds(
  rule: Rule,
  byId: ReadonlyMap<string, LogicField>,
  values: FormValues,
  visiting: ReadonlySet<string>,
): boolean {
  const target = byId.get(rule.field);
  // Un campo nascosto non ha valore, come in WPForms.
  const visible = target ? isVisible(target, byId, values, visiting) : false;
  const selected = visible ? selectedValues(values[rule.field]) : [];
  const isChoice = target?.type === 'radio' || target?.type === 'checkbox';
  const expected = isChoice
    ? (choiceEntries(target.options).find((c) => c.key === rule.value)?.label ?? null)
    : rule.value;
  switch (rule.operator) {
    case '==':
      return expected !== null && selected.includes(expected);
    case '!=':
      return expected === null || !selected.includes(expected);
    case 'e':
      return selected.length === 0;
    case '!e':
      return selected.length > 0;
    case 'c':
      return expected !== null && selected.some((v) => v.includes(expected));
    case '!c':
      return expected === null || !selected.some((v) => v.includes(expected));
    case '>':
    case '<': {
      // Confronto numerico di WPForms; nei 25 form della sorgente non compare.
      const actual = Number(selected[0]);
      const limit = Number(expected);
      if (selected.length === 0 || !Number.isFinite(actual) || !Number.isFinite(limit))
        return false;
      return rule.operator === '>' ? actual > limit : actual < limit;
    }
    default:
      return false;
  }
}

function isVisible(
  field: LogicField,
  byId: ReadonlyMap<string, LogicField>,
  values: FormValues,
  visiting: ReadonlySet<string>,
): boolean {
  const { options } = field;
  if (options['conditional_logic'] !== '1' && options['conditional_logic'] !== true) return true;
  if (visiting.has(field.id)) return false; // condizioni circolari: il campo resta nascosto
  const next = new Set(visiting).add(field.id);
  const groups = rulesOf(options);
  if (groups.length === 0) return true;
  const matches = groups.some(
    (group) => group.length > 0 && group.every((rule) => ruleHolds(rule, byId, values, next)),
  );
  return options['conditional_type'] === 'hide' ? !matches : matches;
}

/** Vero se il campo si vede con i valori dati: gruppi in OR, regole in AND, `show` o `hide`. */
export function isFieldVisible(
  field: LogicField,
  fields: readonly LogicField[],
  values: FormValues,
): boolean {
  return isVisible(field, new Map(fields.map((f) => [f.id, f])), values, new Set());
}

/** Gli identificativi dei campi visibili, nell'ordine della definizione. */
export function visibleFieldIds(
  fields: readonly LogicField[],
  values: FormValues,
): ReadonlySet<string> {
  const byId = new Map(fields.map((f) => [f.id, f]));
  return new Set(fields.filter((f) => isVisible(f, byId, values, new Set())).map((f) => f.id));
}
