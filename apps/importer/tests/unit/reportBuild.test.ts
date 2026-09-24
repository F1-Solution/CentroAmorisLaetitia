/**
 * Il costruttore vero del rapporto (`report/build.ts`, wave `1D-W5c`): da ciò
 * che le fasi misurano alla tabella di `importer-spec.md` §8.1.
 *
 * Quattro cose che devono reggere, e che l'abbozzo della `1D-W2` non provava:
 * la tabella conta **per fase** anche dove le righe sono dodici e le fasi
 * diciassette; `media` alimenta due righe mentre `sliders` ne alimenta una
 * sola delle due entità che crea; il confronto dei conteggi spetta a `verify`
 * e non a questa tabella (§8.1, ultima riga); i contenuti protetti stanno
 * **in testa** al rapporto (§6.3 punto 3).
 */
import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/report/build.js';
import { renderReportText } from '../../src/report/text.js';
import type { StageName, StageResult } from '../../src/stages/types.js';
import type { VerificationCheck } from '../../src/report/types.js';

const OPTIONS = { runId: 'run-1', mode: 'plan' as const, importerVersion: '0.1.0' };

function results(
  entries: readonly [StageName, StageResult][],
): ReadonlyMap<StageName, StageResult> {
  return new Map(entries);
}

function counters(created: number, updated = 0, skipped = 0, errors = 0): StageResult {
  return { created, updated, skipped, errors };
}

const ALL_CHECKS_PASSED: readonly VerificationCheck[] = [
  { check: 'uploads-references-remaining', value: 0, expected: 0, ok: true, executed: true },
];

describe('costruzione del rapporto', () => {
  it('porta i conteggi di una fase nella riga che le corrisponde', () => {
    const report = buildReport(OPTIONS, {
      results: results([['menus', counters(64)]]),
      issues: [],
      aborted: null,
    });

    const row = report.stages.find((s) => s.row === 'menu_items')!;
    expect(row.created).toBe(64);
    expect(row.implemented).toBe(true);
    // Le righe che nessuna fase ha alimentato restano dichiarate non eseguite,
    // non "a zero": sono due cose diverse.
    expect(report.stages.find((s) => s.row === 'contents')!.implemented).toBe(false);
  });

  it('la fase media alimenta due righe: media e media_variants', () => {
    const report = buildReport(OPTIONS, {
      results: results([
        ['media', { ...counters(170), extraRows: { media_variants: counters(1376) } }],
      ]),
      issues: [],
      aborted: null,
    });

    expect(report.stages.find((s) => s.row === 'media')!.created).toBe(170);
    expect(report.stages.find((s) => s.row === 'media_variants')!.created).toBe(1376);
  });

  it("le fasi senza riga propria non ne inventano una, ma i loro errori contano nell'esito", () => {
    const report = buildReport(OPTIONS, {
      results: results([
        ['contents', counters(108)],
        // `relations` non ha una riga del rapporto: i suoi 108 aggiornamenti
        // non devono comparire come 108 contenuti in piu'.
        ['relations', counters(0, 108)],
      ]),
      issues: [],
      aborted: null,
    });

    const contents = report.stages.find((s) => s.row === 'contents')!;
    expect(contents.created).toBe(108);
    expect(contents.updated).toBe(0);
  });

  it('il confronto dei conteggi non si fa qui: lo fa verify (§8.1, ultima riga)', () => {
    const report = buildReport(OPTIONS, {
      // 106 invece dei 108 attesi: la colonna ATTESI lo mostra, ma l'esito non
      // si decide su questa tabella. È `verify` a misurare i volumi veri e a
      // registrare lo scostamento, che arriva qui come errore.
      results: results([['contents', counters(106)]]),
      issues: [],
      aborted: null,
    });
    expect(report.stages.find((s) => s.row === 'contents')!.expected).toBe(108);
    expect(report.outcome).toBe('success');
  });

  it("uno scostamento misurato da verify degrada l'esito (§8.2)", () => {
    const report = buildReport(OPTIONS, {
      results: results([
        ['contents', counters(106)],
        // `verify` registra un `table-count-mismatch` e lo conta come errore
        // proprio: è la strada per cui un conteggio sbagliato impedisce
        // `success`.
        ['verify', { ...counters(0, 0, 0, 1), checks: ALL_CHECKS_PASSED }],
      ]),
      issues: [],
      aborted: null,
    });
    expect(report.outcome).toBe('partial');
  });

  it("una fase senza riga propria degrada comunque l'esito se ha errori", () => {
    const report = buildReport(OPTIONS, {
      // `relations` non ha una riga del rapporto: senza questa regola, i suoi
      // errori sparirebbero.
      results: results([['relations', counters(0, 0, 0, 3)]]),
      issues: [],
      aborted: null,
    });
    expect(report.outcome).toBe('partial');
  });

  it('rowResult separa i conteggi della riga da quelli della fase', () => {
    const report = buildReport(OPTIONS, {
      // La fase `sliders` crea 1 carosello e 12 slide; la riga conta le slide.
      results: results([['sliders', { ...counters(13), rowResult: counters(12) }]]),
      issues: [],
      aborted: null,
    });
    expect(report.stages.find((s) => s.row === 'slider_slides')!.created).toBe(12);
  });

  it('senza errori, senza verifiche fallite e sotto soglia, esito success', () => {
    const report = buildReport(OPTIONS, {
      results: results([
        ['contents', counters(108)],
        ['verify', { ...counters(0), checks: ALL_CHECKS_PASSED }],
      ]),
      issues: [],
      aborted: null,
    });
    expect(report.outcome).toBe('success');
  });

  it('una verifica non superata impedisce success', () => {
    const report = buildReport(OPTIONS, {
      results: results([
        ['contents', counters(108)],
        [
          'verify',
          {
            ...counters(0),
            checks: [{ check: 'media-missing', value: 3, expected: 0, ok: false, executed: true }],
          },
        ],
      ]),
      issues: [],
      aborted: null,
    });
    expect(report.outcome).toBe('partial');
  });

  it('una verifica non eseguita non vale come superata', () => {
    const report = buildReport(OPTIONS, {
      results: results([
        ['contents', counters(108)],
        [
          'verify',
          {
            ...counters(0),
            checks: [
              { check: 'files-vs-expected', value: 0, expected: 1546, ok: false, executed: false },
            ],
          },
        ],
      ]),
      issues: [],
      aborted: null,
    });
    expect(report.outcome).toBe('partial');
    expect(renderReportText(report)).toContain('NON ESEGUITA');
  });

  it("una fase fallita rende failed l'intera esecuzione", () => {
    const report = buildReport(OPTIONS, {
      results: results([['contents', counters(108)]]),
      issues: [],
      aborted: { stage: 'media', reason: 'Error' },
    });
    expect(report.outcome).toBe('failed');
  });

  it('i contenuti protetti compaiono in testa al rapporto, prima della tabella (§6.3 punto 3)', () => {
    const report = buildReport(OPTIONS, {
      results: results([
        [
          'contents',
          {
            ...counters(107, 0, 1),
            skippedForEditorialWork: ['11111111-2222-3333-4444-555555555555'],
          },
        ],
      ]),
      issues: [],
      aborted: null,
    });

    expect(report.skippedForEditorialWork).toEqual([
      { contentId: '11111111-2222-3333-4444-555555555555' },
    ]);

    const text = renderReportText(report);
    const posizioneElenco = text.indexOf('CONTENUTI NON SOVRASCRITTI');
    const posizioneTabella = text.indexOf('FASE');
    expect(posizioneElenco).toBeGreaterThan(-1);
    expect(posizioneElenco).toBeLessThan(posizioneTabella);
  });

  it("un contenuto protetto non degrada l'esito: e' il comportamento voluto, non un errore", () => {
    const report = buildReport(OPTIONS, {
      results: results([
        [
          'contents',
          // 107 creati + 1 saltato = 108 attesi: il conteggio torna.
          { ...counters(107, 0, 1), skippedForEditorialWork: ['un-identificatore'] },
        ],
        ['verify', { ...counters(0), checks: ALL_CHECKS_PASSED }],
      ]),
      issues: [],
      aborted: null,
    });
    expect(report.outcome).toBe('success');
  });

  it('la soglia del blocco di riserva superata impedisce success', () => {
    const report = buildReport(OPTIONS, {
      results: results([
        [
          'contents',
          {
            ...counters(108),
            conversion: {
              gutenberg: 57,
              divi: 47,
              html: 4,
              blocksTotal: 1000,
              blocksNonContainer: 800,
              fallbackBlocks: 200,
              fallbackPercent: 25,
              fallbackByReason: {
                wp_html_block: 200,
                divi_unmapped_module: 0,
                divi_unmapped_markup: 0,
                shortcode_unknown: 0,
                manual: 0,
              },
              contentsWithFallback: 40,
              thresholdPercentOk: false,
              thresholdContentsOk: false,
            },
          },
        ],
      ]),
      issues: [],
      aborted: null,
    });
    expect(report.outcome).toBe('partial');
    expect(renderReportText(report)).toContain('SOPRA SOGLIA');
  });
});
