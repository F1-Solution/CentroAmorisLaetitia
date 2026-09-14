import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { submissionOrigin } from './enums.js';
import { bytea } from './types.js';

/**
 * Form. ADR-010: i form sono dati, non codice, così che il form builder della
 * fase gestionale scriva nella stessa tabella.
 */

export const forms = pgTable(
  'forms',
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull(),
    title: text().notNull(),
    /** Campi, etichette, obbligatorietà, ordine. */
    definition: jsonb().notNull(),
    confirmationMessage: text(),
    isActive: boolean().notNull().default(true),
    /**
     * Vero se la definizione contiene un campo di pagamento. Impedisce di
     * pubblicare un form che appaia funzionante senza esserlo: DR-039 ha scelto
     * la raccolta più rimando al pagamento, non la parità piena.
     */
    requiresPayment: boolean().notNull().default(false),
    legacyId: bigint({ mode: 'number' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('forms_slug_unique').on(t.slug), unique('forms_legacy_id_unique').on(t.legacyId)],
);

export const formNotifications = pgTable(
  'form_notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    formId: uuid()
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Destinatari, anche con segnaposto. */
    recipients: text().notNull(),
    subject: text().notNull(),
    senderName: text(),
    replyTo: text(),
    body: text().notNull(),
    isActive: boolean().notNull().default(true),
    position: integer().notNull().default(0),
  },
  (t) => [index('form_notifications_form_idx').on(t.formId, t.position)],
);

/**
 * DATI PERSONALI. 425 righe importate per DR-026. Rischio R-04, verifica legale
 * MI-06 obbligatoria prima della produzione. Nessuna riga di questa tabella
 * compare in documentazione, log, screenshot, fixture o Git (DR-010).
 */
export const formSubmissions = pgTable(
  'form_submissions',
  {
    id: uuid().primaryKey().defaultRandom(),
    formId: uuid()
      .notNull()
      .references(() => forms.id, { onDelete: 'restrict' }),
    submittedAt: timestamp({ withTimezone: true }).notNull(),
    origin: submissionOrigin().notNull(),
    payload: jsonb().notNull(),
    /** Mai l'indirizzo in chiaro. */
    ipHash: bytea(),
    userAgent: text(),
    notifiedAt: timestamp({ withTimezone: true }),
    notificationError: text(),
    legacyId: bigint({ mode: 'number' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('form_submissions_legacy_unique').on(t.legacyId),
    index('form_submissions_form_idx').on(t.formId, t.submittedAt.desc().nullsFirst()),
  ],
);
