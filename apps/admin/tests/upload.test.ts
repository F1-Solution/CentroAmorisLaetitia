import { DEFAULT_MEDIA_LIMITS, mediaMessages } from '@amoris/contracts/mediaRules';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '../src/lib/api';
import { uploadFile } from '../src/lib/upload';

/**
 * Un rifiuto del server che non porta un messaggio italiano (per esempio un
 * `413` di un proxy, con corpo in inglese o vuoto) si legge comunque in italiano.
 */

function respond(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => (body === undefined ? Promise.reject(new Error('vuoto')) : Promise.resolve(body)),
    }),
  );
}

const file = new File(['byte'], 'prova.png', { type: 'image/png' });

async function rejection(): Promise<ApiError> {
  try {
    await uploadFile('/media', file);
  } catch (caught) {
    return caught as ApiError;
  }
  throw new Error('Il caricamento doveva essere rifiutato.');
}

describe('uploadFile', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('un 413 senza corpo si legge in italiano, con il limite massimo', async () => {
    respond(413, undefined);
    const errore = await rejection();
    expect(errore.status).toBe(413);
    expect(errore.message).toBe(mediaMessages.tooLargeAny(DEFAULT_MEDIA_LIMITS.videoBytes));
  });

  it('un 413 con il testo inglese del server si sostituisce con quello italiano', async () => {
    respond(413, { error: { message: 'request file too large' } });
    const errore = await rejection();
    expect(errore.message).toBe(mediaMessages.tooLargeAny(DEFAULT_MEDIA_LIMITS.videoBytes));
  });

  it('un rifiuto che ha già codice e messaggio dell’API resta com’è', async () => {
    respond(409, { error: { code: 'MEDIA_TYPE_CHANGED', message: 'Messaggio del servizio.' } });
    const errore = await rejection();
    expect(errore.code).toBe('MEDIA_TYPE_CHANGED');
    expect(errore.message).toBe('Messaggio del servizio.');
  });
});
