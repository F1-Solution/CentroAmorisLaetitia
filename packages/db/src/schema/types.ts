import { customType } from 'drizzle-orm/pg-core';

/**
 * Tipi di PostgreSQL che Drizzle non conosce di serie ma che lo schema
 * canonico di 1B-W2 usa davvero.
 */

/** Testo senza distinzione fra maiuscole e minuscole. Usato per le email. */
export const citext = customType<{ data: string; driverData: string }>({
  dataType: () => 'citext',
});

/** Sequenza di byte. Usata per digest e impronte, mai per dati in chiaro. */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/** Vettore di ricerca full-text. Sempre colonna generata, mai scritta a mano. */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
});
