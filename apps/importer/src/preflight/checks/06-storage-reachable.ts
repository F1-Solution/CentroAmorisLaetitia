import type { CheckResult } from '../types.js';

export interface BucketProbe {
  probe(bucket: string): Promise<boolean>;
}

/** Controllo 6: lo storage a oggetti è raggiungibile e i due bucket esistono. */
export async function checkStorageReachable(
  probe: BucketProbe,
  buckets: readonly string[],
): Promise<CheckResult> {
  const results = await Promise.all(
    buckets.map(async (bucket) => ({ bucket, reachable: await probe.probe(bucket).catch(() => false) })),
  );
  const unreachable = results.filter((r) => !r.reachable).map((r) => r.bucket);
  const ok = unreachable.length === 0;
  return {
    check: 'storage-reachable',
    ok,
    message: ok
      ? `i ${buckets.length} bucket sono raggiungibili`
      : 'configurazione incompleta: uno o più bucket non sono raggiungibili',
    detail: { unreachable },
  };
}
