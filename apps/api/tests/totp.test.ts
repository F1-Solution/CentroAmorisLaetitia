import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  base32Encode,
  hotp,
  matchStep,
  openSecret,
  otpauthUri,
  sealSecret,
  STEP_SECONDS,
} from '../src/auth/totp.js';

/** Wave 1F-W4, T6l-a (DR-384, DR-388): algoritmo TOTP scritto con `node:crypto`; vettori di RFC 4226 e RFC 6238. */

const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const KEY = 'ab'.repeat(32);

describe('HOTP (RFC 4226, appendice D)', () => {
  it.each([
    [0, '755224'],
    [1, '287082'],
    [2, '359152'],
    [3, '969429'],
    [4, '338314'],
    [9, '520489'],
  ])('contatore %i dà %s', (counter, expected) => {
    expect(hotp(RFC_SECRET, counter)).toBe(expected);
  });
});

describe('TOTP (RFC 6238, appendice B, SHA-1)', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])(
    'a %i secondi il codice a 8 cifre è %s e le ultime 6 sono quelle a 6 cifre',
    (seconds, eight) => {
      const counter = Math.floor(seconds / STEP_SECONDS);
      expect(hotp(RFC_SECRET, counter, 8)).toBe(eight);
      expect(hotp(RFC_SECRET, counter)).toBe(eight.slice(2));
    },
  );
});

describe('Base32 (RFC 4648)', () => {
  it('codifica il segreto di prova del RFC 6238', () => {
    expect(base32Encode(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });
  it('codifica i vettori di RFC 4648 senza imbottitura', () => {
    expect(base32Encode(Buffer.from('f'))).toBe('MY');
    expect(base32Encode(Buffer.from('fo'))).toBe('MZXQ');
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });
});

describe('finestra e anti-riuso', () => {
  const now = 1_700_000_000_000;
  const step = Math.floor(now / 1000 / STEP_SECONDS);
  const code = (offset: number) => hotp(RFC_SECRET, step + offset);

  it('accetta il passo corrente e quelli adiacenti, rifiuta ±2', () => {
    expect(matchStep(RFC_SECRET, code(0), now, -1)).toBe(step);
    expect(matchStep(RFC_SECRET, code(-1), now, -1)).toBe(step - 1);
    expect(matchStep(RFC_SECRET, code(1), now, -1)).toBe(step + 1);
    expect(matchStep(RFC_SECRET, code(-2), now, -1)).toBeNull();
    expect(matchStep(RFC_SECRET, code(2), now, -1)).toBeNull();
  });

  it('non accetta un passo già usato né uno precedente', () => {
    expect(matchStep(RFC_SECRET, code(0), now, step)).toBeNull();
    expect(matchStep(RFC_SECRET, code(-1), now, step)).toBeNull();
    expect(matchStep(RFC_SECRET, code(1), now, step)).toBe(step + 1);
  });

  it('rifiuta codici malformati', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', ' 123456'])
      expect(matchStep(RFC_SECRET, bad, now, -1)).toBeNull();
  });
});

describe('segreto cifrato', () => {
  const secret = randomBytes(20);
  const sealed = sealSecret(secret, KEY, 'utente-1');

  it('non contiene il segreto né in chiaro né in Base32', () => {
    expect(sealed).not.toContain(base32Encode(secret));
    expect(sealed).not.toContain(secret.toString('hex'));
    expect(sealed).not.toContain(secret.toString('base64url'));
  });
  it('si decifra con la chiave e l’utente giusti, con un IV diverso a ogni cifratura', () => {
    expect(openSecret(sealed, KEY, 'utente-1').equals(secret)).toBe(true);
    expect(sealSecret(secret, KEY, 'utente-1')).not.toBe(sealed);
  });
  it('non si decifra con un’altra chiave né per un altro utente', () => {
    expect(() => openSecret(sealed, 'cd'.repeat(32), 'utente-1')).toThrow();
    expect(() => openSecret(sealed, KEY, 'utente-2')).toThrow();
  });
});

describe('URI otpauth', () => {
  it('porta emittente, account e segreto', () => {
    const uri = otpauthUri('GEZDGNBV', 'persona@esempio.invalid');
    expect(uri).toBe(
      'otpauth://totp/Amoris%20Laetitia:persona%40esempio.invalid?secret=GEZDGNBV&issuer=Amoris%20Laetitia&algorithm=SHA1&digits=6&period=30',
    );
  });
});
