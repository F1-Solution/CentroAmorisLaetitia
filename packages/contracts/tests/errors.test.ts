import { describe, expect, it } from 'vitest';
import { apiErrorSchema, readinessSchema } from '../src/index.js';

/**
 * Test unitari degli schemi condivisi. Servono a due cose: che l'involucro degli
 * errori regga la forma che il resto del sistema si aspetta, e che non accetti
 * silenziosamente forme diverse — che è il modo in cui un contratto si sfalda.
 */

describe('involucro degli errori', () => {
  it('accetta un errore completo di dettagli di validazione', () => {
    const risultato = apiErrorSchema.safeParse({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'La richiesta non è valida.',
        details: [{ path: 'slug', message: 'valore non valido' }],
        requestId: 'req-1',
      },
    });
    expect(risultato.success).toBe(true);
  });

  it('accetta un errore senza dettagli: non tutti gli errori ne hanno', () => {
    expect(
      apiErrorSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'Non trovata.' } }).success,
    ).toBe(true);
  });

  it('rifiuta un errore senza codice, che sarebbe intrattabile da chi lo riceve', () => {
    expect(
      apiErrorSchema.safeParse({ error: { message: 'qualcosa è andato storto' } }).success,
    ).toBe(false);
  });
});

describe('stato di prontezza', () => {
  it('ammette solo i due stati previsti', () => {
    expect(readinessSchema.safeParse({ status: 'ok', dependencies: [] }).success).toBe(true);
    expect(readinessSchema.safeParse({ status: 'boh', dependencies: [] }).success).toBe(false);
  });

  it('riporta la latenza quando la dipendenza risponde', () => {
    const risultato = readinessSchema.safeParse({
      status: 'ok',
      dependencies: [{ name: 'database', ok: true, latencyMs: 2 }],
    });
    expect(risultato.success).toBe(true);
  });
});
