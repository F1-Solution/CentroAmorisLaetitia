import type { FastifyInstance, FastifyRequest } from 'fastify';

/** Tetto per indirizzo in memoria, senza scrivere a database: oltre, 429 con il codice stabile delle altre limitazioni. */
export function anonymousLimit(max: number, options: { readonly allowDirect?: boolean } = {}) {
  return {
    max,
    timeWindow: '1 minute',
    // Il sito chiama l'API dalla rete interna senza l'indirizzo del visitatore: Caddy invece lo aggiunge sempre.
    ...(options.allowDirect
      ? {
          allowList: (request: FastifyRequest) =>
            (request.server as FastifyInstance).config.TRUSTED_PROXY.length > 0 &&
            request.headers['x-forwarded-for'] === undefined,
        }
      : {}),
    errorResponseBuilder: () => ({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
      message: 'Troppi tentativi: riprova più tardi.',
    }),
  };
}
