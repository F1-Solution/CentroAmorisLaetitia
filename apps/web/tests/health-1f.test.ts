import { afterEach, describe, expect, it, vi } from 'vitest';

// 1F-W2 T1 (ADR-009 §4.6): il sito ha una rotta di stato per il health check del Compose.
// Risponde finché il processo risponde, senza interrogare l'API: se l'API è giù il sito
// non va riavviato, e il proxy dei redirect non deve chiamarla per questo percorso.
describe('rotta di stato del sito (1F-W2)', () => {
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

  it('il proxy dei redirect non intercetta la rotta di stato, ma intercetta ancora le pagine', async () => {
    const { config } = await import('../src/proxy');
    // Il matcher è un'espressione regolare sull'intero percorso.
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    expect(matcher.test('/health/live/')).toBe(false);
    expect(matcher.test('/health/live')).toBe(false);
    expect(matcher.test('/chi-siamo/')).toBe(true);
    expect(matcher.test('/')).toBe(true);
  });
});
