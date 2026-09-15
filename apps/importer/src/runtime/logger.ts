/**
 * Registro dell'esecuzione. Accetta solo identificatori, conteggi, nomi di fase
 * e codici (`IMPORTER-DESIGN.md` §8.4): non c'è una firma che prenda una
 * stringa libera, quindi non c'è modo di interpolarci per sbaglio un valore
 * della sorgente.
 *
 * Il livello `diagnostic` porta il messaggio originale di un errore tecnico
 * (per esempio uno stack di PostgreSQL) e non è mai scritto su file: solo a
 * terminale, e solo se `verbose` è attivo.
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEvent {
  readonly level: LogLevel;
  readonly event: string;
  readonly runId?: string;
  readonly stage?: string;
  readonly check?: string;
  readonly count?: number;
  readonly table?: string;
  readonly code?: string;
}

export interface Logger {
  log(event: LogEvent): void;
  diagnostic(message: string, cause?: unknown): void;
}

export function createLogger(options: { verbose: boolean }): Logger {
  return {
    log(event: LogEvent) {
      const line = [
        `[${event.level}]`,
        event.event,
        event.runId ? `run=${event.runId}` : null,
        event.stage ? `stage=${event.stage}` : null,
        event.check ? `check=${event.check}` : null,
        event.table ? `table=${event.table}` : null,
        event.code ? `code=${event.code}` : null,
        event.count !== undefined ? `count=${event.count}` : null,
      ]
        .filter((part): part is string => part !== null)
        .join(' ');
      console.error(line);
    },
    diagnostic(message: string, cause?: unknown) {
      if (!options.verbose) return;
      console.error(`[diagnostic] ${message}`, cause ?? '');
    },
  };
}
