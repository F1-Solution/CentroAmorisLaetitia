/**
 * Fase 11 `forms` (`importer-spec.md` §4): produce `forms` e
 * `form_notifications`.
 *
 * Sorgente: i 25 `wp_posts` con `post_type = 'wpforms'` e
 * `post_status = 'publish'` (misurato — ADR-010 §1.1). I 3 nel cestino si
 * scartano senza contarli come saltati: `expected()` conta solo i 25
 * pubblicati.
 *
 * `post_content` è **JSON** (non serializzato PHP), con chiavi di primo
 * livello `fields, id, field_id, settings, payments, meta` (misurato). Un
 * valore che non fa `JSON.parse`, o un campo di tipo mai visto fra i dieci
 * misurati (`address, checkbox, date-time, email, html, name, number,
 * payment-single, phone, radio, text` — ADR-010 §1.2), fa fallire **solo
 * quel form**: l'errore si propaga fuori da `parseFormPost` e lo isola
 * `forEachItem`, come già fa `stages/sliders/index.ts` per un JSON malformato.
 *
 * ## Forma di `forms.definition`
 *
 * Non si copia l'intero blob del plugin: si tiene una forma propria, un
 * campo per riga con `id, type, label, required, order` più le sole chiavi
 * `options` che servono a rendere **quel tipo** di campo
 * (`FIELD_OPTION_KEYS_BY_TYPE`), scartando il resto (CSS, condizioni,
 * integrazioni di terze parti mai usate su questa sorgente). `order` è
 * l'indice di enumerazione delle chiavi di `fields`: essendo chiavi
 * numeriche, JavaScript le enumera già in ordine ascendente, che è l'ordine
 * di visualizzazione del form.
 *
 * `requiresPayment` è vero quando la definizione contiene un campo
 * `payment-single` (misurato: 22 form su 25). ADR-010 §4.2 esclude questo
 * tipo dai campi resi in Fase 1: il flag è ciò che impedisce di pubblicare un
 * form che sembri funzionante senza esserlo, in attesa della decisione D14.
 *
 * ## Notifiche
 *
 * `settings.notifications` è una mappa id -> notifica; si scrive una riga
 * `form_notifications` per voce (39 in totale sui 25 form). Idempotenza:
 * `forms.legacyId` ha un vincolo di unicità, ma si usa comunque
 * `import_id_map` con entità `form`, come le altre fasi con identità
 * numerica sorgente (`sliders`, `documents`) — così una futura modifica
 * manuale di `forms.legacy_id` non disallinea la corrispondenza. Le
 * notifiche non hanno una propria voce in `import_id_map`: si cancellano e
 * si reinseriscono ad ogni riesecuzione, come fa `documents` con
 * `document_terms`.
 */
import { and, eq } from 'drizzle-orm';
import { schema } from '@amoris/db';
import type { Stage, StageContext } from '../context.js';
import type { ItemKey, StageResult } from '../types.js';
import { forEachItem } from '../../persistence/forEachItem.js';
import type { SqlRow } from '../../source/sql/types.js';
import { asString, parseFormPost } from './parse.js';
import {
  findDiviContactForms,
  type DiviContactForm,
  type DiviContactForms,
} from './diviContactForm.js';

interface FormRow {
  readonly legacyId: number;
  readonly slug: string;
  readonly postTitle: string;
  readonly rawContent: string;
}

function asNumber(value: SqlRow[string] | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10) || 0;
  return 0;
}

async function loadFormRows(ctx: StageContext): Promise<readonly FormRow[]> {
  const rows = await ctx.source.rows('wp_posts');
  const result: FormRow[] = [];
  for (const row of rows as readonly SqlRow[]) {
    if (asString(row['post_type']) !== 'wpforms') continue;
    if (asString(row['post_status']) !== 'publish') continue; // i 3 nel cestino decadono, ADR-010 §1.1
    result.push({
      legacyId: asNumber(row['ID']),
      slug: asString(row['post_name']),
      postTitle: asString(row['post_title']),
      rawContent: asString(row['post_content']),
    });
  }
  return result;
}

/** I moduli di contatto di Divi dei contenuti pubblicati (DR-094). */
async function loadDiviForms(ctx: StageContext): Promise<DiviContactForms> {
  const rows = (await ctx.source.rows('wp_posts')) as readonly SqlRow[];
  return findDiviContactForms(
    rows
      .filter((row) => asString(row['post_status']) === 'publish')
      .filter((row) => ['page', 'post'].includes(asString(row['post_type'])))
      .map((row) => ({ postId: asNumber(row['ID']), content: asString(row['post_content']) })),
  );
}

/**
 * Il form di un modulo di Divi, con la sua notifica come nella sorgente
 * (DR-098). Divi non ha un oggetto proprio, e usa un predefinito in inglese: si
 * usa il titolo del form.
 */
async function writeDiviForm(
  ctx: StageContext,
  tx: StageContext['tx'],
  form: DiviContactForm,
): Promise<'created' | 'updated'> {
  const existingId = await ctx.ids.find(tx, DIVI_SOURCE, form.postId, 'form');
  // Lo slug è unico fra tutti i form: se lo occupa un altro, lo si dice con un
  // nome riconoscibile invece di un generico errore d'inserimento.
  const [owner] = await tx
    .select({ id: schema.forms.id })
    .from(schema.forms)
    .where(eq(schema.forms.slug, form.slug));
  if (owner && owner.id !== existingId) {
    const conflict = new Error('slug già usato da un altro form');
    conflict.name = 'divi-form-slug-conflict';
    throw conflict;
  }
  // Un modulo di contatto non ha pagamento né testo del bottone proprio (DR-094).
  const values = {
    slug: form.slug,
    title: form.title,
    definition: { fields: form.fields, submitText: null, submitTextProcessing: null },
    confirmationMessage: form.confirmationMessage,
    requiresPayment: false,
    legacyId: null,
  };
  const [written] = await tx
    .insert(schema.forms)
    .values({ id: existingId ?? undefined, ...values })
    .onConflictDoUpdate({ target: schema.forms.id, set: { ...values, updatedAt: new Date() } })
    .returning({ id: schema.forms.id });
  if (!written) throw new Error('inserimento di forms non ha restituito una riga');
  await ctx.ids.remember(
    tx,
    DIVI_SOURCE,
    form.postId,
    'form',
    written.id,
    ctx.mode === 'apply' ? ctx.runId : null,
    existingId ? 'updated' : 'created',
  );

  // Una sola notifica, alla posizione 0: si aggiorna sul posto, come quelle di WPForms.
  const notification = {
    formId: written.id,
    name: 'Notifica',
    recipients: form.notification.recipients,
    subject: form.title,
    senderName: null,
    replyTo: null,
    body: form.notification.body,
    isActive: true,
    position: 0,
  };
  const [current] = await tx
    .select({ id: schema.formNotifications.id })
    .from(schema.formNotifications)
    .where(
      and(
        eq(schema.formNotifications.formId, written.id),
        eq(schema.formNotifications.position, 0),
      ),
    );
  if (current) {
    await tx
      .update(schema.formNotifications)
      .set(notification)
      .where(eq(schema.formNotifications.id, current.id));
  } else {
    await tx.insert(schema.formNotifications).values(notification);
  }
  return existingId ? 'updated' : 'created';
}

/** La chiave di corrispondenza dei form di Divi: il modulo non ha una riga sorgente propria. */
export const DIVI_SOURCE = 'divi_contact_form';

export const formsStage: Stage = {
  name: 'forms',
  dependsOn: [],

  async expected(ctx: StageContext) {
    return (await loadFormRows(ctx)).length + (await loadDiviForms(ctx)).forms.length;
  },

  async run(ctx: StageContext): Promise<StageResult> {
    const rows = await loadFormRows(ctx);
    const recordError = async (key: ItemKey, error: unknown): Promise<void> => {
      await ctx.issues.record({
        severity: 'error',
        stage: 'forms',
        code: 'item-import-failed',
        sourceTable: key.sourceTable,
        sourceId: key.sourceId,
        detail: error instanceof Error ? error.name : 'unknown-error',
      });
    };

    const wpforms = await forEachItem(
      ctx.tx,
      rows,
      (row): ItemKey => ({ sourceTable: 'wp_posts', sourceId: row.legacyId }),
      async (row, tx) => {
        const parsed = parseFormPost(row.rawContent); // JSON/campo sconosciuto: lancia qui, isolato sul solo form

        const existingId = await ctx.ids.find(tx, 'wp_posts', row.legacyId, 'form');
        const [written] = await tx
          .insert(schema.forms)
          .values({
            id: existingId ?? undefined,
            slug: row.slug,
            title: parsed.title || row.postTitle,
            definition: {
              fields: parsed.fields,
              submitText: parsed.submitText,
              submitTextProcessing: parsed.submitTextProcessing,
              payment: parsed.payment,
            },
            confirmationMessage: parsed.confirmationMessage,
            requiresPayment: parsed.requiresPayment,
            legacyId: row.legacyId,
          })
          .onConflictDoUpdate({
            target: schema.forms.id,
            set: {
              slug: row.slug,
              title: parsed.title || row.postTitle,
              definition: {
                fields: parsed.fields,
                submitText: parsed.submitText,
                submitTextProcessing: parsed.submitTextProcessing,
                payment: parsed.payment,
              },
              confirmationMessage: parsed.confirmationMessage,
              requiresPayment: parsed.requiresPayment,
              legacyId: row.legacyId,
              updatedAt: new Date(),
            },
          })
          .returning({ id: schema.forms.id });
        if (!written) throw new Error('inserimento di forms non ha restituito una riga');

        await ctx.ids.remember(
          tx,
          'wp_posts',
          row.legacyId,
          'form',
          written.id,
          ctx.mode === 'apply' ? ctx.runId : null,
          existingId ? 'updated' : 'created',
        );

        // Notifiche. Non hanno una voce propria in `import_id_map`, ma hanno
        // un identificatore proprio, e **`position` è la loro chiave naturale
        // dentro il form**: è progressiva e deterministica, assegnata dal
        // lettore della sorgente.
        //
        // Si aggiornano quindi sul posto per posizione, invece di cancellarle
        // e reinserirle. Cancellarle e reinserirle — come si fa con
        // `document_terms`, che ha una chiave composta e nessun identificatore
        // proprio — qui rigenererebbe 39 UUID a ogni esecuzione: la seconda
        // esecuzione produrrebbe uno stato diverso dalla prima a parità di
        // contenuto, che è esattamente ciò che `importer-spec.md` §6.1 vieta
        // («gli identificatori non si riassegnano mai»). Misurato in `1D-W5c`
        // dal confronto fra due `apply` (`IMPORTER-DESIGN.md` §11.14).
        const esistenti = await tx
          .select({ id: schema.formNotifications.id, position: schema.formNotifications.position })
          .from(schema.formNotifications)
          .where(eq(schema.formNotifications.formId, written.id));
        const perPosizione = new Map(esistenti.map((n) => [n.position, n.id]));

        for (const notification of parsed.notifications) {
          const valori = {
            formId: written.id,
            name: notification.name,
            recipients: notification.recipients,
            subject: notification.subject,
            senderName: notification.senderName,
            replyTo: notification.replyTo,
            body: notification.body,
            isActive: notification.isActive,
            position: notification.position,
          };
          const esistente = perPosizione.get(notification.position);
          if (esistente) {
            await tx
              .update(schema.formNotifications)
              .set(valori)
              .where(eq(schema.formNotifications.id, esistente));
            perPosizione.delete(notification.position);
          } else {
            await tx.insert(schema.formNotifications).values(valori);
          }
        }

        // Le posizioni che la sorgente non ha più: la notifica è stata tolta.
        for (const id of perPosizione.values()) {
          await tx.delete(schema.formNotifications).where(eq(schema.formNotifications.id, id));
        }

        return existingId ? 'updated' : 'created';
      },
      recordError,
    );

    const diviSource = await loadDiviForms(ctx);
    for (const issue of diviSource.issues) {
      await ctx.issues.record({
        severity: 'warning',
        stage: 'forms',
        code: issue.code,
        sourceTable: 'wp_posts',
        sourceId: issue.postId,
        detail: null,
      });
    }
    const divi = await forEachItem(
      ctx.tx,
      diviSource.forms,
      (form): ItemKey => ({ sourceTable: DIVI_SOURCE, sourceId: form.postId }),
      (form, tx) => writeDiviForm(ctx, tx, form),
      recordError,
    );

    return {
      created: wpforms.created + divi.created,
      updated: wpforms.updated + divi.updated,
      skipped: wpforms.skipped + divi.skipped,
      errors: wpforms.errors + divi.errors,
    };
  },
};
