import { describe, expect, it } from 'vitest';
import { createDraftSaveQueue } from '../src/lib/editor/draftSaveQueue';

/*
 * DR-350: la coda dei salvataggi della copia di lavoro. Ogni salvataggio è una
 * promessa che la prova risolve a mano, così si vede quando ne parte un altro.
 */

function manualSaves(): {
  readonly save: () => Promise<boolean>;
  readonly started: () => number;
  readonly finish: (ok?: boolean) => void;
} {
  const open: ((ok: boolean) => void)[] = [];
  let count = 0;
  return {
    save: () => {
      count += 1;
      return new Promise<boolean>((resolve) => open.push(resolve));
    },
    started: () => count,
    finish: (ok = true) => open.shift()!(ok),
  };
}

const tick = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

describe('draftSaveQueue (DR-350)', () => {
  it('un salvataggio chiesto durante un altro aspetta che finisca', async () => {
    const saves = manualSaves();
    const queue = createDraftSaveQueue(saves.save);

    void queue.request();
    void queue.request();
    await tick();
    expect(saves.started()).toBe(1);

    saves.finish();
    await tick();
    expect(saves.started()).toBe(2);
  });

  it('più richieste durante un salvataggio diventano uno solo, che ne dà l’esito a tutte', async () => {
    const saves = manualSaves();
    const queue = createDraftSaveQueue(saves.save);

    const first = queue.request();
    const second = queue.request();
    const third = queue.request();
    saves.finish();
    await tick();
    saves.finish(false);

    expect(await first).toBe(true);
    expect(await second).toBe(false);
    expect(await third).toBe(false);
    expect(saves.started()).toBe(2);
  });

  it('hold attende il salvataggio in viaggio e annulla quello in coda', async () => {
    const saves = manualSaves();
    const queue = createDraftSaveQueue(saves.save);

    void queue.request();
    const queued = queue.request();
    let held = false;
    const holding = queue.hold().then(() => {
      held = true;
    });
    await tick();
    expect(held).toBe(false);

    saves.finish();
    await holding;
    expect(held).toBe(true);
    expect(await queued).toBe(false);
    expect(saves.started()).toBe(1);
  });

  it('durante hold non parte nessun salvataggio; dopo release sì', async () => {
    const saves = manualSaves();
    const queue = createDraftSaveQueue(saves.save);

    await queue.hold();
    expect(await queue.request()).toBe(false);
    expect(saves.started()).toBe(0);

    queue.release();
    void queue.request();
    expect(saves.started()).toBe(1);
  });

  it('un salvataggio che lancia un errore conta come non riuscito e non ferma la coda', async () => {
    let calls = 0;
    const queue = createDraftSaveQueue(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('rete')) : Promise.resolve(true);
    });

    expect(await queue.request()).toBe(false);
    expect(await queue.request()).toBe(true);
  });
});
