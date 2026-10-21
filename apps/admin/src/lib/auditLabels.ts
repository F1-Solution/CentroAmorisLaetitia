/** Etichette in italiano del registro delle operazioni: elenco chiuso, il codice grezzo è il ripiego. */

const ACTION_LABELS: Readonly<Record<string, string>> = {
  'content.create': 'Ha creato',
  'content.update': 'Ha modificato',
  'content.publish': 'Ha pubblicato',
  'content.unpublish': 'Ha ritirato',
  'content.delete': 'Ha eliminato',
  'content.draft.save': 'Ha salvato la copia di lavoro',
  'content.draft.discard': 'Ha scartato la copia di lavoro',
  'media.upload': 'Ha caricato un media',
  'media.replace': 'Ha sostituito un media',
  'media.update': 'Ha modificato un media',
  'media.delete': 'Ha eliminato un media',
  'menu.item.create': 'Ha creato una voce di menu',
  'menu.item.update': 'Ha modificato una voce di menu',
  'menu.item.delete': 'Ha eliminato una voce di menu',
  'redirect.create': 'Ha creato un reindirizzamento',
  'redirect.update': 'Ha modificato un reindirizzamento',
  'redirect.delete': 'Ha eliminato un reindirizzamento',
  'seo.template.update': 'Ha modificato un modello SEO',
  'seo.content.update': 'Ha modificato il titolo SEO',
  'setting.update': 'Ha modificato un’impostazione',
  'term.create': 'Ha creato una categoria',
  'term.update': 'Ha modificato una categoria',
  'term.delete': 'Ha eliminato una categoria',
  'account.create': 'Ha creato un account',
  'account.update': 'Ha modificato un account',
  'account.password_reset': 'Ha reimpostato una password',
  'account.deactivate': 'Ha disattivato un account',
  'account.reactivate': 'Ha riattivato un account',
  'account.roles': 'Ha cambiato i ruoli di un account',
  'auth.login': 'Accesso',
  'auth.logout': 'Uscita',
  'auth.password_changed': 'Cambio della password',
  'auth.sessions_revoked': 'Chiusura delle sessioni',
  'auth.context_changed': 'Cambio di area',
  'POST /forms/:slug/submissions': 'Invio di un modulo dal sito',
};

const ENTITY_LABELS: Readonly<Record<string, string>> = {
  content: 'Contenuto',
  content_seo: 'Titolo SEO di un contenuto',
  media: 'Media',
  menu_item: 'Voce di menu',
  redirect: 'Reindirizzamento',
  seo_template: 'Modello SEO',
  setting: 'Impostazione',
  term: 'Categoria',
  account: 'Account',
};

/** Azione senza etichetta: si mostra il codice, non si nasconde la riga. */
export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function entityTypeLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

/** Operazioni che si possono filtrare, nell'ordine dell'elenco chiuso. */
export const FILTERABLE_ACTION_OPTIONS: readonly { value: string; label: string }[] =
  Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }));
