import type { ImportReport } from './types.js';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

/**
 * Rende il rapporto in forma testuale (`importer-spec.md` §8.1). Riceve
 * l'oggetto già costruito: non legge il database (`IMPORTER-DESIGN.md` §2). Non
 * contiene alcun campo di testo libero proveniente dalla sorgente — solo
 * conteggi, identificatori e codici da vocabolario chiuso (§8.3).
 */
export function renderReportText(report: ImportReport): string {
  const lines: string[] = [];
  lines.push(`IMPORT — esecuzione ${report.runId}            ${report.mode}`);
  lines.push(`sorgente: ${report.sourceLabel}        importer ${report.importerVersion}`);
  lines.push('─'.repeat(60));
  lines.push(
    `${pad('FASE', 18)}${pad('ATTESI', 8)}${pad('CREATI', 8)}${pad('AGGIORNATI', 12)}${pad('SALTATI', 9)}ERRORI`,
  );
  for (const stage of report.stages) {
    const expected = stage.expected === null ? '~' : String(stage.expected);
    const note = stage.implemented ? '' : '  (non ancora attuata)';
    lines.push(
      `${pad(stage.row, 18)}${pad(expected, 8)}${pad(String(stage.created), 8)}${pad(
        String(stage.updated),
        12,
      )}${pad(String(stage.skipped), 9)}${stage.errors}${note}`,
    );
  }
  lines.push('─'.repeat(60));
  lines.push('CONVERSIONE DEI CONTENUTI');
  const c = report.conversion;
  lines.push(`  gutenberg  ${c.gutenberg}    divi  ${c.divi}    html  ${c.html}`);
  lines.push(`  blocchi prodotti           ${c.blocksTotal}`);
  lines.push(
    `  blocchi di riserva 'html'  ${c.fallbackBlocks}  ( ${c.fallbackPercent}% )   soglia: 10%`,
  );
  lines.push(`  contenuti con riserva      ${c.contentsWithFallback} / 108   soglia: 15`);
  lines.push('VERIFICHE');
  if (report.checks.length === 0) {
    lines.push('  (fase verify non ancora attuata: nessun controllo eseguito)');
  }
  for (const check of report.checks) {
    lines.push(`  ${check.check}${' '.repeat(Math.max(1, 46 - check.check.length))}${check.value}   atteso ${check.expected}`);
  }
  if (report.skippedForEditorialWork.length > 0) {
    lines.push('CONTENUTI SALTATI PER LAVORO REDAZIONALE');
    for (const item of report.skippedForEditorialWork) lines.push(`  ${item.contentId}`);
  }
  lines.push(`ESITO: ${report.outcome}`);
  return lines.join('\n');
}
