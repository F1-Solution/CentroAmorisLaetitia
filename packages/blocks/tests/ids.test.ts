import { describe, expect, it } from 'vitest';
import { createBlockIdAllocator, deriveBlockId } from '../src/import-ids.js';
import { generateAdminBlockId } from '../src/ids.js';

const BLOCK_ID_PATTERN = /^b_[0-9a-f]{12}$/;

describe('deriveBlockId (§4.1)', () => {
  it('è deterministico: stesso ingresso, stesso identificatore', () => {
    const input = { legacyContentId: 42, startOffset: 10, endOffset: 20, type: 'rich_text' };
    const id1 = deriveBlockId(input, () => false);
    const id2 = deriveBlockId(input, () => false);
    expect(id1).toBe(id2);
    expect(id1).toMatch(BLOCK_ID_PATTERN);
  });

  it('due chiavi diverse producono identificatori diversi', () => {
    const a = deriveBlockId({ legacyContentId: 1, startOffset: 0, endOffset: 5, type: 'rich_text' }, () => false);
    const b = deriveBlockId({ legacyContentId: 1, startOffset: 0, endOffset: 6, type: 'rich_text' }, () => false);
    expect(a).not.toBe(b);
  });

  it('su collisione ricalcola su "chiave#2", in modo deterministico (§4.2)', () => {
    const input = { legacyContentId: 7, startOffset: 0, endOffset: 3, type: 'image' };
    const first = deriveBlockId(input, () => false);
    // Simula: il primo id risulta già preso, deve ricalcolare e ottenere un id diverso e stabile.
    const second = deriveBlockId(input, (candidate) => candidate === first);
    expect(second).not.toBe(first);
    expect(second).toMatch(BLOCK_ID_PATTERN);
    // Ripetendo con lo stesso predicato si ottiene sempre lo stesso risultato.
    const secondAgain = deriveBlockId(input, (candidate) => candidate === first);
    expect(secondAgain).toBe(second);
  });
});

describe('createBlockIdAllocator', () => {
  it('assegna lo stesso insieme di identificatori a partire dalla stessa sorgente', () => {
    const inputs = [
      { legacyContentId: 1, startOffset: 0, endOffset: 5, type: 'rich_text' },
      { legacyContentId: 1, startOffset: 6, endOffset: 10, type: 'image' },
    ];
    const runOnce = () => {
      const allocator = createBlockIdAllocator();
      return inputs.map((input) => allocator.allocate(input));
    };
    expect(runOnce()).toEqual(runOnce());
  });
});

describe('generateAdminBlockId (§4.3)', () => {
  it('produce identificatori nello stesso formato, non deterministici', () => {
    const a = generateAdminBlockId();
    const b = generateAdminBlockId();
    expect(a).toMatch(BLOCK_ID_PATTERN);
    expect(b).toMatch(BLOCK_ID_PATTERN);
    expect(a).not.toBe(b);
  });
});
