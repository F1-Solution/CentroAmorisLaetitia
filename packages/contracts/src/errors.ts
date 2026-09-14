import { z } from 'zod';

/**
 * Forma unica degli errori dell'API.
 *
 * Un solo involucro per tutti gli errori, perché chi consuma l'API — il sito,
 * l'area amministrativa, domani la PWA — deve poterli trattare in un punto solo.
 * Il messaggio è rivolto a una persona ed è in italiano; il codice è rivolto al
 * programma e resta stabile nel tempo.
 *
 * Non contiene mai tracce di stack, query, percorsi del server o dati personali:
 * quelli stanno nei log.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    /** Codice stabile, in maiuscolo con trattini bassi. Per esempio `NOT_FOUND`. */
    code: z.string(),
    /** Messaggio per una persona, in italiano. */
    message: z.string(),
    /** Errori di validazione, campo per campo. */
    details: z
      .array(
        z.object({
          path: z.string(),
          message: z.string(),
        }),
      )
      .optional(),
    /** Identificativo della richiesta: è ciò che si cita per far cercare nei log. */
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
