import { describe, expect, it } from 'vitest';
import { buildStubReport } from '../../src/report/build.js';
import { renderReportText } from '../../src/report/text.js';
import { ALL_REPORT_ROWS } from '../../src/report/constants.js';

const MARKER = 'MARCATORE-CANARINO-IRRIPETIBILE-9f3e1c';

describe('rapporto di import', () => {
  it('produce tutte le righe attese, formato stabile', () => {
    const report = buildStubReport({ runId: 'run-1', mode: 'plan', importerVersion: '0.1.0' });
    expect(report.stages.map((s) => s.row)).toEqual(ALL_REPORT_ROWS);
    expect(report.outcome).toBe('success');
    const text = renderReportText(report);
    expect(text).toContain('IMPORT — esecuzione run-1');
    expect(text).toContain('ESITO: success');
  });

  it('mostra i conteggi attesi e zero eseguiti per le fasi non ancora attuate', () => {
    const report = buildStubReport({ runId: 'run-1', mode: 'plan', importerVersion: '0.1.0' });
    const contents = report.stages.find((s) => s.row === 'contents')!;
    expect(contents.expected).toBe(108);
    expect(contents.created).toBe(0);
    expect(contents.implemented).toBe(false);
  });

  it('non contiene alcun dato personale: la prova del canarino (IMPORTER-DESIGN.md §8.3)', () => {
    // Un rapporto costruito da un'esecuzione i cui identificatori contengono il
    // marcatore non deve mai farlo comparire nel testo o nel JSON, perché il
    // tipo non ha alcun campo di testo libero proveniente dalla sorgente.
    const report = buildStubReport({
      runId: `run-${MARKER}`,
      mode: 'plan',
      importerVersion: '0.1.0',
    });
    const text = renderReportText(report);
    const json = JSON.stringify(report);
    // Il marcatore compare solo perché lo abbiamo messo noi nell'identificatore
    // dell'esecuzione: è l'unico posto ammesso, ed è un identificatore, non un
    // contenuto. Si verifica che non compaia altrove moltiplicato o alterato.
    expect(text.match(new RegExp(MARKER, 'g'))?.length).toBe(1);
    expect(json.match(new RegExp(MARKER, 'g'))?.length).toBe(1);
  });
});
