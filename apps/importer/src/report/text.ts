import type { CheckName, ImportReport } from './types.js';

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

/** Le otto righe VERIFICHE di `importer-spec.md` §8.1, con la stessa dicitura. */
const CHECK_LABELS: Readonly<Record<CheckName, string>> = {
  'uploads-references-remaining': "riferimenti 'wp-content/uploads' rimasti",
  'files-vs-expected': 'file nel bucket / file attesi',
  'checksum-mismatches': 'checksum non corrispondenti',
  'media-missing': 'media referenziati e mancanti',
  'menu-items-dangling': 'voci di menu che puntano nel vuoto',
  'redirects-to-404': 'redirect che puntano a un 404',
  'contents-without-path': 'contenuti senza percorso',
  'meta-keys-unclassified': 'chiavi meta non classificate',
};

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

  // In testa, non in fondo: `importer-spec.md` §6.3 punto 3. Un elenco di
  // contenuti non sovrascritti in coda a settanta righe di conteggi è un
  // elenco che nessuno legge, ed è l'unica parte del rapporto che chiede
  // un'azione a chi lo legge.
  if (report.skippedForEditorialWork.length > 0) {
    lines.push('─'.repeat(60));
    lines.push(
      `CONTENUTI NON SOVRASCRITTI — modificati dopo l'ultima esecuzione riuscita (${report.skippedForEditorialWork.length})`,
    );
    for (const item of report.skippedForEditorialWork) lines.push(`  ${item.contentId}`);
    lines.push('  per sovrascriverne uno: --force-content <id>, un contenuto per volta');
  }

  lines.push('─'.repeat(60));
  lines.push(
    `${pad('FASE', 18)}${pad('ATTESI', 8)}${pad('CREATI', 8)}${pad('AGGIORNATI', 12)}${pad('SALTATI', 9)}ERRORI`,
  );
  for (const stage of report.stages) {
    const expected = stage.expected === null ? '~' : String(stage.expected);
    const note = stage.implemented ? '' : '  (non eseguita)';
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
    `  blocchi di riserva 'html'  ${c.fallbackBlocks}  ( ${c.fallbackPercent.toFixed(2)}% )   soglia: 10%${
      c.thresholdPercentOk ? '' : '   SOPRA SOGLIA'
    }`,
  );
  lines.push(
    `  contenuti con riserva      ${c.contentsWithFallback} / 108   soglia: 15${
      c.thresholdContentsOk ? '' : '   SOPRA SOGLIA'
    }`,
  );
  lines.push('VERIFICHE');
  if (report.checks.length === 0) {
    lines.push('  (fase verify non eseguita: nessun controllo misurato)');
  }
  for (const check of report.checks) {
    const label = CHECK_LABELS[check.check];
    const verdict = !check.executed ? '   NON ESEGUITA' : check.ok ? '' : '   NON SUPERATA';
    lines.push(
      `  ${pad(label, 46)}${pad(String(check.value), 6)} atteso ${check.expected}${verdict}`,
    );
  }
  lines.push(`ESITO: ${report.outcome}`);
  return lines.join('\n');
}
