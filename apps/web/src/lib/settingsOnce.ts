import { cache } from 'react';
import { ApiUnavailable, getSettings, settingString } from './api';

/** Le impostazioni pubbliche, lette una volta per richiesta fra metadati e pagina. */
export const settingsOnce = cache(getSettings);

const SITE_TITLE_DEFAULT = 'Centro Amoris Laetitia';

/** «Titolo del sito» (DR-273), con il titolo di oggi se manca o se l'API non risponde. */
export async function siteTitleOrDefault(): Promise<string> {
  try {
    return settingString(await settingsOnce(), 'site.title') || SITE_TITLE_DEFAULT;
  } catch (caught) {
    if (caught instanceof ApiUnavailable) return SITE_TITLE_DEFAULT;
    throw caught;
  }
}
