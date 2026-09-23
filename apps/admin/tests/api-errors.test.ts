import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/lib/api';

/**
 * Difetto del 2026-09-23: creando un redirect con un indirizzo scritto male, a
 * schermo compariva «La richiesta non è valida» e nient'altro. Il servizio
 * elencava i campi rifiutati nell'involucro dell'errore; era l'interfaccia a
 * buttarli via, e chi leggeva non poteva sapere che cosa correggere.
 */
describe('i campi rifiutati arrivano fino allo schermo', () => {
  it('senza dettagli il messaggio resta quello del servizio', () => {
    const errore = new ApiError(400, 'VALIDATION_FAILED', 'La richiesta non è valida.');
    expect(errore.fullMessage).toBe('La richiesta non è valida.');
  });

  it('con i dettagli il messaggio dice quale campo e perché', () => {
    const errore = new ApiError(400, 'VALIDATION_FAILED', 'La richiesta non è valida.', [
      { path: 'sourcePath', message: 'il percorso deve iniziare con una barra' },
    ]);
    expect(errore.fullMessage).toContain('sourcePath');
    expect(errore.fullMessage).toContain('deve iniziare con una barra');
  });

  it('più campi rifiutati compaiono tutti', () => {
    const errore = new ApiError(400, 'VALIDATION_FAILED', 'La richiesta non è valida.', [
      { path: 'sourcePath', message: 'primo motivo' },
      { path: 'targetPath', message: 'secondo motivo' },
    ]);
    expect(errore.fullMessage).toContain('primo motivo');
    expect(errore.fullMessage).toContain('secondo motivo');
  });

  it('un dettaglio senza percorso non produce un due punti a vuoto', () => {
    const errore = new ApiError(400, 'VALIDATION_FAILED', 'Non valida.', [
      { path: '', message: 'motivo senza campo' },
    ]);
    expect(errore.fullMessage).toBe('Non valida. motivo senza campo');
  });
});
