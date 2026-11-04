import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * 1F-W2 T2 (DR-360): la stessa immagine dell'area serve staging e produzione. Con
 * `NEXT_PUBLIC_API_URL` vuoto il browser chiama l'API sulla stessa origine, sotto
 * `/api` (Caddy la instrada, ADR-003 §3.2); con un valore assoluto, come in sviluppo
 * e negli e2e, resta quello. Senza variabile vale il predefinito locale di sempre.
 *
 * Il modulo legge l'ambiente al caricamento: ogni caso lo ricarica dopo `stubEnv`.
 */

function okFetch() {
  const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  vi.stubGlobal('fetch', spy);
  return spy;
}

async function urlOfApiCall(): Promise<string> {
  const spy = okFetch();
  const { api } = await import('../src/lib/api');
  await api('/auth/me');
  return spy.mock.calls[0]?.[0] as string;
}

async function urlOfUpload(): Promise<string> {
  const spy = okFetch();
  const { uploadFile } = await import('../src/lib/upload');
  await uploadFile('/media', new File(['byte'], 'prova.png', { type: 'image/png' }));
  return spy.mock.calls[0]?.[0] as string;
}

describe('indirizzo dell’API visto dal browser (DR-360)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('vuoto: relativo, sotto /api sulla stessa origine', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    expect(await urlOfApiCall()).toBe('/api/auth/me');
  });

  it('di soli spazi: relativo come il vuoto', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '   ');
    expect(await urlOfApiCall()).toBe('/api/auth/me');
  });

  it('assoluto: resta quello, senza doppia barra', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.invalid/');
    expect(await urlOfApiCall()).toBe('https://api.example.invalid/auth/me');
  });

  it('assente: il predefinito locale dello sviluppo', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', undefined);
    expect(await urlOfApiCall()).toBe('http://localhost:3002/auth/me');
  });

  it('il caricamento dei file segue la stessa regola', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    expect(await urlOfUpload()).toBe('/api/media');
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.invalid/');
    expect(await urlOfUpload()).toBe('https://api.example.invalid/media');
  });
});
