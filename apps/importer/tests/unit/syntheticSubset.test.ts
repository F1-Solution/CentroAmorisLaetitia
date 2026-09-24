/**
 * **La catena completa dell'importazione su un sottoinsieme sintetico** —
 * wave `1D-W10`.
 *
 * Tre cose in una sola esecuzione, perché sono tre domande sullo stesso stato:
 *
 * 1. **Idempotenza** (criterio 1D-2): due `apply` di fila producono lo stesso
 *    stato, confrontato con la fotografia strutturale di `stateDigest`.
 * 2. **Andata e ritorno su tutti i contenuti** (criterio 1D-36): ogni
 *    contenuto prodotto è in forma canonica, il suo HTML è quello che i
 *    blocchi producono, e risanificare il testo non lo sposta.
 * 3. **L'ordine delle fasi di DR-062**: il riferimento a un modulo dentro un
 *    contenuto si risolve in un blocco `form`, non in un blocco di riserva.
 *    È la differenza osservabile fra l'ordine vecchio e quello nuovo.
 *
 * La prova equivalente sulla **sorgente reale** sta in
 * `tests/real/idempotency.real.test.ts` e `tests/real/roundTripReal.real.test.ts`:
 * non girano in CI perché leggono `source-private/` (DR-010). Questa gira in
 * CI, e il sottoinsieme è in Git perché è **inventato**.
 */
import { schema } from '@amoris/db';
import { eq } from 'drizzle-orm';
import {
  blockDocumentSchema,
  extractContentText,
  sanitizeRichText,
  serializeBlockDocument,
  type BlockDocument,
  type BlockNode,
} from '@amoris/blocks/model';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runImport } from '../../src/run/orchestrator.js';
import { buildReport } from '../../src/report/build.js';
import { createIssueSink } from '../../src/persistence/issueSink.js';
import { createRun, finishRun } from '../../src/persistence/importRuns.js';
import { IMPLEMENTED_STAGES } from '../../src/stages/registry.js';
import {
  diffStateDigests,
  describeDifferences,
  stateDigest,
} from '../../src/verify/stateDigest.js';
import type { StateDigest } from '../../src/verify/stateDigest.js';
import { createTestDatabase, type TestDatabase } from './_support/dbHarness.js';
import { fakeObjectStore } from './_support/fakeStorage.js';
import { createSyntheticSubset, LEGACY, type SyntheticSubset } from './_support/syntheticSubset.js';

/** Sale di misura, non un segreto: il database di questo test viene distrutto alla fine. */
const SALE = 'sale-sintetico-non-un-segreto';

let testDb: TestDatabase;
let subset: SyntheticSubset;
let primaEsecuzione: Awaited<ReturnType<typeof esegui>>;
let secondaEsecuzione: Awaited<ReturnType<typeof esegui>>;
let dopoPrima: StateDigest;
let dopoSeconda: StateDigest;

async function esegui() {
  const runId = await createRun(testDb.db, {
    isDryRun: false,
    sourceLabel: 'sottoinsieme-sintetico',
    importerVersion: '0.0.0-test',
  });
  const issues = createIssueSink(testDb.db, 'apply', runId);
  const outcome = await runImport({
    db: testDb.db,
    source: subset.source,
    storage: fakeObjectStore(),
    runId,
    mode: 'apply',
    issues,
    options: { only: null, forceContentIds: [], verbose: false },
    ipHashSalt: SALE,
  });
  const report = buildReport(
    { runId, mode: 'apply', importerVersion: '0.0.0-test' },
    { results: outcome.results, issues: issues.collected, aborted: outcome.aborted },
  );
  await finishRun(testDb.db, runId, report.outcome, report);
  return { runId, outcome, report };
}

beforeAll(async () => {
  testDb = await createTestDatabase('amoris_importer_sottoinsieme');
  subset = await createSyntheticSubset();

  primaEsecuzione = await esegui();
  dopoPrima = await stateDigest(testDb.db);

  secondaEsecuzione = await esegui();
  dopoSeconda = await stateDigest(testDb.db);
}, 600_000);

afterAll(async () => {
  await subset?.teardown();
  await testDb?.teardown();
});

function walk(nodes: readonly BlockNode[], visit: (node: BlockNode) => void): void {
  for (const node of nodes) {
    visit(node);
    walk(node.children, visit);
  }
}

describe('ordine delle fasi (DR-062)', () => {
  it('documents, sliders e forms stanno prima di contents', () => {
    const ordine = [...IMPLEMENTED_STAGES.keys()];
    const contents = ordine.indexOf('contents');
    for (const prima of ['documents', 'sliders', 'forms'] as const) {
      expect(ordine.indexOf(prima), `${prima} deve precedere contents`).toBeLessThan(contents);
    }
    // E ciò che dipende da `contents` resta dopo: l'ordine nuovo non ha
    // scavalcato una dipendenza vera.
    for (const dopo of ['relations', 'menus', 'seo', 'redirects', 'rewrite', 'verify'] as const) {
      expect(ordine.indexOf(dopo), `${dopo} deve seguire contents`).toBeGreaterThan(contents);
    }
  });

  it('la catena si esegue per intero, senza fasi saltate né interruzioni', () => {
    expect(primaEsecuzione.outcome.aborted).toBeNull();
    expect(primaEsecuzione.outcome.skippedStages).toEqual([]);
  });

  it('il riferimento al modulo diventa un blocco form, non un blocco di riserva', async () => {
    const [pagina] = await testDb.db
      .select({ blocks: schema.contents.blocks })
      .from(schema.contents)
      .where(eq(schema.contents.legacyId, LEGACY.pagina));
    expect(pagina, 'la pagina sintetica deve essere stata importata').toBeDefined();

    const tipi: string[] = [];
    let formId: string | null = null;
    walk((pagina!.blocks as BlockDocument).blocks, (node) => {
      tipi.push(node.type);
      if (node.type === 'form') formId = node.props.formId;
    });

    expect(tipi, 'con DR-062 il modulo si risolve: nessun blocco di riserva').not.toContain('html');
    expect(tipi).toContain('form');

    // E punta al form davvero importato, non a un identificativo inventato.
    const [modulo] = await testDb.db.select({ id: schema.forms.id }).from(schema.forms);
    expect(formId).toBe(modulo?.id);
  });
});

describe('idempotenza sul sottoinsieme sintetico (criterio 1D-2)', () => {
  it('la prima esecuzione cambia lo stato', () => {
    expect(dopoPrima.some((tabella) => tabella.rows > 0)).toBe(true);
  });

  it('due apply di fila producono lo stesso stato', () => {
    const differenze = diffStateDigests(dopoPrima, dopoSeconda);
    expect(differenze, differenze.length ? describeDifferences(differenze) : '').toEqual([]);
  });

  it('la seconda esecuzione non crea nulla: aggiorna e basta', () => {
    expect(secondaEsecuzione.outcome.aborted).toBeNull();
    for (const riga of secondaEsecuzione.report.stages) {
      expect.soft(`${riga.row}:${riga.created}`).toBe(`${riga.row}:0`);
    }
  });

  it('nessuna riga di errore in nessuna delle due esecuzioni', () => {
    for (const esecuzione of [primaEsecuzione, secondaEsecuzione]) {
      for (const riga of esecuzione.report.stages) {
        expect.soft(`${riga.row}:${riga.errors}`).toBe(`${riga.row}:0`);
      }
    }
  });

  it('le compilazioni dei moduli non si duplicano: sono un fatto storico', async () => {
    const righe = await testDb.db.select().from(schema.formSubmissions);
    expect(righe).toHaveLength(1);
  });
});

describe('andata e ritorno su tutti i contenuti importati (criterio 1D-36)', () => {
  it('ogni contenuto è in forma canonica, e il suo HTML è quello che i blocchi producono', async () => {
    const righe = await testDb.db
      .select({
        id: schema.contents.id,
        path: schema.contents.path,
        blocks: schema.contents.blocks,
        contentHtml: schema.contents.contentHtml,
        contentText: schema.contents.contentText,
      })
      .from(schema.contents);

    expect(righe.length).toBeGreaterThan(0);

    for (const riga of righe) {
      const documento = riga.blocks as BlockDocument;

      // Forma canonica: se Zod la completasse, il primo salvataggio
      // dell'editor riscriverebbe un contenuto che nessuno ha toccato.
      expect.soft(blockDocumentSchema.parse(documento), riga.path).toEqual(documento);

      const html = serializeBlockDocument(documento);
      expect.soft(riga.contentHtml, `HTML di ${riga.path}`).toBe(html);
      expect.soft(riga.contentText, `testo di ${riga.path}`).toBe(extractContentText(html));

      // Serializzare due volte dà lo stesso byte: è la determinatezza di
      // `BLOCK-MODEL.md` §6, senza la quale l'andata e ritorno non esiste.
      expect.soft(serializeBlockDocument(documento), `HTML stabile di ${riga.path}`).toBe(html);

      walk(documento.blocks, (node) => {
        if (node.type !== 'rich_text') return;
        const esito = sanitizeRichText(node.props.html);
        expect.soft(esito.ok, `${riga.path} / ${node.id} deve sanificarsi`).toBe(true);
        if (esito.ok) {
          expect
            .soft(esito.html, `${riga.path} / ${node.id} è un punto fisso`)
            .toBe(node.props.html);
        }
      });
    }
  });

  it('dopo la riscrittura dei media non resta alcun riferimento a wp-content/uploads', async () => {
    const righe = await testDb.db
      .select({ path: schema.contents.path, contentHtml: schema.contents.contentHtml })
      .from(schema.contents);
    for (const riga of righe) {
      expect.soft(riga.contentHtml.includes('wp-content/uploads'), riga.path).toBe(false);
    }
  });
});
