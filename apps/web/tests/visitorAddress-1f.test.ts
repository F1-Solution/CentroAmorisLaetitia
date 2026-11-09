import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * 1F-W4 T7, rilievo N2 (DR-401): l'API limita ricerca e redirect per visitatore, quindi il sito le chiama
 * inoltrando l'indirizzo che Caddy ha scritto per ultimo in `X-Forwarded-For`. Indirizzi di documentazione.
 */

const incoming = vi.hoisted(() => new Headers());
vi.mock('next/headers', () => ({ headers: async () => incoming }));

afterEach(() => {
  vi.unstubAllGlobals();
  incoming.delete('x-forwarded-for');
});

function fetchStub(body = '{}') {
  const spy = vi.fn().mockResolvedValue(new Response(body, { status: 404 }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

const sent = (spy: ReturnType<typeof fetchStub>) => {
  const [url, init] = spy.mock.calls[0] as [string, RequestInit | undefined];
  return { url, headers: new Headers(init?.headers) };
};

describe('DR-401: il sito inoltra all API l indirizzo del visitatore', () => {
  it('proxy: la ricerca del redirect porta l ultimo indirizzo scritto da Caddy', async () => {
    const spy = fetchStub();
    const { proxy } = await import('../src/proxy');
    await proxy(
      new NextRequest('http://sito.example.invalid/chi-siamo/', {
        headers: { 'x-forwarded-for': '198.51.100.9, 203.0.113.7' },
      }),
    );
    const { url, headers } = sent(spy);
    expect(url).toContain('/public/redirect');
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('proxy: senza X-Forwarded-For non ne inventa uno', async () => {
    const spy = fetchStub();
    const { proxy } = await import('../src/proxy');
    await proxy(new NextRequest('http://sito.example.invalid/chi-siamo/'));
    expect(sent(spy).headers.get('x-forwarded-for')).toBeNull();
  });

  it('ricerca: inoltra l indirizzo della richiesta in corso', async () => {
    incoming.set('x-forwarded-for', '203.0.113.8');
    const spy = fetchStub();
    const { searchContents } = await import('../src/lib/api');
    await searchContents('prova', 1);
    const { url, headers } = sent(spy);
    expect(url).toContain('/public/search');
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.8');
  });
});
