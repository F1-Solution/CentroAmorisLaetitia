/**
 * Il tipo della transazione di lavoro (`IMPORTER-DESIGN.md` §5.3). Si deriva da
 * `Database['transaction']` invece di importarlo da `@amoris/db`: quel
 * pacchetto non espone il tipo della transazione come voce a sé, e derivarlo
 * evita di aggiungere un'esportazione a un pacchetto che non è di questa wave.
 */
import type { Database } from '@amoris/db';

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
