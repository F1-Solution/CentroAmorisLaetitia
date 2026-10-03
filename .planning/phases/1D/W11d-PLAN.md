# 1D-W11d — Verifica del bucket e ora del database: piano di attuazione

> **Per chi esegue:** sotto-skill obbligatoria `superpowers:executing-plans` (o
> `superpowers:subagent-driven-development`). I passi usano caselle `- [ ]`.
> Protocollo `PROGRESS.md` obbligatorio: una riga per sotto-wave.

**Obiettivo:** rendere raggiungibile l'esito `success` di `apply` (DR-088) e
togliere alla protezione del lavoro redazionale la dipendenza dagli orologi
(DR-090), senza eseguire `apply`.

**Architettura:** lo strumento di archiviazione dell'importer impara a elencare
le chiavi di un bucket; la verifica «file nel bucket / file attesi» confronta le
chiavi attese (`media` e `media_variants`) con quelle presenti, e resta «non
eseguita» solo nel `plan` completo, che non carica file. La fine di
un'esecuzione si registra con l'ora del database.

**Tecnologie:** TypeScript strict, Drizzle ORM, `@aws-sdk/client-s3` (già
dipendenza), Vitest, PostgreSQL e MinIO locali.

**Riferimenti:** registro delle decisioni §26 (DR-088, DR-089, DR-090);
HO-008 §3.3; `W11-PLAN.md` §7 criterio 4; `importer-spec.md` §8.

Dipende da: `1D-W11a-bis` completata (commit `9df3e57`). Precede: `1D-W11c`
(`apply`), che **non** fa parte di questo piano.

## Vincoli globali

- Si toccano `apps/importer`, e per DR-091 `apps/api/src/modules/content/service.ts` e `packages/db`.
- Nessuna dipendenza nuova: `ListObjectsV2Command` è già in `@aws-sdk/client-s3`.
- Solo dati sintetici nelle prove (DR-010). Nessuna chiave reale stampata.
- `plan` non scrive mai nel bucket (`importer-spec.md` §5.2): resta vero.
- Commenti e messaggi in italiano, una frase; nomi in inglese.
- Nessun `apply`, nessun commit senza conferma dell'utente.

## Punti di attenzione per la revisione

1. **Più di 1.000 oggetti per bucket**: S3 restituisce al massimo 1.000 chiavi
   per pagina e l'import ne carica circa 1.465. Senza paginazione la verifica
   conterebbe come mancanti centinaia di file presenti. Prova: Task 1, passo 1.
2. **`importer verify` dopo un `apply`** gira in modo `plan` su dati già
   committati: lì il bucket riflette il database, e la verifica **deve**
   eseguirsi. Prova: Task 2, passo 1, terzo caso.
3. **Bucket irraggiungibile durante la verifica**: deve dare «non eseguita»,
   non un numero inventato né un'eccezione che interrompe la fase. Prova:
   Task 2, passo 1, quinto caso.
4. **Misura derivata di un allegato riservato**: va cercata nel bucket
   riservato, non in quello pubblico. Prova: Task 2, passo 1, quarto caso.
5. **Oggetti in più nel bucket** (per esempio quelli del seme sintetico): non
   sono file mancanti. Comportamento fissato da D21; prova: Task 2, passo 1,
   sesto caso.

---

## Sotto-wave `1D-W11d1` — DR-088

### Task 1: elencare le chiavi di un bucket

**File:**
- Modifica: `apps/importer/src/storage/objectStore.ts` (interfaccia
  `ObjectStore` e `createObjectStore`)
- Modifica: `apps/importer/tests/unit/_support/fakeStorage.ts`
- Prova: `apps/importer/tests/unit/storage/objectStorePagination.test.ts` (nuovo)
- Prova: `apps/importer/tests/unit/storage/objectStore.test.ts` (MinIO vero)

**Interfacce:**
- Produce: `ObjectStore.listKeys(bucket: Bucket): Promise<ReadonlySet<string>>`
- Produce: `fakeObjectStore(options?: { extraKeys?: Partial<Record<Bucket, readonly string[]>>; failList?: boolean })`;
  `listKeys` restituisce le chiavi registrate da `put` più `extraKeys`, e
  lancia un errore se `failList` è vero.

- [ ] **Passo 1: prova della paginazione, che deve fallire**

```ts
// apps/importer/tests/unit/storage/objectStorePagination.test.ts
import { describe, expect, it } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import { createObjectStore } from '../../../src/storage/objectStore.js';

describe('ObjectStore.listKeys', () => {
  it('segue le pagine finché S3 dice che non ce ne sono altre', async () => {
    const pages = [
      { Contents: [{ Key: 'a.jpg' }, { Key: 'b.jpg' }], IsTruncated: true, NextContinuationToken: 't1' },
      { Contents: [{ Key: 'c.jpg' }], IsTruncated: false },
    ];
    const tokens: (string | undefined)[] = [];
    const s3 = {
      send: async (command: { input: { ContinuationToken?: string } }) => {
        tokens.push(command.input.ContinuationToken);
        return pages[tokens.length - 1];
      },
    } as unknown as S3Client;

    const keys = await createObjectStore(s3, { public: 'pub', private: 'priv' }).listKeys('public');

    expect([...keys].sort()).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    expect(tokens).toEqual([undefined, 't1']);
  });
});
```

- [ ] **Passo 2: eseguirla e vederla fallire**

Comando: `cd apps/importer && npx vitest run tests/unit/storage/objectStorePagination.test.ts`
Atteso: FAIL, `listKeys is not a function` (o errore di tipo).

- [ ] **Passo 3: implementazione minima**

In `objectStore.ts`, importare `ListObjectsV2Command` accanto a
`PutObjectCommand`; aggiungere all'interfaccia:

```ts
  /** Le chiavi presenti nel bucket, seguendo tutte le pagine (S3 ne dà al più 1.000 per volta). */
  listKeys(bucket: Bucket): Promise<ReadonlySet<string>>;
```

e a `createObjectStore`:

```ts
    async listKeys(bucket) {
      const keys = new Set<string>();
      let token: string | undefined;
      do {
        const page = await s3.send(
          new ListObjectsV2Command({
            Bucket: bucket === 'public' ? buckets.public : buckets.private,
            ContinuationToken: token,
          }),
        );
        for (const item of page.Contents ?? []) if (item.Key) keys.add(item.Key);
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
```

In `fakeStorage.ts`:

```ts
export interface FakeObjectStoreOptions {
  readonly extraKeys?: Partial<Record<Bucket, readonly string[]>>;
  readonly failList?: boolean;
}

export function fakeObjectStore(options: FakeObjectStoreOptions = {}): FakeObjectStore {
  const puts: RecordedPut[] = [];
  return {
    puts,
    async put(bucket, key, absoluteFilePath, contentType, byteSize) {
      puts.push({ bucket, key, absoluteFilePath, contentType, byteSize });
    },
    async listKeys(bucket) {
      if (options.failList) throw new Error('archiviazione non raggiungibile (finta)');
      return new Set([
        ...puts.filter((p) => p.bucket === bucket).map((p) => p.key),
        ...(options.extraKeys?.[bucket] ?? []),
      ]);
    },
  };
}
```

- [ ] **Passo 4: prova su MinIO vero**, in `objectStore.test.ts`, dopo la prova
  di `put` esistente (stessa chiave usa e getta, già ripulita in `afterAll`):

```ts
  it('listKeys ritrova la chiave appena caricata, nel solo bucket giusto', async () => {
    const key = `${testKeyPrefix}/elenco.txt`;
    await store.put('private', key, filePath, 'text/plain', 34);
    expect((await store.listKeys('private')).has(key)).toBe(true);
    expect((await store.listKeys('public')).has(key)).toBe(false);
  });
```

  e aggiungere `${testKeyPrefix}/elenco.txt` al bucket riservato nella pulizia
  di `afterAll`.

- [ ] **Passo 5: eseguire e vedere passare**

Comando: `cd apps/importer && npx vitest run tests/unit/storage`
Atteso: PASS. Poi `pnpm --filter @amoris/importer typecheck`: nessun errore.

### Task 2: la verifica «file nel bucket / file attesi» si esegue

**File:**
- Modifica: `apps/importer/src/stages/context.ts` (`StageContext`)
- Modifica: `apps/importer/src/run/orchestrator.ts` (`runOne`, circa riga 118)
- Modifica: `apps/importer/src/stages/verify/checks.ts` (intestazione,
  `checkFilesVsExpected`, `runAllChecks`)
- Modifica: `apps/importer/src/stages/verify/index.ts` (intestazione)
- Prova: `apps/importer/tests/unit/stages/verifyStage.test.ts`

**Interfacce:**
- Consuma: `ObjectStore.listKeys` e `fakeObjectStore(options)` del Task 1.
- Produce: `StageContext.verifyOnly?: boolean` — vero solo quando
  l'orchestratore esegue la sola fase `verify` (`importer verify`).
- Produce: `checkFilesVsExpected(ctx: StageContext): Promise<VerificationCheck>`;
  `value` = chiavi attese assenti dal bucket giusto, `expected` = 0.

- [ ] **Passo 0 (fatto da accertare):** in `stages/media/index.ts` verificare
  che le misure derivate siano caricate nello **stesso** bucket dell'originale
  (`put(bucket, …)` intorno alla riga 316). Se non fosse così, fermarsi e
  segnalarlo: la regola del quarto caso sotto sarebbe sbagliata.

- [ ] **Passo 1: prove che devono fallire.** Sostituire in
  `verifyStage.test.ts` la prova «checkFilesVsExpected non è mai eseguibile»
  con un `describe('verifica dei file nel bucket — DR-088')` che usa un
  database nuovo per caso e questi aiuti:

```ts
async function seedMediaWithVariant(db: Database, isPrivate: boolean): Promise<void> {
  const [media] = await db
    .insert(schema.media)
    .values({
      storageKey: `2020/05/foto-${isPrivate ? 'riservata' : 'pubblica'}.jpg`,
      publicPath: `/media/2020/05/foto-${isPrivate ? 'riservata' : 'pubblica'}.jpg`,
      fileName: 'foto.jpg',
      mimeType: 'image/jpeg',
      byteSize: 9,
      checksum: Buffer.alloc(32),
      isPrivate,
      uploadedAt: new Date(),
    })
    .returning({ id: schema.media.id, storageKey: schema.media.storageKey });
  await db.insert(schema.mediaVariants).values({
    mediaId: media!.id,
    storageKey: media!.storageKey.replace('.jpg', '-300x200.jpg'),
    publicPath: `/media/${media!.storageKey.replace('.jpg', '-300x200.jpg')}`,
    width: 300,
    height: 200,
    byteSize: 9,
    checksum: Buffer.alloc(32),
  });
}

function ctxWith(tx: Tx, mode: 'plan' | 'apply', storage: ObjectStore, verifyOnly = false) {
  return { ...ctxFor(tx), mode, storage, verifyOnly };
}
```

  Casi (uno per `it`):

  1. `plan` completo → `executed: false`, `ok: false`.
  2. `apply`, oggetto e misura derivata pubblici presenti
     (`extraKeys: { public: ['2020/05/foto-pubblica.jpg', '2020/05/foto-pubblica-300x200.jpg'] }`)
     → `value: 0`, `ok: true`, `executed: true`.
  3. `plan` con `verifyOnly: true` e la misura derivata **assente** →
     `executed: true`, `value: 1`.
  4. `apply`, allegato riservato con le sue chiavi messe nel bucket
     **pubblico** → `value: 2` (vanno cercate nel riservato).
  5. `apply` con `failList: true` → `executed: false`, nessuna eccezione.
  6. `apply`, tutto presente più una chiave estranea in `extraKeys.public` →
     comportamento secondo D21 (raccomandato: `value: 0`).

- [ ] **Passo 2: eseguirle e vederle fallire**

Comando: `cd apps/importer && npx vitest run tests/unit/stages/verifyStage.test.ts`
Atteso: FAIL sui casi 2, 3, 4, 6 (la verifica oggi è sempre «non eseguita»).

- [ ] **Passo 3: implementazione**

In `context.ts`, dentro `StageContext`:

```ts
  /** Vero quando si esegue la sola fase `verify` su dati già committati: il bucket riflette il database. */
  readonly verifyOnly?: boolean;
```

In `orchestrator.ts`, nell'oggetto passato a `stage.run` dentro `runOne`:

```ts
      verifyOnly: onlyStage === 'verify',
```

In `checks.ts`, sostituire `checkFilesVsExpected`:

```ts
/**
 * Le chiavi di `media` e `media_variants` assenti dal bucket giusto (DR-088).
 * Nel `plan` completo il bucket non è stato scritto: non c'è nulla da misurare.
 */
export async function checkFilesVsExpected(ctx: StageContext): Promise<VerificationCheck> {
  if (ctx.mode === 'plan' && !ctx.verifyOnly) return check('files-vs-expected', 0, 0, false);

  const [mediaRows, variantRows] = await Promise.all([
    ctx.tx
      .select({ storageKey: schema.media.storageKey, isPrivate: schema.media.isPrivate })
      .from(schema.media),
    ctx.tx
      .select({ storageKey: schema.mediaVariants.storageKey, isPrivate: schema.media.isPrivate })
      .from(schema.mediaVariants)
      .innerJoin(schema.media, eq(schema.media.id, schema.mediaVariants.mediaId)),
  ]);

  let present: Record<Bucket, ReadonlySet<string>>;
  try {
    present = {
      public: await ctx.storage.listKeys('public'),
      private: await ctx.storage.listKeys('private'),
    };
  } catch {
    // Archiviazione non raggiungibile: non dimostrata, mai «passata».
    return check('files-vs-expected', 0, 0, false);
  }

  let missing = 0;
  for (const row of [...mediaRows, ...variantRows]) {
    if (!present[row.isPrivate ? 'private' : 'public'].has(row.storageKey)) missing += 1;
  }
  return check('files-vs-expected', missing, 0);
}
```

  importare `type Bucket` da `../../storage/objectStore.js`; in `runAllChecks`
  sostituire `checkFilesVsExpected()` con `await checkFilesVsExpected(ctx)`.
  Aggiornare l'intestazione di `checks.ts` (righe 7-12) e di `verify/index.ts`
  (frase sullo storage non raggiungibile): una frase ciascuna, che dica che la
  verifica si esegue in `apply` e in `importer verify`.

- [ ] **Passo 4: eseguire e vedere passare**

Comando: `cd apps/importer && npx vitest run tests/unit/stages/verifyStage.test.ts tests/unit/orchestrator.test.ts`
Atteso: PASS.

- [ ] **Passo 5: riga in `PROGRESS.md`**
  `PHASE:1D WAVE:1D-W11d1 STATUS:complete TS:<ora UTC>`

---

## Sotto-wave `1D-W11d2` — DR-090

D20 = B (DR-091): Task 3 e Task 4 insieme.

### Task 3: la fine di un'esecuzione con l'ora del database

**File:**
- Modifica: `apps/importer/src/persistence/importRuns.ts` (`finishRun`)
- Prova: `apps/importer/tests/unit/persistence/importRuns.test.ts` (nuovo)

**Interfacce:**
- Produce: `finishRun(db: Database | Tx, runId, outcome, summary)`; firma
  allargata a `Tx` perché la prova possa fissare l'ora della transazione.

- [ ] **Passo 1: prova che deve fallire.** In una transazione PostgreSQL
  `now()` è fisso all'inizio: se `finishRun` usa l'ora del database,
  `finished_at` coincide esattamente con quell'istante anche dopo un'attesa;
  con l'ora di Node no.

```ts
// apps/importer/tests/unit/persistence/importRuns.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { schema } from '@amoris/db';
import { createRun, finishRun } from '../../../src/persistence/importRuns.js';
import type { ImportReport } from '../../../src/report/types.js';
import { createTestDatabase, type TestDatabase } from '../_support/dbHarness.js';

let testDb: TestDatabase;
beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_import_runs');
});
afterAll(async () => {
  await testDb.teardown();
});

describe('finishRun', () => {
  it('DR-090: registra la fine con l’ora del database, non con quella di Node', async () => {
    const runId = await createRun(testDb.db, {
      isDryRun: false,
      sourceLabel: 'BackupDB-2026-09-13',
      importerVersion: '0.0.0-test',
    });
    // Il rapporto è solo archiviato: qui conta l'ora, non il contenuto.
    const summary = { runId } as unknown as ImportReport;

    await testDb.db.transaction(async (tx) => {
      const [start] = await tx
        .select({ at: sql<string>`now()::text` })
        .from(schema.importRuns)
        .where(eq(schema.importRuns.id, runId));
      await new Promise((resolve) => setTimeout(resolve, 50));
      await finishRun(tx, runId, 'success', summary);
      const [row] = await tx
        .select({ at: sql<string>`finished_at::text` })
        .from(schema.importRuns)
        .where(eq(schema.importRuns.id, runId));
      expect(row!.at).toBe(start!.at);
    });
  });
});
```

- [ ] **Passo 2: eseguirla e vederla fallire**

Comando: `cd apps/importer && npx vitest run tests/unit/persistence/importRuns.test.ts`
Atteso: FAIL (gli istanti differiscono di circa 50 ms, o errore di tipo su `tx`).

- [ ] **Passo 3: implementazione**

```ts
import { eq, isNull, sql } from 'drizzle-orm';
import type { Tx } from './tx.js';

export async function finishRun(
  db: Database | Tx,
  runId: string,
  outcome: ImportReport['outcome'],
  summary: ImportReport,
): Promise<void> {
  await db
    .update(schema.importRuns)
    .set({
      // DR-090: stesso orologio delle righe con cui si confronta.
      finishedAt: sql`now()`,
      outcome,
      summary: summary as unknown as Record<string, unknown>,
    })
    .where(eq(schema.importRuns.id, runId));
}
```

- [ ] **Passo 4: eseguire e vedere passare**, poi le prove della protezione:

Comando: `cd apps/importer && npx vitest run tests/unit/persistence tests/unit/stages/contentsStage.test.ts tests/unit/stages/relationsStage.test.ts`
Atteso: PASS.

### Task 4 (D20 = B, DR-091): tutte le ore del confronto dal database

**Analisi d'impatto** — ogni scrittura di un'ora che la protezione del lavoro
redazionale (`contents/editorialProtection.ts`, `rollback/index.ts`
`contentsEditedAfter`) confronta, presente o futura con DR-087:

| # | Punto | Oggi |
|---|---|---|
| 1 | `apps/importer/src/persistence/importRuns.ts:40` fine dell'esecuzione | Node (Task 3) |
| 2 | `apps/api/src/modules/content/service.ts:115` modifica del contenuto | Node |
| 3 | `apps/api/src/modules/content/service.ts:146,148` pubblicazione e ritiro | Node |
| 4 | `apps/api/src/modules/content/service.ts:203` copia di lavoro | Node |
| 5 | `apps/importer/src/stages/contents/index.ts:258` | Node |
| 6 | `apps/importer/src/stages/relations/index.ts:147` | Node |
| 7 | `apps/importer/src/stages/rewrite/index.ts:52` | Node |

Già dal database, non si toccano: le insert di `contents` e `content_revisions`
(valore predefinito `now()`). Fuori dal confronto, non si toccano:
`publishedAt` e gli `updatedAt` delle altre tabelle.

**Precisione:** si tronca al millisecondo. L'API confronta in JavaScript
`baseUpdatedAt` con `updatedAt` (`content/routes.ts:225,251`) sui valori
riletti; al millisecondo l'andata e ritorno è esatta, come oggi con Node.

**File:**
- Crea: `packages/db/src/clock.ts`; Modifica: `packages/db/src/index.ts`
- Modifica: i punti 1-7 (il punto 1 sostituisce `sql\`now()\`` del Task 3)
- Prova: `apps/api/tests/…` della copia di lavoro (accanto alle prove di `saveDraft`)

**Interfacce:**
- Produce: `databaseNow(): SQL` esportato da `@amoris/db`.

- [ ] **Passo 1: prova che deve fallire**, nell'API: in una transazione,
  `saveDraft(tx, …)` dopo un'attesa di 50 ms scrive `updated_at` uguale a
  `date_trunc('milliseconds', now())` della transazione (stessa tecnica del
  Task 3).
- [ ] **Passo 2:** eseguirla, FAIL.
- [ ] **Passo 3: implementazione**

```ts
// packages/db/src/clock.ts
import { sql, type SQL } from 'drizzle-orm';

/** L'ora del database al millisecondo (DR-091): un solo orologio per i confronti della protezione redazionale. */
export function databaseNow(): SQL {
  return sql`date_trunc('milliseconds', now())`;
}
```

  `index.ts`: `export { databaseNow } from './clock.js';`. Nei punti 1-7
  sostituire `new Date()` (o `sql\`now()\``) con `databaseNow()`. In
  `saveDraft` la firma di `db` si allarga a `Database | Tx` solo se serve alla
  prova.
- [ ] **Passo 4:** prove di `apps/api` e `apps/importer` verdi; la prova del
  Task 3 confronta con `date_trunc('milliseconds', now())::text`.

- [ ] **Riga in `PROGRESS.md`** a fine sotto-wave:
  `PHASE:1D WAVE:1D-W11d2 STATUS:complete TS:<ora UTC>`

---

## Sotto-wave `1D-W11d3` — validazione, nuovo `plan`, stop

- [ ] Revisione del codice con l'agente `code-reviewer`; correggere CRITICAL e HIGH.
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`: verdi.
      Prima di `pnpm test`, misurare lo scarto d'orologio: sopra i 20 ms
      riallineare (HO-008 §6.1) invece di attribuire i fallimenti al codice.
- [ ] Contare, in sola lettura, gli oggetti già presenti nei due bucket (seme
      sintetico): servono per HO-008 §5 e per D21.
- [ ] `plan --verbose` sul database vuoto, con il rapporto letto prima di
      mostrarlo (RD-12). Atteso: tutte le verifiche eseguibili a 0, «file nel
      bucket» **non eseguita**, esito `partial` per quest'unica ragione.
- [ ] Aggiornare HO-008 (§3 nuovo esito, §5 oggetti presenti, §6 conferma di
      DR-072) e `docs/handoff/README.md`.
- [ ] **Fermarsi prima di `apply`.** Chiedere la conferma di DR-072 e del commit.
- [ ] Riga in `PROGRESS.md`: `PHASE:1D WAVE:1D-W11d3 STATUS:complete TS:<ora UTC>`

## Criteri di «fatto»

1. In `apply` e in `importer verify` la verifica del bucket è eseguita: una
   prova lo dimostra in entrambi i modi.
2. La paginazione è provata con più di una pagina.
3. Bucket irraggiungibile → «non eseguita», senza eccezione: provato.
4. `finished_at` viene dall'orologio del database: provato con una
   transazione, non con un confronto di orari.
5. Le quattro suite del repository sono verdi.
6. Il nuovo `plan` è `partial` **solo** per «file nel bucket — non eseguita».
7. HO-008 aggiornato; nessun `apply` eseguito.

## Rischi e rientro

| Rischio | Mitigazione | Rientro |
|---|---|---|
| L'`apply` reale dà `files-vs-expected` > 0 per chiavi con maiuscole diverse (DR-065) | la chiave archiviata è quella del database, ed è quella cercata | rapporto, poi `rollback --run <id>` |
| Gli oggetti del seme sintetico confondono il conteggio | D21 | conteggio in sola lettura prima di `apply` |
| DR-090 nella sola lettura minima peggiora lo sviluppo locale (vedi D20) | D20 bloccante per `1D-W11d2` | `git revert` del Task 3 |

## Assunzioni dichiarate

- Le misure derivate stanno nel bucket del loro originale (accertata al Task 2,
  passo 0).
- I documenti della fase `documents` producono righe `media` (HO-008 §2: 8 dei
  178 `media` vengono da lì), quindi sono coperti dalla stessa verifica.
- `importer verify` resta in modo `plan`: non lo si cambia.

## Decisioni aperte

### D20. Fin dove arriva DR-090 (bloccante per `1D-W11d2`)

**Fatto nuovo:** l'area di gestione scrive l'ora delle copie di lavoro con
l'orologio di Node (`apps/api/src/modules/content/service.ts:203`), non con
quello del database. La premessa di DR-090 («la stessa delle copie di lavoro»)
vale solo per le prove, che inseriscono le copie a mano. In sviluppo l'API gira
su Windows come l'importer: registrare la fine dell'esecuzione con l'ora del
database **introdurrebbe** lo scarto che oggi c'è solo nelle prove.

- **A** — solo `finishRun` con l'ora del database, come scritto in DR-090.
- **B** — tutte le ore del confronto dal database: `finishRun`, le copie di
  lavoro e `contents.updated_at` scritti dall'API e dall'importer (tocca
  `apps/api`; prepara anche DR-087).
- **C** — DR-090 si supera: nessuna modifica, requisito operativo di orologi
  sincronizzati.
- **Raccomandazione:** B, perché è l'unica in cui i due lati del confronto
  leggono sempre lo stesso orologio.

### D21. Oggetti in più nel bucket (bloccante per il caso 6 del Task 2)

- **A** — contano solo i file attesi e mancanti; gli oggetti in più sono
  ignorati dalla verifica.
- **B** — il bucket deve coincidere con l'atteso: anche gli oggetti in più
  fanno fallire la verifica, e il seme sintetico va cancellato prima di `apply`
  (cancellazione: conferma obbligatoria).
- **Raccomandazione:** A. La verifica serve a dimostrare che i file importati
  sono arrivati; gli oggetti del seme sono un altro problema.

### D22. Immagine del servizio che crea i bucket (differibile)

Il registro risponde 401 per l'immagine fissata in
`infra/compose/docker-compose.yml:58`. **Termine:** prima di ricreare
l'ambiente da zero. Opzioni e raccomandazione nel round dedicato, dopo aver
verificato se la stessa versione è pubblicata altrove.
