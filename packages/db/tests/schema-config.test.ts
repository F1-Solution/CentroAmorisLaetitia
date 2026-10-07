import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { getTableName, is } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import * as schema from '../src/schema/index.js';

/**
 * Integrità della **dichiarazione** dello schema, senza database.
 *
 * Drizzle costruisce indici, chiavi uniche e chiavi esterne solo quando qualcuno
 * chiede la configurazione della tabella: una chiave esterna verso una tabella
 * sbagliata, o un vincolo dimenticato, resta invisibile finché una migrazione
 * non lo genera. Qui la configurazione si costruisce per ogni tabella, e si
 * verifica che ogni chiave esterna punti a una tabella dello schema e che i
 * vincoli unici su cui il codice fa affidamento ci siano.
 */

const tables = Object.values(schema).filter((value): value is PgTable => is(value, PgTable));
const tableNames = new Set(tables.map((table) => getTableName(table)));

describe('configurazione delle tabelle', () => {
  it('lo schema dichiara tabelle, e ognuna costruisce la propria configurazione', () => {
    expect(tables.length).toBeGreaterThan(20);
    for (const table of tables) {
      expect(() => getTableConfig(table), getTableName(table)).not.toThrow();
    }
  });

  it('ogni chiave esterna punta a una tabella dello schema', () => {
    for (const table of tables) {
      for (const foreignKey of getTableConfig(table).foreignKeys) {
        const target = getTableName(foreignKey.reference().foreignTable);
        expect(tableNames.has(target), `${getTableName(table)} → ${target}`).toBe(true);
      }
    }
  });

  it('i vincoli unici su cui il codice fa affidamento sono dichiarati', () => {
    const unique = new Set(
      tables.flatMap((table) => getTableConfig(table).uniqueConstraints.map((u) => u.getName())),
    );
    // L'accesso cerca la persona per indirizzo; l'importer ritrova form e
    // allegati per chiave della sorgente; la verifica dei media si fida della
    // chiave di archiviazione.
    for (const name of [
      'users_email_unique',
      'forms_slug_unique',
      'forms_legacy_id_unique',
      'media_storage_key_unique',
      'media_variants_public_path_unique',
    ]) {
      expect(unique.has(name), name).toBe(true);
    }
  });
});
