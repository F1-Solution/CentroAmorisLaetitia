import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * 1F-W2 T2 (DR-360): l'immagine del sito si costruisce con `NEXT_PUBLIC_API_URL` vuoto
 * e, lato server, raggiunge l'API con `API_URL` letto all'avvio (rete interna del
 * Compose). Un valore vuoto vale «assente», non un indirizzo relativo che il server
 * non saprebbe chiamare. Lo stesso per le letture delle pagine e per il proxy dei redirect.
 *
 * I moduli leggono l'ambiente al caricamento: ogni caso li ricarica dopo `stubEnv`.
 */

function apiStub() {
  const spy = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => null });
  vi.stubGlobal('fetch', spy);
  return spy;
}

async function urlOfPageRead(): Promise<string> {
  const spy = apiStub();
  const { getContent } = await import('../src/lib/api');
  await getContent('/chi-siamo/');
  return spy.mock.calls[0]?.[0] as string;
}

async function urlOfRedirectLookup(): Promise<string> {
  const spy = apiStub();
  const { proxy } = await import('../src/proxy');
  await proxy(new NextRequest('http://sito.example.invalid/chi-siamo/'));
  return spy.mock.calls[0]?.[0] as string;
}

const casi: readonly {
  readonly nome: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly base: string;
}[] = [
  {
    nome: 'API_URL interno vince sul valore della build vuoto',
    env: { API_URL: 'http://api:3002', NEXT_PUBLIC_API_URL: '' },
    base: 'http://api:3002',
  },
  {
    nome: 'build vuota e nessun API_URL: il predefinito locale, non un indirizzo relativo',
    env: { API_URL: undefined, NEXT_PUBLIC_API_URL: '' },
    base: 'http://localhost:3002',
  },
  {
    nome: 'API_URL vuoto vale assente: si usa il valore assoluto della build',
    env: { API_URL: '', NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3102/' },
    base: 'http://127.0.0.1:3102',
  },
  {
    nome: 'API_URL di soli spazi vale assente',
    env: { API_URL: '  ', NEXT_PUBLIC_API_URL: undefined },
    base: 'http://localhost:3002',
  },
];

describe('indirizzo dell’API visto dal server del sito (DR-360)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  for (const caso of casi) {
    it(`letture delle pagine — ${caso.nome}`, async () => {
      for (const [chiave, valore] of Object.entries(caso.env)) vi.stubEnv(chiave, valore);
      expect(await urlOfPageRead()).toBe(
        `${caso.base}/public/content?path=${encodeURIComponent('/chi-siamo/')}`,
      );
    });

    it(`proxy dei redirect — ${caso.nome}`, async () => {
      for (const [chiave, valore] of Object.entries(caso.env)) vi.stubEnv(chiave, valore);
      expect(await urlOfRedirectLookup()).toBe(
        `${caso.base}/public/redirect?path=${encodeURIComponent('/chi-siamo/')}`,
      );
    });
  }
});
