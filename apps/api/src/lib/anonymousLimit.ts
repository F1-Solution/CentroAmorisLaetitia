/**
 * Tetto per indirizzo in memoria, senza scrivere a database: oltre, 429 con il codice stabile delle altre limitazioni.
 * Nessuna esenzione per le chiamate interne: il sito inoltra l'indirizzo del visitatore (DR-401).
 */
export function anonymousLimit(max: number) {
  return {
    max,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Troppi tentativi: riprova più tardi.',
    }),
  };
}
