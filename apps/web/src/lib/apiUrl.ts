type Ambiente = Readonly<Record<string, string | undefined>>;

const PREDEFINITO_LOCALE = 'http://localhost:3002';

/** Indirizzo dell'API per il server del sito: `API_URL` all'avvio, poi quello della build; i valori vuoti valgono assenti (DR-360). */
export function apiUrl(env: Ambiente = process.env): string {
  for (const valore of [env.API_URL, env.NEXT_PUBLIC_API_URL]) {
    const pulito = valore?.trim().replace(/\/+$/, '') ?? '';
    if (pulito !== '') return pulito;
  }
  return PREDEFINITO_LOCALE;
}
