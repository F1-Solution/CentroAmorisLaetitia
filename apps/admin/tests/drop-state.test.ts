import { describe, expect, it } from 'vitest';
import {
  IDLE,
  dropClassNames,
  dropStatusText,
  isDropTarget,
  type DropState,
} from '../src/components/dnd/dropState';

/**
 * Lo stato del trascinamento a due esiti (DR-082, DR-084), senza puntatore: il
 * gesto vero si prova nel browser (`tests/e2e/cms/trascinamento.spec.ts`).
 */

const labels: Record<string, string> = { a: 'Chi siamo', b: 'Contatti' };
const describeId = (id: string): string => labels[id] ?? id;

const over = (zone: DropState['zone'], refusal: string | null = null): DropState => ({
  activeId: 'a',
  overId: 'b',
  zone,
  refusal,
});

describe('isDropTarget', () => {
  it('è vero solo per la riga di arrivo, mai per quella presa né a riposo', () => {
    expect(isDropTarget(over('inside'), 'b')).toBe(true);
    expect(isDropTarget(over('inside'), 'a')).toBe(false);
    expect(isDropTarget(IDLE, 'b')).toBe(false);
    expect(isDropTarget({ ...over('after'), overId: 'a' }, 'a')).toBe(false);
  });
});

describe('dropClassNames (DR-084)', () => {
  it('segna la fascia della riga di arrivo', () => {
    expect(dropClassNames(over('inside'), 'b', false)).toBe(
      'amoris-tree-drop amoris-tree-drop--inside',
    );
    expect(dropClassNames(over('before'), 'b', false)).toContain('amoris-tree-drop--before');
    expect(dropClassNames(over('after'), 'b', false)).toContain('amoris-tree-drop--after');
  });

  it('un rilascio non ammesso si vede durante il movimento', () => {
    expect(dropClassNames(over('inside', 'non qui'), 'b', false)).toContain(
      'amoris-tree-drop--refused',
    );
  });

  it('la riga presa è attenuata e non porta indicatore', () => {
    expect(dropClassNames(over('inside'), 'a', true)).toBe(
      'amoris-tree-drop amoris-tree-drop--dragging',
    );
  });
});

describe('dropStatusText', () => {
  it('dice a parole dove finirà, prima del rilascio', () => {
    expect(dropStatusText(over('inside'), describeId)).toBe('«Chi siamo» andrà dentro «Contatti».');
    expect(dropStatusText(over('before'), describeId)).toBe(
      '«Chi siamo» andrà prima di «Contatti», allo stesso livello.',
    );
    expect(dropStatusText(over('after'), describeId)).toBe(
      '«Chi siamo» andrà dopo «Contatti», allo stesso livello.',
    );
  });

  it('dice il motivo di un rifiuto', () => {
    expect(
      dropStatusText(over('inside', 'Questo tipo di blocco non può stare lì.'), describeId),
    ).toBe('«Chi siamo» non può andare qui: Questo tipo di blocco non può stare lì.');
  });

  it('a riposo tace, e sopra sé stesso invita a scegliere', () => {
    expect(dropStatusText(IDLE, describeId)).toBe('');
    expect(dropStatusText({ ...over('after'), overId: null }, describeId)).toBe(
      '«Chi siamo»: scegli dove lasciarlo.',
    );
  });
});
