/**
 * Un solo salvataggio della copia di lavoro alla volta (DR-350, W9-N7).
 *
 * Una richiesta che arriva mentre un salvataggio è in viaggio si mette in coda
 * e parte appena quello finisce, leggendo lo stato più recente; più richieste
 * in coda diventano un solo salvataggio. `hold` annulla la coda, attende il
 * salvataggio in viaggio e non ne lascia partire altri fino a `release`: così
 * il `DELETE` della copia arriva sempre dopo l'ultimo `PUT`.
 */
export interface DraftSaveQueue {
  /** Chiede un salvataggio; risolve con l'esito del salvataggio che la copre, `false` se annullato. */
  request(): Promise<boolean>;
  /** Annulla la coda e attende il salvataggio in viaggio; fino a `release` nessuno parte. */
  hold(): Promise<void>;
  release(): void;
}

interface Waiting {
  readonly promise: Promise<boolean>;
  readonly resolve: (ok: boolean) => void;
}

function waiting(): Waiting {
  let resolve: (ok: boolean) => void = () => undefined;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export function createDraftSaveQueue(save: () => Promise<boolean>): DraftSaveQueue {
  let running: Promise<boolean> | null = null;
  let next: Waiting | null = null;
  let holds = 0;

  function start(): Promise<boolean> {
    const run = (async (): Promise<boolean> => {
      try {
        return await save();
      } catch {
        return false;
      }
    })();
    running = run;
    void run.then(() => {
      running = null;
      const queued = next;
      next = null;
      if (!queued) return;
      if (holds > 0) queued.resolve(false);
      else void start().then(queued.resolve);
    });
    return run;
  }

  return {
    request() {
      if (holds > 0) return Promise.resolve(false);
      if (!running) return start();
      next ??= waiting();
      return next.promise;
    },
    async hold() {
      holds += 1;
      const queued = next;
      next = null;
      queued?.resolve(false);
      while (running) await running;
    },
    release() {
      holds = Math.max(0, holds - 1);
    },
  };
}
