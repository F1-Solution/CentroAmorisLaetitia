import type { PreflightReport } from '../../preflight/types.js';
import { runPreflight } from '../../preflight/index.js';
import type { Runtime } from '../bootstrap.js';

/**
 * Esegue gli 8 controlli e li stampa. Se uno solo fallisce, l'importer non
 * parte (`importer-spec.md` §5): il chiamante deve fermarsi quando `ok` è falso.
 */
export async function runPreflightGate(runtime: Runtime): Promise<PreflightReport> {
  const report = await runPreflight({
    source: runtime.source,
    db: runtime.db,
    s3: runtime.s3,
    buckets: [runtime.config.S3_BUCKET_PUBLIC, runtime.config.S3_BUCKET_PRIVATE],
  });

  console.error('PREFLIGHT');
  for (const result of report.results) {
    console.error(`  [${result.ok ? 'ok' : 'FALLITO'}] ${result.check}: ${result.message}`);
  }
  if (!report.ok) {
    console.error('L’importer non parte: uno o più controlli di preflight sono falliti.');
  }
  return report;
}
