import { mediaMessages } from '@amoris/contracts';
import { mediaError } from './fileType.js';

/** Semaforo con coda corta: l'elaborazione delle immagini non si accumula senza limiti. */
export interface ProcessingGate {
  run<T>(task: () => Promise<T>): Promise<T>;
}

/** Al massimo `max` lavori insieme e `queueLimit` in attesa; oltre, `MEDIA_BUSY` (503). */
export function createGate(max: number, queueLimit: number): ProcessingGate {
  let running = 0;
  const waiting: (() => void)[] = [];

  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else running -= 1;
  };

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      if (running >= max) {
        if (waiting.length >= queueLimit) {
          throw mediaError('MEDIA_BUSY', mediaMessages.busy());
        }
        await new Promise<void>((resolve) => waiting.push(resolve));
      } else {
        running += 1;
      }
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}
