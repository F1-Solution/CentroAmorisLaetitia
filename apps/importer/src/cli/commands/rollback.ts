import type { Runtime } from '../bootstrap.js';
import type { ParsedArgs } from '../args.js';
import {
  applyRollback,
  canProceed,
  ENTITIES_NOT_ROLLED_BACK,
  planRollback,
} from '../../rollback/index.js';

/**
 * `importer rollback --run <id>` — annulla un'esecuzione (`importer-spec.md`
 * §9). Attuato nella wave `1D-W5c` (`IMPORTER-DESIGN.md` §7).
 *
 * **Richiede `--confirm`**, che `importer-spec.md` §3 chiede solo per `apply`.
 * È uno scostamento dichiarato, nella direzione prudente: `CLAUDE.md` mette le
 * cancellazioni fra le azioni a conferma obbligatoria, e questo comando
 * cancella. Senza `--confirm` il comando mostra esattamente che cosa
 * cancellerebbe e non tocca nulla — che è anche il modo utile di usarlo.
 */
export async function runRollback(runtime: Runtime, args: ParsedArgs): Promise<number> {
  // `parseArgs` garantisce già che `--run` ci sia per questo comando.
  const runId = args.run ?? '';
  const plan = await planRollback(runtime.db, runId);

  if (!plan.runExists) {
    console.error(`Nessuna esecuzione con identificatore ${runId}.`);
    return 1;
  }

  console.error(`ROLLBACK — esecuzione ${plan.runId}`);
  console.error(
    `  conclusa il: ${plan.runFinishedAt ? plan.runFinishedAt.toISOString() : '(mai conclusa)'}`,
  );

  if (plan.supersededBy !== null) {
    console.error(
      "\nRIFIUTATO. Un'esecuzione successiva ha sovrascritto la traccia di questa nella mappa\n" +
        `delle corrispondenze: ${plan.supersededBy}.\n` +
        "Si annulla solo l'esecuzione più recente. Annullare questa non cancellerebbe nulla,\n" +
        'e dirlo come se fosse riuscito sarebbe peggio di non farlo.',
    );
    console.error(
      `\nPer annullare l'ultima: importer rollback --run ${plan.supersededBy} --confirm\n` +
        'Per riportare il database a uno stato precedente: ripristino del backup (`importer-spec.md` §9).',
    );
    return 1;
  }

  if (plan.editorialWorkAfter.length > 0) {
    console.error(
      `\nRIFIUTATO. ${plan.editorialWorkAfter.length} contenuti sono stati modificati da un redattore ` +
        'dopo questa esecuzione, e annullarla cancellerebbe quel lavoro (`importer-spec.md` §9).',
    );
    for (const contentId of plan.editorialWorkAfter) console.error(`  ${contentId}`);
    console.error(
      "\nNon esiste un'opzione per forzare. Per riportare il database a uno stato precedente " +
        'resta il ripristino del backup, che `importer-spec.md` §9 indica come la strada più sicura.',
    );
    return 1;
  }

  if (plan.toDelete.length === 0 && plan.updatedNotRestored.length === 0) {
    console.error(
      '\nQuesta esecuzione non ha creato né aggiornato alcuna entità: niente da annullare.',
    );
    return 0;
  }

  console.error('\nDA CANCELLARE — entità create da questa esecuzione');
  if (plan.toDelete.length === 0) console.error('  (nessuna)');
  for (const item of plan.toDelete) console.error(`  ${item.entity}: ${item.count}`);

  if (plan.updatedNotRestored.length > 0) {
    console.error(
      '\nNON RIPRISTINATE — aggiornate da questa esecuzione, esistevano già prima.\n' +
        "  L'importer non conserva l'immagine precedente di una riga: queste entità restano\n" +
        '  come questa esecuzione le ha lasciate. Per riportarle indietro serve il ripristino\n' +
        '  del backup (`importer-spec.md` §9).',
    );
    for (const item of plan.updatedNotRestored) console.error(`  ${item.entity}: ${item.count}`);
  }

  console.error(
    `\nNON TOCCATE — ${ENTITIES_NOT_ROLLED_BACK.join(', ')}: sono configurazione con una chiave\n` +
      '  propria, non contenuto importato. Restano anche il registro delle esecuzioni,\n' +
      "  le anomalie, l'audit log e i redirect creati a mano.",
  );

  if (!canProceed(plan)) {
    // Non raggiungibile: i due casi che lo impediscono sono già usciti sopra.
    console.error('\nRIFIUTATO.');
    return 1;
  }

  if (!args.confirm) {
    console.error(
      '\nNulla è stato cancellato: questa era solo la lettura del piano.\n' +
        `Per eseguire davvero: importer rollback --run ${plan.runId} --confirm`,
    );
    return 0;
  }

  const result = await applyRollback(runtime.db, plan);

  console.error('\nCANCELLATE');
  for (const item of result.deleted) console.error(`  ${item.entity}: ${item.count}`);
  console.error(`  redirect di migrazione: ${result.migrationRedirectsDeleted}`);
  console.error('\nAnnullamento eseguito.');
  return 0;
}
