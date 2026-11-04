import { afterEach, describe, expect, it, vi } from 'vitest';

// 1F-W2 T1 (ADR-009 §4.6): l'area ha una rotta di stato, `/admin/health/live` per il
// `basePath`, per il health check del Compose. Risponde finché il processo risponde,
// senza interrogare l'API: un'API lenta non deve far riavviare l'area.
describe('rotta di stato dell’area (1F-W2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('risponde 200 con { status: "ok" }, senza cache e senza chiamare l’API', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { GET } = await import('../src/app/health/live/route');

    const risposta = await GET();

    expect(risposta.status).toBe(200);
    expect(await risposta.json()).toEqual({ status: 'ok' });
    expect(risposta.headers.get('cache-control')).toBe('no-store');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('si calcola a ogni richiesta, non alla compilazione', async () => {
    const route = await import('../src/app/health/live/route');
    expect(route.dynamic).toBe('force-dynamic');
  });
});
