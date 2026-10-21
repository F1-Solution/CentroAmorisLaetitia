import { AUTH_ACTIONS } from '../../auth/audit.js';

/**
 * Elenco chiuso delle azioni delle modifiche fatte dall'area amministrativa:
 * le 27 dichiarate con `config.audit` nei moduli, più le tre che `accounts`
 * sceglie a runtime. Una prova confronta l'elenco con i sorgenti.
 */
export const CHANGE_ACTIONS = [
  'content.create',
  'content.update',
  'content.publish',
  'content.unpublish',
  'content.delete',
  'content.address.update',
  'content.draft.save',
  'content.draft.discard',
  'media.upload',
  'media.replace',
  'media.update',
  'media.delete',
  'menu.item.create',
  'menu.item.update',
  'menu.item.delete',
  'redirect.create',
  'redirect.update',
  'redirect.delete',
  'seo.template.update',
  'seo.content.update',
  'setting.update',
  'term.create',
  'term.update',
  'term.delete',
  'account.create',
  'account.update',
  'account.password_reset',
  'account.deactivate',
  'account.reactivate',
  'account.roles',
] as const;

/** Vista predefinita: le modifiche al sito, senza salvataggi e scarti delle copie di lavoro (DR-233). */
export const DEFAULT_VIEW_ACTIONS: readonly string[] = CHANGE_ACTIONS.filter(
  (action) => action !== 'content.draft.save' && action !== 'content.draft.discard',
);

/** Azione che il hook scrive per gli invii dei form del sito (metodo e percorso). */
export const FORM_SUBMISSION_ACTION = 'POST /forms/:slug/submissions';

/** Valori ammessi dal filtro `action`. */
export const FILTERABLE_ACTIONS: readonly string[] = [
  ...CHANGE_ACTIONS,
  ...Object.values(AUTH_ACTIONS),
  FORM_SUBMISSION_ACTION,
];
