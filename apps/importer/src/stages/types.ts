import type {
  ConversionSummary,
  ReportIssue,
  ReportRowName,
  VerificationCheck,
} from '../report/types.js';

/**
 * Il contratto di una fase (`IMPORTER-DESIGN.md` §4.1). In questa wave (`1D-W2`)
 * nessuna fase di dominio è attuata: solo `preflight` fa qualcosa di vero. Le
 * altre sedici esistono come nomi riconosciuti, con un'esecuzione che dichiara
 * apertamente di non essere ancora scritta e in quale wave arriva.
 */
export type StageName =
  | 'preflight'
  | 'settings'
  | 'users'
  | 'media'
  | 'terms'
  | 'contents'
  | 'relations'
  | 'menus'
  | 'seo'
  | 'documents'
  | 'sliders'
  | 'forms'
  | 'submissions'
  | 'legacy'
  | 'redirects'
  | 'rewrite'
  | 'verify';

export type Mode = 'plan' | 'apply';

/**
 * Ciò che una fase aggiunge al rapporto oltre ai propri quattro conteggi
 * (`importer-spec.md` §8.1). Facoltativo: quasi tutte le fasi non ne
 * producono nulla, e chi non ne produce non deve dichiararlo.
 *
 * Sta dentro `StageResult` e non in un secondo canale perché il rapporto è
 * **un solo oggetto** (`IMPORTER-DESIGN.md` §8.1): un secondo canale
 * divergerebbe dal primo alla prima modifica, che è esattamente ciò che
 * quel paragrafo vieta.
 */
export interface StageReportContribution {
  /**
   * Righe del rapporto prodotte da questa fase oltre alla propria. Serve a
   * `media`, che produce sia `media` sia `media_variants` mentre le righe
   * del rapporto sono due (`importer-spec.md` §8.1).
   */
  readonly extraRows?: Readonly<Partial<Record<ReportRowName, StageResult>>>;
  /**
   * I conteggi che appartengono alla **riga del rapporto** di questa fase,
   * quando differiscono da quelli della fase nel suo insieme. Serve alle fasi
   * che producono anche entità senza una riga propria: `settings` crea anche i
   * template SEO, `sliders` crea anche il carosello che contiene le slide.
   *
   * Senza questo, la riga `slider_slides` direbbe 13 dove le slide sono 12, e
   * la riga `settings` direbbe 21 dove le impostazioni sono 15: un conteggio
   * che somma due cose diverse è peggio di un conteggio assente, perché
   * sembra giusto.
   *
   * I conteggi della fase intera non si perdono: gli errori entrano
   * nell'esito comunque (§8.2).
   */
  readonly rowResult?: StageResult;
  /** Solo `contents`: la sezione CONVERSIONE DEI CONTENUTI del rapporto. */
  readonly conversion?: ConversionSummary;
  /** Solo `verify`: le otto righe VERIFICHE. */
  readonly checks?: readonly VerificationCheck[];
  /**
   * Solo `contents`: gli identificatori dei contenuti non sovrascritti perché
   * modificati da un redattore (`importer-spec.md` §6.3 punto 3). Vanno in
   * testa al rapporto, non in fondo.
   */
  readonly skippedForEditorialWork?: readonly string[];
}

export interface StageResult extends StageReportContribution {
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly errors: number;
}

export const NOT_YET_IMPLEMENTED: StageResult = { created: 0, updated: 0, skipped: 0, errors: 0 };

/** In quale wave ciascuna fase arriva, secondo `PLAN.md` §1. */
export const STAGE_INTRODUCED_IN_WAVE: Readonly<Record<StageName, string>> = {
  preflight: '1D-W2',
  settings: '1D-W4',
  users: '1D-W4',
  media: '1D-W4',
  terms: '1D-W4',
  contents: '1D-W4',
  relations: '1D-W4',
  menus: '1D-W4',
  seo: '1D-W4',
  documents: '1D-W4',
  sliders: '1D-W4',
  forms: '1D-W5',
  submissions: '1D-W5',
  legacy: '1D-W5',
  redirects: '1D-W5',
  rewrite: '1D-W5',
  verify: '1D-W5',
};

/** L'ordine obbligato di `importer-spec.md` §4: ogni fase dipende dalla precedente elencata. */
export const STAGE_DEPENDS_ON: Readonly<Record<StageName, readonly StageName[]>> = {
  preflight: [],
  settings: ['preflight'],
  users: ['preflight'],
  media: ['users'],
  terms: ['preflight'],
  contents: ['media', 'terms'],
  relations: ['contents'],
  menus: ['contents', 'terms'],
  seo: ['contents'],
  documents: ['media', 'terms'],
  sliders: ['media'],
  forms: ['preflight'],
  submissions: ['forms'],
  legacy: ['preflight'],
  redirects: ['contents', 'media', 'documents'],
  rewrite: ['contents', 'media'],
  verify: [
    'settings',
    'users',
    'media',
    'terms',
    'contents',
    'relations',
    'menus',
    'seo',
    'documents',
    'sliders',
    'forms',
    'submissions',
    'legacy',
    'redirects',
    'rewrite',
  ],
};

export const ALL_STAGE_NAMES: readonly StageName[] = Object.keys(STAGE_DEPENDS_ON) as StageName[];

/**
 * Quale riga del rapporto conta i risultati di quale fase. La tabella di
 * `importer-spec.md` §8.1 «conta per fase, non per tabella del database», e
 * ha dodici righe contro diciassette fasi: cinque fasi non ne hanno una
 * propria perché non producono righe nuove — `relations` e `rewrite`
 * aggiornano contenuti già creati, `seo` scrive dentro `contents`, `legacy`
 * riempie tabelle che il rapporto non elenca, `verify` misura e basta.
 *
 * I loro conteggi non spariscono: gli errori di quelle fasi entrano
 * comunque nell'esito complessivo (§8.2).
 */
export const STAGE_REPORT_ROW: Readonly<Record<StageName, ReportRowName | null>> = {
  preflight: null,
  settings: 'settings',
  users: 'users',
  media: 'media',
  terms: 'terms',
  contents: 'contents',
  relations: null,
  menus: 'menu_items',
  seo: null,
  documents: 'documents',
  sliders: 'slider_slides',
  forms: 'forms',
  submissions: 'form_submissions',
  legacy: null,
  redirects: 'redirects',
  rewrite: null,
  verify: null,
};

/**
 * Il contratto vero di una fase, attuato a partire da `1D-W4a`
 * (`IMPORTER-DESIGN.md` §4.1). `expected` e `run` restano separati: il primo
 * serve al rapporto anche in fasi non ancora eseguite, il secondo scrive.
 *
 * Le entità elencate qui sono quelle prodotte dai blocchi `1D-W4a`…`1D-W4d`.
 * Ogni blocco aggiunge le proprie senza toccare le altre.
 */
export type EntityKind =
  | 'setting'
  | 'seo_template'
  | 'role'
  | 'permission'
  | 'user'
  | 'term'
  | 'media'
  | 'content'
  | 'menu'
  | 'menu_item'
  | 'document'
  | 'slider'
  | 'slider_slide'
  | 'form';

/**
 * Identifica un elemento sorgente per l'isolamento dell'errore
 * (`IMPORTER-DESIGN.md` §4.2): solo identificatori, mai un frammento di
 * contenuto.
 */
export interface ItemKey {
  readonly sourceTable: string;
  readonly sourceId: number;
}

/**
 * Riceve le anomalie di una fase. In `apply` le scrive anche su
 * `import_issues` (connessione di registro, §5.3); in `plan` resta solo in
 * memoria (§5.2 punto 2). `collected` alimenta il rapporto in entrambi i casi.
 *
 * Riusa `ReportIssue` di `report/types.ts` invece di un tipo proprio: sono lo
 * stesso oggetto, e un secondo tipo divergerebbe alla prima modifica.
 */
export interface IssueSink {
  record(issue: ReportIssue): Promise<void>;
  readonly collected: readonly ReportIssue[];
}

/** Alimenta il rapporto (`importer-spec.md` §8): una entry per fase eseguita. */
export interface CounterSink {
  record(stage: StageName, result: StageResult): void;
  readonly collected: ReadonlyMap<StageName, StageResult>;
}

export function createCounterSink(): CounterSink {
  const collected = new Map<StageName, StageResult>();
  return {
    record(stage, result) {
      collected.set(stage, result);
    },
    collected,
  };
}

export function emptyStageResult(): StageResult {
  return { created: 0, updated: 0, skipped: 0, errors: 0 };
}

/**
 * Somma **i soli quattro conteggi**. Le contribuzioni al rapporto
 * (`StageReportContribution`) non si sommano qui: appartengono alla fase nel
 * suo insieme, non a un pezzo del suo lavoro, e chi le produce le dichiara
 * una volta sola al `return`.
 */
export function addStageResults(a: StageResult, b: StageResult): StageResult {
  return {
    created: a.created + b.created,
    updated: a.updated + b.updated,
    skipped: a.skipped + b.skipped,
    errors: a.errors + b.errors,
  };
}
