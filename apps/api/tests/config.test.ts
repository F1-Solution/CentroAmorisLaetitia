import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';

/**
 * ADR-009 §4.3 chiede che un servizio con configurazione incompleta **non parta** e
 * dica quale variabile manca. Questi test verificano proprio quello, perché è il
 * genere di comportamento che si rompe in silenzio e si scopre in produzione.
 */

/**
 * Minima per partire: indirizzo del database più i due segreti che ADR-007 §3.1
 * controllo 12 impone di leggere dall'ambiente, senza valore predefinito.
 */
const minima = {
  DATABASE_URL: 'postgres://finto:finto@localhost:5432/finto',
  IP_HASH_SALT: 'sale-sintetico-per-i-test-abbastanza-lungo',
  CSRF_SECRET: 'segreto-sintetico-per-i-test-abbastanza-lungo',
  TOTP_ENCRYPTION_KEY: 'cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd',
};

describe('configurazione', () => {
  it('non parte senza l’indirizzo del database, e dice quale variabile manca', () => {
    let errore: unknown;
    try {
      loadConfig({});
    } catch (e) {
      errore = e;
    }
    expect(errore).toBeInstanceOf(ConfigError);
    expect((errore as ConfigError).problems.join(' ')).toContain('DATABASE_URL');
  });

  it('applica i valori predefiniti per tutto il resto', () => {
    const config = loadConfig(minima);
    expect(config.NODE_ENV).toBe('development');
    expect(config.API_PORT).toBe(3002);
    expect(config.API_HOST).toBe('127.0.0.1');
    expect(config.CORS_ORIGINS).toEqual([]);
  });

  it('rifiuta una porta fuori intervallo invece di accomodarla', () => {
    expect(() => loadConfig({ ...minima, API_PORT: '70000' })).toThrow(ConfigError);
  });

  it('legge le origini ammesse come elenco, ignorando spazi e voci vuote', () => {
    const config = loadConfig({
      ...minima,
      CORS_ORIGINS: 'http://localhost:3000 , ,http://localhost:3001',
    });
    expect(config.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  // Il Compose imposta TRUSTED_PROXY alla sottorete delle applicazioni: se il CIDR non passa, l'API non parte.
  it('accetta come proxy fidati indirizzi e sottoreti CIDR, e rifiuta prefissi non numerici', () => {
    const config = loadConfig({ ...minima, TRUSTED_PROXY: '10.77.84.0/24, 127.0.0.1, fd00::/64' });
    expect(config.TRUSTED_PROXY).toEqual(['10.77.84.0/24', '127.0.0.1', 'fd00::/64']);
    expect(() => loadConfig({ ...minima, TRUSTED_PROXY: '10.0.0.0/33' })).toThrow(ConfigError);
    expect(() => loadConfig({ ...minima, TRUSTED_PROXY: '10.0.0.0/dd' })).toThrow(ConfigError);
  });
});
