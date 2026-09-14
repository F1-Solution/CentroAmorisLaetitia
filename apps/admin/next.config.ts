import type { NextConfig } from 'next';

/**
 * Area amministrativa.
 *
 * `basePath` è `/admin` perché il reverse proxy instrada lì (ADR-003 §3.2, ADR-008
 * §3.2): senza, gli indirizzi degli asset generati punterebbero alla radice, cioè
 * al sito pubblico.
 *
 * L'intestazione `X-Robots-Tag` vale su ogni risposta, non solo sulle pagine:
 * ADR-008 §3.3 regola 2 chiede che quest'area non venga indicizzata, e un file
 * lasciato fuori sarebbe comunque un modo per trovarla.
 *
 * Il manifest e il service worker della PWA arrivano **dopo il gate** (DR-030):
 * qui non ci sono.
 */
const config: NextConfig = {
  basePath: '/admin',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default config;
