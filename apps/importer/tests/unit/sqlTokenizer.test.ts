import { describe, expect, it } from 'vitest';
import { parseDump } from '../../src/source/sql/tokenizer.js';
import { parseQuotedString } from '../../src/source/sql/scanner.js';
import { buildSyntheticDump, DEFAULT_POSTS } from '../fixtures/builder/buildDump.js';
import { EXPECTED_TABLES } from '../../src/preflight/constants.js';

describe('tokenizzatore del dump SQL — dump sintetico completo', () => {
  const dump = parseDump(buildSyntheticDump());

  it('legge tutte le 53 tabelle attese', () => {
    expect(dump.tables.size).toBe(53);
    for (const table of EXPECTED_TABLES) {
      expect(dump.tables.has(table)).toBe(true);
    }
  });

  it('legge un INSERT esteso multi-riga per wp_posts', () => {
    const rows = dump.rows.get('wp_posts');
    expect(rows).toHaveLength(DEFAULT_POSTS.length);
  });

  it('decodifica correttamente apici raddoppiati, barre e accenti, tornando esattamente al valore di partenza', () => {
    const rows = dump.rows.get('wp_posts')!;
    const first = rows[0]!;
    expect(first['post_title']).toBe("L'arte del colloquio");
    expect(first['post_content']).toBe(DEFAULT_POSTS[0]!.post_content);
    expect(first['post_content']).toContain("l''apostrofo raddoppiato");
    expect(first['post_content']).toContain('una \\barra\\');
    expect(first['post_content']).toContain('un a-capo\ne un accento città');
    expect(first['post_content']).toContain('🎉');
  });

  it('legge NULL come null, non come la stringa "NULL"', () => {
    const rows = dump.rows.get('wp_postmeta')!;
    const withNull = rows.find((r) => r['meta_key'] === '_thumbnail_id');
    expect(withNull?.['meta_value']).toBeNull();
  });

  it('legge le colonne esplicite dell’INSERT, non l’ordine del CREATE TABLE', () => {
    const rows = dump.rows.get('wp_postmeta')!;
    expect(rows.every((r) => typeof r['meta_key'] === 'string')).toBe(true);
  });

  it('non perde righe: il conteggio coincide con quello scritto nel costruttore', () => {
    expect(dump.rows.get('wp_posts')).toHaveLength(2);
    expect(dump.rows.get('wp_postmeta')).toHaveLength(3);
  });
});

describe('tokenizzatore del dump SQL — ogni sequenza di escape del §3.6', () => {
  function dumpWithValue(rawSqlStringLiteral: string): string {
    return [
      'CREATE TABLE `wp_prova` (\n  `id` bigint,\n  `v` text,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB;',
      `INSERT INTO \`wp_prova\` (\`id\`,\`v\`) VALUES (1,${rawSqlStringLiteral});`,
    ].join('\n\n');
  }

  it.each([
    ["'\\0'", '\0'],
    ["'\\''", "'"],
    ["''''", "'"], // apice raddoppiato
    ["'\\\"'", '"'],
    ["'\\b'", '\b'],
    ["'\\n'", '\n'],
    ["'\\r'", '\r'],
    ["'\\t'", '\t'],
    ["'\\Z'", '\x1a'],
    ["'\\\\'", '\\'],
    ["'\\%'", '\\%'],
    ["'\\_'", '\\_'],
    ["'stringa vuota'", 'stringa vuota'],
    ["''", ''],
    ["'città'", 'città'],
    ["'🎉'", '🎉'],
  ])('la sequenza %s decodifica in %j', (literal, expected) => {
    const dump = parseDump(dumpWithValue(literal));
    const rows = dump.rows.get('wp_prova')!;
    expect(rows[0]!['v']).toBe(expected);
  });

  it('un letterale esadecimale si conserva come testo, senza interpretarlo', () => {
    const dump = parseDump(
      [
        'CREATE TABLE `wp_prova` (\n  `id` bigint,\n  `v` text,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB;',
        'INSERT INTO `wp_prova` (`id`,`v`) VALUES (1,0x48656C6C6F);',
      ].join('\n\n'),
    );
    const rows = dump.rows.get('wp_prova')!;
    expect(rows[0]!['v']).toBe('0x48656C6C6F');
  });

  it('scarta correttamente commenti e direttive condizionali', () => {
    const dump = parseDump(
      [
        '-- commento di intestazione',
        '/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;',
        'LOCK TABLES `wp_prova` WRITE;',
        'CREATE TABLE `wp_prova` (\n  `id` bigint,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB;',
        'UNLOCK TABLES;',
      ].join('\n\n'),
    );
    expect(dump.tables.has('wp_prova')).toBe(true);
  });
});

describe('lettura diretta di una stringa fra apici (scanner)', () => {
  it('si ferma alla posizione giusta e restituisce il valore atteso', () => {
    const text = "'ciao \\'mondo\\''resto";
    const [value, next] = parseQuotedString(text, 0);
    expect(value).toBe("ciao 'mondo'");
    expect(text.slice(next)).toBe('resto');
  });
});
