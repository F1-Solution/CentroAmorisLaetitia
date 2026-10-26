import { z } from 'zod';

/**
 * Forma unica degli errori del servizio, già usata dal gestore di `app.ts`.
 * Sta qui perché entri anche nella specifica OpenAPI: una rotta che può
 * rispondere 401 lo deve dichiarare, altrimenti la specifica descrive solo il
 * caso felice.
 */
export const errorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});

/** Risposta senza corpo: `204` va dichiarato con uno schema Zod come tutti gli altri. */
export const noContent = z.null().describe('Operazione eseguita, nessun contenuto');

const descriptions: Record<number, string> = {
  400: 'Richiesta non valida',
  401: 'Accesso mancante o scaduto',
  403: 'Operazione non consentita, o token anti-CSRF assente',
  404: 'Risorsa non trovata',
  406: 'La richiesta non è un modulo multipart con un file',
  409: 'Conflitto con lo stato attuale',
  413: 'File troppo pesante o con troppi pixel',
  415: 'Tipo di file non ammesso',
  422: 'Dati non elaborabili',
  429: 'Troppi tentativi',
  503: 'Servizio occupato o archivio non raggiungibile: riprovare più tardi',
};

export function errorResponses<const Codes extends readonly number[]>(
  ...codes: Codes
): { [Code in Codes[number]]: typeof errorBody } {
  return Object.fromEntries(
    codes.map((code) => [code, errorBody.describe(descriptions[code] ?? 'Errore')]),
  ) as { [Code in Codes[number]]: typeof errorBody };
}
